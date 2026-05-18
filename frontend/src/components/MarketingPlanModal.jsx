import { useState, useEffect } from 'react';

const API = 'http://localhost:3001/api';

const DEFAULT_FOLDER = 'D:\\AI\\MKT';

const MKT_TEMPLATES = [
  {
    id: 'full_plan',
    icon: '📊',
    title: 'Full Marketing Plan',
    desc: 'Comprehensive marketing strategy: goals, target audience, channels, budget, KPIs',
    prompt: 'Tạo một marketing plan toàn diện dựa trên tài liệu tham khảo đã cung cấp. Bao gồm: phân tích thị trường, mục tiêu marketing, chân dung khách hàng mục tiêu, chiến lược kênh phân phối, kế hoạch content, ngân sách dự kiến, và KPI đo lường hiệu quả.',
  },
  {
    id: 'content_strategy',
    icon: '✍️',
    title: 'Content Strategy',
    desc: 'Content calendar, topics, format guidelines and distribution plan',
    prompt: 'Xây dựng chiến lược content marketing dựa trên tài liệu tham khảo. Bao gồm: content calendar, các chủ đề nội dung, format phù hợp (video, blog, social), kênh phân phối và lịch đăng bài.',
  },
  {
    id: 'social_media',
    icon: '📱',
    title: 'Social Media Plan',
    desc: 'Platform strategy, post schedule, engagement tactics for each channel',
    prompt: 'Lập kế hoạch social media marketing chi tiết dựa trên tài liệu tham khảo. Bao gồm: chiến lược cho từng nền tảng (Facebook, Instagram, TikTok, LinkedIn), lịch đăng bài, loại nội dung, cách tăng engagement.',
  },
  {
    id: 'campaign',
    icon: '🚀',
    title: 'Campaign Plan',
    desc: 'Launch campaign with timeline, messaging, creative briefs and budget',
    prompt: 'Thiết kế kế hoạch chiến dịch marketing dựa trên tài liệu tham khảo. Bao gồm: mục tiêu chiến dịch, messaging chính, creative brief, timeline thực hiện, phân bổ ngân sách và metrics đánh giá.',
  },
  {
    id: 'custom',
    icon: '✏️',
    title: 'Custom Request',
    desc: 'Write your own marketing request — documents will be injected as context',
    prompt: '',
  },
];

