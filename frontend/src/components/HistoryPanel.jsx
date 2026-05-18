import { useState } from 'react';

const AGENT_COLORS = {
  planner:  '#5b4fff',
  manager:  '#0891b2',
  worker:   '#16a34a',
  reviewer: '#d97706',
  request_reviewer: '#db2777',
};
const EVENT_ICONS = { thought:'💭', artifact:'📄', approval:'✅', revision:'🔄', message:'💬' };
const STATUS_COLORS = {
  completed:'#16a34a', failed:'#dc2626', pending:'#6b7280',
  planning:'#5b4fff', assigning:'#0891b2', working:'#16a34a', reviewing:'#d97706',
};

function agentColor(agent='') {
  return AGENT_COLORS[agent.toLowerCase().split('(')[0].trim().split(' ')[0]] || '#6b7280';
}

// ─── Single event row ──────────────────────────────────────────────────────────
function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false);
  const color      = agentColor(event.agent);
  const eventType  = event.event_type || event.type?.replace('agent:','') || 'message';
  const icon       = EVENT_ICONS[eventType] || '💬';
  let   content    = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
  const isArtifact = eventType === 'artifact';
  const isLong     = content.length > 160;
  const preview    = isLong && !expanded ? content.slice(0, 160) + '…' : content;

  return (
    <div style={{ paddingLeft:10, borderLeft:`2px solid ${color}44`, marginBottom:8 }}
      onClick={() => isLong && setExpanded(!expanded)}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
        <span style={{ fontSize:10 }}>{icon}</span>
        <span style={{ fontSize:9, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.04em' }}>
          {event.agent?.split('(')[0].trim().split(' ').slice(0,2).join(' ')}
        </span>
        <span style={{ fontSize:9, color:'#9ca3af', marginLeft:'auto' }}>
          {event.timestamp ? new Date(event.timestamp).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : ''}
        </span>
      </div>
      {isArtifact ? (
        <pre style={{ fontSize:10, maxHeight: expanded ? 300 : 60, overflow:'hidden', margin:0, cursor:'pointer', lineHeight:1.5, color:'#1e293b', background:'#f8fafc', padding:'6px 8px', borderRadius:6, border:'1px solid #e2e8f0' }}>
          {preview}
        </pre>
      ) : (
        <p style={{ fontSize:11, color:'#374151', lineHeight:1.55, wordBreak:'break-word', margin:0, cursor: isLong ? 'pointer' : 'default' }}>
          {preview}
          {isLong && <span style={{ color:'#5b4fff', marginLeft:4, fontSize:10 }}>{expanded?'▲':'▼'}</span>}
        </p>
      )}
    </div>
  );
}

// ─── Live feed (all events, newest first) ─────────────────────────────────────
function LiveFeed({ events }) {
  if (!events.length) return (
    <div style={{ textAlign:'center', padding:'50px 16px', color:'#9ca3af' }}>
      <div style={{ fontSize:28, marginBottom:8, opacity:.5 }}>📡</div>
      <div style={{ fontSize:12 }}>Đang đợi hoạt động từ agents…</div>
    </div>
  );
  return (
    <div className="scroll-y" style={{ flex:1, padding:'12px 14px' }}>
      {[...events].reverse().map((ev, i) => <EventRow key={ev.id || i} event={ev} />)}
    </div>
  );
}

// ─── Per-task grouped view ─────────────────────────────────────────────────────
function TaskFeed({ events, tasks }) {
  const [openId, setOpenId] = useState(null);

  const grouped = {};
  const unassigned = [];
  events.forEach(ev => {
    if (ev.task_id) {
      if (!grouped[ev.task_id]) grouped[ev.task_id] = [];
      grouped[ev.task_id].push(ev);
    } else {
      unassigned.push(ev);
    }
  });

  const STATUS_COLOR = {
    completed:'#16a34a', failed:'#dc2626', working:'#16a34a',
    reviewing:'#d97706', revision:'#db2777', pending:'#6b7280', assigned:'#0891b2',
  };

  return (
    <div className="scroll-y" style={{ flex:1, padding:'10px 12px' }}>
      {unassigned.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
            🔧 Pipeline Events
          </div>
          {unassigned.slice(-5).map((ev, i) => <EventRow key={i} event={ev} />)}
        </div>
      )}

      {tasks.map((task) => {
        const taskEvents = grouped[task.id] || [];
        const stColor    = STATUS_COLOR[task.status] || '#6b7280';
        const isOpen     = openId === task.id;

        return (
          <div key={task.id} style={{ marginBottom:10 }}>
            <div
              onClick={() => setOpenId(isOpen ? null : task.id)}
              style={{
                display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                background: isOpen ? 'rgba(91,79,255,.06)' : '#f9fafb',
                border:`1px solid ${isOpen ? '#c7d2fe' : '#e5e7eb'}`,
                borderRadius:10, padding:'8px 12px',
                transition:'all .2s',
              }}
            >
              <span style={{ width:7, height:7, borderRadius:'50%', background:stColor, flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:600, color:'#111827', flex:1, minWidth:0,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {task.title}
              </span>
              <span style={{ fontSize:9, color:stColor, fontWeight:700, textTransform:'uppercase', flexShrink:0 }}>
                {task.status}
              </span>
              <span style={{ fontSize:10, color:'#9ca3af', flexShrink:0 }}>
                {taskEvents.length} events {isOpen ? '▲' : '▼'}
              </span>
            </div>

            {isOpen && (
              <div style={{
                background:'#f9fafb', border:'1px solid #e5e7eb',
                borderTop:'none', borderRadius:'0 0 10px 10px', padding:'10px 12px',
              }}>
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:9, color:'#6b7280' }}>👤 {task.assigned_to || 'Unassigned'}</span>
                  <span style={{ fontSize:9, color:'#6b7280' }}>🏷️ {task.team}</span>
                  {task.revision_count > 0 && <span style={{ fontSize:9, color:'#db2777' }}>🔄 {task.revision_count} revisions</span>}
                </div>

                {/* Progress bar */}
                <div style={{ display:'flex', gap:3, marginBottom:10 }}>
                  {['Assigned','Working','Reviewed'].map((s, i) => {
                    const done = (i===0 && !!task.assigned_to) || (i===1 && ['reviewing','revision','completed'].includes(task.status)) || (i===2 && task.status==='completed');
                    return (
                      <div key={s} style={{ flex:1, textAlign:'center' }}>
                        <div style={{ height:3, borderRadius:9, background: done ? '#16a34a' : '#e5e7eb', marginBottom:3 }} />
                        <span style={{ fontSize:8, color: done ? '#16a34a' : '#9ca3af', fontWeight:600 }}>{s}</span>
                      </div>
                    );
                  })}
                </div>

                {taskEvents.length === 0 ? (
                  <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', margin:'8px 0' }}>No events yet</p>
                ) : (
                  taskEvents.map((ev, i) => <EventRow key={i} event={ev} />)
                )}

                {(task.reviews || []).length > 0 && (() => {
                  const r = task.reviews[task.reviews.length - 1];
                  return (
                    <div style={{
                      marginTop:8, padding:'8px 10px', borderRadius:8,
                      background: r.decision === 'approved' ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${r.decision === 'approved' ? '#86efac' : '#fcd34d'}`,
                    }}>
                      <div style={{ fontSize:10, fontWeight:700, color: r.decision === 'approved' ? '#16a34a' : '#d97706', marginBottom:3 }}>
                        {r.decision === 'approved' ? '✅ Approved' : '🔄 Revision Requested'} · Score: {r.score}/10
                      </div>
                      <p style={{ fontSize:10, color:'#374151', margin:0, lineHeight:1.5 }}>{r.feedback?.slice(0,120)}</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {tasks.length === 0 && unassigned.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 10px', color:'#9ca3af', fontSize:12 }}>
          Submit a request to start
        </div>
      )}
    </div>
  );
}

// ─── Session history ───────────────────────────────────────────────────────────
function SessionHistory({ sessions, activeSessionId, onSelect }) {
  return (
    <div className="scroll-y" style={{ flex:1, padding:'10px' }}>
      {sessions.length === 0 ? (
        <div style={{ textAlign:'center', padding:'30px 10px', color:'#9ca3af', fontSize:12 }}>
          No sessions yet
        </div>
      ) : sessions.map(s => {
        const isActive = s.id === activeSessionId;
        const color    = STATUS_COLORS[s.status] || '#6b7280';
        return (
          <div key={s.id} onClick={() => onSelect(s.id)} className={`request-card${isActive?' active':''}`}>
            <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:color, marginTop:4, flexShrink:0 }} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#111827', lineHeight:1.4, marginBottom:3,
                  overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                  {s.request}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:10, color, fontWeight:700, textTransform:'uppercase' }}>{s.status}</span>
                  <span style={{ fontSize:10, color:'#9ca3af' }}>
                    {new Date(s.created_at).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'})}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function HistoryPanel({ sessions, activeSessionId, events, tasks, onSelectSession }) {
  const [tab, setTab] = useState('tasks');

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#fff' }}>
      <div style={{ padding:'10px 12px', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>
        <div style={{ display:'flex', gap:4 }}>
          {[['tasks','📋 By Task'],['live','⚡ Live'],['history','🕒 History']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                flex:1, padding:'5px 0', borderRadius:7, border:'none',
                background: tab===k ? '#5b4fff' : 'transparent',
                color: tab===k ? '#fff' : '#6b7280',
                fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tasks'   && <TaskFeed   events={events} tasks={tasks} />}
      {tab === 'live'    && <LiveFeed   events={events} />}
      {tab === 'history' && <SessionHistory sessions={sessions} activeSessionId={activeSessionId} onSelect={onSelectSession} />}
    </div>
  );
}
