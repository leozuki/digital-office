require('dotenv').config();
const express    = require('express');
const { WebSocketServer } = require('ws');
const http       = require('http');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const fs         = require('fs-extra');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');
const db         = require('./database/db');
const orchestrator   = require('./workflow/orchestrator');
const docreader      = require('./agents/docreader');
const musicCoverRouter = require('./routes/musicCover');

const app  = express();
// Render dùng $PORT, local dev dùng BACKEND_PORT hoặc 3001
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3001;

// ─── CORS — chỉ cho phép origin đã biết ──────────────────────────────────────
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000'
).split(',').map(o => o.trim());

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Giới hạn khởi tạo session AI: tối đa 10 request / 5 phút / IP
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu — vui lòng thử lại sau 5 phút.' },
});

// Giới hạn chung: 100 request / phút / IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu.' },
});

// Whitelist thư mục được phép đọc tài liệu (nếu rỗng = không hạn chế — chỉ dùng trong dev)
const ALLOWED_DOC_FOLDERS = process.env.ALLOWED_DOC_FOLDERS
  ? process.env.ALLOWED_DOC_FOLDERS.split(',').map(f => path.resolve(f.trim())).filter(Boolean)
  : [];

// ─── Authentication Middleware ──────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123456';
  // Kiểm tra password từ Header (X-Admin-Password hoặc Authorization Bearer)
  const providedPass = req.headers['x-admin-password'] || 
                      (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].split(' ')[1] : null);

  if (providedPass === adminPass) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized — Yêu cầu mật khẩu quản trị' });
};


app.use(cors({
  origin: (origin, cb) => {
    // Cho phép requests không có origin (curl, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Không set CORS headers → browser sẽ block, trả về cb(null, false) thay vì throw error
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' })); // Giới hạn 2MB thay vì 50MB
app.use(generalLimiter);
app.use('/api/music-cover', musicCoverRouter);
app.use('/data/music-cover', express.static(require('path').join(__dirname, 'data', 'music-cover')));

const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws' });

// ─── WebSocket Manager ────────────────────────────────────────────────────────
const clients = new Set();
wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (err) => console.error('[WS] Error:', err.message));

  // Send current sessions immediately on connect
  ws.send(JSON.stringify({ type: 'init', data: { sessions: db.getSessions() } }));
});

const wsManager = {
  broadcast(data) {
    const msg = JSON.stringify(data);
    clients.forEach((ws) => {
      if (ws.readyState === 1) ws.send(msg);
    });
  },
};

// ─── Authentication Check ───────────────────────────────────────────────────
app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || 'admin123456')) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Mật khẩu không chính xác' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  // Nếu đã build frontend → serve index.html; ngược lại trả về API status
  const indexHtml = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res.json({ status: 'Digital Office API is running', timestamp: new Date().toISOString() });
});

// Create new session (start workflow)
app.post('/api/sessions', aiLimiter, async (req, res) => {
  const { request, context, docFolder, autonomous } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!request || typeof request !== 'string' || !request.trim()) {
    return res.status(400).json({ error: 'Request text is required' });
  }
  if (request.trim().length > 8000) {
    return res.status(400).json({ error: 'Request text quá dài (tối đa 8000 ký tự)' });
  }

  // ── Validate docFolder (whitelist) ─────────────────────────────────────
  let safeDocFolder = null;
  if (docFolder) {
    const resolved = path.resolve(docFolder);
    // Nếu ALLOWED_DOC_FOLDERS rỗng → không hạn chế (dev mode); ngược lại phải nằm trong whitelist
    const isAllowed = ALLOWED_DOC_FOLDERS.length === 0 ||
      ALLOWED_DOC_FOLDERS.some(allowed => resolved.startsWith(allowed));
    if (!isAllowed) {
      return res.status(400).json({ error: `Thư mục không được phép: ${docFolder}` });
    }
    safeDocFolder = resolved;
  }

  const sessionId  = uuidv4();
  const sessionObj = { id: sessionId, status: 'pending', request: request.trim(), created_at: new Date().toISOString() };
  db.createSession(sessionId, request.trim());

  wsManager.broadcast({ type: 'session:created', data: sessionObj });
  res.status(201).json(sessionObj);

  // Kick off async workflow (fire-and-forget)
  orchestrator.process(sessionId, request.trim(), wsManager, { context, docFolder: safeDocFolder, autonomous }).catch((err) => {
    console.error(`[Orchestrator] Session ${sessionId} failed:`, err.message);
    db.updateSession(sessionId, 'failed');
    wsManager.broadcast({ type: 'session:failed', data: { id: sessionId, status: 'failed', error: err.message } });
  });
});