export default function MarketingPlanModal({ onClose, onSubmit, isSubmitting }) {
  const [step,         setStep]         = useState(1); // 1=choose template, 2=configure, 3=loading docs
  const [template,     setTemplate]     = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [folder,       setFolder]       = useState(DEFAULT_FOLDER);
  const [docInfo,      setDocInfo]      = useState(null);  // {count, docs}
  const [docLoading,   setDocLoading]   = useState(false);
  const [docError,     setDocError]     = useState('');
  const [readDocs,     setReadDocs]     = useState(false); // whether to inject docs

  // Load doc list when folder changes
  useEffect(() => {
    if (!folder.trim()) return;
    setDocLoading(true);
    setDocError('');
    const timer = setTimeout(() => {
      fetch(`${API}/docs?folder=${encodeURIComponent(folder)}`)
        .then(r => r.json())
        .then(d => { setDocInfo(d); setDocLoading(false); })
        .catch(e => { setDocError(e.message); setDocLoading(false); });
    }, 600);
    return () => clearTimeout(timer);
  }, [folder]);

  const handleTemplateSelect = (t) => {
    setTemplate(t);
    if (t.id === 'custom') setCustomPrompt('');
    setStep(2);
  };

  const handleSubmit = () => {
    const prompt = template.id === 'custom' ? customPrompt : template.prompt;
    if (!prompt.trim()) return;
    onSubmit({
      request:   prompt,
      docFolder: readDocs ? folder : undefined,
    });
  };

  const finalPrompt = template?.id === 'custom' ? customPrompt : template?.prompt || '';
  const canSubmit   = finalPrompt.trim().length > 0 && !isSubmitting;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20,
    }} onClick={onClose}>
      <div style={{
        background:'#fff', borderRadius:20, width:'100%', maxWidth:680,
        boxShadow:'0 25px 80px rgba(0,0,0,.25)', overflow:'hidden',
        maxHeight:'90vh', display:'flex', flexDirection:'column',
      }} onClick={e => e.stopPropagation()}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{
          padding:'20px 24px 16px',
          background:'linear-gradient(135deg,#5b4fff 0%,#8b5cf6 100%)',
          flexShrink:0,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:4 }}>
                📊 Marketing Plan Workflow
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.7)' }}>
                {step === 1 ? 'Chọn loại kế hoạch marketing bạn cần xây dựng'
                           : `Template: ${template?.title}`}
              </div>
            </div>
            <button onClick={onClose} style={{
              background:'rgba(255,255,255,.15)', border:'none', borderRadius:8,
              color:'#fff', fontSize:18, width:32, height:32, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>×</button>
          </div>

          {/* Steps */}
          <div style={{ display:'flex', gap:4, marginTop:16 }}>
            {['Choose Template', 'Configure'].map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{
                  width:22, height:22, borderRadius:'50%', fontSize:11, fontWeight:800,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: step > i + 1 ? '#22c55e' : step === i + 1 ? '#fff' : 'rgba(255,255,255,.25)',
                  color:      step > i + 1 ? '#fff'    : step === i + 1 ? '#5b4fff' : 'rgba(255,255,255,.5)',
                }}>{step > i + 1 ? '✓' : i + 1}</div>
                <span style={{ fontSize:11, color: step === i + 1 ? '#fff' : 'rgba(255,255,255,.5)', fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
                {i < 1 && <div style={{ width:20, height:1, background:'rgba(255,255,255,.2)', margin:'0 4px' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {step === 1 && (
            <div>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>
                Chọn loại kế hoạch marketing phù hợp với nhu cầu của bạn:
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {MKT_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => handleTemplateSelect(t)} style={{
                    padding:'14px 16px', borderRadius:12, border:'1px solid #e5e7eb',
                    background:'#fff', cursor:'pointer', textAlign:'left',
                    transition:'all .15s', boxShadow:'0 1px 4px rgba(0,0,0,.05)',
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor='#5b4fff'; e.currentTarget.style.background='#faf9ff'; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.background='#fff'; }}
                  >
                    <div style={{ fontSize:22, marginBottom:6 }}>{t.icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:4 }}>{t.title}</div>
                    <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.5 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && template && (
            <div>
              {/* Prompt preview / custom input */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>
                  {template.id === 'custom' ? '✏️ Your Marketing Request' : '📝 Generated Prompt (editable)'}
                </label>
                <textarea
                  value={template.id === 'custom' ? customPrompt : (template.prompt)}
                  onChange={e => {
                    if (template.id === 'custom') setCustomPrompt(e.target.value);
                    else setTemplate({ ...template, prompt: e.target.value });
                  }}
                  placeholder={template.id === 'custom' ? 'Nhập yêu cầu marketing của bạn...' : ''}
                  style={{
                    width:'100%', minHeight:120, padding:'12px 14px', borderRadius:10,
                    border:'1px solid #e5e7eb', fontSize:13, lineHeight:1.65,
                    color:'#374151', resize:'vertical', fontFamily:'inherit',
                    boxSizing:'border-box', outline:'none',
                  }}
                  onFocus={e => e.target.style.borderColor='#5b4fff'}
                  onBlur={e  => e.target.style.borderColor='#e5e7eb'}
                />
              </div>

              {/* Document folder */}
              <div style={{
                padding:'16px', borderRadius:12, border:'1px solid #e5e7eb', background:'#f8f9fb',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <input
                    type="checkbox"
                    id="readDocs"
                    checked={readDocs}
                    onChange={e => setReadDocs(e.target.checked)}
                    style={{ width:16, height:16, cursor:'pointer', accentColor:'#5b4fff' }}
                  />
                  <label htmlFor="readDocs" style={{ fontSize:13, fontWeight:700, color:'#111827', cursor:'pointer' }}>
                    📁 Đọc tài liệu tham khảo từ folder
                  </label>
                </div>

                {readDocs && (
                  <>
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      <input
                        value={folder}
                        onChange={e => setFolder(e.target.value)}
                        placeholder="D:\AI\MKT"
                        style={{
                          flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb',
                          fontSize:12, fontFamily:'monospace', color:'#374151',
                          outline:'none',
                        }}
                        onFocus={e => e.target.style.borderColor='#5b4fff'}
                        onBlur={e  => e.target.style.borderColor='#e5e7eb'}
                      />
                    </div>

                    {/* Doc status */}
                    {docLoading ? (
                      <div style={{ fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ animation:'pulse-anim 1s infinite' }}>⏳</span> Đang kiểm tra folder…
                      </div>
                    ) : docError ? (
                      <div style={{ fontSize:12, color:'#dc2626', padding:'8px 10px',
                        background:'#fef2f2', borderRadius:7, border:'1px solid #fca5a5' }}>
                        ⚠️ {docError}
                      </div>
                    ) : docInfo ? (
                      <div>
                        <div style={{ fontSize:12, color:'#16a34a', fontWeight:700, marginBottom:8 }}>
                          ✅ Tìm thấy {docInfo.count} tài liệu trong folder
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {(docInfo.docs || []).slice(0, 10).map((d, i) => (
                            <span key={i} style={{
                              fontSize:10, padding:'2px 8px', borderRadius:999,
                              background:'#ede9fe', color:'#5b4fff', border:'1px solid #c4b5fd',
                            }}>📄 {d.name.length > 25 ? d.name.slice(0, 22) + '…' : d.name}</span>
                          ))}
                          {(docInfo.count || 0) > 10 && (
                            <span style={{ fontSize:10, color:'#6b7280', padding:'2px 8px' }}>
                              +{docInfo.count - 10} more
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop:10, padding:'8px 10px', borderRadius:7,
                          background:'#fef9c3', border:'1px solid #fde68a',
                          fontSize:11, color:'#78350f', lineHeight:1.5 }}>
                          ⏱️ Ghi chú: Đọc {docInfo.count} ảnh sẽ mất khoảng {Math.ceil(docInfo.count * 2 / 60)} phút. 
                          AI sẽ dùng Gemini Vision để trích xuất nội dung từng tài liệu.
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div style={{
          padding:'14px 24px', borderTop:'1px solid #e5e7eb', flexShrink:0,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          background:'#f9fafb',
        }}>
          {step === 1 ? (
            <button onClick={onClose} style={{
              padding:'9px 18px', borderRadius:9, border:'1px solid #e5e7eb',
              background:'#fff', color:'#6b7280', fontSize:13, cursor:'pointer', fontWeight:600,
            }}>Hủy</button>
          ) : (
            <button onClick={() => setStep(1)} style={{
              padding:'9px 18px', borderRadius:9, border:'1px solid #e5e7eb',
              background:'#fff', color:'#374151', fontSize:13, cursor:'pointer', fontWeight:600,
            }}>← Quay lại</button>
          )}

          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding:'10px 24px', borderRadius:10, border:'none',
                background: canSubmit ? 'linear-gradient(135deg,#5b4fff,#8b5cf6)' : '#e5e7eb',
                color: canSubmit ? '#fff' : '#9ca3af',
                fontSize:13, fontWeight:700, cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 14px rgba(91,79,255,.3)' : 'none',
                transition:'all .15s',
                display:'flex', alignItems:'center', gap:8,
              }}
            >
              {isSubmitting ? '⏳ Đang chạy…' : '🚀 Bắt đầu Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
