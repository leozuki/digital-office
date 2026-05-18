const fs   = require('fs');
const path = require('path');
const { extractJSON } = require('./utils');

const TEAMS_FILE  = path.join(__dirname, '..', 'config', 'teams.json');
const AGENTS_FILE = path.join(__dirname, '..', 'config', 'agents.json');

function loadActiveTeams() {
  try {
    return JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8')).filter(t => t.active !== false);
  } catch {
    return [
      { id:'content', name:'Content Team',  description:'Viết bài blog, SEO content, copywriting' },
      { id:'backend', name:'Backend Team',  description:'Lập trình, API, hệ thống' },
      { id:'design',  name:'Design Team',   description:'Thiết kế UI/UX, brand, visual' },
      { id:'qa',      name:'QA Team',       description:'Kiểm thử, review chất lượng' },
    ];
  }
}

function loadAgentConfig() {
  try { return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8')).planner || {}; }
  catch { return {}; }
}

function buildSystemPrompt(teams) {
  const cfg    = loadAgentConfig();
  const custom = cfg.systemPromptOverride;
  if (custom?.trim()) return custom;

  const teamList = teams.map(t => {
    const desc  = t.description ? ` — ${t.description}` : '';
    const instr = t.instructions ? ` [Quy tắc: ${t.instructions}]` : '';
    return `  • ${t.id} [${t.name}]${desc}${instr}`;
  }).join('\n');

  return `Bạn là Project Planner AI tại Digital Office — một nền tảng trợ lý AI đa tác nhân.
Nhiệm vụ DUY NHẤT của bạn là phân tích yêu cầu của người dùng và chia nhỏ thành các task CỤ THỂ cho đúng team.

═══════════════════════════════════════════════════════
QUY TẮC BẮT BUỘC — ĐỌC KỸ TRƯỚC KHI PHÂN TÍCH
═══════════════════════════════════════════════════════

[1] NHẬN DIỆN CHỦ THỂ:
   - "Digital Office" là CÔNG CỤ bạn đang dùng, KHÔNG phải đối tượng của yêu cầu.
   - Nếu người dùng nói "làm SEO cho dự án X" → đối tượng là DỰ ÁN X, không phải Digital Office.
   - Nếu người dùng nói "viết bài về Y" → nội dung là về Y, không liên quan đến nền tảng này.
   - KHÔNG BAO GIỜ tạo task về "cải thiện Digital Office", "UX Digital Office", v.v. trừ khi được yêu cầu rõ ràng.

[2] PHÂN LOẠI DOMAIN (BẮT BUỘC — làm bước đầu tiên):
   Xác định domain chính của yêu cầu:
   • SEO / Marketing Content  → chỉ dùng team: content
   • Lập trình / Kỹ thuật    → chỉ dùng team: backend (hoặc frontend nếu có)
   • Thiết kế / Visual       → chỉ dùng team: design
   • Nghiên cứu / Phân tích  → team: content hoặc qa
   • Kế hoạch / Chiến lược   → team: content
   KHÔNG trộn domain: nếu yêu cầu là SEO thì KHÔNG tạo task design hay backend.

[3] PHẠM VI TASK:
   - Mỗi task phải TRỰC TIẾP phục vụ yêu cầu của người dùng.
   - Tên task phải CỤ THỂ (ví dụ: "Nghiên cứu từ khóa SEO cho [tên dự án/sản phẩm]")
   - Mô tả task phải bao gồm: ĐỐI TƯỢNG (dự án/sản phẩm nào?), HÀNH ĐỘNG CỤ THỂ, KẾT QUẢ ĐẦU RA.
   - Tối đa 4 task. Không tạo task thừa chỉ để "đủ số".

[4] NGÔN NGỮ: Toàn bộ output PHẢI bằng Tiếng Việt.

[5] OUTPUT: Chỉ trả về JSON thuần — không markdown, không giải thích ngoài JSON.

Teams có thể dùng:
${teamList}

Format JSON bắt buộc:
{
  "domain": "seo | marketing | tech | design | research | strategy",
  "subject": "Đối tượng chính của yêu cầu (ví dụ: 'website bán giày ABC', 'ứng dụng ZaloCRM')",
  "analysis": "Phân tích ngắn gọn: người dùng cần gì, cho dự án/sản phẩm nào",
  "tasks": [
    {
      "title": "Tiêu đề ngắn gọn, cụ thể, có tên đối tượng",
      "description": "Mô tả chi tiết: cần làm gì, cho đối tượng nào, kết quả đầu ra là gì",
      "team": "team-id",
      "priority": 1
    }
  ]
}`;
}

class PlannerAgent {
  constructor(provider) {
    this.provider = provider;
    this.role     = 'planner';
  }

  async plan(request) {
    const teams  = loadActiveTeams();
    const cfg    = loadAgentConfig();
    const system = buildSystemPrompt(teams);

    console.log(`[Planner] Analyzing request using ${this.provider.name}…`);

    const prompt = `YÊU CẦU TỪ NGƯỜI DÙNG:
"${request}"

BƯỚC 1: Xác định đây là yêu cầu về lĩnh vực gì? Đối tượng (dự án/sản phẩm) là gì?
BƯỚC 2: Chỉ tạo task trực tiếp phục vụ yêu cầu đó — đúng domain, đúng đối tượng.
BƯỚC 3: Gán đúng team theo domain đã phân loại.

Trả về JSON hợp lệ duy nhất.`;

    const raw    = await this.provider.generate(system, prompt, {
      temperature: cfg.temperature ?? 0.4,   // thấp hơn để logic chặt hơn
      maxTokens:   cfg.maxTokens   ?? 4096,
    });
    const result = extractJSON(raw);

    if (!Array.isArray(result.tasks) || result.tasks.length === 0) {
      throw new Error('[Planner] No tasks returned by model');
    }

    const validIds = new Set(teams.map(t => t.id));
    result.tasks = result.tasks.map((t, i) => ({
      title:       t.title       || `Task ${i + 1}`,
      description: t.description || 'Không có mô tả',
      team:        validIds.has(t.team) ? t.team : teams[0]?.id || 'content',
      priority:    t.priority    || i + 1,
      // Pass subject/domain context down to manager + worker
      subject:     result.subject || '',
      domain:      result.domain  || '',
    }));

    console.log(`[Planner] Domain: ${result.domain} | Subject: ${result.subject} | Tasks: ${result.tasks.length}`);
    return result;
  }
}

module.exports = PlannerAgent;
