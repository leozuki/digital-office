import { useState, useCallback } from 'react';
import WorkflowKanban      from './WorkflowKanban';
import NewRequestModal     from './NewRequestModal';
import MarketingPlanModal  from './MarketingPlanModal';

// ─── Status config ─────────────────────────────────────────────────────────
const ST = {
  pending:   { color:'#6b7280', bg:'#f3f4f6', label:'Pending',   dot:'#9ca3af' },
  planning:  { color:'#5b4fff', bg:'#ede9fe', label:'Planning',  dot:'#5b4fff' },
  assigning: { color:'#0891b2', bg:'#e0f2fe', label:'Assigning', dot:'#0891b2' },
  working:   { color:'#16a34a', bg:'#dcfce7', label:'Working',   dot:'#16a34a' },
  reviewing: { color:'#d97706', bg:'#fef3c7', label:'Reviewing', dot:'#d97706' },
  completed: { color:'#16a34a', bg:'#dcfce7', label:'Done',      dot:'#16a34a' },
  failed:    { color:'#dc2626', bg:'#fee2e2', label:'Failed',    dot:'#dc2626' },
};

function stOf(s) { return ST[s] || ST.pending; }

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)   return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000)return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
}

// ─── Mini progress bar ──────────────────────────────────────────────────────
function MiniProgress({ completed, total }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div style={{ height: 3, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginTop: 5 }}>
      <div style={{
        height: '100%', borderRadius: 999,
        background: 'linear-gradient(90deg,#5b4fff,#0891b2)',
        width: `${pct}%`, transition: 'width .4s ease',
      }} />
    </div>
  );
}

