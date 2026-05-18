import { useState } from 'react';

const QUICK = [
  'Tạo một trang HTML với animation loading vòng tròn đẹp',
  'Viết REST API Node.js CRUD cho Todo app',
  'Thiết kế landing page cho SaaS product AI',
  'Viết tài liệu kỹ thuật cho microservice authentication',
];

export default function NewRequestModal({ onSubmit, onClose, isSubmitting }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const t = text.trim();
    if (!t || isSubmitting) return;
    onSubmit(t);
    setText('');
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-title">🚀 New Request</div>
        <div className="modal-sub">Describe your task — the AI team will plan, assign and execute it.</div>

        <textarea
          className="input"
          style={{ minHeight: 120, marginBottom: 14 }}
          placeholder="e.g. Tạo một trang HTML với animation loading đẹp…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />

        {/* Quick examples */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Quick examples
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {QUICK.map((q) => (
              <button key={q} className="btn btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 11 }}
                onClick={() => setText(q)}>
                ↗ {q}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!text.trim() || isSubmitting}>
            {isSubmitting ? '⏳ Sending…' : '✈️ Send to Office'}&nbsp;
            <span style={{ fontSize: 10, opacity: .7 }}>Ctrl+Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
