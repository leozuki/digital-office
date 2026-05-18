import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  request:  '#db2777',
  planner:  '#5b4fff',
  manager:  '#0891b2',
  worker:   '#16a34a',
  reviewer: '#d97706',
};

function hex2rgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '108,99,255';
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { color: '#6b7280', label: 'Pending',   icon: '⏳' },
  working:   { color: '#16a34a', label: 'Working',   icon: '⚙️', pulse: true },
  reviewing: { color: '#d97706', label: 'Reviewing', icon: '🔍', pulse: true },
  revision:  { color: '#db2777', label: 'Revision',  icon: '🔄', pulse: true },
  completed: { color: '#16a34a', label: 'Done',      icon: '✅' },
  failed:    { color: '#dc2626', label: 'Failed',    icon: '❌' },
};

// ─── Agent node (thin header nodes) ──────────────────────────────────────────
function AgentNode({ data }) {
  const c = data.color;
  const isActive = data.isActive;
  return (
    <div style={{
      background:     `#fff`,
      border:         `${isActive ? 2 : 1}px solid ${isActive ? c : '#e5e7eb'}`,
      borderRadius:   12,
      padding:        '10px 20px',
      minWidth:       140,
      textAlign:      'center',
      boxShadow:      isActive ? `0 0 0 3px ${c}22, 0 4px 20px ${c}20` : '0 1px 4px rgba(0,0,0,.08)',
      transition:     'all .4s',
    }}>
      <Handle type="target" position={Position.Top}    style={{ opacity:0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity:0 }} />
      <div style={{ fontSize: 18, marginBottom: 3 }}>{data.icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c, letterSpacing: '.01em' }}>{data.label}</div>
      {isActive && (
        <div style={{ marginTop: 5, fontSize: 10, color: c, fontWeight: 600, opacity: .8 }}>
          {data.statusLabel || 'Processing…'}
        </div>
      )}
    </div>
  );
}