// ─── Workflow sidebar card ───────────────────────────────────────────────────
function WorkflowCard({ session, isActive, onClick, onDelete, index }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const st         = stOf(session.status);
  const isRunning  = !['completed','failed','pending'].includes(session.status);
  const completed  = session.completed_tasks || 0;
  const total      = session.total_tasks     || 0;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setConfirmDelete(true);
    setTimeout(() => setConfirmDelete(false), 3000);
  };
  const handleConfirm = (e) => { e.stopPropagation(); onDelete(session.id); };
  const handleCancel  = (e) => { e.stopPropagation(); setConfirmDelete(false); };

  return (
    <div onClick={confirmDelete ? undefined : onClick} style={{
      padding: '12px 14px',
      borderRadius: 10,
      border: isActive ? '2px solid #5b4fff' : confirmDelete ? '1px solid #fca5a5' : '1px solid #e5e7eb',
      background: confirmDelete ? '#fff5f5' : isActive ? 'rgba(91,79,255,.04)' : '#fff',
      cursor: confirmDelete ? 'default' : 'pointer',
      transition: 'all .2s',
      boxShadow: isActive ? '0 0 0 3px rgba(91,79,255,.1)' : '0 1px 3px rgba(0,0,0,.06)',
      position: 'relative',
    }}>
      {/* Top row */}
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
        {/* Index badge */}
        <div style={{
          width:22, height:22, borderRadius:6, flexShrink:0,
          background: isActive ? '#5b4fff' : '#f3f4f6',
          color: isActive ? '#fff' : '#6b7280',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, fontWeight:800,
        }}>
          {index + 1}
        </div>

        {/* Status pill */}
        <span style={{
          fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:999,
          background: st.bg, color: st.color, letterSpacing:'.05em',
          textTransform:'uppercase', display:'flex', alignItems:'center', gap:4,
        }}>
          <span style={{
            width:5, height:5, borderRadius:'50%', background:st.dot, flexShrink:0,
            animation: isRunning ? 'pulse-anim 1.4s ease-in-out infinite' : 'none',
          }} />
          {st.label}
        </span>

        <span style={{ fontSize:10, color:'#9ca3af', marginLeft:'auto', flexShrink:0 }}>
          {fmtDate(session.created_at)}
        </span>

        {/* Inline 2-step delete */}
        {confirmDelete ? (
          <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <button onClick={handleConfirm} style={{
              background:'#dc2626', border:'none', borderRadius:5,
              color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px',
              cursor:'pointer', lineHeight:1.4,
            }}>Xóa</button>
            <button onClick={handleCancel} style={{
              background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:5,
              color:'#6b7280', fontSize:10, fontWeight:600, padding:'3px 7px',
              cursor:'pointer', lineHeight:1.4,
            }}>Hủy</button>
          </div>
        ) : (
          <button onClick={handleDeleteClick} title="Xóa workflow này" style={{
            background:'none', border:'none', cursor:'pointer',
            color:'#d1d5db', fontSize:13, padding:'2px 3px',
            borderRadius:4, lineHeight:1, flexShrink:0, transition:'color .15s',
          }}
          onMouseOver={e => e.currentTarget.style.color='#dc2626'}
          onMouseOut={e  => e.currentTarget.style.color='#d1d5db'}
          >🗑</button>
        )}
      </div>

      {/* Request text / warning */}
      <div style={{
        fontSize:12, fontWeight:600, lineHeight:1.4, overflow:'hidden',
        color: confirmDelete ? '#b91c1c' : '#111827',
        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
      }}>
        {confirmDelete ? '⚠️ Xóa workflow này? Không thể hoàn tác!' : session.request}
      </div>

      {/* Progress (hidden during confirm) */}
      {!confirmDelete && total > 0 && (
        <div style={{ marginTop:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#9ca3af', marginBottom:2 }}>
            <span>Tasks</span><span>{completed}/{total}</span>
          </div>
          <MiniProgress completed={completed} total={total} />
        </div>
      )}
    </div>
  );
}

// ─── Multi-Workflow Page ─────────────────────────────────────────────────────
export default function WorkflowsPage({
  sessions, activeSessionId, activeSession,
  events, tasks,
  onSelectSession, onSubmitRequest, onDeleteSession, isSubmitting,
}) {
  const [showModal,    setShowModal]    = useState(false);
  const [showMktModal, setShowMktModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText,   setSearchText]   = useState('');

  // Enrich sessions with task counts from current tasks
  const enrichedSessions = sessions.map(s => {
    if (s.id === activeSessionId) {
      return {
        ...s,
        total_tasks:     tasks.length,
        completed_tasks: tasks.filter(t => t.status === 'completed').length,
      };
    }
    return s;
  });

  const filtered = enrichedSessions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (searchText && !s.request?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const running   = sessions.filter(s => !['completed','failed'].includes(s.status));
  const completed = sessions.filter(s => s.status === 'completed');
  const failed    = sessions.filter(s => s.status === 'failed');

  const handleSubmit = useCallback((text) => {
    onSubmitRequest(text);
    setShowModal(false);
  }, [onSubmitRequest]);

  const handleMktSubmit = useCallback(({ request, docFolder }) => {
    onSubmitRequest(request, { docFolder });
    setShowMktModal(false);
  }, [onSubmitRequest]);

  return (
    <div style={{ height:'100%', display:'flex', overflow:'hidden' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div style={{
        width: 268, flexShrink:0,
        display:'flex', flexDirection:'column',
        background:'#fff',
        borderRight:'1px solid #e5e7eb',
        overflow:'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{ padding:'14px 14px 10px', flexShrink:0, borderBottom:'1px solid #f0f0f0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#111827' }}>
              Workflows
              <span style={{
                marginLeft:6, fontSize:10, fontWeight:700,
                background:'#ede9fe', color:'#5b4fff',
                padding:'1px 7px', borderRadius:999,
              }}>{sessions.length}</span>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {/* Universal Assistant button */}
              <button onClick={() => {
                  const req = window.prompt("Nhập yêu cầu cho Universal Assistant:", "Hãy nghiên cứu xu hướng AI hiện tại và lên kế hoạch marketing");
                  if (req) onSubmitRequest(req, { autonomous: true });
                }} 
                disabled={isSubmitting}
                title="Universal Executive Assistant (Đa năng, Tự trị)"
                style={{
                  padding:'5px 9px', borderRadius:8, border:'1px solid #e5e7eb',
                  background:'#fff', color:'#374151',
                  fontSize:13, fontWeight:700, cursor:'pointer',
                  transition:'all .15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background='#ecfeff'; e.currentTarget.style.borderColor='#22d3ee'; }}
                onMouseOut={e  => { e.currentTarget.style.background='#fff';    e.currentTarget.style.borderColor='#e5e7eb'; }}
              >🧠</button>
              {/* Marketing Plan button */}
              <button onClick={() => setShowMktModal(true)} disabled={isSubmitting}
                title="Tạo Marketing Plan từ tài liệu"
                style={{
                  padding:'5px 9px', borderRadius:8, border:'1px solid #e5e7eb',
                  background:'#fff', color:'#374151',
                  fontSize:13, fontWeight:700, cursor:'pointer',
                  transition:'all .15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background='#fdf4ff'; e.currentTarget.style.borderColor='#d8b4fe'; }}
                onMouseOut={e  => { e.currentTarget.style.background='#fff';    e.currentTarget.style.borderColor='#e5e7eb'; }}
              >📊</button>
              {/* New workflow button */}
              <button onClick={() => setShowModal(true)} disabled={isSubmitting}
                style={{
                  padding:'5px 12px', borderRadius:8, border:'none',
                  background:'#5b4fff', color:'#fff',
                  fontSize:11, fontWeight:700, cursor:'pointer',
                  boxShadow:'0 2px 8px rgba(91,79,255,.3)',
                  display:'flex', alignItems:'center', gap:5,
                }}>
                + New
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:6 }}>
            {[
              { label:'Active',    count:running.length,   color:'#16a34a', bg:'#f0fdf4' },
              { label:'Done',      count:completed.length, color:'#5b4fff', bg:'#ede9fe' },
              { label:'Failed',    count:failed.length,    color:'#dc2626', bg:'#fef2f2' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{
                flex:1, textAlign:'center', padding:'5px 0',
                background: bg, borderRadius:8,
              }}>
                <div style={{ fontSize:16, fontWeight:800, color }}>{count}</div>
                <div style={{ fontSize:9, color:'#9ca3af', fontWeight:600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding:'8px 10px', flexShrink:0, borderBottom:'1px solid #f0f0f0' }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af' }}>🔍</span>
            <input
              placeholder="Search workflows…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{
                width:'100%', padding:'6px 8px 6px 28px',
                border:'1px solid #e5e7eb', borderRadius:8,
                fontSize:12, outline:'none', background:'#f9fafb', color:'#111827',
              }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', padding:'6px 10px', gap:4, flexShrink:0, borderBottom:'1px solid #f0f0f0' }}>
          {[['all','All'],['working','Active'],['completed','Done'],['failed','Failed']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              style={{
                flex:1, padding:'4px 0',
                borderRadius:6, border:'none',
                background: filterStatus===k ? '#5b4fff' : 'transparent',
                color: filterStatus===k ? '#fff' : '#6b7280',
                fontSize:10, fontWeight:700, cursor:'pointer',
                transition:'all .15s',
              }}>{l}</button>
          ))}
        </div>

        {/* Workflow list */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 10px 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 10px', color:'#9ca3af' }}>
              <div style={{ fontSize:32, marginBottom:8, opacity:.3 }}>📋</div>
              <div style={{ fontSize:12 }}>No workflows yet</div>
              <button onClick={() => setShowModal(true)}
                style={{ marginTop:12, padding:'7px 16px', borderRadius:8, border:'1px solid #5b4fff',
                  background:'transparent', color:'#5b4fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                + Create first workflow
              </button>
            </div>
          ) : filtered.map((session, i) => (
            <WorkflowCard
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => onSelectSession(session.id)}
              onDelete={onDeleteSession}
              index={sessions.indexOf(session)}
            />
          ))}
        </div>
      </div>

      {/* ── MAIN KANBAN AREA ─────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {activeSession ? (
          <>
            {/* Workflow header bar */}
            <div style={{
              padding:'10px 20px',
              background:'#fff',
              borderBottom:'1px solid #e5e7eb',
              display:'flex', alignItems:'center', gap:12,
              flexShrink:0,
            }}>
              <div style={{
                width:32, height:32, borderRadius:9,
                background: stOf(activeSession.status).bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, flexShrink:0,
              }}>
                { activeSession.status === 'completed' ? '✅'
                : activeSession.status === 'failed'    ? '❌'
                : ['working','reviewing'].includes(activeSession.status) ? '⚙️'
                : activeSession.status === 'planning'  ? '🗺️'
                : '📋' }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {activeSession.request}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
                  <span style={{
                    fontSize:10, fontWeight:800,
                    color: stOf(activeSession.status).color,
                    textTransform:'uppercase', letterSpacing:'.04em',
                  }}>
                    {activeSession.status}
                  </span>
                  {tasks.length > 0 && (
                    <span style={{ fontSize:10, color:'#9ca3af' }}>
                      {tasks.filter(t=>t.status==='completed').length}/{tasks.length} tasks
                    </span>
                  )}
                  {activeSession.created_at && (
                    <span style={{ fontSize:10, color:'#d1d5db' }}>
                      {fmtDate(activeSession.created_at)}
                    </span>
                  )}
                </div>
              </div>
              {/* Quick actions */}
              <button onClick={() => setShowModal(true)}
                style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e5e7eb',
                  background:'#fff', color:'#5b4fff', fontSize:12, fontWeight:700,
                  cursor:'pointer', flexShrink:0 }}>
                + Parallel workflow
              </button>
            </div>

            <div style={{ flex:1, overflow:'hidden' }}>
              <WorkflowKanban events={events} tasks={tasks} session={activeSession} />
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            flexDirection:'column', gap:16, color:'#9ca3af',
            background: 'linear-gradient(135deg,#f8f9ff 0%,#f0f2f5 100%)',
          }}>
            <div style={{ fontSize:64, opacity:.15 }}>⚡</div>
            <div style={{ fontSize:20, fontWeight:800, color:'#374151' }}>
              No workflow selected
            </div>
            <div style={{ fontSize:14, color:'#9ca3af', maxWidth:360, textAlign:'center' }}>
              Select a workflow from the sidebar or create a new one to see the Kanban board
            </div>
            <button onClick={() => setShowModal(true)}
              style={{
                padding:'12px 28px', borderRadius:12, border:'none',
                background:'#5b4fff', color:'#fff', fontSize:14, fontWeight:700,
                cursor:'pointer', boxShadow:'0 4px 16px rgba(91,79,255,.35)',
              }}>
              🚀 Create First Workflow
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <NewRequestModal
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
      {showMktModal && (
        <MarketingPlanModal
          onSubmit={handleMktSubmit}
          onClose={() => setShowMktModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
