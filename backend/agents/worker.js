const fs   = require('fs');
const path = require('path');
const { extractJSON } = require('./utils');

const TEAMS_FILE  = path.join(__dirname, '..', 'config', 'teams.json');
const AGENTS_FILE = path.join(__dirname, '..', 'config', 'agents.json');

function loadTeamConfig(teamId) {
  try {
    const teams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
    return teams.find(t => t.id === teamId?.toLowerCase()) || null;
  } catch { return null; }
}

function loadAgentConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    return cfg.worker || {};
  } catch { return {}; }
}

function buildSystemPrompt(workerName, team, teamConfig, agentConfig) {
  const persona    = agentConfig.persona || 'Expert Specialist';
  const tone       = agentConfig.tone    || 'professional';
  const extraInstr = agentConfig.instructions || 'Tạo ra kết quả hoàn chỉnh, chất lượng cao, sẵn sàng sử dụng ngay.';
  const customSys  = agentConfig.systemPromptOverride;

  if (customSys && customSys.trim()) return customSys;

  // Team-specific context
  const teamDesc  = teamConfig?.description ? `\nChuyên môn team: ${teamConfig.description}` : '';
  const teamInstr = teamConfig?.instructions ? `\nQuy tắc đầu ra của team: ${teamConfig.instructions}` : '';
  const teamSkills= teamConfig?.skills?.length ? `\nKỹ năng: ${teamConfig.skills.join(', ')}` : '';

  return `Bạn là ${workerName}, ${persona} trong team ${team} tại Digital Office.
Giọng điệu: ${tone}.${teamDesc}${teamSkills}${teamInstr}

${extraInstr}

═══════════════════════════════════════════════════════
⚠️  LƯU Ý QUAN TRỌNG — ĐỌC TRƯỚC KHI LÀM VIỆC
═══════════════════════════════════════════════════════
• "Digital Office" là NỀN TẢNG bạn đang chạy trên đó, KHÔNG phải đối tượng của công việc.
• Công việc của bạn là thực hiện task CHO DỰ ÁN/SẢN PHẨM được nêu trong mô tả task.
• Đọc kỹ mô tả task: đối tượng là gì? dự án nào? lĩnh vực gì? → Tập trung vào đó.
• KHÔNG tự thêm phần nào liên quan đến Digital Office, UI/UX của tool này, hay tính năng của nền tảng này.
═══════════════════════════════════════════════════════

NGÔN NGỮ:
• Trừ code lập trình (Javascript, Python, v.v.) — giữ nguyên cú pháp tiếng Anh.
• TẤT CẢ nội dung text khác (thought, notes, tài liệu, nội dung bài viết) PHẢI bằng TIẾNG VIỆT.

Chỉ trả về JSON hợp lệ.

Format JSON bắt buộc:
{
  "thought": "Phân tích cách tiếp cận: đối tượng là gì, chiến lược thực hiện ra sao",
  "artifact": {
    "type": "code | document | design_spec | config | test",
    "language": "javascript | typescript | html | css | python | markdown | json | plaintext | etc",
    "filename": "ten_file_de_xuat.ext",
    "content": "Nội dung HOÀN CHỈNH — KHÔNG được cắt bớt, KHÔNG dùng placeholder, KHÔNG dùng '...'"
  },
  "notes": "Ghi chú triển khai, phụ thuộc, edge cases, hoặc gợi ý bước tiếp theo"
}

Quy tắc KHÔNG THƯƠNG LƯỢNG:
- Kết quả phải HOÀN CHỈNH 100%. Không 'xem phần trên', không '...', không TODO.
- Tất cả code phải chạy được ngay không cần chỉnh sửa.
- Tất cả tài liệu phải được viết đầy đủ, không chỉ outline/skeleton.
- Artifact phải sẵn sàng dùng ngay lập tức.`;
}

class WorkerAgent {
  constructor(provider, workerName, team) {
    this.provider   = provider;
    this.workerName = workerName || 'Worker';
    this.team       = team       || 'backend';
    this.role       = 'worker';
  }

  async work(task, revisionInstruction = null, revisionCount = 0) {
    const teamConfig  = loadTeamConfig(this.team);
    const agentConfig = loadAgentConfig();
    const systemPrompt = buildSystemPrompt(this.workerName, this.team, teamConfig, agentConfig);

    let prompt;
    if (revisionInstruction) {
      prompt = `REVISION #${revisionCount} — The reviewer has requested changes.

Original Task:
Title: ${task.title}
Description: ${task.description}
${task.estimated_output ? `Expected output: ${task.estimated_output}` : ''}

Reviewer's Revision Instructions:
${revisionInstruction}

Implement ALL requested changes. Return only valid JSON.`;
    } else {
      prompt = `Task Assignment:
Title: ${task.title}
Description: ${task.description}
Team: ${this.team}
${task.estimated_output ? `Expected Output: ${task.estimated_output}` : 'Expected Output: Complete, production-ready deliverable'}
${task.reasoning ? `Assignment reasoning: ${task.reasoning}` : ''}

Complete this task fully. Return only valid JSON.`;
    }

    console.log(`[Worker:${this.workerName}] Working on "${task.title}" (rev ${revisionCount}) using ${this.provider.name}…`);
    const raw = await this.provider.generate(systemPrompt, prompt, {
      maxTokens:   agentConfig.maxTokens   ?? 8192,
      temperature: agentConfig.temperature ?? 0.75,
    });
    const result = extractJSON(raw);

    if (!result.artifact || !result.artifact.content) {
      throw new Error(`[Worker] No artifact produced for task "${task.title}"`);
    }
    result.thought   = result.thought   || '';
    result.notes     = result.notes     || '';
    result.artifact.type     = result.artifact.type     || 'document';
    result.artifact.language = result.artifact.language || 'plaintext';
    result.artifact.filename = result.artifact.filename || 'output.txt';

    return result;
  }
}

module.exports = WorkerAgent;
