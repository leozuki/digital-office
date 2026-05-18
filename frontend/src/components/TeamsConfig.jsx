import { useState, useEffect, useRef } from 'react';

const API    = 'http://localhost:3001/api';
const COLORS = ['#5b4fff','#0891b2','#16a34a','#db2777','#d97706','#dc2626','#6366f1','#059669'];
const SKILL_SUGGESTIONS = [
  'React','Vue','TypeScript','CSS','Tailwind','Node.js','Python','PostgreSQL',
  'REST API','GraphQL','Docker','Redis','JWT','Testing','SEO','Copywriting',
  'Figma','SVG','Markdown','Technical Writing','Performance','Security',
];

// ─── Member Chip ──────────────────────────────────────────────────────────────
function MemberChip({ member, onRemove, onEdit }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6,
      background:'#f3f4f6', border:'1px solid #e5e7eb',
      borderRadius:999, padding:'4px 6px 4px 8px', fontSize:11,
    }}>
      <span style={{ fontSize:14 }}>{member.avatar || '👤'}</span>
      <div>
        <span style={{ color:'var(--text)', fontWeight:600 }}>{member.name}</span>
        <span style={{ color:'var(--text-3)', marginLeft:5 }}>{member.role}</span>
      </div>
      <button onClick={() => onEdit(member)} title="Edit member"
        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:12, padding:'0 2px' }}>✏️</button>
      <button onClick={onRemove} title="Remove member"
        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:13, padding:'0 2px', lineHeight:1 }}>✕</button>
    </div>
  );
}

// ─── Skill Tag ────────────────────────────────────────────────────────────────
function SkillTag({ skill, color, onRemove }) {
  const rgb = (color||'#6c63ff').slice(1).match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',')||'108,99,255';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      background:`rgba(${rgb},.15)`, color:`rgba(${rgb},1)` ,
      border:`1px solid rgba(${rgb},.3)`, borderRadius:999, padding:'2px 8px 2px 9px', fontSize:10, fontWeight:600,
    }}>
      {skill}
      {onRemove && <button onClick={onRemove} style={{ background:'none', border:'none', cursor:'pointer', color:`rgba(${rgb},.7)`, fontSize:11, padding:0, lineHeight:1 }}>✕</button>}
    </span>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────