// Submit human feedback to an active session
app.post('/api/sessions/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;
  if (!feedback) return res.status(400).json({ error: 'Feedback text is required' });
  
  orchestrator.injectFeedback(id, feedback);
  console.log(`[API] Human feedback injected for session ${id}: ${feedback}`);
  res.json({ ok: true });
});

// List all sessions
app.get('/api/sessions', (req, res) => {
  res.json(db.getSessions());
});

// Get session detail
app.get('/api/sessions/:id', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const tasks  = db.getSessionTasks(req.params.id);
  const events = db.getSessionEvents(req.params.id);
  const enrichedTasks = tasks.map((t) => ({
    ...t,
    outputs: db.getTaskOutputs(t.id),
    reviews: db.getTaskReviews(t.id),
  }));
  res.json({ ...session, tasks: enrichedTasks, events });
});

// Get session tasks
app.get('/api/sessions/:id/tasks', (req, res) => {
  const tasks = db.getSessionTasks(req.params.id).map((t) => ({
    ...t,
    outputs: db.getTaskOutputs(t.id),
    reviews: db.getTaskReviews(t.id),
  }));
  res.json(tasks);
});

// Rerun a specific task with optional user instruction
app.post('/api/tasks/:id/rerun', (req, res) => {
  const { id } = req.params;
  const { instruction } = req.body;
  const task = db.getTask(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  res.json({ ok: true, taskId: id });

  // Fire-and-forget rerun
  orchestrator.rerunTask(id, instruction || '', wsManager).catch((err) => {
    console.error(`[Rerun] Task ${id} failed:`, err.message);
    db.updateTask(id, 'failed', task.assigned_to, 0);
    wsManager.broadcast({ type: 'task:updated', data: { id, status: 'failed', error: err.message } });
  });
});

// Get session events (workflow log)
app.get('/api/sessions/:id/events', (req, res) => {
  res.json(db.getSessionEvents(req.params.id));
});

// ─── Document APIs ────────────────────────────────────────────────────────────
// List image documents in a folder
app.get('/api/docs', authMiddleware, async (req, res) => {
  const folder = req.query.folder || process.env.DEFAULT_DOC_FOLDER || '';
  if (!folder) return res.status(400).json({ error: 'Vui lòng chỉ định tham số folder' });
  try {
    const docs = await docreader.listDocuments(folder);
    res.json({ folder, count: docs.length, docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extract text from all images in a folder (with caching)
app.post('/api/docs/read', authMiddleware, async (req, res) => {
  const { folder = process.env.DEFAULT_DOC_FOLDER || '' } = req.body;
  if (!folder) return res.status(400).json({ error: 'Vui lòng chỉ định tham số folder' });
  try {
    console.log(`[API] Reading documents from: ${folder}`);
    const text = await docreader.readDocumentsFromFolder(folder);
    res.json({ folder, length: text.length, text });
  } catch (err) {
    console.error('[API] DocRead error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear doc cache
app.delete('/api/docs/cache', authMiddleware, (req, res) => {
  const { folder } = req.body || {};
  docreader.clearCache(folder);
  res.json({ ok: true, message: 'Cache cleared' });
});

// Delete a session and all its data
app.delete('/api/sessions/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const session = db.getSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  try {
    db.deleteSession(id);
    wsManager.broadcast({ type: 'session:deleted', data: { id } });
    res.json({ ok: true, id });
    console.log(`[API] Session deleted: ${id}`);
  } catch (err) {
    console.error('[API] Delete session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Knowledge Base
app.get('/api/knowledge', (req, res) => {
  const { category } = req.query;
  res.json(db.getKnowledge(category));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Teams Config ─────────────────────────────────────────────────────────────
const TEAMS_FILE = path.join(__dirname, 'config', 'teams.json');
app.get('/api/teams', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'))); }
  catch { res.json([]); }
});
app.put('/api/teams', authMiddleware, (req, res) => {
  try {
    // Sử dụng fs-extra outputJsonSync để ghi atomic (ghi ra file tạm rồi rename)
    fs.outputJsonSync(TEAMS_FILE, req.body, { spaces: 2 });
    res.json({ ok: true });
  } catch (err) { 
    console.error('[API] Update teams error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// ─── Runners Config ───────────────────────────────────────────────────────────
app.get('/api/runners', (req, res) => {
  res.json({
    planner:  process.env.PLANNER_RUNNER  || 'gemini:gemini-3.5-flash',
    manager:  process.env.MANAGER_RUNNER  || 'gemini:gemini-3.5-flash',
    worker:   process.env.WORKER_RUNNER   || 'gemini:gemini-3.5-flash',
    reviewer: process.env.REVIEWER_RUNNER || 'gemini:gemini-3.5-flash',
    available: ['gemini:gemini-3.5-flash','gemini:gemini-2.0-flash','anthropic:claude-3-5-sonnet-20241022','ollama:llama3'],
  });
});
app.put('/api/runners', authMiddleware, (req, res) => {
  const { planner, manager, worker, reviewer } = req.body;
  if (planner)  process.env.PLANNER_RUNNER  = planner;
  if (manager)  process.env.MANAGER_RUNNER  = manager;
  if (worker)   process.env.WORKER_RUNNER   = worker;
  if (reviewer) process.env.REVIEWER_RUNNER = reviewer;
  res.json({ ok: true, runners: { planner: process.env.PLANNER_RUNNER, manager: process.env.MANAGER_RUNNER, worker: process.env.WORKER_RUNNER, reviewer: process.env.REVIEWER_RUNNER } });
});

// ─── Agents Config ────────────────────────────────────────────────────────────
const AGENTS_FILE = path.join(__dirname, 'config', 'agents.json');
app.get('/api/agents', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'))); }
  catch { res.json({}); }
});
app.put('/api/agents', authMiddleware, (req, res) => {
  try {
    fs.outputJsonSync(AGENTS_FILE, req.body, { spaces: 2 });
    res.json({ ok: true });
  } catch (err) { 
    console.error('[API] Update agents error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// ─── Config endpoint ─────────────────────────────────────────────────────────
const KEYS_FILE = path.join(__dirname, 'config', 'keys.json');

app.get('/api/keys', authMiddleware, (req, res) => {
  try {
    const keys = fs.readJsonSync(KEYS_FILE);
    // Trả về keys nhưng ẩn bớt ký tự (chỉ để lại 4 ký tự đầu/cuối)
    const masked = {};
    const ALL_KEY_NAMES = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OLLAMA_BASE_URL'];
    
    ALL_KEY_NAMES.forEach(k => {
      const val = keys[k] || process.env[k];
      if (!val || val.includes('your_')) {
        masked[k] = '';
      } else {
        masked[k] = val.length > 10 ? `${val.slice(0, 6)}...${val.slice(-4)}` : '********';
      }
    });
    res.json(masked);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/keys', authMiddleware, (req, res) => {
  try {
    const newKeys = req.body;
    const currentKeys = fs.readJsonSync(KEYS_FILE);
    
    // Chỉ cập nhật những key có giá trị mới (không phải mask)
    Object.entries(newKeys).forEach(([k, v]) => {
      if (v && !v.includes('...')) {
        currentKeys[k] = v;
        process.env[k] = v; // Cập nhật cả runtime
      }
    });
    
    fs.outputJsonSync(KEYS_FILE, currentKeys, { spaces: 2 });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', (req, res) => {
  res.json({
    agents: {
      planner:  process.env.PLANNER_RUNNER  || 'anthropic:claude-3-5-sonnet-20241022',
      manager:  process.env.MANAGER_RUNNER  || 'gemini:gemini-3.5-flash',
      worker:   process.env.WORKER_RUNNER   || 'gemini:gemini-3.5-flash',
      reviewer: process.env.REVIEWER_RUNNER || 'anthropic:claude-3-5-sonnet-20241022',
    },
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    hasGemini:    !!process.env.GEMINI_API_KEY,
    hasOllama:    !!process.env.OLLAMA_BASE_URL,
  });
});

// ─── Serve Frontend (production) ────────────────────────────────────────────
// Nếu đã build frontend (dist/index.html tồn tại), serve static files và SPA routing
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  // SPA catch-all: mọi route không phải /api/* → trả về index.html
  app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/data')) {
      return res.status(404).json({ error: `Đường dẫn ${req.originalUrl} không tồn tại.` });
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  // Chưa build frontend — trả về 404 JSON như cũ
  app.use((req, res) => {
    res.status(404).json({ error: `Đường dẫn ${req.originalUrl} không tồn tại.` });
  });
}

// ─── Global Error Handlers ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.stack || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});

// ─── Start ────────────────────────────────────────────────────────────────────
db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🏢  Digital Office Backend  →  http://localhost:${PORT}`);
    console.log(`📡  WebSocket              →  ws://localhost:${PORT}/ws`);
    console.log(`🤖  Planner  : ${process.env.PLANNER_RUNNER  || 'anthropic:claude-3-5-sonnet-20241022'}`);
    console.log(`🤖  Manager  : ${process.env.MANAGER_RUNNER  || 'gemini:gemini-2.0-flash'}`);
    console.log(`🤖  Worker   : ${process.env.WORKER_RUNNER   || 'gemini:gemini-2.0-flash'}`);
    console.log(`🤖  Reviewer : ${process.env.REVIEWER_RUNNER || 'anthropic:claude-3-5-sonnet-20241022'}\n`);
  });
}).catch((err) => {
  console.error('[DB] Failed to initialize:', err);
  process.exit(1);
});
