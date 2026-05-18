import { useState } from 'react';

// ─── Event type config ────────────────────────────────────────────────────────
const TYPE_META = {
  thought:  { label: 'THOUGHT',  cls: 'type-thought',  icon: '💭' },
  artifact: { label: 'ARTIFACT', cls: 'type-artifact', icon: '📄' },
  approval: { label: 'APPROVAL', cls: 'type-approval', icon: '✅' },
  revision: { label: 'REVISION', cls: 'type-revision', icon: '🔄' },
  task:     { label: 'TASK',     cls: 'type-task',     icon: '📌' },
  info:     { label: 'INFO',     cls: 'type-info',     icon: 'ℹ️' },
  message:  { label: 'EVENT',    cls: 'type-thought',  icon: '💬' },
};

function getTypeMeta(eventType = '') {
  const t = eventType.replace('agent:','').toLowerCase();
  return TYPE_META[t] || TYPE_META.message;
}

function fmtTime(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return ''; }
}

// ─── Single event card ────────────────────────────────────────────────────────
function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const meta       = getTypeMeta(event.event_type || event.type);
  const isArtifact = meta.label === 'ARTIFACT';

  let rawContent = typeof event.content === 'string' ? event.content : JSON.stringify(event.content, null, 2);
  let artifactMeta = null;
  let displayContent = rawContent;

  if (isArtifact) {
    try {
      const parsed = JSON.parse(rawContent);
      const art = parsed.artifact || parsed;
      if (art.filename || art.type) {
        artifactMeta = { type: art.type, language: art.language, filename: art.filename };
        displayContent = art.content || rawContent;
      }
    } catch {}
  }

  const isLong  = displayContent.length > 250;
  const preview = isLong && !expanded ? displayContent.slice(0, 250) + '\u2026' : displayContent;

  return (
    <div className="event-card" onClick={() => isLong && setExpanded(!expanded)}>
      <div className="event-card-header">
        <span className={`event-type-badge ${meta.cls}`}>
          {meta.icon} {meta.label}
        </span>
        <span className="event-card-time">{fmtTime(event.created_at || event.timestamp)}</span>
      </div>

      {isArtifact && artifactMeta ? (
        <div style={{ padding: '6px 0 2px' }}>
          <div style={{ display:'flex', gap:5, alignItems:'center', marginBottom:5 }}>
            <span style={{
              fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:999,
              background:'rgba(91,79,255,.1)', color:'#5b4fff', border:'1px solid rgba(91,79,255,.2)',
            }}>{artifactMeta.type?.toUpperCase() || 'FILE'}</span>
            {artifactMeta.filename && (
              <code style={{ fontSize:10, color:'#374151' }}>{artifactMeta.filename}</code>
            )}
          </div>
          <pre className="event-card-body code" style={{ marginTop:0, fontSize:10.5, maxHeight: expanded ? 'none' : 120, overflow:'hidden' }}>
            {preview}
          </pre>
        </div>
      ) : isArtifact ? (
        <pre className="event-card-body code">{preview}</pre>
      ) : (
        <div className="event-card-body">{preview}</div>
      )}

      {isLong && (
        <button className="event-card-expand">
          {expanded ? '\u25b2 Collapse' : '\u25bc Expand'}
        </button>
      )}
    </div>
  );
}

// ─── Agent Column ─────────────────────────────────────────────────────────────
const AGENT_DEFS = [
  {
    id: 'planner',
    name: 'Project Planner',
    sub: 'GENERAL',
    icon: '🗺️',
    color: '#5b4fff',
    lightBg: 'rgba(91,79,255,.07)',
    badge: 'badge-purple',
    emptyMsg: 'Waiting for user request…',
    filterFn: (ev) => {
      const a = (ev.agent || '').toLowerCase();
      return a.includes('planner') || (ev.event_type === 'message' && !ev.task_id && !a.includes('manager'));
    },
  },
  {
    id: 'manager',
    name: 'Project Manager',
    sub: 'GENERAL',
    icon: '📋',
    color: '#0891b2',
    lightBg: 'rgba(8,145,178,.07)',
    badge: 'badge-cyan',
    emptyMsg: 'Waiting for Planner…',
    filterFn: (ev) => (ev.agent || '').toLowerCase().includes('manager'),
  },
  {
    id: 'worker',
    name: 'Team Workers',
    sub: 'ALL TEAMS',
    icon: '⚙️',
    color: '#16a34a',
    lightBg: 'rgba(22,163,74,.07)',
    badge: 'badge-green',
    emptyMsg: 'Waiting for task assignment…',
    filterFn: (ev) => (ev.agent || '').toLowerCase().includes('worker') || (ev.task_id && !(ev.agent || '').toLowerCase().includes('reviewer') && !(ev.agent || '').toLowerCase().includes('manager') && !(ev.agent || '').toLowerCase().includes('planner')),
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    sub: 'QUALITY CHECK',
    icon: '🔍',
    color: '#d97706',
    lightBg: 'rgba(217,119,6,.07)',
    badge: 'badge-amber',
    emptyMsg: 'Waiting for worker output…',
    filterFn: (ev) => (ev.agent || '').toLowerCase().includes('reviewer'),
  },
];

