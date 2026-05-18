import { useState } from 'react';

// ─── Simple Markdown → HTML renderer (no external deps) ──────────────────────
function renderMarkdown(md = '') {
  if (!md) return '';
  let html = md
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="md-code" data-lang="${lang}"><code>${escHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/__(.+?)__/g,         '<strong>$1</strong>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr class="md-hr" />')
    // Unordered list items
    .replace(/^[-*•] (.+)$/gm, '<li class="md-li">$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li md-oli">$1</li>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="md-bq">$1</blockquote>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="md-p">')
    // Single newlines to <br>
    .replace(/\n/g, '<br/>');

  // Wrap bare text in paragraph
  if (!html.startsWith('<')) html = `<p class="md-p">${html}</p>`;
  return html;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getLanguageLabel(lang = '') {
  const map = {
    javascript:'JavaScript', typescript:'TypeScript', python:'Python',
    html:'HTML', css:'CSS', markdown:'Markdown', json:'JSON',
    bash:'Shell', sql:'SQL', plaintext:'Text', document:'Document',
    design_spec:'Design Spec',
  };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}

function getTypeIcon(type = '') {
  const map = { code:'💻', document:'📄', design_spec:'🎨', config:'⚙️', test:'🧪', markdown:'📝' };
  return map[type?.toLowerCase()] || '📄';
}

function parseArtifact(rawContent) {
  if (!rawContent) return null;
  try {
    const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    // Handle {artifact: {...}} wrapper or direct object
    const art = parsed.artifact || parsed;
    if (art && (art.type || art.content || art.filename)) return art;
  } catch {}
  // Fallback: treat as plain text
  return { type: 'document', language: 'plaintext', filename: 'output.txt', content: rawContent };
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const pct   = Math.max(0, Math.min(10, score)) / 10 * 100;
  const color = score >= 8 ? '#16a34a' : score >= 6 ? '#d97706' : '#dc2626';
  const r = 18, circ = 2 * Math.PI * r;
  return (
    <div style={{ position:'relative', width:48, height:48, flexShrink:0 }}>
      <svg width={48} height={48} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={24} cy={24} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={circ - (pct/100)*circ}
          strokeLinecap="round" style={{ transition:'stroke-dashoffset .5s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, fontWeight:800, color }}>
        {Number(score).toFixed(1)}
      </div>
    </div>
  );
}

// ─── Artifact Viewer ──────────────────────────────────────────────────────────
function ArtifactViewer({ rawContent }) {
  const [view,   setView]   = useState('rendered'); // 'rendered' | 'raw'
  const [copied, setCopied] = useState(false);

  const artifact = parseArtifact(rawContent);
  if (!artifact) return null;

  const isMarkdown = ['markdown', 'document'].includes((artifact.language || artifact.type || '').toLowerCase());
  const isCode     = ['javascript','typescript','python','html','css','json','bash','sql'].includes((artifact.language||'').toLowerCase());
  const content    = artifact.content || '';

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const download = () => {
    const ext  = { javascript:'js', typescript:'ts', python:'py', html:'html', css:'css',
                   json:'json', bash:'sh', sql:'sql', markdown:'md' }[artifact.language] || 'txt';
    const name = artifact.filename || `output.${ext}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
        background:'#f1f5f9', borderBottom:'1px solid #e2e8f0',
      }}>
        <span style={{ fontSize:15 }}>{getTypeIcon(artifact.type)}</span>
        <code style={{ fontSize:12, color:'#5b4fff', flex:1, minWidth:0,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {artifact.filename || 'output'}
        </code>
        <span style={{
          fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999,
          background:'rgba(91,79,255,.1)', color:'#5b4fff', border:'1px solid rgba(91,79,255,.2)',
          flexShrink:0,
        }}>
          {getLanguageLabel(artifact.language || artifact.type)}
        </span>

        {/* Toggle: Rendered / Raw */}
        {isMarkdown && (
          <div style={{ display:'flex', border:'1px solid #e2e8f0', borderRadius:7, overflow:'hidden' }}>
            {['rendered','raw'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding:'3px 10px', fontSize:10, fontWeight:700, border:'none',
                background: view === v ? '#5b4fff' : '#fff',
                color: view === v ? '#fff' : '#6b7280',
                cursor:'pointer', transition:'all .15s',
              }}>{v === 'rendered' ? '📖 Preview' : '📝 Source'}</button>
            ))}
          </div>
        )}

        <button onClick={copy} style={{
          padding:'4px 10px', fontSize:11, background:'#fff', border:'1px solid #e2e8f0',
          borderRadius:6, cursor:'pointer', color:'#374151', fontWeight:600,
        }}>
          {copied ? '✅ Copied' : '📋 Copy'}
        </button>
        <button onClick={download} style={{
          padding:'4px 10px', fontSize:11, background:'#fff', border:'1px solid #e2e8f0',
          borderRadius:6, cursor:'pointer', color:'#374151', fontWeight:600,
        }}>
          ⬇️ Save
        </button>
      </div>

      {/* Content */}
      {isMarkdown && view === 'rendered' ? (
        <div className="md-body" style={{ padding:'20px 24px', maxHeight:520, overflowY:'auto' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      ) : (
        <pre style={{
          padding:'16px', margin:0, fontSize:12, lineHeight:1.65,
          color: isCode ? '#1e293b' : '#374151',
          overflowX:'auto', maxHeight:480, overflowY:'auto',
          fontFamily:"'JetBrains Mono','Fira Code',monospace",
          whiteSpace:'pre-wrap', wordBreak:'break-word',
        }}>
          {content || '(empty)'}
        </pre>
      )}
    </div>
  );
}

// ─── Review Summary ───────────────────────────────────────────────────────────
function ReviewSummary({ review }) {
  const approved = review.decision === 'approved';
  return (
    <div style={{
      margin:'12px 0 10px', padding:'12px 16px', borderRadius:10,
      background: approved ? '#f0fdf4' : '#fffbeb',
      border: `1px solid ${approved ? '#86efac' : '#fcd34d'}`,
    }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        <ScoreRing score={Number(review.score) || 0} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:800, marginBottom:5,
            color: approved ? '#16a34a' : '#d97706' }}>
            {approved ? '✅ Approved' : '🔄 Revision Requested'}
            <span style={{ fontWeight:400, fontSize:11, color:'#6b7280', marginLeft:8 }}>
              Score: {Number(review.score).toFixed(1)}/10
            </span>
          </div>
          {review.feedback && (
            <p style={{ fontSize:12, color:'#374151', lineHeight:1.7, margin:'0 0 8px' }}>
              {review.feedback}
            </p>
          )}
          {(review.strengths?.length > 0) && (
            <div style={{ marginBottom:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', marginBottom:3 }}>✓ Strengths</div>
              {review.strengths.map((s, i) => (
                <div key={i} style={{ fontSize:11, color:'#166534', paddingLeft:10 }}>• {s}</div>
              ))}
            </div>
          )}
          {(review.issues?.length > 0) && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#d97706', marginBottom:3 }}>⚠ Issues</div>
              {review.issues.map((s, i) => (
                <div key={i} style={{ fontSize:11, color:'#92400e', paddingLeft:10 }}>• {s}</div>
              ))}
            </div>
          )}
          {review.revision_instruction && (
            <div style={{ marginTop:8, padding:'7px 10px', borderRadius:7,
              background:'rgba(217,119,6,.08)', border:'1px solid #fcd34d',
              fontSize:11, color:'#92400e' }}>
              📌 {review.revision_instruction}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Output Card ─────────────────────────────────────────────────────────
function TaskOutputCard({ task }) {
  const [expanded,       setExpanded]       = useState(true);
  const [showRerun,      setShowRerun]      = useState(false);
  const [rerunText,      setRerunText]      = useState('');
  const [rerunLoading,   setRerunLoading]   = useState(false);
  const [rerunFeedback,  setRerunFeedback]  = useState('');

  const outputs  = task.outputs || [];
  const reviews  = task.reviews || [];
  const lastOut  = outputs[outputs.length - 1];
  const lastRev  = reviews[reviews.length - 1];

  const STATUS = {
    completed: { color:'#16a34a', bg:'#f0fdf4', border:'rgba(22,163,74,.25)', dot:'#22c55e' },
    working:   { color:'#0891b2', bg:'#f0f9ff', border:'#bae6fd',             dot:'#38bdf8' },
    reviewing: { color:'#d97706', bg:'#fffbeb', border:'#fde68a',             dot:'#fbbf24' },
    revision:  { color:'#db2777', bg:'#fdf2f8', border:'#f9a8d4',             dot:'#ec4899' },
    failed:    { color:'#dc2626', bg:'#fef2f2', border:'#fca5a5',             dot:'#f87171' },
    pending:   { color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb',             dot:'#9ca3af' },
  };
  const st = STATUS[task.status] || STATUS.pending;
  const canRerun = ['completed', 'failed', 'revision'].includes(task.status);

  const handleRerun = async () => {
    setRerunLoading(true);
    setRerunFeedback('');
    try {
      await fetch(`http://localhost:3001/api/tasks/${task.id}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: rerunText }),
      });
      setRerunFeedback('✅ Đã gửi! Agent đang chạy lại…');
      setRerunText('');
      setTimeout(() => { setShowRerun(false); setRerunFeedback(''); }, 2500);
    } catch (e) {
      setRerunFeedback('❌ Lỗi: ' + e.message);
    } finally {
      setRerunLoading(false);
    }
  };

  return (
    <div style={{
      background:'#fff', border:`1px solid ${st.border}`,
      borderRadius:12, marginBottom:16, overflow:'hidden',
      boxShadow:'0 1px 4px rgba(0,0,0,.07)',
      transition:'border-color .3s',
    }}>
      {/* Card header */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
        cursor:'pointer', background: st.bg,
        borderBottom: expanded ? `1px solid ${st.border}` : 'none',
      }} onClick={() => setExpanded(!expanded)}>

        {/* Status dot */}
        <div style={{
          width:9, height:9, borderRadius:'50%', background: st.dot, flexShrink:0,
          animation: ['working','reviewing','revision'].includes(task.status) ? 'pulse-anim 1.4s ease-in-out infinite' : 'none',
        }} />

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:3 }}>
            {task.title}
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{
              fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:999,
              background: st.bg, color: st.color, border:`1px solid ${st.border}`,
              textTransform:'uppercase', letterSpacing:'.05em',
            }}>{task.status}</span>
            {task.team && (
              <span style={{ fontSize:10, color:'#6b7280', display:'flex', alignItems:'center', gap:3 }}>
                🏷️ {task.team}
              </span>
            )}
            {task.assigned_to && (
              <span style={{ fontSize:10, color:'#6b7280' }}>👤 {task.assigned_to}</span>
            )}
            {task.revision_count > 0 && (
              <span style={{ fontSize:10, color:'#db2777', fontWeight:700 }}>
                🔄 {task.revision_count} revision{task.revision_count > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Score ring */}
        {lastRev?.score && <ScoreRing score={Number(lastRev.score)} />}

        {/* Rerun toggle — stop propagation so it doesn't collapse card */}
        {canRerun && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowRerun(!showRerun); }}
            style={{
              padding:'4px 10px', fontSize:11, fontWeight:700, borderRadius:7, border:'none',
              background: showRerun ? '#5b4fff' : '#f3f4f6',
              color: showRerun ? '#fff' : '#374151',
              cursor:'pointer', transition:'all .2s', flexShrink:0,
              display:'flex', alignItems:'center', gap:4,
            }}
            title="Chạy lại task này với hướng dẫn mới"
          >
            🔁 Chạy lại
          </button>
        )}

        <span style={{ fontSize:12, color:'#9ca3af', marginLeft:4 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Rerun Panel ─────────────────────────────────────────────────────── */}
      {showRerun && (
        <div style={{
          padding:'14px 16px', background:'#f8f5ff',
          borderBottom:`1px solid #e9d5ff`,
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#5b4fff', marginBottom:8 }}>
            🔁 Chạy lại Task: <span style={{ fontWeight:400, color:'#374151' }}>{task.title}</span>
          </div>
          <textarea
            value={rerunText}
            onChange={(e) => setRerunText(e.target.value)}
            placeholder={`Nhập lý do / yêu cầu sửa đổi cụ thể...\nVí dụ: "Đoạn 2 bị sai dữ liệu, hãy dùng số liệu năm 2026", "Viết lại bằng giọng văn chuyên nghiệp hơn", "Thêm bảng so sánh vào phần kết luận"…`}
            style={{
              width:'100%', minHeight:80, padding:'10px 12px', borderRadius:8,
              border:'1px solid #c4b5fd', fontSize:12, lineHeight:1.6, resize:'vertical',
              fontFamily:'inherit', outline:'none', boxSizing:'border-box',
              color:'#1f2937', background:'#fff',
            }}
          />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
            {rerunFeedback ? (
              <span style={{ fontSize:12, color: rerunFeedback.startsWith('✅') ? '#16a34a' : '#dc2626', fontWeight:600 }}>
                {rerunFeedback}
              </span>
            ) : (
              <span style={{ fontSize:11, color:'#9ca3af' }}>
                Để trống sẽ chạy lại với mô tả ban đầu
              </span>
            )}
            <div style={{ display:'flex', gap:6 }}>
              <button
                onClick={() => { setShowRerun(false); setRerunText(''); }}
                style={{
                  padding:'5px 14px', fontSize:11, fontWeight:700, borderRadius:7,
                  border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', cursor:'pointer',
                }}
              >Hủy</button>
              <button
                onClick={handleRerun}
                disabled={rerunLoading}
                style={{
                  padding:'5px 16px', fontSize:11, fontWeight:800, borderRadius:7,
                  border:'none', background: rerunLoading ? '#a5b4fc' : '#5b4fff',
                  color:'#fff', cursor: rerunLoading ? 'default' : 'pointer',
                  boxShadow:'0 2px 6px rgba(91,79,255,.35)',
                  display:'flex', alignItems:'center', gap:5,
                }}
              >
                {rerunLoading ? '⏳ Đang gửi…' : '🚀 Chạy lại ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding:'16px' }}>

          {/* Description */}
          {task.description && (
            <p style={{ fontSize:12, color:'#374151', lineHeight:1.7, marginBottom:12, marginTop:0 }}>
              {task.description}
            </p>
          )}

          {/* Review */}
          {lastRev && <ReviewSummary review={lastRev} />}

          {/* Artifact */}
          {lastOut?.content ? (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280',
                textTransform:'uppercase', letterSpacing:'.05em', margin:'12px 0 8px',
                display:'flex', alignItems:'center', gap:6 }}>
                📦 Artifact
                {outputs.length > 1 && (
                  <span style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'none', letterSpacing:0 }}>
                    (revision {outputs.length - 1})
                  </span>
                )}
              </div>
              <ArtifactViewer rawContent={lastOut.content} />
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'24px 0', color:'#9ca3af', fontSize:12 }}>
              {['working','reviewing'].includes(task.status)
                ? '⏳ Worker is generating output…'
                : 'No artifact produced for this task'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Final Response Block ─────────────────────────────────────────────────────
function FinalResponse({ text }) {
  const [view, setView] = useState('rendered');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      background:'#f0fdf4', border:'2px solid #86efac',
      borderRadius:14, overflow:'hidden', marginTop:12,
      boxShadow:'0 2px 12px rgba(22,163,74,.08)',
    }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'12px 18px',
        borderBottom:'1px solid #bbf7d0',
        background:'linear-gradient(90deg,rgba(22,163,74,.07),transparent)',
      }}>
        <span style={{ fontSize:16 }}>✅</span>
        <span style={{ fontSize:14, fontWeight:800, color:'#15803d', flex:1 }}>
          Final Response
        </span>
        <div style={{ display:'flex', border:'1px solid #86efac', borderRadius:7, overflow:'hidden' }}>
          {['rendered','raw'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'3px 10px', fontSize:10, fontWeight:700, border:'none',
              background: view === v ? '#16a34a' : '#fff',
              color: view === v ? '#fff' : '#6b7280',
              cursor:'pointer',
            }}>{v === 'rendered' ? '📖 Preview' : '📝 Source'}</button>
          ))}
        </div>
        <button onClick={copy} style={{
          padding:'4px 12px', fontSize:11, background:'#fff',
          border:'1px solid #86efac', borderRadius:6, cursor:'pointer',
          color:'#15803d', fontWeight:600,
        }}>
          {copied ? '✅ Copied' : '📋 Copy'}
        </button>
      </div>

      {/* Content */}
      {view === 'rendered' ? (
        <div className="md-body" style={{ padding:'18px 24px', maxHeight:600, overflowY:'auto' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      ) : (
        <pre style={{ padding:'18px 24px', margin:0, fontSize:12, lineHeight:1.7,
          color:'#166534', whiteSpace:'pre-wrap', wordBreak:'break-word',
          maxHeight:600, overflowY:'auto' }}>
          {text}
        </pre>
      )}
    </div>
  );
}

