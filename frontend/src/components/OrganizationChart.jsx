import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Agent colors ──────────────────────────────────────────────────────────
const AGENT_COLORS = {
  request_reviewer: '#ff6b9d',
  planner:          '#6c63ff',
  manager:          '#00d2ff',
  worker:           '#00e676',
  reviewer:         '#ffab40',
};

const TEAM_COLORS = {
  frontend: '#6c63ff',
  backend:  '#00d2ff',
  content:  '#00e676',
  design:   '#ff6b9d',
  qa:       '#ffab40',
};

// ─── Custom node styles ────────────────────────────────────────────────────
function OrgNode({ data }) {
  const color = data.color || '#6c63ff';
  return (
    <div style={{
      background:    `linear-gradient(135deg, rgba(${hexToRgb(color)},0.15), rgba(${hexToRgb(color)},0.05))`,
      border:        `1px solid rgba(${hexToRgb(color)},0.4)`,
      borderRadius:  '14px',
      padding:       '14px 18px',
      minWidth:      '160px',
      textAlign:     'center',
      backdropFilter:'blur(12px)',
      boxShadow:     `0 4px 20px rgba(${hexToRgb(color)},0.2)`,
    }}>
      <div style={{ fontSize: '22px', marginBottom: '6px' }}>{data.icon}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: color, marginBottom: '3px' }}>{data.label}</div>
      {data.subtitle && (
        <div style={{ fontSize: '10px', color: '#9090b0', fontWeight: 500 }}>{data.subtitle}</div>
      )}
      {data.members && data.members.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
          {data.members.map((m) => (
            <span key={m} style={{
              fontSize: '9px', fontWeight: 600, padding: '2px 7px',
              background: `rgba(${hexToRgb(color)},0.15)`, color,
              borderRadius: '999px', border: `1px solid rgba(${hexToRgb(color)},0.3)`,
            }}>{m.split(' ')[0]}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1],16)},${parseInt(result[2],16)},${parseInt(result[3],16)}`
    : '108,99,255';
}

const nodeTypes = { orgNode: OrgNode };

// ─── Static org structure ──────────────────────────────────────────────────
const staticNodes = [
  // CEO / Request Reviewer
  { id: 'rr',       type: 'orgNode', position: { x: 340, y: 20  }, data: { icon: '🏛️', label: 'Request Reviewer', subtitle: 'Signs off on all responses', color: '#ff6b9d' } },
  // Middle tier
  { id: 'planner',  type: 'orgNode', position: { x: 60,  y: 160 }, data: { icon: '🗺️', label: 'Project Planner', subtitle: 'Decomposes requests', color: '#6c63ff' } },
  { id: 'manager',  type: 'orgNode', position: { x: 620, y: 160 }, data: { icon: '📋', label: 'Project Manager', subtitle: 'Assigns tasks to teams', color: '#00d2ff' } },
  // Teams
  { id: 'frontend', type: 'orgNode', position: { x: 0,   y: 360 }, data: { icon: '🎨', label: 'Frontend Team',   color: '#6c63ff', members: ['Alex', 'Sam'] } },
  { id: 'backend',  type: 'orgNode', position: { x: 200, y: 360 }, data: { icon: '⚙️', label: 'Backend Team',    color: '#00d2ff', members: ['Jordan', 'Casey'] } },
  { id: 'content',  type: 'orgNode', position: { x: 400, y: 360 }, data: { icon: '✍️', label: 'Content Team',    color: '#00e676', members: ['Riley', 'Morgan'] } },
  { id: 'design',   type: 'orgNode', position: { x: 600, y: 360 }, data: { icon: '🖌️', label: 'Design Team',     color: '#ff6b9d', members: ['Quinn', 'Drew'] } },
  { id: 'qa',       type: 'orgNode', position: { x: 800, y: 360 }, data: { icon: '🔍', label: 'QA Team',         color: '#ffab40', members: ['Taylor'] } },
  // Reviewer
  { id: 'reviewer', type: 'orgNode', position: { x: 340, y: 520 }, data: { icon: '✅', label: 'Task Reviewer',   subtitle: 'Reviews all outputs', color: '#ffab40' } },
];

const makeEdge = (source, target, color = '#6c63ff') => ({
  id:            `${source}-${target}`,
  source,
  target,
  style:         { stroke: color, strokeWidth: 2, strokeOpacity: .5 },
  markerEnd:     { type: MarkerType.ArrowClosed, color },
  animated:      false,
});

const staticEdges = [
  makeEdge('rr',      'planner',  '#6c63ff'),
  makeEdge('rr',      'manager',  '#00d2ff'),
  makeEdge('manager', 'frontend', '#6c63ff'),
  makeEdge('manager', 'backend',  '#00d2ff'),
  makeEdge('manager', 'content',  '#00e676'),
  makeEdge('manager', 'design',   '#ff6b9d'),
  makeEdge('manager', 'qa',       '#ffab40'),
  makeEdge('frontend','reviewer', '#ffab40'),
  makeEdge('backend', 'reviewer', '#ffab40'),
  makeEdge('content', 'reviewer', '#ffab40'),
  makeEdge('design',  'reviewer', '#ffab40'),
  makeEdge('qa',      'reviewer', '#ffab40'),
  makeEdge('reviewer','rr',       '#ff6b9d'),
];

export default function OrganizationChart() {
  const [nodes, , onNodesChange] = useNodesState(staticNodes);
  const [edges, , onEdgesChange] = useEdgesState(staticEdges);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={20} size={1} color="rgba(108,99,255,0.12)" />
        <Controls />
        <MiniMap
          nodeColor={(n) => n.data?.color || '#6c63ff'}
          maskColor="rgba(8,8,16,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
