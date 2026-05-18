import { useState } from 'react';
import { useOfficeStore }    from './hooks/useOfficeStore';
import WorkflowsPage         from './components/WorkflowsPage';
import OrganizationChart     from './components/OrganizationChart';
import TeamsConfig           from './components/TeamsConfig';
import RunnersConfig         from './components/RunnersConfig';
import OutputPanel           from './components/OutputPanel';
import MusicCoverPage        from './components/MusicCoverPage';
import StrategyPage          from './components/StrategyPage';
import ErrorBoundary         from './components/ErrorBoundary';
import KeysConfig            from './components/KeysConfig';

// ─── Hub Configuration ────────────────────────────────────────────────────────
const HUBS = [
  { id: 'marketing', label: 'Marketing', icon: '📈', tabs: ['workflows', 'brain', 'output'] },
  { id: 'creative',  label: 'Creative',  icon: '🎨', tabs: ['music'] },
  { id: 'system',    label: 'System',    icon: '⚙️',  tabs: ['explorer', 'teams', 'runners', 'keys'] }
];

const TABS = [
  { id: 'workflows', label: 'Workflows', icon: '⚡' },
  { id: 'brain',     label: 'Brain',     icon: '🧠' },
  { id: 'output',    label: 'Output',    icon: '📄' },
  { id: 'music',     label: 'Music',     icon: '🎵' },
  { id: 'explorer',  label: 'Explorer',  icon: '🏛️' },
  { id: 'teams',     label: 'Teams',     icon: '👥' },
  { id: 'runners',   label: 'Runners',   icon: '🤖' },
  { id: 'keys',      label: 'Keys',      icon: '🔑' },
];

const STATUS_COLOR = {
  pending: '#6b7280', planning: '#5b4fff', assigning: '#0891b2',
  working: '#16a34a', reviewing: '#d97706', completed: '#16a34a', failed: '#dc2626',
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeHub, setActiveHub] = useState('marketing');
  const [activeTab, setActiveTab] = useState('workflows');

  const {
    sessions, activeSessionId, activeSession,
    events, tasks,
    isSubmitting, isConnected,
    setActiveSessionId, submitRequest, deleteSession,
    adminPassword, verifyPassword
  } = useOfficeStore();

  const [passInput, setPassInput] = useState(adminPassword);
  const [isAuthValid, setIsAuthValid] = useState(!!adminPassword);


  const sessionStatus = activeSession?.status || null;

  const handleSubmit = (text, options = {}) => {
    submitRequest(text, options);
    setActiveTab('workflows');
  };

  // Count running workflows for badge
  const runningCount = sessions.filter(s => !['completed','failed'].includes(s.status)).length;
  const doneCount    = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="app-shell">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="app-navbar">
        {/* Logo */}
        <div className="nav-logo">
          <div className="nav-logo-icon">🏢</div>
          <div className="nav-logo-text">Digital <span>Office</span></div>
        </div>

        {/* Hubs Selection */}
        <div className="nav-hubs" style={{ display: 'flex', gap: 4, marginRight: 24, paddingRight: 24, borderRight: '1px solid #e5e7eb' }}>
          {HUBS.map(hub => (
            <button key={hub.id}
              onClick={() => {
                setActiveHub(hub.id);
                setActiveTab(hub.tabs[0]);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                border: 'none', background: activeHub === hub.id ? '#f3f4f6' : 'transparent',
                color: activeHub === hub.id ? '#111827' : '#6b7280',
                fontSize: 13, fontWeight: activeHub === hub.id ? 700 : 500, cursor: 'pointer'
              }}>
              <span style={{ filter: activeHub === hub.id ? 'none' : 'grayscale(1)' }}>{hub.icon}</span>
              {hub.label}
            </button>
          ))}
        </div>

        {/* Filtered Tabs */}
        <div className="nav-tabs">
          {TABS.filter(t => HUBS.find(h => h.id === activeHub).tabs.includes(t.id)).map(tab => (
            <button key={tab.id}
              className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              <span className="nav-tab-icon">{tab.icon}</span>
              {tab.label}
              {/* Badges... */}
              {tab.id === 'workflows' && runningCount > 0 && (
                <span style={{
                  background:'#16a34a', color:'#fff',
                  borderRadius:999, padding:'1px 6px', fontSize:9, fontWeight:800,
                }}>{runningCount}</span>
              )}
              {tab.id === 'output' && doneCount > 0 && (
                <span style={{
                  background:'#5b4fff', color:'#fff',
                  borderRadius:999, padding:'1px 6px', fontSize:9, fontWeight:800,
                }}>{doneCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Right: active session status */}
        <div className="nav-right">
          {activeSession && (
            <div className="session-bar">
              <span style={{
                width:7, height:7, borderRadius:'50%',
                background: STATUS_COLOR[sessionStatus] || '#9ca3af',
                flexShrink:0,
                animation: !['completed','failed',null].includes(sessionStatus) ? 'pulse-anim 1.4s ease-in-out infinite' : 'none',
              }} />
              <span className="session-bar-status" style={{ color: STATUS_COLOR[sessionStatus] || '#9ca3af' }}>
                {sessionStatus}
              </span>
              <span className="session-bar-req">
                {activeSession.request?.slice(0, 50)}{(activeSession.request?.length||0) > 50 ? '…' : ''}
              </span>
            </div>
          )}
          <div className={`conn-dot ${isConnected ? 'on' : 'off'}`}
            title={isConnected ? 'Backend connected' : 'Disconnected'} />
          
          {/* Admin Auth Input */}
          <div style={{ marginLeft: 16, display: 'flex', gap: 4 }}>
            <input
              type="password"
              placeholder="Admin pass..."
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              onBlur={async () => {
                if (passInput) {
                  const ok = await verifyPassword(passInput);
                  setIsAuthValid(ok);
                }
              }}
              style={{
                width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb',
                fontSize: 11, background: isAuthValid ? '#f0fdf4' : '#fff'
              }}
            />
          </div>
        </div>
      </nav>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <main className="app-content">
          {activeTab === 'workflows' && (
            <WorkflowsPage
              sessions={sessions}
              activeSessionId={activeSessionId}
              activeSession={activeSession}
              events={events}
              tasks={tasks}
              isSubmitting={isSubmitting}
              onSelectSession={setActiveSessionId}
              onSubmitRequest={handleSubmit}
              onDeleteSession={deleteSession}
            />
          )}
          {activeTab === 'explorer' && <OrganizationChart />}
          {activeTab === 'output'   && <OutputPanel tasks={tasks} session={activeSession} />}
          {activeTab === 'brain'    && <StrategyPage />}
          { activeTab === 'music'    && <MusicCoverPage />}
          { activeTab === 'teams'    && <TeamsConfig />}
          { activeTab === 'runners'  && <RunnersConfig />}
          { activeTab === 'keys'     && <KeysConfig />}
        </main>
      </ErrorBoundary>
    </div>
  );
}
