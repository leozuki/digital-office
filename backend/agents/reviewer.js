const fs   = require('fs');
const path = require('path');
const { extractJSON } = require('./utils');

const AGENTS_FILE = path.join(__dirname, '..', 'config', 'agents.json');

function loadAgentConfig() {
  try { return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8')).reviewer || {}; }
  catch { return {}; }
}

function buildSystemPrompt(cfg) {
  const persona = cfg.persona || 'Senior Quality Reviewer';
  const tone    = cfg.tone    || 'constructive';
  const extra   = cfg.instructions || 'Be rigorous but fair. Approve if score >= 7.';
  const custom  = cfg.systemPromptOverride;
  if (custom?.trim()) return custom;

  return `You are the ${persona} at Digital Office.
Tone: ${tone}.
${extra}

IMPORTANT: All your text output (feedback, strengths, issues, revision_instruction) MUST BE WRITTEN IN VIETNAMESE (Tiếng Việt).

You MUST respond with valid JSON only.

Response format:
{
  "decision": "approved | rejected",
  "score": 8.5,
  "feedback": "Overall assessment of the work quality",
  "strengths": ["What was done excellently"],
  "issues": ["Specific issues — be precise and actionable"],
  "revision_instruction": "Step-by-step fix instructions for the worker (only if rejected)"
}

Scoring criteria:
- 9-10 : Exceptional, production-ready — approve immediately
- 7-8  : Good, minor improvements possible — approve
- 5-6  : Acceptable but has gaps — approve if minor, reject if functional issues
- 3-4  : Below standard, incomplete or broken — must reject
- 1-2  : Wrong approach or completely off-task — must reject

Rules:
- APPROVE if score >= 7 AND the artifact correctly addresses the task.
- REJECT only for functional gaps, errors, or clearly incomplete work.
- If rejecting, provide SPECIFIC revision_instruction — not vague feedback.
- Do not reject over style preferences alone.
- Always be professional and constructive.`;
}

const reviewerSchema = {
  type: "OBJECT",
  properties: {
    decision: {
      type: "STRING",
      description: "Quyết định phê duyệt: approved | rejected",
      enum: ["approved", "rejected"]
    },
    score: {
      type: "NUMBER",
      description: "Điểm đánh giá chất lượng (từ 1.0 đến 10.0)"
    },
    feedback: {
      type: "STRING",
      description: "Đánh giá tổng quan về chất lượng sản phẩm bằng tiếng Việt"
    },
    strengths: {
      type: "ARRAY",
      description: "Các điểm mạnh, điểm hoàn thành xuất sắc",
      items: { type: "STRING" }
    },
    issues: {
      type: "ARRAY",
      description: "Các vấn đề còn tồn đọng cần khắc phục",
      items: { type: "STRING" }
    },
    revision_instruction: {
      type: "STRING",
      description: "Hướng dẫn sửa lỗi chi tiết từng bước cho Worker (nếu rejected)"
    }
  },
  required: ["decision", "score", "feedback", "strengths", "issues", "revision_instruction"]
};

class ReviewerAgent {
  constructor(provider) {
    this.provider = provider;
    this.role     = 'reviewer';
  }

  async review(task, workerOutput) {
    const cfg = loadAgentConfig();
    const { artifact, thought, notes } = workerOutput;

    const prompt = `Task Being Reviewed:
Title: ${task.title}
Description: ${task.description}
${task.estimated_output ? `Expected output: ${task.estimated_output}` : ''}

Worker's Output:
---
Thought Process: ${thought}
Notes: ${notes}

Artifact Type: ${artifact.type} / ${artifact.language}
Filename: ${artifact.filename}
Content:
${artifact.content?.slice(0, 12000)}${(artifact.content?.length || 0) > 12000 ? '\n[... content truncated for review ...]' : ''}
---

Evaluate this output thoroughly. Does it fully satisfy the task? Return only valid JSON.`;

    console.log(`[Reviewer] Reviewing "${task.title}" using ${this.provider.name}…`);
    const raw    = await this.provider.generate(buildSystemPrompt(cfg), prompt, {
      temperature: cfg.temperature ?? 0.4,
      maxTokens:   cfg.maxTokens   ?? 2048,
      responseMimeType: "application/json",
      responseSchema: reviewerSchema,
    });
    
    let result;
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.warn('[Reviewer] JSON.parse failed, falling back to extractJSON:', e.message);
      result = extractJSON(raw);
    }

    result.decision             = result.decision || 'approved';
    result.score                = Number(result.score) || 7.0;
    result.feedback             = result.feedback || '';
    result.strengths            = result.strengths || [];
    result.issues               = result.issues    || [];
    result.revision_instruction = result.revision_instruction || '';

    return result;
  }
}

module.exports = ReviewerAgent;
