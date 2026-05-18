/**
 * Music Cover Pipeline — orchestrates the full workflow:
 * YouTube URL → lyrics extract → Vietnamese translation → Suno prompt
 * → browser automation → 10 images → Canva brief
 */
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs   = require('fs-extra');

const { extractFromYouTube }          = require('../services/youtubeService');
const { translateAndCreateSunoPrompt, generateImageDescriptions,
        generateImages, generateCanvaBrief } = require('../services/musicCoverService');
const { createSunoSong }              = require('../services/sunoAutomation');

// In-memory job store (keyed by sessionId)
const jobs = new Map();

function getJob(id) { return jobs.get(id); }
function setJob(id, data) { jobs.set(id, { ...jobs.get(id), ...data }); }

// ─── SSE helper ──────────────────────────────────────────────────────────────
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── POST /api/music-cover/start ────────────────────────────────────────────
router.post('/start', async (req, res) => {
  const { youtubeUrl, runSuno = false } = req.body;
  if (!youtubeUrl) return res.status(400).json({ error: 'youtubeUrl is required' });

  const sessionId = uuidv4();
  jobs.set(sessionId, { id: sessionId, status: 'pending', progress: [], youtubeUrl, runSuno });

  res.json({ sessionId });

  // Run async pipeline
  runPipeline(sessionId, youtubeUrl, runSuno).catch(err => {
    setJob(sessionId, { status: 'failed', error: err.message });
    console.error('[MusicCover] Pipeline error:', err.message);
  });
});

// ─── GET /api/music-cover/status/:id — SSE stream ────────────────────────────
router.get('/status/:id', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { id } = req.params;
  const job = getJob(id);
  if (!job) { sendSSE(res, 'error', { message: 'Job not found' }); return res.end(); }

  // Send current state
  sendSSE(res, 'state', job);

  // Poll every 1.5s
  const interval = setInterval(() => {
    const current = getJob(id);
    if (!current) { clearInterval(interval); return res.end(); }
    sendSSE(res, 'state', current);
    if (['completed', 'failed'].includes(current.status)) {
      clearInterval(interval);
      res.end();
    }
  }, 1500);

  req.on('close', () => clearInterval(interval));
});

// ─── GET /api/music-cover/result/:id ────────────────────────────────────────
router.get('/result/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

// ─── GET /api/music-cover/image/:id/:filename ────────────────────────────────
// Security: sanitize both :id and :filename to prevent path traversal attacks
const UUID_REGEX     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_FILE_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

router.get('/image/:id/:filename', async (req, res) => {
  const { id, filename } = req.params;

  // Validate :id must be a UUID
  if (!UUID_REGEX.test(id)) {
    return res.status(400).send('Invalid session ID');
  }
  // Validate :filename — only alphanumeric, dash, underscore, dot allowed
  if (!SAFE_FILE_REGEX.test(filename) || filename.includes('..')) {
    return res.status(400).send('Invalid filename');
  }

  const baseDir  = path.resolve(__dirname, '..', 'data', 'music-cover');
  const filePath = path.resolve(baseDir, id, filename);

  // Ensure the resolved path is still inside baseDir (belt-and-suspenders)
  if (!filePath.startsWith(baseDir + path.sep)) {
    return res.status(403).send('Access denied');
  }

  if (!(await fs.pathExists(filePath))) return res.status(404).send('Image not found');
  res.sendFile(filePath);
});

// ─── GET /api/music-cover/jobs ───────────────────────────────────────────────
router.get('/jobs', (req, res) => {
  const list = [...jobs.values()].map(j => ({
    id: j.id, status: j.status, youtubeUrl: j.youtubeUrl,
    title: j.meta?.title, artist: j.meta?.author,
    createdAt: j.createdAt,
  }));
  res.json(list.reverse().slice(0, 20));
});

// ─── DELETE /api/music-cover/:id ─────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  jobs.delete(req.params.id);
  res.json({ ok: true });
});