// ─── Task card node ───────────────────────────────────────────────────────────
function TaskCardNode({ data }) {
  const task   = data.task;
  const st     = STATUS[task.status] || STATUS.pending;
  const review = (task.reviews || [])[task.reviews?.length - 1];
  const output = (task.outputs || [])[task.outputs?.length - 1];
  const isActive = ['working','reviewing','revision'].includes(task.status);

  let artifactName = null;
  if (output?.content) {
    try { artifactName = JSON.parse(output.content)?.filename; } catch {}
  }

  return (
    <div style={{
      background:   '#fff',
      border:       `2px solid ${isActive ? st.color : '#e5e7eb'}`,
      borderRadius: 14,
      width:        220,
      overflow:     'hidden',
      boxShadow:    isActive ? `0 0 0 3px ${st.color}20, 0 4px 16px rgba(0,0,0,.1)` : '0 1px 4px rgba(0,0,0,.08)',
      transition:   'border-color .4s, box-shadow .4s',
    }}>
      <Handle type="target" position={Position.Top}    style={{ opacity:0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity:0 }} />

      {/* Header */}
      <div style={{
        background: `${st.color}12`,
        padding:    '10px 12px 8px',
        borderBottom: `1px solid ${st.color}28`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
          <span style={{ fontSize:13 }}>{st.icon}</span>
          <span style={{
            fontSize:10, fontWeight:700, color: st.color,
            textTransform:'uppercase', letterSpacing:'.05em',
            display:'flex', alignItems:'center', gap:4,
          }}>
            {isActive && <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:st.color, animation:'pulse 1.2s infinite' }} />}
            {st.label}
          </span>
          {task.revision_count > 0 && (
            <span style={{ marginLeft:'auto', fontSize:9, color:'#db2777', fontWeight:700, background:'#fdf2f8', padding:'1px 6px', borderRadius:999, border:'1px solid #f9a8d4' }}>
              rev.{task.revision_count}
            </span>
          )}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:'#111827', lineHeight:1.4 }}>
          {task.title}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:'8px 12px' }}>
        {/* Team + worker */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
          <TeamBadge team={task.team} />
          {task.assigned_to && (
            <span style={{ fontSize:9, color:'#6b7280', alignSelf:'center' }}>
              👤 {task.assigned_to?.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Progress steps */}
        <ProgressSteps task={task} />

        {/* Review score */}
        {review && (
          <div style={{
            marginTop:7,
            background: review.decision === 'approved' ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${review.decision === 'approved' ? '#86efac' : '#fcd34d'}`,
            borderRadius:8, padding:'5px 8px',
          }}>
            <div style={{ fontSize:10, fontWeight:700, color: review.decision === 'approved' ? '#16a34a' : '#d97706', marginBottom:2 }}>
              {review.decision === 'approved' ? '✅ Approved' : '🔄 Revision'} · {review.score}/10
            </div>
            <div style={{ fontSize:10, color:'#374151', lineHeight:1.4 }}>
              {(review.feedback || '').slice(0,80)}{(review.feedback?.length || 0) > 80 ? '…' : ''}
            </div>
          </div>
        )}

        {/* Artifact */}
        {artifactName && (
          <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:9 }}>📄</span>
            <code style={{ fontSize:9, color:'#5b4fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
              {artifactName}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressSteps({ task }) {
  const steps = [
    { key:'assigned', label:'Assigned',  done: !!task.assigned_to },
    { key:'working',  label:'Working',   done: ['reviewing','revision','completed'].includes(task.status) },
    { key:'review',   label:'Reviewed',  done: task.status === 'completed' },
  ];
  return (
    <div style={{ display:'flex', gap:3, alignItems:'center' }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display:'flex', alignItems:'center', flex:1 }}>
          <div style={{
            flex:1, height:3, borderRadius:9,
            background: s.done ? '#16a34a' : '#e5e7eb', transition:'background .4s',
          }} />
          {i < steps.length - 1 && <div style={{ width:1, height:3 }} />}
        </div>
      ))}
      <div style={{ fontSize:8, color:'#6b7280', marginLeft:4, whiteSpace:'nowrap' }}>
        {steps.filter(s=>s.done).length}/{steps.length}
      </div>
    </div>
  );
}

function TeamBadge({ team }) {
  const MAP = {
    frontend: ['🎨', '#6c63ff'],
    backend:  ['⚙️', '#00d2ff'],
    content:  ['✍️', '#00e676'],
    design:   ['🖌️', '#ff6b9d'],
    qa:       ['🔍', '#ffab40'],
  };
  const [icon, color] = MAP[team] || ['📌', '#6b7280'];
  return (
    <span style={{
      fontSize:9, fontWeight:700, padding:'2px 7px',
      background:`${color}18`, color,
      borderRadius:999, border:`1px solid ${color}40`,
      display:'inline-flex', alignItems:'center', gap:3,
    }}>{icon} {team}</span>
  );
}

// ─── Response node ────────────────────────────────────────────────────────────
function ResponseNode({ data }) {
  const done = data.completed;
  const c    = done ? '#00e676' : '#5a5a80';
  return (
    <div style={{
      background:   '#fff',
      border:       `2px solid ${done ? '#16a34a' : '#e5e7eb'}`,
      borderRadius: 12,
      padding:      '10px 24px',
      textAlign:    'center',
      minWidth:     140,
      boxShadow:    done ? `0 0 0 3px rgba(22,163,74,.12), 0 4px 16px rgba(22,163,74,.15)` : '0 1px 4px rgba(0,0,0,.08)',
      transition:   'all .4s',
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity:0 }} />
      <div style={{ fontSize:20, marginBottom:4 }}>{done ? '✅' : '⏳'}</div>
      <div style={{ fontSize:12, fontWeight:700, color: done ? '#16a34a' : '#9ca3af' }}>
        {done ? 'Response Ready' : 'Awaiting…'}
      </div>
      {done && data.score && (
        <div style={{ fontSize:10, color:'#6b7280', marginTop:3 }}>
          Avg score: {data.score}/10
        </div>
      )}
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode, taskCard: TaskCardNode, responseNode: ResponseNode };

// ─── Build layout ─────────────────────────────────────────────────────────────
function buildLayout(tasks, session, events) {
  const nodes = [];
  const edges = [];
  const taskCount     = tasks.length || 1;
  const TASK_W        = 240;
  const TASK_GAP      = 24;
  const totalW        = taskCount * TASK_W + (taskCount - 1) * TASK_GAP;
  const centerX       = totalW / 2;

  // Active agents
  const activeSet = new Set((events || []).map(e => e.agent?.toLowerCase().split('(')[0].trim().split(' ')[0]));
  const sessionStatus = session?.status || 'pending';

  // ── Header agents ──────────────────────────────────────────────────────────
  nodes.push({
    id: 'request', type: 'agentNode',
    position: { x: centerX - 70, y: 0 },
    data: { icon: '📨', label: 'User Request', color: C.request, isActive: false },
  });
  nodes.push({
    id: 'planner', type: 'agentNode',
    position: { x: centerX - 70, y: 120 },
    data: { icon: '🗺️', label: 'Planner', color: C.planner,
      isActive: sessionStatus === 'planning',
      statusLabel: sessionStatus === 'planning' ? 'Decomposing tasks…' : null },
  });
  nodes.push({
    id: 'manager', type: 'agentNode',
    position: { x: centerX - 70, y: 240 },
    data: { icon: '📋', label: 'Manager', color: C.manager,
      isActive: sessionStatus === 'assigning',
      statusLabel: sessionStatus === 'assigning' ? 'Assigning tasks…' : null },
  });

  edges.push(makeEdge('request','planner', C.planner, sessionStatus !== 'pending'));
  edges.push(makeEdge('planner','manager',  C.manager,  ['assigning','working','reviewing','completed'].includes(sessionStatus)));

  // ── Task cards ─────────────────────────────────────────────────────────────
  const tasksY = 380;
  tasks.forEach((task, i) => {
    const x = i * (TASK_W + TASK_GAP);
    const id = `task-${task.id || i}`;

    nodes.push({
      id, type: 'taskCard',
      position: { x, y: tasksY },
      data: { task },
    });

    // Manager → Task edge
    edges.push({
      id: `m-${id}`,
      source: 'manager',
      target: id,
      animated: sessionStatus === 'assigning',
      style: {
        stroke: C.manager,
        strokeWidth: task.assigned_to ? 2 : 1,
        strokeDasharray: task.assigned_to ? undefined : '5 4',
        opacity: task.assigned_to ? 0.8 : 0.3,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: C.manager },
    });

    // Task → Response edge (when done)
    if (task.status === 'completed') {
      edges.push({
        id: `${id}-resp`,
        source: id,
        target: 'response',
        animated: false,
        style: { stroke: '#00e676', strokeWidth: 2, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#00e676' },
      });
    }
  });

  // ── Response node ──────────────────────────────────────────────────────────
  const completed     = tasks.filter(t => t.status === 'completed');
  const avgScore      = completed.length
    ? (completed.flatMap(t => (t.reviews||[]).filter(r=>r.decision==='approved').map(r=>r.score)).reduce((a,b)=>a+b,0) / (completed.length || 1)).toFixed(1)
    : null;

  nodes.push({
    id: 'response', type: 'responseNode',
    position: { x: centerX - 70, y: tasksY + 360 },
    data: { completed: sessionStatus === 'completed', score: avgScore },
  });

  return { nodes, edges };
}

function makeEdge(src, tgt, color, animated = false) {
  return {
    id: `${src}-${tgt}`,
    source: src,
    target: tgt,
    animated,
    style: { stroke: color, strokeWidth: 2, opacity: 0.7 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WorkflowGraph({ events = [], tasks = [], session }) {
  const { nodes: initN, edges: initE } = useMemo(
    () => buildLayout(tasks, session, events),
    [tasks, session, events]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initN);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initE);

  useEffect(() => {
    const { nodes: n, edges: e } = buildLayout(tasks, session, events);
    setNodes(n);
    setEdges(e);
  }, [tasks, session, events, setNodes, setEdges]);

  const isEmpty = !session;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background variant="dots" gap={22} size={1} color="rgba(108,99,255,0.08)" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {isEmpty && (
        <div style={{
          position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', pointerEvents:'none',
          gap:12,
        }}>
          <div style={{ fontSize:44, opacity:.25 }}>🏢</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>Submit a request to see the workflow</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>Tasks will appear here as agents work</div>
        </div>
      )}
    </div>
  );
}
