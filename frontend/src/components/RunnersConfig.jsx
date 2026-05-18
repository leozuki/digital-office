import { useState, useEffect } from 'react';

const API = 'http://localhost:3001/api';

const AGENT_META = {
  planner: {
    icon:'🗺️', label:'Project Planner', color:'#5b4fff',
    desc:'Decomposes user requests into a clear, structured list of tasks',
    fields: { persona:'Senior Project Architect', tone:'analytical', temperature:0.6, maxTokens:4096 },
  },
  manager: {
    icon:'📋', label:'Project Manager', color:'#0891b2',
    desc:'Assigns each task to the best-fit team member based on skills and roles',
    fields: { persona:'Experienced Project Manager', tone:'professional', temperature:0.5, maxTokens:3000 },
  },
  worker: {
    icon:'⚙️', label:'Worker', color:'#16a34a',
    desc:'Executes assigned tasks and produces complete code/content/design outputs',
    fields: { persona:'Expert Specialist', tone:'technical', temperature:0.75, maxTokens:8192 },
  },
  reviewer: {
    icon:'🔍', label:'Reviewer', color:'#d97706',
    desc:'Evaluates worker output, scores quality, and approves or requests revision',
    fields: { persona:'Senior Quality Reviewer', tone:'constructive', temperature:0.4, maxTokens:2048 },
  },
};

const TONE_OPTIONS   = ['analytical','professional','technical','constructive','creative','formal','concise'];
const PERSONA_OPTS   = ['Senior Project Architect','Experienced Project Manager','Expert Specialist','Senior Quality Reviewer','Creative Director','Technical Lead','Startup CTO'];
const MODEL_LABELS   = {
  'gemini:gemini-flash-latest':           '⚡ Gemini Flash Latest (fast)',
  'gemini:gemini-2.0-flash':             '⚡ Gemini 2.0 Flash',
  'gemini:gemini-2.0-flash-lite':        '🪶 Gemini 2.0 Flash Lite (light)',
  'gemini:gemini-2.5-pro':               '🧠 Gemini 2.5 Pro (powerful)',
  'anthropic:claude-3-5-sonnet-20241022':'🧠 Claude 3.5 Sonnet (best)',
  'anthropic:claude-3-haiku-20240307':   '🐱 Claude 3 Haiku (fast)',
  'ollama:llama3':                        '🦙 Llama 3 (local)',
  'ollama:mistral':                       '🌬️ Mistral (local)',
};

function Slider({ label, value, min, max, step, onChange, format }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-2)' }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{format ? format(value) : value}</span>
      </div>
      <div style={{ position:'relative', height:6, borderRadius:999, background:'#e5e7eb' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:999,
          width:`${pct}%`, background:'linear-gradient(90deg,var(--primary),var(--cyan))' }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}
          style={{ position:'absolute', inset:0, width:'100%', opacity:0, cursor:'pointer', height:'100%' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
        <span style={{ fontSize:9, color:'var(--text-3)' }}>{min}</span>
        <span style={{ fontSize:9, color:'var(--text-3)' }}>{max}</span>
      </div>
    </div>
  );
}