function AgentColumn({ def, events, tasks, sessionStatus }) {
  const colEvents  = events.filter(def.filterFn);
  const isActive   = (() => {
    if (def.id === 'planner'  && sessionStatus === 'planning')   return true;
    if (def.id === 'manager'  && sessionStatus === 'assigning')  return true;
    if (def.id === 'worker'   && sessionStatus === 'working')    return true;
    if (def.id === 'reviewer' && sessionStatus === 'reviewing')  return true;
    return false;
  })();

  return (
    <div className={`agent-col${isActive ? ' active' : ''}`}
      style={ isActive ? { borderColor: def.color, boxShadow: `0 0 0 3px ${def.lightBg}, 0 4px 20px rgba(0,0,0,.08)` } : {} }>

      {/* Header */}
      <div className="agent-col-header" style={{ background: def.lightBg }}>
        <div className="agent-col-title">
          <div className="agent-col-title-icon" style={{ background: `${def.color}18`, color: def.color }}>
            {def.icon}
          </div>
          <div>
            <div className="agent-col-name" style={{ color: def.color }}>{def.name}</div>
            <div className="agent-col-sub">({def.sub})</div>
          </div>
        </div>
        <div className="agent-col-meta">
          {isActive && (
            <span className="badge" style={{ background: `${def.color}18`, color: def.color, borderColor: `${def.color}44` }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:def.color, display:'inline-block' }} className="pulse" />
              Active
            </span>
          )}
          <span className="event-count">{colEvents.length} events</span>
        </div>
      </div>

      {/* Task pills for worker column */}
      {def.id === 'worker' && tasks.length > 0 && (
        <div style={{ padding:'8px 10px 0', display:'flex', flexWrap:'wrap', gap:5, borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
          {tasks.map(t => {
            const PILL = {
              pending:   { bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db' },
              working:   { bg:'#f0fdf4', color:'#16a34a', border:'#86efac' },
              reviewing: { bg:'#fffbeb', color:'#d97706', border:'#fcd34d' },
              revision:  { bg:'#fdf2f8', color:'#db2777', border:'#f9a8d4' },
              completed: { bg:'#f0fdf4', color:'#16a34a', border:'#86efac' },
              failed:    { bg:'#fef2f2', color:'#dc2626', border:'#fca5a5' },
            }[t.status] || { bg:'#f3f4f6', color:'#6b7280', border:'#d1d5db' };
            return (
              <span key={t.id} style={{
                fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:999,
                background: PILL.bg, border:`1px solid ${PILL.border}`, color: PILL.color,
                display:'flex', alignItems:'center', gap:4,
              }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:PILL.color, flexShrink:0 }} />
                {t.title?.slice(0, 24)}{(t.title?.length||0)>24?'…':''}
              </span>
            );
          })}
        </div>
      )}

      {/* Events */}
      <div className="agent-col-body">
        {colEvents.length === 0 ? (
          <div className="agent-col-empty">
            <span style={{ fontSize: 28, opacity: .2 }}>{def.icon}</span>
            <span style={{ fontSize: 12 }}>{def.emptyMsg}</span>
          </div>
        ) : (
          [...colEvents].reverse().map((ev, i) => (
            <EventCard key={ev.id || `${def.id}-${i}`} event={ev} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Final Response column ─────────────────────────────────────────────────────
function ResponseColumn({ session, tasks }) {
  const done      = session?.status === 'completed';
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total     = tasks.length;

  return (
    <div className="agent-col" style={{
      borderColor: done ? 'rgba(22,163,74,.4)' : 'var(--border)',
      boxShadow:   done ? '0 0 0 3px rgba(22,163,74,.08), var(--shadow-md)' : 'var(--shadow-sm)',
    }}>
      <div className="agent-col-header" style={{ background: done ? 'rgba(22,163,74,.07)' : 'var(--surface-3)' }}>
        <div className="agent-col-title">
          <div className="agent-col-title-icon" style={{ background:'rgba(22,163,74,.12)', color:'#16a34a' }}>
            {done ? '✅' : '⏳'}
          </div>
          <div>
            <div className="agent-col-name" style={{ color: done ? '#16a34a' : 'var(--text-3)' }}>
              {done ? 'Response' : 'Awaiting'}
            </div>
            <div className="agent-col-sub">
              {total > 0 ? `${completed}/${total} tasks done` : 'Request Reviewer'}
            </div>
          </div>
        </div>
      </div>
      <div className="agent-col-body">
        {done && session?.final_response ? (
          <div style={{
            background:'#f0fdf4', border:'1px solid #86efac',
            borderRadius:'var(--radius-md)', padding:'14px', fontSize:12.5,
            color:'#166534', lineHeight:1.75, whiteSpace:'pre-wrap',
            boxShadow:'var(--shadow-sm)',
          }}>
            {session.final_response}
          </div>
        ) : (
          <div className="agent-col-empty">
            <span style={{ fontSize: 28, opacity: .25 }}>✅</span>
            <span style={{ fontSize: 12 }}>Final response will appear here when all tasks are reviewed and approved</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Kanban ──────────────────────────────────────────────────────────────
export default function WorkflowKanban({ events, tasks, session }) {
  const sessionStatus = session?.status || 'idle';

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* Top gradient pipeline indicator */}
      <div className="pipeline-hint" />

      <div className="kanban-board">
        {AGENT_DEFS.map(def => (
          <AgentColumn
            key={def.id}
            def={def}
            events={events}
            tasks={tasks}
            sessionStatus={sessionStatus}
          />
        ))}
        <ResponseColumn session={session} tasks={tasks} />
      </div>
    </div>
  );
}
