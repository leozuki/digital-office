/**
 * SQLite database using sql.js (pure JavaScript — no native build required).
 * Database is persisted to disk as a binary file.
 */
const initSqlJs  = require('sql.js');
const fs         = require('fs-extra');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const DB_PATH   = path.join(DATA_DIR, 'office.db');

let db; // sql.js Database instance

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await fs.ensureDir(DATA_DIR);

  const SQL = await initSqlJs();

  // Load existing DB from disk if available
  if (await fs.pathExists(DB_PATH)) {
    const fileBuffer = await fs.readFile(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behaviour (sql.js is in-memory, we persist manually)
  db.run('PRAGMA journal_mode = MEMORY;');
  db.run('PRAGMA foreign_keys = ON;');

  // Create schema
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      request      TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      created_at   TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      final_response TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id             TEXT PRIMARY KEY,
      session_id     TEXT NOT NULL,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      team           TEXT NOT NULL,
      priority       INTEGER DEFAULT 0,
      status         TEXT DEFAULT 'pending',
      assigned_to    TEXT,
      revision_count INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now')),
      completed_at   TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS task_outputs (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      content         TEXT NOT NULL,
      type            TEXT DEFAULT 'artifact',
      revision_number INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id                   TEXT PRIMARY KEY,
      task_id              TEXT NOT NULL,
      output_id            TEXT NOT NULL,
      decision             TEXT NOT NULL,
      score                REAL,
      feedback             TEXT,
      revision_instruction TEXT,
      created_at           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      task_id    TEXT,
      agent      TEXT NOT NULL,
      type       TEXT NOT NULL,
      content    TEXT,
      metadata   TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id           TEXT PRIMARY KEY,
      key          TEXT NOT NULL,
      value        TEXT NOT NULL,
      category     TEXT DEFAULT 'general',
      confidence   REAL DEFAULT 1.0,
      updated_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  persist();
  console.log('[DB] Initialized at', DB_PATH);
}

// ─── Persist to disk ──────────────────────────────────────────────────────────
function persist() {
  if (!db) return;
  const data = db.export();
  fs.outputFileSync(DB_PATH, Buffer.from(data));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function get(sql, params = []) {
  const stmt   = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const rows = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ─── Session ──────────────────────────────────────────────────────────────────
function createSession(id, request) {
  run(`INSERT INTO sessions (id, request, status) VALUES (?, ?, 'pending')`, [id, request]);
}

function updateSession(id, status, finalResponse = null) {
  const completedAt = ['completed', 'failed'].includes(status) ? new Date().toISOString() : null;
  run(
    `UPDATE sessions SET status = ?, completed_at = ?, final_response = ? WHERE id = ?`,
    [status, completedAt, finalResponse, id]
  );
}

function getSession(id)  { return get(`SELECT * FROM sessions WHERE id = ?`, [id]); }
function getSessions()   { return all(`SELECT * FROM sessions ORDER BY created_at DESC LIMIT 100`); }

function deleteSession(id) {
  // Delete in cascade order (foreign keys)
  const tasks = all(`SELECT id FROM tasks WHERE session_id = ?`, [id]);
  tasks.forEach(t => {
    run(`DELETE FROM reviews      WHERE task_id  = ?`, [t.id]);
    run(`DELETE FROM task_outputs WHERE task_id  = ?`, [t.id]);
  });
  run(`DELETE FROM tasks           WHERE session_id = ?`, [id]);
  run(`DELETE FROM workflow_events  WHERE session_id = ?`, [id]);
  run(`DELETE FROM sessions         WHERE id = ?`,         [id]);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
function insertTask(sessionId, task) {
  const id = uuidv4();
  run(
    `INSERT INTO tasks (id, session_id, title, description, team, priority) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sessionId, task.title, task.description, task.team, task.priority || 0]
  );
  return id;
}

function updateTask(id, status, assignedTo = null, revisionCount = 0) {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  run(
    `UPDATE tasks SET status = ?, assigned_to = ?, revision_count = ?, completed_at = ? WHERE id = ?`,
    [status, assignedTo, revisionCount, completedAt, id]
  );
}

function getSessionTasks(sessionId) { return all(`SELECT * FROM tasks WHERE session_id = ? ORDER BY priority ASC`, [sessionId]); }
function getTask(id)                { return get(`SELECT * FROM tasks WHERE id = ?`, [id]); }

// ─── Outputs ──────────────────────────────────────────────────────────────────
function insertOutput(taskId, content, type = 'artifact', revisionNumber = 0) {
  const id = uuidv4();
  run(
    `INSERT INTO task_outputs (id, task_id, content, type, revision_number) VALUES (?, ?, ?, ?, ?)`,
    [id, taskId, content, type, revisionNumber]
  );
  return id;
}

function getTaskOutputs(taskId) { return all(`SELECT * FROM task_outputs WHERE task_id = ? ORDER BY revision_number ASC`, [taskId]); }

// ─── Reviews ──────────────────────────────────────────────────────────────────
function insertReview(taskId, outputId, decision, score, feedback, revisionInstruction) {
  const id = uuidv4();
  run(
    `INSERT INTO reviews (id, task_id, output_id, decision, score, feedback, revision_instruction) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, taskId, outputId, decision, score || null, feedback || null, revisionInstruction || null]
  );
  return id;
}

function getTaskReviews(taskId) { return all(`SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at ASC`, [taskId]); }

// ─── Events ───────────────────────────────────────────────────────────────────
function insertEvent(sessionId, taskId, agent, type, content, metadata = null) {
  const id = uuidv4();
  run(
    `INSERT INTO events (id, session_id, task_id, agent, type, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, taskId || null, agent, type,
     typeof content === 'string' ? content : JSON.stringify(content),
     metadata ? JSON.stringify(metadata) : null]
  );
  persist();
  return id;
}

function getSessionEvents(sessionId) {
  return all(`SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC`, [sessionId]);
}

// ─── Knowledge ────────────────────────────────────────────────────────────────
function insertKnowledge(key, value, category = 'general', confidence = 1.0) {
  const id = uuidv4();
  run(
    `INSERT INTO knowledge (id, key, value, category, confidence) VALUES (?, ?, ?, ?, ?)`,
    [id, key, typeof value === 'string' ? value : JSON.stringify(value), category, confidence]
  );
  persist();
  return id;
}

function getKnowledge(category = null) {
  if (category) return all(`SELECT * FROM knowledge WHERE category = ? ORDER BY updated_at DESC`, [category]);
  return all(`SELECT * FROM knowledge ORDER BY updated_at DESC LIMIT 100`);
}

function getKnowledgeBySession(sessionId) {
  // Lấy knowledge liên quan đến session dựa trên category và điều kiện session tồn tại
  // (Nếu muốn chính xác hơn sau này: lưu session_id vào bảng knowledge)
  const session = get(`SELECT id FROM sessions WHERE id = ?`, [sessionId]);
  if (!session) return [];
  // Trả knowledge gần nhất (optimistic: sau này có thể link session_id vào bảng knowledge)
  return all(`SELECT * FROM knowledge WHERE category = 'seo' ORDER BY updated_at DESC LIMIT 10`);
}

// ─── Export ───────────────────────────────────────────────────────────────────
module.exports = {
  init,
  createSession, updateSession, getSession, getSessions, deleteSession,
  insertTask, updateTask, getSessionTasks, getTask,
  insertOutput, getTaskOutputs,
  insertReview, getTaskReviews,
  insertEvent, getSessionEvents,
  insertKnowledge, getKnowledge, getKnowledgeBySession,
};