// ─── Main Output Panel ────────────────────────────────────────────────────────
export default function OutputPanel({ tasks = [], session }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const completedCount  = tasks.filter(t => t.status === 'completed').length;
  const inProgressCount = tasks.filter(t => ['working','reviewing','revision'].includes(t.status)).length;
  const totalCount      = tasks.length;

  const filtered = activeFilter === 'done'     ? tasks.filter(t => t.status === 'completed')
                 : activeFilter === 'progress' ? tasks.filter(t => ['working','reviewing','revision'].includes(t.status))
                 : tasks;

  if (!session) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:12, color:'#9ca3af',
      background:'linear-gradient(135deg,#f8f9ff 0%,#f0f2f5 100%)' }}>
      <div style={{ fontSize:48, opacity:.15 }}>📄</div>
      <div style={{ fontSize:16, fontWeight:800, color:'#374151' }}>No workflow selected</div>
      <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', maxWidth:320 }}>
        Select a workflow from the Workflows tab to view task outputs here
      </div>
    </div>
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden',
      background:'#f8f9fb' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ padding:'16px 24px 12px', flexShrink:0,
        background:'#fff', borderBottom:'1px solid #e5e7eb' }}>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ flex:1, minWidth:0, marginRight:20 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#111827', marginBottom:4 }}>
              📦 Task Outputs
            </div>
            <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5,
              overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
              {session.request}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:16, flexShrink:0 }}>
            {[
              { count: completedCount,  label:'Done',     color:'#16a34a', bg:'#f0fdf4' },
              { count: inProgressCount, label:'Active',   color:'#d97706', bg:'#fffbeb' },
              { count: totalCount,      label:'Total',    color:'#5b4fff', bg:'#ede9fe' },
            ].map(({ count, label, color, bg }) => (
              <div key={label} style={{ textAlign:'center', padding:'6px 12px', borderRadius:10, background:bg }}>
                <div style={{ fontSize:20, fontWeight:800, color }}>{count}</div>
                <div style={{ fontSize:9, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', marginTop:1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height:4, borderRadius:999, background:'#e5e7eb', overflow:'hidden', marginBottom:10 }}>
          <div style={{
            height:'100%', borderRadius:999,
            background:'linear-gradient(90deg,#5b4fff,#16a34a)',
            width: totalCount > 0 ? `${(completedCount/totalCount)*100}%` : '0%',
            transition:'width .5s ease',
          }} />
        </div>

        {/* Filter tabs and Feedback button */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:6 }}>
            {[['all','All Tasks'], ['done','✅ Done'], ['progress','⏳ Active']].map(([k, l]) => (
              <button key={k} onClick={() => setActiveFilter(k)}
                style={{
                  padding:'5px 14px', fontSize:11, fontWeight:700, borderRadius:8, border:'none',
                  background: activeFilter === k ? '#5b4fff' : '#f3f4f6',
                  color: activeFilter === k ? '#fff' : '#374151',
                  cursor:'pointer', transition:'all .15s',
                }}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={async () => {
              const feedback = window.prompt("Nhập sửa đổi/yêu cầu cho AI đang chạy (Ví dụ: Yêu cầu viết lại đoạn 2, Yêu cầu dùng thẻ table, v.v.):");
              if (!feedback) return;
              try {
                await fetch(`http://localhost:3001/api/sessions/${session.id}/feedback`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ feedback })
                });
                alert('Đã gửi yêu cầu! AI sẽ áp dụng sửa đổi ở bước Review/Revision kế tiếp.');
              } catch (e) { alert('Lỗi: ' + e.message); }
            }}
            disabled={inProgressCount === 0}
            style={{
              padding:'5px 14px', fontSize:11, fontWeight:800, borderRadius:8, border:'none',
              background: inProgressCount > 0 ? '#dc2626' : '#fca5a5',
              color: '#fff', cursor: inProgressCount > 0 ? 'pointer' : 'default',
              display:'flex', alignItems:'center', gap:4,
              boxShadow: inProgressCount > 0 ? '0 2px 4px rgba(220,38,38,.3)' : 'none'
            }}
            title={inProgressCount === 0 ? "Chỉ khả dụng khi có tác vụ đang chạy" : "Gửi yêu cầu sửa đổi cho AI"}
          >
            🛑 Can thiệp AI (Gửi lỗi/Feedback)
          </button>
        </div>
      </div>

      {/* ── Task list ───────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:13 }}>
            {tasks.length === 0
              ? '⏳ Tasks will appear here as the planner decomposes your request…'
              : 'No tasks match this filter'}
          </div>
        ) : (
          filtered.map(task => <TaskOutputCard key={task.id} task={task} />)
        )}

        {/* Final response block */}
        {session.final_response && <FinalResponse text={session.final_response} />}
      </div>

      {/* ── Markdown styles ─────────────────────────────────────────────────── */}
      <style>{`
        .md-body { font-family: 'Inter', system-ui, sans-serif; }
        .md-body p.md-p { font-size:13px; color:#374151; line-height:1.75; margin:0 0 12px; }
        .md-body h1.md-h1 { font-size:20px; font-weight:800; color:#111827; margin:20px 0 10px; }
        .md-body h2.md-h2 { font-size:17px; font-weight:700; color:#1f2937; margin:18px 0 8px; border-bottom:1px solid #e5e7eb; padding-bottom:6px; }
        .md-body h3.md-h3 { font-size:14px; font-weight:700; color:#374151; margin:14px 0 6px; }
        .md-body li.md-li { font-size:13px; color:#374151; line-height:1.7; margin:3px 0 3px 18px; list-style:disc; display:list-item; }
        .md-body li.md-oli { list-style:decimal; }
        .md-body strong { color:#111827; font-weight:700; }
        .md-body em { color:#4b5563; font-style:italic; }
        .md-body code.md-inline-code { background:#f1f5f9; color:#5b4fff; padding:1px 6px; border-radius:4px; font-size:12px; font-family:monospace; }
        .md-body pre.md-code { background:#1e293b; color:#e2e8f0; padding:14px 18px; border-radius:9px; overflow-x:auto; margin:12px 0; font-size:12px; line-height:1.65; }
        .md-body pre.md-code code { background:none; color:inherit; padding:0; font-size:inherit; }
        .md-body blockquote.md-bq { border-left:3px solid #c7d2fe; padding:6px 14px; background:#f8f9ff; color:#4b5563; border-radius:0 6px 6px 0; margin:10px 0; font-style:italic; font-size:13px; }
        .md-body hr.md-hr { border:none; border-top:1px solid #e5e7eb; margin:16px 0; }
      `}</style>
    </div>
  );
}