// ─── Main pipeline ────────────────────────────────────────────────────────────
async function runPipeline(sessionId, youtubeUrl, runSuno) {
  const addProgress = (step, status = 'running', detail = '') => {
    const job = getJob(sessionId);
    setJob(sessionId, {
      progress: [...(job?.progress || []), { step, status, detail, ts: new Date().toISOString() }],
      currentStep: step,
    });
    console.log(`[MusicCover:${sessionId.slice(0, 8)}] ${step} — ${status} ${detail}`);
  };

  try {
    setJob(sessionId, { status: 'running', createdAt: new Date().toISOString() });

    // ── PHASE 1: Extract YouTube metadata ────────────────────────────────────
    addProgress('📺 Extracting YouTube info', 'running');
    const { meta, rawLyrics, videoId } = await extractFromYouTube(youtubeUrl);
    setJob(sessionId, { meta, rawLyrics, videoId });
    addProgress('📺 Extracting YouTube info', 'done', `"${meta.title}" by ${meta.author}`);

    // ── PHASE 2: Translate + Suno prompt ─────────────────────────────────────
    addProgress('🎵 Translating lyrics & creating Suno prompt', 'running');
    const musicData = await translateAndCreateSunoPrompt(meta.title, meta.author, rawLyrics);
    setJob(sessionId, { musicData });
    addProgress('🎵 Translating lyrics & creating Suno prompt', 'done',
      `Genre: ${musicData.genre} | Mood: ${musicData.mood}`);

    // ── PHASE 3: Generate image descriptions ──────────────────────────────────
    addProgress('🎨 Generating 10 image concepts', 'running');
    const imageDescriptions = await generateImageDescriptions(
      meta.title, meta.author, musicData.vietnameseLyrics, musicData.mood, musicData.genre
    );
    setJob(sessionId, { imageDescriptions });
    addProgress('🎨 Generating 10 image concepts', 'done', `${imageDescriptions.length} scenes created`);

    // ── PHASE 4: Generate actual images ───────────────────────────────────────
    addProgress('🖼️ Generating images with Gemini', 'running');
    const imageResults = await generateImages(sessionId, imageDescriptions);
    const generatedCount = imageResults.filter(i => i.generated).length;
    setJob(sessionId, { imageResults });
    addProgress('🖼️ Generating images with Gemini', generatedCount > 0 ? 'done' : 'warning',
      `${generatedCount}/${imageResults.length} images generated`);

    // ── PHASE 5: Suno automation (optional) ───────────────────────────────────
    let sunoResult = null;
    if (runSuno) {
      addProgress('🤖 Automating Suno.ai', 'running');
      sunoResult = await createSunoSong(
        musicData.sunoLyrics,
        musicData.sunoStylePrompt,
        meta.title,
        (msg) => addProgress(`🤖 Suno: ${msg}`, 'running')
      );
      setJob(sessionId, { sunoResult });
      addProgress('🤖 Automating Suno.ai', sunoResult.success ? 'done' : 'warning',
        sunoResult.success ? sunoResult.songUrl : sunoResult.error);
    } else {
      // Manual Suno steps
      const { createSunoSong: buildManual } = require('../services/sunoAutomation');
      sunoResult = { success: false, manualSteps: {
        url: 'https://suno.com/create',
        steps: [
          '1. Mở https://suno.com và đăng nhập tài khoản',
          '2. Click "Create" → bật "Custom Mode"',
          '3. Dán lời bài hát vào ô "Lyrics"',
          '4. Điền Style Prompt vào ô "Style of Music"',
          '5. Nhập tiêu đề bài hát',
          '6. Click "Create" (2 bản nhạc sẽ được tạo)',
        ],
        lyrics:      musicData.sunoLyrics,
        stylePrompt: musicData.sunoStylePrompt,
      }};
      setJob(sessionId, { sunoResult });
    }

    // ── PHASE 6: Canva video brief ────────────────────────────────────────────
    addProgress('📹 Creating Canva video brief', 'running');
    const canvaBrief = await generateCanvaBrief(
      meta.title, meta.author, musicData.vietnameseLyrics, imageResults, meta
    );
    setJob(sessionId, { canvaBrief });
    addProgress('📹 Creating Canva video brief', 'done');

    // ── COMPLETE ──────────────────────────────────────────────────────────────
    setJob(sessionId, { status: 'completed' });
    addProgress('✅ Workflow Complete!', 'done',
      `All ${6} phases finished successfully`);

    console.log(`[MusicCover] ✅ Session ${sessionId} completed`);
  } catch (err) {
    setJob(sessionId, { status: 'failed', error: err.message });
    console.error(`[MusicCover] ❌ Failed:`, err);
    throw err;
  }
}

module.exports = router;
