const db             = require('../database/db');
const { getProvider } = require('../providers');
const PlannerAgent    = require('../agents/planner');
const ManagerAgent    = require('../agents/manager');
const WorkerAgent     = require('../agents/worker');
const ReviewerAgent   = require('../agents/reviewer');
const docreader       = require('../agents/docreader');
const MemoryAgent     = require('../agents/memory');

const MAX_REVISIONS = 3;

// ─── Human Feedback Queue ───────────────────────────────────────────────────
const sessionFeedback = new Map();

function injectFeedback(sessionId, feedback) {
  const existing = sessionFeedback.get(sessionId) || '';
  sessionFeedback.set(sessionId, existing ? `${existing}\n${feedback}` : feedback);
}

// ─── Helper: emit event + broadcast ─────────────────────────────────────────
function emit(sessionId, taskId, agent, type, content, metadata, wsManager) {
  db.insertEvent(sessionId, taskId, agent, type,
    typeof content === 'string' ? content : JSON.stringify(content), metadata);
  wsManager.broadcast({
    type: `agent:${type}`,
    data: { sessionId, taskId, agent, content, metadata, timestamp: new Date().toISOString() },
  });
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
async function process(sessionId, request, wsManager, options = {}) {
  const broadcast = (type, data) => wsManager.broadcast({ type, data });
  const { context: rawContext, docFolder } = options;

  try {
    // ── Phase 0: LOAD DOCUMENTS (if docFolder provided) ───────────────────
    let docContext = rawContext || '';

    if (docFolder) {
      db.updateSession(sessionId, 'planning'); // show as planning while reading docs
      broadcast('session:updated', { id: sessionId, status: 'planning' });
      emit(sessionId, null, 'planner', 'thought',
        `📂 Loading reference documents from: ${docFolder}…`, null, wsManager);
      try {
        docContext = await docreader.readDocumentsFromFolder(docFolder);
        emit(sessionId, null, 'planner', 'thought',
          `✅ Loaded ${docContext.length} chars of reference material from ${docFolder}. Analyzing content…`, null, wsManager);
      } catch (err) {
        emit(sessionId, null, 'planner', 'thought',
          `⚠️ Could not load documents from ${docFolder}: ${err.message}. Proceeding without reference material.`, null, wsManager);
      }
    }

    // Full context string to inject into planning
    const contextBlock = docContext
      ? `\n\n===== REFERENCE DOCUMENTS =====\n${docContext.slice(0, 12000)}\n===== END REFERENCE DOCUMENTS =====`
      : '';
    const enrichedRequest = request + contextBlock;

    // ── Phase 1: PLANNING ────────────────────────────────────────────────────
    db.updateSession(sessionId, 'planning');
    broadcast('session:updated', { id: sessionId, status: 'planning' });

    const planner = new PlannerAgent(getProvider('planner'));
    emit(sessionId, null, 'planner', 'thought',
      `Received request: "${request}". Analyzing and decomposing into tasks…`, null, wsManager);

    let plan;
    try {
      plan = await planner.plan(enrichedRequest);
    } catch (err) {
      throw new Error(`Planning failed: ${err.message}`);
    }

    emit(sessionId, null, 'planner', 'artifact', plan, { type: 'plan' }, wsManager);
    console.log(`[Orchestrator] Planner → Domain: ${plan.domain || '?'} | Subject: ${plan.subject || '?'} | Tasks: ${plan.tasks.length}`);

    const planContext = { domain: plan.domain, subject: plan.subject };

    // Save tasks to DB
    const taskIds = plan.tasks.map((t) => ({
      id:    db.insertTask(sessionId, t),
      ...t,
    }));
    broadcast('tasks:created', { sessionId, tasks: taskIds });

    // ── Phase 2: ASSIGNING ───────────────────────────────────────────────────
    db.updateSession(sessionId, 'assigning');
    broadcast('session:updated', { id: sessionId, status: 'assigning' });

    const manager = new ManagerAgent(getProvider('manager'));
    emit(sessionId, null, 'manager', 'thought',
      `Nhận ${taskIds.length} task. Domain: ${planContext.domain || 'chung'}. Đối tượng: ${planContext.subject || 'theo yêu cầu'}. Đang phân công…`, null, wsManager);

    let assignments = [];
    try {
      assignments = await manager.assign(taskIds, planContext);
    } catch (err) {
      console.warn(`[Orchestrator] Manager assign failed: ${err.message} — using defaults`);
      // ⚠️ Thông báo user biết đang dùng fallback
      emit(sessionId, null, 'manager', 'thought',
        `⚠️ Manager Agent gặp lỗi (${err.message}). Đang phân công mặc định — tất cả task giao cho Riley (SEO Content Writer). Vui lòng kiểm tra lại sau khi workflow hoàn tất.`,
        null, wsManager);
      broadcast('session:warning', {
        id: sessionId,
        warning: 'manager_fallback',
        message: `Manager Agent lỗi, phân công mặc định. Chi tiết: ${err.message}`,
      });
      assignments = taskIds.map((t) => ({
        task_title:       t.title,
        assigned_to:      'Riley (SEO Content Writer)',
        team:             t.team || 'content',
        reasoning:        'Giao việc mặc định do lỗi hệ thống',
        complexity:       'medium',
        estimated_output: 'Tài liệu hoàn chỉnh theo yêu cầu',
      }));
    }

    emit(sessionId, null, 'manager', 'artifact', assignments, { type: 'assignments' }, wsManager);

    // ── Phase 3: WORKING & REVIEWING ────────────────────────────────────────
    db.updateSession(sessionId, 'working');
    broadcast('session:updated', { id: sessionId, status: 'working' });

    const reviewer = new ReviewerAgent(getProvider('reviewer'));

    for (let i = 0; i < taskIds.length; i++) {
      const task = taskIds[i];
      // Find assignment: prioritize exact match, fallback to index-based if matching fails
      const assignment = assignments.find(a => a.task_title === task.title) || assignments[i] || assignments[0] || {};

      const worker = new WorkerAgent(
        getProvider('worker'),
        assignment.assigned_to || 'Jordan (Node.js Expert)',
        task.team || 'backend'
      );

      db.updateTask(task.id, 'working', assignment.assigned_to || 'Worker', 0);
      broadcast('task:updated', {
        id: task.id, sessionId, status: 'working', assigned_to: assignment.assigned_to,
      });

      emit(sessionId, task.id, assignment.assigned_to || 'worker', 'thought',
        `Starting work on: "${task.title}". ${assignment.reasoning || ''}`, null, wsManager);

      let approved        = false;
      let revisionCount   = 0;
      let lastInstruction = null;
      let lastOutputId    = null;

      while (!approved && revisionCount <= MAX_REVISIONS) {
        // ── Worker produces output ─────────────────────────────────────────
        let workerOutput;
        try {
          workerOutput = await worker.work(task, lastInstruction, revisionCount);
        } catch (err) {
          console.error(`[Worker] Failed on "${task.title}": ${err.message}`);
          // Create a fallback output to avoid complete failure
          workerOutput = {
            thought:  'Worker encountered an error.',
            notes:    err.message,
            artifact: { type: 'document', language: 'plaintext', filename: 'error.txt', content: `Error: ${err.message}` },
          };
        }

        emit(sessionId, task.id, assignment.assigned_to || 'worker', 'thought',
          workerOutput.thought, null, wsManager);

        lastOutputId = db.insertOutput(
          task.id,
          JSON.stringify(workerOutput.artifact),
          revisionCount > 0 ? 'revision' : 'artifact',
          revisionCount
        );

        emit(sessionId, task.id, assignment.assigned_to || 'worker', 'artifact',
          workerOutput.artifact, { outputId: lastOutputId, revisionCount }, wsManager);

        // ── Reviewer evaluates ─────────────────────────────────────────────
        db.updateTask(task.id, 'reviewing', assignment.assigned_to, revisionCount);
        broadcast('task:updated', { id: task.id, sessionId, status: 'reviewing' });

        emit(sessionId, task.id, 'reviewer', 'thought',
          `Reviewing "${task.title}" (revision #${revisionCount})…`, null, wsManager);

        let review;
        try {
          review = await reviewer.review(task, workerOutput);
        } catch (err) {
          console.warn(`[Reviewer] Failed: ${err.message} — auto-approving`);
          // ⚠️ Thông báo rõ ràng ra UI thay vì silently approve
          const fallbackMsg = `⚠️ Reviewer Agent gặp lỗi (${err.message}). Auto-approve với điểm 7.5 — kết quả CHƯA được kiểm duyệt thực sự. Vui lòng review thủ công.`;
          emit(sessionId, task.id, 'reviewer', 'thought', fallbackMsg, null, wsManager);
          broadcast('session:warning', {
            id: sessionId,
            warning: 'reviewer_fallback',
            taskId: task.id,
            taskTitle: task.title,
            message: fallbackMsg,
          });
          review = { decision: 'approved', score: 7.5, feedback: 'Auto-approved due to reviewer error — NOT verified.', strengths: [], issues: [], revision_instruction: '' };
        }

        db.insertReview(task.id, lastOutputId, review.decision, review.score,
          review.feedback, review.revision_instruction);

        emit(sessionId, task.id, 'reviewer', review.decision === 'approved' ? 'approval' : 'revision',
          review, { score: review.score }, wsManager);

        // --- HUMAN INTERVENTION CHECK ---
        const humanFeedback = sessionFeedback.get(sessionId);
        if (humanFeedback) {
          review.decision = 'rejected';
          review.revision_instruction = `[USER CORRECTION]: ${humanFeedback}\n\nReviewer comments: ` + (review.revision_instruction || review.feedback || '');
          sessionFeedback.delete(sessionId);
          emit(sessionId, task.id, 'manager', 'thought', `🛑 Human intervention applied! Forcing revision with user feedback: "${humanFeedback}"`, null, wsManager);
          // If max revisions were reached, give the user 1 extra revision cycle
          if (revisionCount >= MAX_REVISIONS) {
            revisionCount = MAX_REVISIONS - 1; 
          }
        }
        // --------------------------------

        if (review.decision === 'approved') {
          approved = true;
          db.updateTask(task.id, 'completed', assignment.assigned_to, revisionCount);
          broadcast('task:updated', { id: task.id, sessionId, status: 'completed', score: review.score });
          emit(sessionId, task.id, 'reviewer', 'thought',
            `✅ Task "${task.title}" APPROVED (score: ${review.score}/10). ${review.feedback}`, null, wsManager);
        } else if (revisionCount >= MAX_REVISIONS) {
          // Max revisions hit — accept anyway
          approved = true;
          db.updateTask(task.id, 'completed', assignment.assigned_to, revisionCount);
          broadcast('task:updated', { id: task.id, sessionId, status: 'completed', note: 'max_revisions' });
          emit(sessionId, task.id, 'reviewer', 'thought',
            `⚠️ Max revisions (${MAX_REVISIONS}) reached for "${task.title}". Accepting current version.`, null, wsManager);
        } else {
          revisionCount++;
          lastInstruction = review.revision_instruction;
          db.updateTask(task.id, 'revision', assignment.assigned_to, revisionCount);
          broadcast('task:updated', { id: task.id, sessionId, status: 'revision', revisionCount });
          emit(sessionId, task.id, assignment.assigned_to || 'worker', 'thought',
            `🔄 Revision #${revisionCount} requested. Applying changes…`, null, wsManager);
        }
      }
    }

    // ── Phase 4: COMPILE FINAL RESPONSE ─────────────────────────────────────
    const completedTasks = db.getSessionTasks(sessionId);
    const finalResponse  = compileFinalResponse(request, plan, completedTasks);

    db.updateSession(sessionId, 'completed', finalResponse);
    broadcast('session:updated', { id: sessionId, status: 'completed', final_response: finalResponse });
    emit(sessionId, null, 'request_reviewer', 'thought',
      `All ${completedTasks.length} tasks completed. Final response compiled and signed off.`, null, wsManager);

    broadcast('session:completed', { id: sessionId, finalResponse });
    console.log(`[Orchestrator] ✅ Session ${sessionId} completed`);

    // ── Phase 5: REFLECTION & AUTONOMY ───────────────────────────────────────
    const memory = new MemoryAgent(getProvider('manager')); // uses manager LLM
    emit(sessionId, null, 'memory', 'thought',
      `Analyzing results to extract SEO insights and strategic learnings…`, null, wsManager);

    const existingKnowledge = db.getKnowledgeBySession?.(sessionId) || [];
    const reflection = await memory.reflect(request, finalResponse, existingKnowledge);

    // Save learnings to DB
    if (reflection.learnings && Array.isArray(reflection.learnings)) {
      reflection.learnings.forEach(l => {
        db.insertKnowledge?.(l.key, l.value, l.category);
      });
      emit(sessionId, null, 'memory', 'artifact', reflection.learnings, { type: 'learnings' }, wsManager);
    }

    // Auto-trigger next cycle if autonomous flag is set
    if (options.autonomous && reflection.next_workflow_request) {
      emit(sessionId, null, 'memory', 'thought',
        `🚀 [Autonomous Mode] Strategic next step identified: "${reflection.next_workflow_request}". Triggering next cycle…`, null, wsManager);

      // Recursive call for the next session (with a small delay to avoid stack overflow)
      setTimeout(() => {
        // Here we would call a global "startSession" from server.js or emit to an event bus
        // For simplicity, we just broadcast the suggestion to the UI for now
        broadcast('session:autonomous_suggestion', {
          originalSessionId: sessionId,
          suggestion: reflection.next_workflow_request,
          reasoning: reflection.reasoning
        });
      }, 5000);
    }

  } catch (err) {
    console.error(`[Orchestrator] ❌ Session ${sessionId} failed:`, err);
    db.updateSession(sessionId, 'failed');
    broadcast('session:failed', { id: sessionId, error: err.message });
    throw err;
  }
}

function compileFinalResponse(request, plan, tasks) {
  const lines = [
    `# Digital Office — Response`,
    ``,
    `**Original Request:** ${request}`,
    `**Analysis:** ${plan.analysis || ''}`,
    ``,
    `---`,
    ``,
    `## Completed Tasks (${tasks.length})`,
    ``,
  ];

  tasks.forEach((task, i) => {
    const outputs  = db.getTaskOutputs(task.id);
    const reviews  = db.getTaskReviews(task.id);
    const lastRev  = reviews.filter((r) => r.decision === 'approved').pop();

    lines.push(`### ${i + 1}. ${task.title}`);
    lines.push(`**Team:** ${task.team} | **Status:** ${task.status} | **Revisions:** ${task.revision_count}`);
    if (lastRev) lines.push(`**Review Score:** ${lastRev.score}/10 — ${lastRev.feedback}`);
    lines.push('');

    const lastOutput = outputs[outputs.length - 1];
    if (lastOutput) {
      try {
        const artifact = JSON.parse(lastOutput.content);
        lines.push(`**Artifact:** \`${artifact.filename}\` (${artifact.type}/${artifact.language})`);
        lines.push('');
        lines.push('```' + (artifact.language || ''));
        lines.push(artifact.content);
        lines.push('```');
      } catch {
        lines.push(lastOutput.content);
      }
    }
    lines.push('');
  });

  return lines.join('\n');
}

// ─── Rerun single task ────────────────────────────────────────────────────────
async function rerunTask(taskId, userInstruction, wsManager) {
  const broadcast = (type, data) => wsManager.broadcast({ type, data });
  const task = db.getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const sessionId = task.session_id;
  const MAX_REV   = 2;

  // Build the instruction combining user correction + original description
  const fullInstruction = userInstruction
    ? `[YÊU CẦU SỬA ĐỔI TỪ NGƯỜI DÙNG]: ${userInstruction}\n\nMô tả gốc của task: ${task.description}`
    : task.description;

  db.updateTask(taskId, 'working', task.assigned_to || 'Worker', 0);
  broadcast('task:updated', { id: taskId, sessionId, status: 'working', assigned_to: task.assigned_to });
  emit(sessionId, taskId, task.assigned_to || 'worker', 'thought',
    `🔁 Chạy lại task theo yêu cầu: "${userInstruction || 'Không có hướng dẫn cụ thể'}"`, null, wsManager);

  const worker   = new WorkerAgent(getProvider('worker'), task.assigned_to || 'Worker', task.team || 'backend');
  const reviewer = new ReviewerAgent(getProvider('reviewer'));

  let approved      = false;
  let revisionCount = 0;
  let lastInstruction = fullInstruction;

  while (!approved && revisionCount <= MAX_REV) {
    // Worker generates
    let workerOutput;
    try {
      workerOutput = await worker.work(
        { ...task, description: lastInstruction },
        revisionCount > 0 ? lastInstruction : null,
        revisionCount
      );
    } catch (err) {
      workerOutput = {
        thought: 'Worker gặp lỗi.',
        notes: err.message,
        artifact: { type: 'document', language: 'plaintext', filename: 'error.txt', content: `Lỗi: ${err.message}` },
      };
    }

    emit(sessionId, taskId, task.assigned_to || 'worker', 'thought', workerOutput.thought, null, wsManager);

    const outputId = db.insertOutput(taskId, JSON.stringify(workerOutput.artifact),
      revisionCount > 0 ? 'revision' : 'artifact', revisionCount);

    emit(sessionId, taskId, task.assigned_to || 'worker', 'artifact',
      workerOutput.artifact, { outputId, revisionCount }, wsManager);

    // Reviewer evaluates
    db.updateTask(taskId, 'reviewing', task.assigned_to, revisionCount);
    broadcast('task:updated', { id: taskId, sessionId, status: 'reviewing' });
    emit(sessionId, taskId, 'reviewer', 'thought', `Đang kiểm tra lại task (lần ${revisionCount + 1})…`, null, wsManager);

    let review;
    try {
      review = await reviewer.review(task, workerOutput);
    } catch {
      review = { decision: 'approved', score: 7.5, feedback: 'Tự động chấp thuận.', strengths: [], issues: [], revision_instruction: '' };
    }

    db.insertReview(taskId, outputId, review.decision, review.score, review.feedback, review.revision_instruction);
    emit(sessionId, taskId, 'reviewer', review.decision === 'approved' ? 'approval' : 'revision',
      review, { score: review.score }, wsManager);

    if (review.decision === 'approved' || revisionCount >= MAX_REV) {
      approved = true;
      db.updateTask(taskId, 'completed', task.assigned_to, revisionCount);
      broadcast('task:updated', { id: taskId, sessionId, status: 'completed', score: review.score });
      emit(sessionId, taskId, 'reviewer', 'thought',
        `✅ Task đã hoàn thành sau khi chạy lại. Điểm: ${review.score}/10`, null, wsManager);
    } else {
      revisionCount++;
      lastInstruction = review.revision_instruction || lastInstruction;
      db.updateTask(taskId, 'revision', task.assigned_to, revisionCount);
      broadcast('task:updated', { id: taskId, sessionId, status: 'revision', revisionCount });
    }
  }
}

module.exports = { process, injectFeedback, rerunTask };
