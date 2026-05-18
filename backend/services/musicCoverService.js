/**
 * Gemini Music Cover Service
 * - Translate lyrics to Vietnamese
 * - Generate Suno AI prompt
 * - Generate 10 image prompts + actual images via Gemini
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs   = require('fs-extra');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'music-cover');
fs.ensureDirSync(OUTPUT_DIR);

// ─── API key rotation + retry ─────────────────────────────────────────────────
function getApiKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY${i === 1 ? '' : '_' + i}`];
    if (k) keys.push(k);
  }
  if (!keys.length) throw new Error('GEMINI_API_KEY not set');
  return keys;
}

let keyIdx = 0;
function getGenAI() {
  const keys = getApiKeys();
  const key  = keys[keyIdx++ % keys.length];
  return new GoogleGenerativeAI(key);
}

async function geminiGenerate(prompt, modelName = 'gemini-2.0-flash') {
  const MAX_RETRIES = 4;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const is429 = err.message?.includes('429') || err.message?.includes('quota');
      if (is429 && attempt < MAX_RETRIES - 1) {
        const m    = err.message?.match(/retry.*?(\d+)s/i);
        const wait = m ? parseInt(m[1]) * 1000 + 1000 : Math.min((2 ** attempt) * 10000, 70000);
        console.warn(`[MusicCover] 429 — waiting ${Math.round(wait/1000)}s (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
  throw lastErr;
}

// ─── Phase 1: Translate + Suno prompt ────────────────────────────────────────
async function translateAndCreateSunoPrompt(songTitle, artist, rawLyrics) {
  const hasLyrics = rawLyrics && rawLyrics.length > 50;
  const prompt = `Bạn là chuyên gia âm nhạc và dịch thuật. Tôi cần tạo một bài nhạc cover bằng AI.

Thông tin bài hát gốc:
- Tên: "${songTitle}"
- Nghệ sĩ: "${artist}"
${hasLyrics ? `- Lời bài hát:\n${rawLyrics.slice(0, 2500)}` : '- (Không lấy được lời bài hát tự động — hãy sáng tác dựa trên tên bài)'}

Hãy thực hiện và trả về CHÍNH XÁC JSON sau (không có markdown, không giải thích):
{
  "vietnameseLyrics": "Lời tiếng Việt đầy đủ (verse/chorus/bridge)...",
  "sunoStylePrompt": "Style prompt cho Suno AI (ví dụ: Vietnamese pop ballad, emotional, piano, strings, female vocal...)",
  "sunoLyrics": "Lời format cho Suno với tags [Verse 1], [Chorus], [Bridge]...",
  "genre": "Pop",
  "mood": "Emotional",
  "tempo": "Slow",
  "keyInstruments": ["piano", "guitar"],
  "songAnalysis": "Phân tích ngắn về bài hát và hướng làm cover"
}`;

  const text = await geminiGenerate(prompt);
  try {
    const m = text.match(/\{[\s\S]+\}/);
    return JSON.parse(m[0]);
  } catch {
    return {
      vietnameseLyrics:  `Lời tiếng Việt cho bài "${songTitle}"...`,
      sunoStylePrompt:   `Vietnamese pop, emotional, ${artist} style`,
      sunoLyrics:        `[Verse 1]\n${text.slice(0, 500)}`,
      genre: 'Pop', mood: 'Emotional', tempo: 'Medium',
      keyInstruments: ['piano', 'guitar'],
      songAnalysis: `Cover bài "${songTitle}" của ${artist}`,
    };
  }
}

// ─── Phase 2: 10 image descriptions ──────────────────────────────────────────
async function generateImageDescriptions(songTitle, artist, vietnameseLyrics, mood, genre) {
  await new Promise(r => setTimeout(r, 3000)); // space out API calls

  const prompt = `Bạn là creative director chuyên làm music video.

Bài hát: "${songTitle}" - ${artist}
Mood: ${mood} | Genre: ${genre}
Lời (trích đoạn): ${vietnameseLyrics.slice(0, 600)}

Tạo 10 mô tả hình ảnh để làm music video. Trả về JSON (không markdown):
{
  "imageDescriptions": [
    {
      "id": 1,
      "scene": "Tên cảnh ngắn",
      "prompt": "Detailed English description for AI image generation: cinematic, photorealistic, 4K, specific setting and mood",
      "timing": "intro",
      "vibe": "cảm xúc"
    }
  ]
}`;

  const text = await geminiGenerate(prompt);
  try {
    const m = text.match(/\{[\s\S]+\}/);
    return JSON.parse(m[0]).imageDescriptions || [];
  } catch {
    const timings = ['intro','verse1','chorus','verse2','bridge','chorus2','verse3','chorus3','bridge2','outro'];
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, scene: `Scene ${i + 1}`,
      prompt: `Cinematic music video scene, ${mood} mood, ${genre} style, artistic, 4K`,
      timing: timings[i] || 'verse', vibe: mood,
    }));
  }
}

// ─── Phase 3: Generate images via Gemini ─────────────────────────────────────
async function generateImages(sessionId, imageDescriptions) {
  const results   = [];
  const sessionDir = path.join(OUTPUT_DIR, sessionId);
  await fs.ensureDir(sessionDir);

  for (let i = 0; i < imageDescriptions.length; i++) {
    const desc = imageDescriptions[i];
    try {
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: desc.prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      });
      const parts   = result.response?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData);

      if (imgPart?.inlineData) {
        const { data, mimeType } = imgPart.inlineData;
        const ext      = mimeType.includes('png') ? 'png' : 'jpg';
        const fileName = `image_${String(i + 1).padStart(2, '0')}.${ext}`;
        const filePath = path.join(sessionDir, fileName);
        await fs.writeFile(filePath, Buffer.from(data, 'base64'));
        results.push({ ...desc, filePath, fileName, generated: true, mimeType });
      } else {
        results.push({ ...desc, generated: false, fallback: true });
      }
      if (i < imageDescriptions.length - 1) await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.warn(`[MusicCover] Image ${i + 1} failed: ${err.message}`);
      results.push({ ...desc, generated: false, error: err.message });
    }
  }
  return results;
}

// ─── Phase 4: Canva brief ─────────────────────────────────────────────────────
async function generateCanvaBrief(songTitle, artist, vietnameseLyrics, imageResults) {
  await new Promise(r => setTimeout(r, 3000));
  const prompt = `Tạo script/brief chi tiết để ghép video nhạc trên Canva.

Bài hát: "${songTitle}" - ${artist}
Số cảnh: ${imageResults.length}
Lời tiếng Việt: ${vietnameseLyrics.slice(0, 800)}

Tạo script bao gồm:
1. Thứ tự hình ảnh và thời gian (giây) mỗi cảnh
2. Text overlay lời nhạc tại mỗi cảnh
3. Hiệu ứng chuyển cảnh đề xuất
4. Hướng dẫn upload nhạc Suno vào Canva
5. Tips để xuất video MP4 chất lượng cao

Trả về định dạng markdown dễ đọc:`;

  return geminiGenerate(prompt);
}

module.exports = {
  translateAndCreateSunoPrompt,
  generateImageDescriptions,
  generateImages,
  generateCanvaBrief,
};
