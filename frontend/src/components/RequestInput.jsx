import { useState } from 'react';

const QUICK_PROMPTS = [
  'Tạo một trang HTML với animation loading vòng tròn đẹp',
  'Viết REST API Node.js CRUD cho Todo app',
  'Thiết kế landing page cho SaaS product AI',
  'Viết tài liệu kỹ thuật cho microservice authentication',
];

export default function RequestInput({ onSubmit, isSubmitting, isConnected }) {
  const [text, setText] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!text.trim() || isSubmitting) return;
    await onSubmit(text.trim());
    setText('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <div style={{
      background:   '#fff',
      borderRight:  '1px solid #e5e7eb',
      display:      'flex',
      flexDirection:'column',
      height:       '100%',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #5b4fff, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 4px 16px rgba(91,79,255,.3)',
          }}>🏢</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-.01em' }}>Digital Office</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>AI Multi-Agent Workspace</div>
          </div>
        </div>

        {/* Connection status */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isConnected ? '#16a34a' : '#dc2626',
          }} />
          <span style={{ fontSize: 11, color: isConnected ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            {isConnected ? 'Connected' : 'Reconnecting…'}
          </span>
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8 }}>
            New Request
          </label>
          <form onSubmit={handleSubmit}>
            <textarea
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder={'Describe your task…\n(Ctrl+Enter to send)'}
              style={{ minHeight: 110, fontSize: 13 }}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
              disabled={!text.trim() || isSubmitting || !isConnected}
            >
              {isSubmitting ? (
                <><div className="spinner" style={{ width: 14, height: 14 }} /> Processing…</>
              ) : (
                <>🚀 Send to Office</>
              )}
            </button>
          </form>
        </div>

        {/* Quick prompts */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Quick Examples
          </div>
          {QUICK_PROMPTS.map((q, i) => (
            <button
              key={i}
              onClick={() => setText(q)}
              style={{
                width:        '100%',
                background:   '#f9fafb',
                border:       '1px solid #e5e7eb',
                borderRadius: 9,
                padding:      '8px 12px',
                color:        '#374151',
                fontSize:     11.5,
                textAlign:    'left',
                cursor:       'pointer',
                marginBottom: 6,
                lineHeight:   1.5,
                transition:   'all .15s',
                fontFamily:   'inherit',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.color = '#5b4fff'; e.currentTarget.style.borderColor = '#c4b5fd'; }}
              onMouseOut={(e)  => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.6 }}>
          <strong style={{ color: '#6b7280' }}>Powered by</strong><br />
          🤖 Claude Sonnet · Gemini Flash · Ollama
        </div>
      </div>
    </div>
  );
}
