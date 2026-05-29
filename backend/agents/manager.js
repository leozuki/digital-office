const fs   = require('fs');
const path = require('path');
const { extractJSON } = require('./utils');

const TEAMS_FILE  = path.join(__dirname, '..', 'config', 'teams.json');
const AGENTS_FILE = path.join(__dirname, '..', 'config', 'agents.json');

function loadTeams() {
  try { return JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8')); }
  catch {
    return [
      { id:'frontend', name:'Frontend Team', members:[{ name:'Alex', role:'React Specialist' }, { name:'Sam', role:'CSS & Animations' }], skills:[], description:'Phát triển giao diện web', instructions:'' },
      { id:'backend',  name:'Backend Team',  members:[{ name:'Jordan', role:'Node.js Expert' }, { name:'Casey', role:'Database Architect' }], skills:[], description:'Lập trình server, API, database', instructions:'' },
      { id:'content',  name:'Content Team',  members:[{ name:'Riley', role:'SEO Content Writer' }, { name:'Morgan', role:'Marketing Copywriter' }], skills:[], description:'Viết bài SEO, marketing, chiến lược nội dung', instructions:'' },
      { id:'design',   name:'Design Team',   members:[{ name:'Quinn', role:'UI/UX Designer' }, { name:'Drew', role:'Brand Designer' }], skills:[], description:'Thiết kế UI/UX, đồ họa, brand', instructions:'' },
      { id:'qa',       name:'QA Team',       members:[{ name:'Taylor', role:'QA Engineer' }], skills:[], description:'Kiểm thử, phân tích, research', instructions:'' },
    ];
  }
}

function loadAgentConfig(role) {
  try {
    const cfg = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    return cfg[role] || {};
  } catch { return {}; }
}

function buildSystemPrompt(teams, taskDomain, taskSubject) {
  const agentCfg    = loadAgentConfig('manager');
  const activeTeams = teams.filter(t => t.active !== false);

  const teamRoster = activeTeams.map(team => {
    const memberList = (team.members || []).map(m => `    • ${m.name} (${m.role})`).join('\n');
    const skillTags  = (team.skills || []).join(', ');
    const desc       = team.description ? `\n  Chuyên môn: ${team.description}` : '';
    const instr      = team.instructions ? `\n  Quy tắc giao việc: ${team.instructions}` : '';
    return `▸ ${team.name} [ID: ${team.id}]${desc}${instr}\n  Kỹ năng: ${skillTags || 'Đa năng'}\n  Thành viên:\n${memberList}`;
  }).join('\n\n');

  const domainNote = taskDomain
    ? `\n⚠️  DOMAIN ĐÃ XÁC ĐỊNH: "${taskDomain.toUpperCase()}" — CHỈ giao task cho team phù hợp domain này.`
    : '';

  const subjectNote = taskSubject
    ? `\n⚠️  ĐỐI TƯỢNG DỰ ÁN: "${taskSubject}" — Worker phải làm việc cho ĐỐI TƯỢNG NÀY, không phải cho Digital Office.`
    : '';

  return `Bạn là Project Manager tại Digital Office.
Nhiệm vụ: Nhận danh sách task từ Planner và giao đúng người, đúng team, với chỉ dẫn đầu ra RẤT CỤ THỂ.
${domainNote}${subjectNote}

═══════════════════════════════════════════════════════
QUY TẮC GIAO VIỆC BẮT BUỘC
═══════════════════════════════════════════════════════

[1] KHÔNG THÊM TASK MỚI: Chỉ giao các task đã nhận từ Planner, không tự tạo thêm.

[2] ĐÚNG DOMAIN — ĐÚNG TEAM:
   • SEO / nội dung / marketing / viết bài → content team
   • Lập trình / API / server / database   → backend team  
   • Giao diện / React / CSS               → frontend team
   • Thiết kế / hình ảnh / brand           → design team
   • Kiểm thử / research / phân tích       → qa team
   KHÔNG giao task SEO cho design team, KHÔNG giao task viết bài cho backend team.

[3] estimated_output PHẢI RÕ RÀNG VÀ ĐỦ DỮ LIỆU:
   Phải nói rõ: định dạng tệp, nội dung cụ thể, tên dự án/sản phẩm liên quan.
   Ví dụ TỐT: "Tài liệu Markdown gồm 20 từ khóa SEO cho website bán giày ABC, bao gồm search volume ước tính, độ cạnh tranh, và mapping với URL"
   Ví dụ XẤU: "SEO keyword list" (quá chung chung)

[4] NGÔN NGỮ: Toàn bộ output PHẢI bằng Tiếng Việt.

[5] OUTPUT: Chỉ trả về JSON thuần.

Teams có thể giao việc:
${teamRoster}

Format JSON bắt buộc:
{
  "assignments": [
    {
      "task_title": "Tiêu đề task CHÍNH XÁC từ danh sách nhận được",
      "assigned_to": "Tên cụ thể của thành viên trong team",
      "team": "team-id",
      "reasoning": "Lý do chọn người này: kỹ năng phù hợp + phù hợp domain",
      "complexity": "low | medium | high",
      "estimated_output": "Mô tả CHI TIẾT về kết quả đầu ra: định dạng, nội dung, cho dự án nào"
    }
  ]
}`;
}

const managerSchema = {
  type: "OBJECT",
  properties: {
    assignments: {
      type: "ARRAY",
      description: "Danh sách các phân công công việc cụ thể cho từng task nhận được",
      items: {
        type: "OBJECT",
        properties: {
          task_title: {
            type: "STRING",
            description: "Tiêu đề task CHÍNH XÁC từ danh sách nhận được"
          },
          assigned_to: {
            type: "STRING",
            description: "Tên cụ thể của thành viên trong team"
          },
          team: {
            type: "STRING",
            description: "ID của team phụ trách task (ví dụ: content, backend, design, qa, frontend)"
          },
          reasoning: {
            type: "STRING",
            description: "Lý do chọn người này: kỹ năng phù hợp + phù hợp domain"
          },
          complexity: {
            type: "STRING",
            description: "Độ phức tạp: low | medium | high",
            enum: ["low", "medium", "high"]
          },
          estimated_output: {
            type: "STRING",
            description: "Mô tả CHI TIẾT kết quả đầu ra dự kiến: định dạng, nội dung, cho dự án nào"
          }
        },
        required: ["task_title", "assigned_to", "team", "reasoning", "complexity", "estimated_output"]
      }
    }
  },
  required: ["assignments"]
};

class ManagerAgent {
  constructor(provider) {
    this.provider = provider;
    this.role     = 'manager';
  }

  async assign(tasks, planContext = {}) {
    const teams = loadTeams();
    console.log(`[Manager] Assigning ${tasks.length} tasks using ${this.provider.name}… Domain: ${planContext.domain || 'unknown'}`);

    // Pass domain + subject context to system prompt
    const systemPrompt = buildSystemPrompt(teams, planContext.domain, planContext.subject);

    const taskList = tasks.map((t, i) =>
      `Task ${i + 1}:\n  Tiêu đề: ${t.title}\n  Team gợi ý: ${t.team}\n  Mô tả: ${t.description}\n  Đối tượng dự án: ${t.subject || planContext.subject || 'theo yêu cầu'}`
    ).join('\n\n');

    const prompt = `Danh sách task cần giao:

${taskList}

Giao mỗi task cho đúng thành viên phù hợp nhất. Đảm bảo estimated_output chi tiết và liên quan đến đúng đối tượng dự án.
Trả về JSON hợp lệ duy nhất.`;

    const agentCfg = loadAgentConfig('manager');
    const raw    = await this.provider.generate(systemPrompt, prompt, {
      temperature: agentCfg.temperature ?? 0.4,  // chặt hơn để không sáng tạo sai
      maxTokens:   agentCfg.maxTokens   ?? 3000,
      responseMimeType: "application/json",
      responseSchema: managerSchema,
    });
    
    let result;
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.warn('[Manager] JSON.parse failed, falling back to extractJSON:', e.message);
      result = extractJSON(raw);
    }

    if (!Array.isArray(result.assignments)) {
      throw new Error('[Manager] Invalid assignments response');
    }
    return result.assignments;
  }

  getTeamMembers() {
    const teams = loadTeams();
    const result = {};
    teams.filter(t => t.active !== false).forEach(team => {
      result[team.id] = (team.members || []).map(m => `${m.name} (${m.role})`);
    });
    return result;
  }
}

module.exports = ManagerAgent;