function TeamCard({ team, onChange, onRemove }) {
  const [expanded,    setExpanded]    = useState(false);
  const [editMember,  setEditMember]  = useState(null);
  const [newSkill,    setNewSkill]    = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const skillRef = useRef(null);

  const rgb = (team.color||'#6c63ff').slice(1).match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',')||'108,99,255';

  const upd = (key, val) => onChange({ ...team, [key]: val });

  const addSkill = (s) => {
    const skill = (s||newSkill).trim();
    if (!skill || (team.skills||[]).includes(skill)) { setNewSkill(''); return; }
    upd('skills', [...(team.skills||[]), skill]);
    setNewSkill(''); setShowSuggest(false);
  };

  const addMember = () => {
    const name = prompt('Member name:');
    if (!name?.trim()) return;
    const role   = prompt('Role (e.g. React Specialist):') || 'Developer';
    const avatar = prompt('Avatar emoji (e.g. 👨‍💻):') || '👤';
    upd('members', [...(team.members||[]), { id: name.toLowerCase().replace(/\s+/g,'-'), name:name.trim(), role, avatar }]);
  };

  const saveMemberEdit = (updated) => {
    upd('members', (team.members||[]).map(m => m.id === updated.id ? updated : m));
    setEditMember(null);
  };

  return (
    <div style={{
      background:'var(--surface)', borderRadius:'var(--radius-lg)',
      border:`1px solid rgba(${rgb},.2)`, marginBottom:12, overflow:'hidden',
      transition:'border-color .2s', opacity: team.active===false ? .5 : 1,
    }}>
      {/* ── Header ── */}
      <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:10,
        background:`linear-gradient(135deg,rgba(${rgb},.12) 0%,rgba(${rgb},.04) 100%)`,
        borderBottom:'1px solid var(--border)' }}>
        {/* Icon */}
        <input value={team.icon||'🛠️'} onChange={e=>upd('icon',e.target.value)}
          style={{ width:44, height:44, borderRadius:10, border:'none', background:`rgba(${rgb},.18)`,
            fontSize:22, textAlign:'center', cursor:'text', outline:'none', color:'inherit' }} />

        {/* Name */}
        <div style={{ flex:1, minWidth:0 }}>
          <input className="input" value={team.name} onChange={e=>upd('name',e.target.value)}
            style={{ fontWeight:800, fontSize:14, padding:'5px 10px', marginBottom:3 }}
            placeholder="Team name…" />
          <div style={{ fontSize:10, color:'var(--text-3)', paddingLeft:2 }}>ID: {team.id}</div>
        </div>

        {/* Color */}
        <input type="color" value={team.color||'#6c63ff'} onChange={e=>upd('color',e.target.value)}
          style={{ width:40, height:40, border:'1px solid var(--border)', borderRadius:8, background:'none', cursor:'pointer' }} />

        {/* Active toggle */}
        <button onClick={()=>upd('active',!team.active)}
          style={{ padding:'5px 12px', borderRadius:999, border:`1px solid rgba(${rgb},.3)`,
            background: team.active!==false?`${team.color}20`:'#f3f4f6',
            color: team.active!==false?team.color:'#6b7280',
            fontSize:11, fontWeight:700, cursor:'pointer' }}>
          {team.active!==false ? '● Active' : '○ Inactive'}
        </button>

        {/* Expand / Delete */}
        <button onClick={()=>setExpanded(!expanded)}
          style={{ background:'#f3f4f6', border:'1px solid var(--border)', borderRadius:8,
            padding:'5px 10px', cursor:'pointer', color:'var(--text)', fontSize:13 }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onRemove} className="btn btn-icon btn-danger btn-sm" title="Delete team">✕</button>
      </div>

      {/* ── Quick info (always visible) ── */}
      <div style={{ padding:'10px 16px', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        {(team.skills||[]).slice(0,6).map(s => (
          <SkillTag key={s} skill={s} color={team.color} />
        ))}
        {(team.skills||[]).length > 6 && (
          <span style={{ fontSize:10, color:'var(--text-3)' }}>+{team.skills.length-6} more</span>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-2)' }}>
          👥 {(team.members||[]).length} members
        </span>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ padding:'0 16px 16px', borderTop:'1px solid var(--border)', paddingTop:14 }}>

          {/* Description */}
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginBottom:5 }}>
            📋 Team Description
          </label>
          <textarea className="input" rows={3} value={team.description||''} onChange={e=>upd('description',e.target.value)}
            placeholder="What does this team specialize in? What are their core capabilities?" style={{ marginBottom:12 }} />

          {/* Assignment Instructions */}
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginBottom:5 }}>
            🎯 Assignment Instructions <span style={{ fontWeight:400 }}>(tells the Manager when to use this team)</span>
          </label>
          <textarea className="input" rows={2} value={team.instructions||''} onChange={e=>upd('instructions',e.target.value)}
            placeholder="e.g. Assign tasks involving UI components, animations, and CSS styling to this team…" style={{ marginBottom:14 }} />

          {/* Skills */}
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginBottom:6 }}>
            ⚡ Skills & Technologies
          </label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
            {(team.skills||[]).map(s => (
              <SkillTag key={s} skill={s} color={team.color}
                onRemove={() => upd('skills', team.skills.filter(x=>x!==s))} />
            ))}
          </div>
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', gap:6 }}>
              <input className="input" style={{ flex:1 }} value={newSkill} placeholder="Add skill…"
                onChange={e=>{setNewSkill(e.target.value);setShowSuggest(true);}}
                onKeyDown={e=>{ if(e.key==='Enter'){addSkill();} if(e.key==='Escape')setShowSuggest(false); }}
                onFocus={()=>setShowSuggest(true)} ref={skillRef} />
              <button className="btn btn-ghost btn-sm" onClick={()=>addSkill()}>Add</button>
            </div>
            {showSuggest && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)',
                padding:8, display:'flex', flexWrap:'wrap', gap:5, maxHeight:120, overflowY:'auto' }}>
                {SKILL_SUGGESTIONS.filter(s=>!team.skills?.includes(s)&&s.toLowerCase().includes(newSkill.toLowerCase())).map(s=>(
                  <button key={s} onClick={()=>addSkill(s)}
                    style={{ background:'#f3f4f6', border:'1px solid #e5e7eb',
                      borderRadius:999, padding:'2px 9px', fontSize:10, cursor:'pointer', color:'#374151' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', display:'block', marginTop:14, marginBottom:6 }}>
            👥 Team Members
          </label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:8 }}>
            {(team.members||[]).map(m => (
              <MemberChip key={m.id} member={m}
                onRemove={() => upd('members', team.members.filter(x=>x.id!==m.id))}
                onEdit={()=>setEditMember({...m})} />
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addMember}>+ Add member</button>
          </div>

          {/* Edit member inline */}
          {editMember && (
            <div style={{ background:'var(--surface-2)', border:'1px solid rgba(108,99,255,.3)', borderRadius:10, padding:14, marginTop:6 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:10 }}>Edit Member</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'flex-end' }}>
                <div>
                  <label style={{ fontSize:10, color:'var(--text-2)', display:'block', marginBottom:4 }}>Name</label>
                  <input className="input" value={editMember.name} onChange={e=>setEditMember(x=>({...x,name:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:'var(--text-2)', display:'block', marginBottom:4 }}>Role</label>
                  <input className="input" value={editMember.role} onChange={e=>setEditMember(x=>({...x,role:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:'var(--text-2)', display:'block', marginBottom:4 }}>Avatar</label>
                  <input className="input" value={editMember.avatar||'👤'} onChange={e=>setEditMember(x=>({...x,avatar:e.target.value}))} style={{ width:60 }} />
                </div>
              </div>
              <div style={{ marginTop:10, display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setEditMember(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={()=>saveMemberEdit(editMember)}>Save</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Teams Config ────────────────────────────────────────────────────────
export default function TeamsConfig() {
  const [teams,   setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [newTeam, setNewTeam] = useState({ name:'', icon:'🛠️', color:'#6c63ff' });

  useEffect(() => {
    fetch(`${API}/teams`).then(r=>r.json()).then(d=>{setTeams(d);setLoading(false);}).catch(()=>setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/teams`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(teams) });
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false), 2500);
  };

  const addTeam = () => {
    if (!newTeam.name.trim()) return;
    setTeams(t => [...t, {
      id: newTeam.name.toLowerCase().replace(/\s+/g,'-'),
      ...newTeam, active:true, members:[], skills:[], description:'', instructions:'',
    }]);
    setNewTeam({ name:'', icon:'🛠️', color:'#6c63ff' }); setAdding(false);
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-2)' }}>Loading…</div>
  );

  return (
    <div className="settings-page">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div>
          <div className="settings-title">👥 Teams Configuration</div>
          <div className="settings-sub">Define teams, their specializations, skills, and members. The Manager agent uses this to assign tasks intelligently.</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setAdding(!adding)}>+ New Team</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving?'⏳ Saving…':saved?'✅ Saved!':'💾 Save All'}
          </button>
        </div>
      </div>

      {adding && (
        <div style={{ background:'var(--surface)', border:'1px solid rgba(108,99,255,.35)', borderRadius:'var(--radius-lg)', padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>✨ New Team</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, alignItems:'flex-end' }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text-2)', display:'block', marginBottom:5 }}>Team Name</label>
              <input className="input" placeholder="e.g. DevOps Team" value={newTeam.name} onChange={e=>setNewTeam(x=>({...x,name:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-2)', display:'block', marginBottom:5 }}>Icon</label>
              <input className="input" style={{ width:70 }} placeholder="🛠️" value={newTeam.icon} onChange={e=>setNewTeam(x=>({...x,icon:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-2)', display:'block', marginBottom:5 }}>Color</label>
              <input type="color" value={newTeam.color} onChange={e=>setNewTeam(x=>({...x,color:e.target.value}))}
                style={{ height:38, width:70, borderRadius:8, border:'1px solid var(--border)', background:'none', cursor:'pointer' }} />
            </div>
          </div>
          <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setAdding(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={addTeam}>Create Team</button>
          </div>
        </div>
      )}

      {teams.map(team => (
        <TeamCard key={team.id} team={team}
          onChange={updated => setTeams(ts => ts.map(t => t.id===updated.id ? updated : t))}
          onRemove={() => setTeams(ts => ts.filter(t => t.id!==team.id))} />
      ))}

      {/* Color presets */}
      <div style={{ marginTop:16, padding:'14px 16px', background:'var(--surface)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', marginBottom:8 }}>Color Presets</div>
        <div style={{ display:'flex', gap:8 }}>
          {COLORS.map(c => (
            <div key={c} style={{ width:22, height:22, borderRadius:6, background:c, cursor:'pointer',
              boxShadow:`0 2px 8px ${c}66`, title:c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
