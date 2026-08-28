# 🏢 Digital Office — AI Multi-Agent Workspace

An AI-powered digital office where structured agents collaborate in a strict workflow: **Planner → Manager → Workers → Reviewer**, powered by Claude Sonnet & Gemini Flash.

---

## 🚗 Also in this repo: Vehicle Distance Safety App

A standalone, camera-based web app that measures the distance to the car ahead
and warns when it's below the minimum safe following distance for the current
speed. See [`vehicle-distance-safety/README.md`](./vehicle-distance-safety/README.md).

---

## 🚀 Quick Start

### 1. Configure API Keys

```bash
# Copy and edit the env file
copy backend\.env.example backend\.env
notepad backend\.env
```

Set your keys:
```env
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

### 2. Launch

```bash
# Windows: Double-click or run
start.bat
```

This will:
- Install all dependencies  
- Start the backend on **:3001**  
- Start the frontend on **:5173**  
- Open the browser automatically

---

## 🤖 Agent Architecture

| Agent | Default Runner | Role |
|---|---|---|
| 🗺️ **Project Planner** | Claude Sonnet | Decomposes request → Task list |
| 📋 **Project Manager** | Gemini Flash | Assigns tasks to team members |
| ⚙️ **Worker** | Gemini Flash | Generates code/text artifacts |
| 🔍 **Reviewer** | Claude Sonnet | Approves or requests revisions |
| ✅ **Request Reviewer** | System | Signs off the final response |

### Multi-Runner Configuration

You can route each agent to a different provider in `backend/.env`:

```env
PLANNER_RUNNER=anthropic:claude-3-5-sonnet-20241022
MANAGER_RUNNER=gemini:gemini-2.0-flash
WORKER_RUNNER=gemini:gemini-2.0-flash
REVIEWER_RUNNER=anthropic:claude-3-5-sonnet-20241022

# Or use local Ollama:
WORKER_RUNNER=ollama:llama3
```

---

## 🎨 Frontend Features

| Tab | Description |
|---|---|
| 🏛️ **Organization** | Static office hierarchy chart (XYFlow) |
| ⚡ **Workflow** | Live node graph — thoughts, artifacts, approvals |
| 📄 **Output** | Final compiled response + task artifacts |

**Right Panel:**
- ⚡ **Live Feed** — real-time agent events as they happen
- 🕒 **History** — all past sessions

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express, WebSocket (ws) |
| **Database** | SQLite (better-sqlite3) |
| **AI Providers** | Anthropic Claude, Google Gemini, Ollama |
| **Frontend** | React 18, Vite |
| **Graph** | @xyflow/react |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
digital-office/
├── backend/
│   ├── agents/          # Planner, Manager, Worker, Reviewer
│   ├── providers/       # Anthropic, Gemini, Ollama
│   ├── workflow/        # Orchestrator engine
│   ├── database/        # SQLite setup
│   ├── data/            # Database file (auto-created)
│   └── server.js        # Express + WebSocket server
├── frontend/
│   └── src/
│       ├── components/  # All UI components
│       └── hooks/       # WebSocket + store
├── start.bat            # Windows launcher
└── README.md
```

---

## 🔧 Manual Start

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

---

## ⚠️ Notes

- Max **3 revision cycles** per task before auto-accept
- SQLite DB stored at `backend/data/office.db`
- All sessions and task history are persisted
- WebSocket auto-reconnects if connection drops