function AgentCard({ agentId, agentConfig, runnerModel, availableModels, onConfigChange, onModelChange }) {
  const [expanded, setExpanded]         = useState(false);
  const [showPromptEditor, setShowPE]   = useState(false);
  const meta = AGENT_META[agentId] || {};
  const rgb  = (meta.color||'#6c63ff').slice(1).match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',')||'108,99,255';
  const cfg  = agentConfig || {};

  const upd = (key, val) => onConfigChange({ ...cfg, [key]: val });

  return (
    <div style={{
      background:'var(--surface)', border:`1px solid rgba(${rgb},.2)`,
      borderRadius:'var(--radius-lg)', marginBottom:12, overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
        background:`linear-gradient(135deg,rgba(${rgb},.12) 0%,rgba(${rgb},.04) 100%)`,
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ width:42, height:42, borderRadius:11, background:`rgba(${rgb},.2)`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
          {meta.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:`rgb(${rgb})`, marginBottom:2 }}>{meta.label}</div>
          <div style={{ fontSize:11, color:'var(--text-2)' }}>{meta.desc}</div>
        </div>

        {/* Runner model dropdown */}
        <select className="input" value={runnerModel||''} style={{ width:240, padding:'6px 12px', fontSize:11 }}
          onChange={e=>onModelChange(e.target.value)}>
          {Object.entries(MODEL_LABELS).map(([k,v])=>(
            <option key={k} value={k}>{v}</option>
          ))}
          {runnerModel && !MODEL_LABELS[runnerModel] && (
            <option value={runnerModel}>{runnerModel}</option>
          )}
        </select>

        <button onClick={()=>setExpanded(!expanded)}
          style={{ background:'#f3f4f6', border:'1px solid var(--border)', borderRadius:8,
            padding:'6px 12px', cursor:'pointer', color:'var(--text)', fontSize:12, flexShrink:0 }}>
          {expanded ? '▲ Less' : '▼ Configure'}
        </button>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div style={{ padding:'16px 20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

            {/* Persona */}
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginBottom:6 }}>
                🎭 Persona
                <span style={{ fontWeight:400, marginLeft:5 }}>How the agent identifies itself</span>
              </label>
              <div style={{ position:'relative' }}>
                <input className="input" list={`persona-list-${agentId}`} value={cfg.persona||meta.fields?.persona||''}
                  onChange={e=>upd('persona',e.target.value)} placeholder="e.g. Senior Project Architect" />
                <datalist id={`persona-list-${agentId}`}>
                  {PERSONA_OPTS.map(p=><option key={p} value={p}/>)}
                </datalist>
              </div>
            </div>

            {/* Tone */}
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginBottom:6 }}>
                🎙️ Tone
                <span style={{ fontWeight:400, marginLeft:5 }}>Communication style</span>
              </label>
              <select className="input" value={cfg.tone||meta.fields?.tone||'professional'} onChange={e=>upd('tone',e.target.value)}>
                {TONE_OPTIONS.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Sliders */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:16 }}>
            <Slider label="🌡️ Temperature" min={0} max={1} step={0.05}
              value={cfg.temperature ?? meta.fields?.temperature ?? 0.7}
              onChange={v=>upd('temperature',v)}
              format={v=>`${v.toFixed(2)} ${v<0.4?'(focused)':v<0.7?'(balanced)':'(creative)'}`} />
            <Slider label="📏 Max Tokens" min={512} max={16384} step={256}
              value={cfg.maxTokens ?? meta.fields?.maxTokens ?? 4096}
              onChange={v=>upd('maxTokens',v)}
              format={v=>`${v.toLocaleString()} tokens`} />
          </div>

          {/* Instructions */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginBottom:5 }}>
              📝 Agent Instructions
              <span style={{ fontWeight:400, marginLeft:5 }}>Appended to the agent's system prompt</span>
            </label>
            <textarea className="input" rows={3} value={cfg.instructions||''}
              onChange={e=>upd('instructions',e.target.value)}
              placeholder="e.g. Always output complete code without placeholders. Aim for score ≥ 8/10…" />
          </div>

          {/* System prompt override */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)' }}>
                🔧 System Prompt Override
                <span style={{ fontWeight:400, marginLeft:5, color:'var(--text-3)' }}>Replaces the default system prompt entirely (advanced)</span>
              </label>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowPE(!showPromptEditor)}>
                {showPromptEditor ? '▲ Hide' : '▼ Edit'}
              </button>
            </div>
            {showPromptEditor && (
              <textarea className="input" rows={6} value={cfg.systemPromptOverride||''}
                onChange={e=>upd('systemPromptOverride',e.target.value)}
                placeholder="Leave empty to use the default system prompt built from teams.json and agent settings…"
                style={{ fontFamily:'monospace', fontSize:11 }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RunnersConfig() {
  const [runners,  setRunners]  = useState({});
  const [agents,   setAgents]   = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/runners`).then(r=>r.json()),
      fetch(`${API}/agents`).then(r=>r.json()),
    ]).then(([r, a]) => {
      const { available, ...runnerMap } = r;
      setRunners(runnerMap);
      setAgents(a);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await Promise.all([
      fetch(`${API}/runners`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(runners) }),
      fetch(`${API}/agents`,  { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(agents)  }),
    ]);
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false), 2500);
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-2)' }}>Loading…</div>
  );

  return (
    <div className="settings-page">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
        <div>
          <div className="settings-title">🤖 Runners & Agent Configuration</div>
          <div className="settings-sub">
            Set the AI model, persona, tone, temperature, and custom instructions for each agent.
            Click "▼ Configure" on any agent to expand its detailed settings.
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ flexShrink:0 }}>
          {saving?'⏳ Saving…':saved?'✅ Applied!':'🔁 Save & Apply'}
        </button>
      </div>

      {Object.keys(AGENT_META).map(agentId => (
        <AgentCard
          key={agentId}
          agentId={agentId}
          agentConfig={agents[agentId] || {}}
          runnerModel={runners[agentId] || 'gemini:gemini-flash-latest'}
          availableModels={Object.keys(MODEL_LABELS)}
          onConfigChange={cfg => setAgents(a => ({...a, [agentId]: cfg}))}
          onModelChange={model => setRunners(r => ({...r, [agentId]: model}))}
        />
      ))}

      {/* Summary */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px', marginTop:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:10 }}>📊 Current Configuration Summary</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {Object.entries(AGENT_META).map(([id, meta]) => {
            const cfg = agents[id] || {};
            return (
              <div key={id} style={{ background:'var(--surface-2)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:18, marginBottom:5 }}>{meta.icon}</div>
                <div style={{ fontSize:11, fontWeight:700, color:meta.color }}>{meta.label}</div>
                <div style={{ fontSize:10, color:'var(--primary)', fontFamily:'monospace', marginTop:3, wordBreak:'break-all' }}>{runners[id]?.split(':')[1]||'—'}</div>
                <div style={{ fontSize:9, color:'var(--text-3)', marginTop:3 }}>
                  temp:{cfg.temperature??'default'} · tokens:{cfg.maxTokens??'default'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
