import { useState } from 'react';

const STATUS_COLORS = {
  pending:   'gray',
  working:   'green',
  reviewing: 'amber',
  revision:  'pink',
  completed: 'green',
  failed:    'red',
};

const TEAM_ICONS = { frontend: '🎨', backend: '⚙️', content: '✍️', design: '🖌️', qa: '🔍' };

function ArtifactViewer({ content }) {
  let artifact;
  try { artifact = typeof content === 'string' ? JSON.parse(content) : content; } catch { artifact = null; }
  if (!artifact) return <p style={{ color: '#374151', fontSize: 13 }}>{String(content).slice(0, 500)}</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <span className={`badge badge-purple`}>📄 {artifact.type}</span>
        <span className={`badge badge-cyan`}>{artifact.language}</span>
        <code style={{ fontSize: 11, color: '#5b4fff', marginLeft: 'auto' }}>{artifact.filename}</code>
      </div>
      <pre style={{ maxHeight: 340, fontSize: 11.5 }}>{artifact.content}</pre>
    </div>
  );
}

function TaskCard({ task, isSelected, onClick }) {
  const statusColor = STATUS_COLORS[task.status] || 'gray';
  const outputs  = task.outputs  || [];
  const reviews  = task.reviews  || [];
  const lastReview = reviews[reviews.length - 1];

  return (
    <div
      onClick={onClick}
      style={{
        background:   isSelected ? 'rgba(91,79,255,.08)' : '#fff',
        border:       `1px solid ${isSelected ? '#c7d2fe' : '#e5e7eb'}`,
        borderRadius: 12,
        padding:      '12px 14px',
        cursor:       'pointer',
        transition:   'all .2s',
        marginBottom: 8,
        boxShadow:    '0 1px 3px rgba(0,0,0,.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 16 }}>{TEAM_ICONS[task.team] || '📌'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4, lineHeight: 1.4 }}>{task.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge badge-${statusColor}`}>
              <span className={`status-dot ${task.status}`} />
              {task.status}
            </span>
            <span className="badge badge-gray">{task.team}</span>
            {task.revision_count > 0 && (
              <span className="badge badge-amber">🔄 rev.{task.revision_count}</span>
            )}
            {lastReview?.score && (
              <span className="badge badge-purple">⭐ {lastReview.score}/10</span>
            )}
          </div>
          {task.assigned_to && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>👤 {task.assigned_to}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskPanel({ tasks, session }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = tasks.find((t) => t.id === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 2 }}>
          📋 Tasks
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} •{' '}
          {tasks.filter((t) => t.status === 'completed').length} completed
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Task list */}
        <div className="scroll-y" style={{ width: selected ? '42%' : '100%', padding: '12px', borderRight: selected ? '1px solid #e5e7eb' : 'none', transition: 'width .3s' }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 13 }}>No tasks yet.<br/>Submit a request to start.</div>
            </div>
          ) : (
            tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                isSelected={t.id === selectedId}
                onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
              />
            ))
          )}
        </div>

        {/* Task detail */}
        {selected && (
          <div className="scroll-y fade-in" style={{ flex: 1, padding: '14px' }}>
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, marginBottom: 10 }} onClick={() => setSelectedId(null)}>← Back</button>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 8 }}>{selected.title}</div>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>{selected.description}</p>
            </div>

            {/* Reviews */}
            {(selected.reviews || []).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Reviews</div>
                {selected.reviews.map((r, i) => (
                  <div key={i} style={{
                    background: r.decision === 'approved' ? '#f0fdf4' : '#fffbeb',
                    border:     `1px solid ${r.decision === 'approved' ? '#86efac' : '#fcd34d'}`,
                    borderRadius: 10, padding: '10px 12px', marginBottom: 8, fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, color: r.decision === 'approved' ? '#16a34a' : '#d97706' }}>
                        {r.decision === 'approved' ? '✅ Approved' : '🔄 Revision'}
                      </span>
                      <span style={{ color: '#6b7280' }}>⭐ {r.score}/10</span>
                    </div>
                    <p style={{ color: '#374151', lineHeight: 1.5 }}>{r.feedback}</p>
                    {r.revision_instruction && (
                      <p style={{ marginTop: 6, color: '#d97706', lineHeight: 1.5, fontSize: 11 }}>→ {r.revision_instruction}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Latest artifact */}
            {(selected.outputs || []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Latest Artifact (rev.{selected.outputs.length - 1})
                </div>
                <ArtifactViewer content={selected.outputs[selected.outputs.length - 1].content} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
