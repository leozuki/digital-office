import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:3001/api/music-cover';

// ─── Phase step component ─────────────────────────────────────────────────────
function PhaseStep({ step, status, detail }) {
  const icon = status === 'done' ? '✅' : status === 'warning' ? '⚠️' : status === 'running' ? '⏳' : '⭕';
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0',
      borderBottom:'1px solid #f0f0f0' }}>
      <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{step}</div>
        {detail && <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{detail}</div>}
      </div>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding:'4px 10px', fontSize:11, borderRadius:6, border:'1px solid #e5e7eb',
        background:'#fff', cursor:'pointer', fontWeight:600, color:'#374151' }}>
      {copied ? '✅ Copied' : '📋 Copy'}
    </button>
  );
}

// ─── Image grid ───────────────────────────────────────────────────────────────
function ImageGrid({ images, sessionId }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
      {images.map((img, i) => (
        <div key={i} style={{ borderRadius:8, overflow:'hidden', border:'1px solid #e5e7eb',
          background:'#f8f9fb', position:'relative' }}>
          {img.generated ? (
            <img
              src={`${API.replace('/api/music-cover','')}/api/music-cover/image/${sessionId}/${img.fileName}`}
              alt={img.scene}
              style={{ width:'100%', aspectRatio:'1', objectFit:'cover', display:'block' }}
            />
          ) : (
            <div style={{ aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:4, padding:8 }}>
              <span style={{ fontSize:20 }}>🎨</span>
              <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center' }}>Prompt ready</div>
            </div>
          )}
          <div style={{ padding:'6px 8px', background:'#fff' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#374151', marginBottom:2 }}>
              {i + 1}. {img.scene}
            </div>
            <div style={{ fontSize:8, color:'#9ca3af' }}>{img.timing}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Suno panel ───────────────────────────────────────────────────────────────
function SunoPanel({ sunoResult, musicData }) {
  const [tab, setTab] = useState('lyrics');
  if (!musicData) return null;
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
      <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', background:'#f8f9fb' }}>
        {[['lyrics','🎵 Lời nhạc'],['style','🎨 Style'],['steps','📋 Hướng dẫn']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:'10px 16px', fontSize:12, fontWeight:700, border:'none',
            background: tab===k ? '#5b4fff' : 'transparent',
            color: tab===k ? '#fff' : '#6b7280', cursor:'pointer',
          }}>{l}</button>
        ))}
        <a href="https://suno.com/create" target="_blank" rel="noopener noreferrer"
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', padding:'0 14px',
            fontSize:11, color:'#5b4fff', fontWeight:700, textDecoration:'none' }}>
          🚀 Mở Suno →
        </a>
      </div>
      <div style={{ padding:16 }}>
        {tab === 'lyrics' && (
          <>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
              <CopyBtn text={musicData.sunoLyrics || ''} />
            </div>
            <pre style={{ background:'#f8f9fb', borderRadius:8, padding:'12px 16px',
              fontSize:12, lineHeight:1.7, margin:0, whiteSpace:'pre-wrap',
              maxHeight:300, overflowY:'auto', fontFamily:'monospace' }}>
              {musicData.sunoLyrics || 'Đang xử lý...'}
            </pre>
          </>
        )}
        {tab === 'style' && (
          <>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
              <CopyBtn text={musicData.sunoStylePrompt || ''} />
            </div>
            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8,
              padding:'12px 16px', fontSize:13, color:'#0369a1', lineHeight:1.7 }}>
              {musicData.sunoStylePrompt}
            </div>
            <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
              {[musicData.genre, musicData.mood, musicData.tempo,
                ...(musicData.keyInstruments||[])].filter(Boolean).map((tag,i) => (
                <span key={i} style={{ fontSize:10, padding:'3px 9px', borderRadius:999,
                  background:'#ede9fe', color:'#5b4fff', fontWeight:700 }}>{tag}</span>
              ))}
            </div>
          </>
        )}
        {tab === 'steps' && sunoResult?.manualSteps && (
          <div>
            <a href="https://suno.com/create" target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-block', marginBottom:12, padding:'8px 20px', borderRadius:8,
                background:'linear-gradient(135deg,#1a1a2e,#16213e)',
                color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none' }}>
              🚀 Mở Suno.com →
            </a>
            {(sunoResult.manualSteps.steps||[]).map((s,i) => (
              <div key={i} style={{ padding:'6px 0', fontSize:12, color:'#374151',
                borderBottom:'1px solid #f0f0f0', display:'flex', gap:8 }}>
                <span style={{ color:'#5b4fff', fontWeight:800, flexShrink:0 }}>{i+1}.</span>
                <span>{s.replace(/^\d+\.\s*/,'')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Music Cover Page ────────────────────────────────────────────────────
export default function MusicCoverPage() {
  const [url,       setUrl]       = useState('');
  const [runSuno,   setRunSuno]   = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [job,       setJob]       = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [activeTab, setActiveTab] = useState('progress');
  const esRef = useRef(null);

  const isRunning = job?.status === 'running';
  const isDone    = job?.status === 'completed';

  const startJob = async () => {
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    setJob(null);
    setActiveTab('progress');
    try {
      const res = await fetch(`${API}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url.trim(), runSuno }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSessionId(data.sessionId);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // SSE listener
  useEffect(() => {
    if (!sessionId) return;
    esRef.current?.close();
    const es = new EventSource(`${API}/status/${sessionId}`);
    esRef.current = es;
    es.addEventListener('state', e => {
      const data = JSON.parse(e.data);
      setJob(data);
      if (['completed','failed'].includes(data.status)) es.close();
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [sessionId]);

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden',
      background:'#f8f9fb' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ padding:'16px 24px', background:'#fff', borderBottom:'1px solid #e5e7eb',
        flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:800, color:'#111827', marginBottom:4 }}>
          🎵 Music Cover Workflow
        </div>
        <div style={{ fontSize:12, color:'#6b7280' }}>
          YouTube → Lời Việt + Suno Prompt → 10 Hình ảnh → Canva Video Brief
        </div>
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div style={{ padding:'16px 24px', background:'#fff', borderBottom:'1px solid #e5e7eb',
        flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
              fontSize:16 }}>▶️</span>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startJob()}
              placeholder="Dán link YouTube vào đây... (ví dụ: https://youtu.be/xxx)"
              style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:10,
                border:'1px solid #e5e7eb', fontSize:13, color:'#374151',
                outline:'none', boxSizing:'border-box' }}
            />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
            color:'#374151', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
            <input type="checkbox" checked={runSuno} onChange={e => setRunSuno(e.target.checked)}
              style={{ accentColor:'#5b4fff' }} />
            🤖 Tự động Suno
          </label>
          <button onClick={startJob} disabled={loading || isRunning || !url.trim()}
            style={{ padding:'10px 20px', borderRadius:10, border:'none',
              background: (loading||isRunning||!url.trim()) ? '#e5e7eb' : 'linear-gradient(135deg,#5b4fff,#8b5cf6)',
              color: (loading||isRunning||!url.trim()) ? '#9ca3af' : '#fff',
              fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0,
              boxShadow:(loading||isRunning) ? 'none' : '0 4px 14px rgba(91,79,255,.3)',
            }}>
            {loading ? '⏳' : isRunning ? '⚙️ Đang xử lý...' : '🚀 Bắt đầu'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop:8, padding:'8px 12px', background:'#fef2f2',
            border:'1px solid #fca5a5', borderRadius:8, fontSize:12, color:'#dc2626' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {!job ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
          flexDirection:'column', gap:16, color:'#9ca3af' }}>
          <div style={{ fontSize:64, opacity:.1 }}>🎵</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#374151' }}>Dán link YouTube để bắt đầu</div>
          <div style={{ fontSize:13, color:'#9ca3af', maxWidth:400, textAlign:'center', lineHeight:1.6 }}>
            Workflow sẽ tự động:<br/>
            📺 Trích xuất lời → 🇻🇳 Dịch tiếng Việt → 🎵 Suno prompt → 🖼️ 10 hình ảnh → 📹 Canva brief
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* Left: meta + progress */}
          <div style={{ width:300, flexShrink:0, borderRight:'1px solid #e5e7eb',
            background:'#fff', overflowY:'auto', padding:'16px' }}>

            {/* Song card */}
            {job.meta && (
              <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid #e5e7eb',
                marginBottom:14 }}>
                <img src={job.meta.thumbnail} alt="" style={{ width:'100%', display:'block' }} />
                <div style={{ padding:'10px 12px', background:'#f8f9fb' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:2,
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {job.meta.title}
                  </div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>🎤 {job.meta.author}</div>
                  <a href={job.meta.watchUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:10, color:'#5b4fff', textDecoration:'none', fontWeight:600 }}>
                    ▶ Xem trên YouTube →
                  </a>
                </div>
              </div>
            )}

            {/* Status badge */}
            <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8,
              background: job.status==='completed' ? '#f0fdf4' : job.status==='failed' ? '#fef2f2' : '#f0f9ff',
              border: `1px solid ${job.status==='completed' ? '#86efac' : job.status==='failed' ? '#fca5a5' : '#bae6fd'}`,
              fontSize:12, fontWeight:700,
              color: job.status==='completed' ? '#16a34a' : job.status==='failed' ? '#dc2626' : '#0891b2' }}>
              {job.status==='completed' ? '✅ Hoàn thành!' : job.status==='failed' ? '❌ Lỗi' : `⚙️ ${job.currentStep || 'Đang xử lý...'}`}
            </div>

            {/* Progress steps */}
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:6,
              textTransform:'uppercase', letterSpacing:'.05em' }}>Tiến độ</div>
            {(job.progress || []).map((p, i) => (
              <PhaseStep key={i} {...p} />
            ))}
          </div>

          {/* Right: results */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
            {/* Tabs */}
            <div style={{ display:'flex', gap:4, marginBottom:16, flexWrap:'wrap' }}>
              {[
                ['progress', '📊 Overview'],
                ...(job.musicData ? [['lyrics','🎵 Lời Việt'],['suno','🎸 Suno']] : []),
                ...(job.imageResults?.length ? [['images','🖼️ Hình ảnh']] : []),
                ...(job.canvaBrief ? [['canva','📹 Canva']] : []),
              ].map(([k,l]) => (
                <button key={k} onClick={() => setActiveTab(k)} style={{
                  padding:'6px 14px', borderRadius:8, border:'none',
                  background: activeTab===k ? '#5b4fff' : '#f3f4f6',
                  color: activeTab===k ? '#fff' : '#374151',
                  fontSize:12, fontWeight:700, cursor:'pointer',
                }}>{l}</button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === 'progress' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { icon:'📺', label:'YouTube', value: job.meta?.title || '—', sub: job.meta?.author },
                  { icon:'🎵', label:'Genre/Mood', value: job.musicData ? `${job.musicData.genre} · ${job.musicData.mood}` : '—' },
                  { icon:'🖼️', label:'Hình ảnh', value: job.imageResults ? `${job.imageResults.filter(i=>i.generated).length}/${job.imageResults.length} generated` : '—' },
                  { icon:'🎸', label:'Suno', value: job.sunoResult?.success ? '✅ Đã tạo' : '📋 Manual steps ready' },
                ].map((card, i) => (
                  <div key={i} style={{ padding:'14px 16px', borderRadius:10,
                    background:'#fff', border:'1px solid #e5e7eb',
                    boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{card.icon}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase',
                      fontWeight:700, marginBottom:3 }}>{card.label}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{card.value}</div>
                    {card.sub && <div style={{ fontSize:11, color:'#6b7280' }}>{card.sub}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Lyrics tab */}
            {activeTab === 'lyrics' && job.musicData && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>🇻🇳 Lời tiếng Việt</div>
                  <CopyBtn text={job.musicData.vietnameseLyrics || ''} />
                </div>
                {job.musicData.songAnalysis && (
                  <div style={{ padding:'10px 14px', background:'#f0f9ff', border:'1px solid #bae6fd',
                    borderRadius:8, fontSize:12, color:'#0369a1', marginBottom:12, lineHeight:1.6 }}>
                    💡 {job.musicData.songAnalysis}
                  </div>
                )}
                <pre style={{ background:'#f8f9fb', borderRadius:10, padding:'16px',
                  fontSize:13, lineHeight:1.8, margin:0, whiteSpace:'pre-wrap',
                  fontFamily:'inherit', color:'#111827', border:'1px solid #e5e7eb' }}>
                  {job.musicData.vietnameseLyrics}
                </pre>
              </div>
            )}

            {/* Suno tab */}
            {activeTab === 'suno' && (
              <SunoPanel sunoResult={job.sunoResult} musicData={job.musicData} />
            )}

            {/* Images tab */}
            {activeTab === 'images' && job.imageResults && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>
                    🖼️ 10 Hình ảnh ({job.imageResults.filter(i=>i.generated).length} generated)
                  </div>
                </div>
                <ImageGrid images={job.imageResults} sessionId={sessionId} />
                {/* Image prompts */}
                <div style={{ marginTop:16, fontSize:12, fontWeight:700, color:'#6b7280',
                  textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                  Prompts (dùng cho Midjourney / DALL-E / Stable Diffusion)
                </div>
                {job.imageResults.map((img, i) => (
                  <div key={i} style={{ padding:'10px 12px', borderRadius:8, border:'1px solid #e5e7eb',
                    background:'#fff', marginBottom:6, display:'flex', gap:10 }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>🎨</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:3 }}>
                        {i+1}. {img.scene} <span style={{ color:'#9ca3af', fontWeight:400 }}>({img.timing})</span>
                      </div>
                      <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.5 }}>{img.prompt}</div>
                    </div>
                    <CopyBtn text={img.prompt} />
                  </div>
                ))}
              </div>
            )}

            {/* Canva tab */}
            {activeTab === 'canva' && job.canvaBrief && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>📹 Canva Video Brief</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <CopyBtn text={job.canvaBrief} />
                    <a href="https://www.canva.com/video" target="_blank" rel="noopener noreferrer"
                      style={{ padding:'4px 12px', fontSize:11, borderRadius:6, fontWeight:700,
                        background:'#00c4cc', color:'#fff', textDecoration:'none' }}>
                      🎬 Mở Canva →
                    </a>
                  </div>
                </div>
                <div style={{ background:'#fff', borderRadius:10, padding:'16px 20px',
                  border:'1px solid #e5e7eb', fontSize:13, lineHeight:1.8, color:'#374151',
                  whiteSpace:'pre-wrap', maxHeight:500, overflowY:'auto' }}>
                  {job.canvaBrief}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
