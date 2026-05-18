import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

// Dùng relative path để hoạt động trên mọi môi trường (dev lẫn production)
const API = '/api';

export function useOfficeStore() {
  const [sessions,        setSessions]        = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSession,   setActiveSession]   = useState(null);
  const [events,          setEvents]          = useState([]);
  const [tasks,           setTasks]           = useState([]);
  const [adminPassword,   setAdminPassword]   = useState(localStorage.getItem('office_admin_pass') || '');
  const [isSubmitting,    setIsSubmitting]    = useState(false);

  const activeIdRef = useRef(activeSessionId);
  useEffect(() => { activeIdRef.current = activeSessionId; }, [activeSessionId]);

  // Helper to get headers with optional auth
  const getHeaders = useCallback((extra = {}) => {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (adminPassword) {
      headers['X-Admin-Password'] = adminPassword;
    }
    return headers;
  }, [adminPassword]);

  const updateAdminPassword = (pass) => {
    setAdminPassword(pass);
    localStorage.setItem('office_admin_pass', pass);
  };


  const { isConnected, lastMessage } = useWebSocket();

  // ── Load sessions list ───────────────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    try {
      const data = await fetch(`${API}/sessions`).then(r => r.json());
      setSessions(data);
    } catch (err) { console.error('Failed to load sessions:', err); }
  }, []);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  // ── Load a specific session's full data ──────────────────────────────────
  const loadSession = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await fetch(`${API}/sessions/${id}`).then(r => r.json());
      setActiveSession(data);
      setEvents(data.events || []);
      setTasks(data.tasks   || []);
    } catch (err) { console.error('Failed to load session:', err); }
  }, []);

  // Switch active session — always clear stale data immediately
  const switchSession = useCallback((id) => {
    setActiveSessionId(id);
    setActiveSession(null);
    setEvents([]);
    setTasks([]);
  }, []);

  useEffect(() => {
    if (activeSessionId) loadSession(activeSessionId);
  }, [activeSessionId, loadSession]);

  // ── WebSocket message handler ────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage;
    const aid = activeIdRef.current;

    switch (type) {
      case 'init':
        if (data.sessions) setSessions(data.sessions);
        // Auto-select the most recent active session if none selected
        if (!aid && data.sessions?.length > 0) {
          const active = data.sessions.find(s => !['completed','failed'].includes(s.status));
          if (active) switchSession(active.id);
        }
        break;

      case 'session:created':
        setSessions(prev => {
          const exists = prev.find(s => s.id === data.id);
          return exists ? prev : [data, ...prev];
        });
        break;

      case 'session:updated':
        setSessions(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
        if (data.id === aid) {
          setActiveSession(prev => prev ? { ...prev, ...data } : data);
        }
        break;

      case 'session:deleted':
        setSessions(prev => prev.filter(s => s.id !== data.id));
        if (data.id === aid) {
          setActiveSessionId(null);
          setActiveSession(null);
          setEvents([]);
          setTasks([]);
        }
        break;

      case 'session:completed':
      case 'session:failed':
        refreshSessions();
        if (data.id === aid) loadSession(data.id);
        break;

      case 'tasks:created':
        if (data.sessionId === aid) {
          setTasks(data.tasks || []);
        }
        break;

      case 'task:updated':
        if (data.sessionId === aid) {
          setTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
          // Reload full session to get outputs/reviews arrays
          loadSession(data.sessionId);
        }
        break;

      case 'agent:thought':
      case 'agent:artifact':
      case 'agent:approval':
      case 'agent:revision':
      case 'agent:info': {
        if (data.sessionId === aid) {
          const event = {
            ...data,
            event_type: type.replace('agent:', ''),
            id:         `${Date.now()}-${Math.random()}`,
          };
          setEvents(prev => [...prev, event]);
        }
        break;
      }

      default:
        break;
    }
  }, [lastMessage, loadSession, refreshSessions, switchSession]);

  // ── Submit request ───────────────────────────────────────────────────────
  const submitRequest = useCallback(async (request, options = {}) => {
    setIsSubmitting(true);
    // Clear state for the new session
    setActiveSession(null);
    setEvents([]);
    setTasks([]);
    try {
      const body = { request, ...options }; // supports docFolder, context
      const data = await fetch(`${API}/sessions`, {
        method:  'POST',
        headers: getHeaders(),
        body:    JSON.stringify(body),
      }).then(r => r.json());

      setSessions(prev => [data, ...prev.filter(s => s.id !== data.id)]);
      setActiveSessionId(data.id);
      setActiveSession(data);
      return data;
    } catch (err) {
      console.error('Submit failed:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // ── Delete session ───────────────────────────────────────────────────────
  const deleteSession = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/sessions/${id}`, { 
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Optimistic update — don't wait for WS broadcast
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeIdRef.current === id) {
        setActiveSessionId(null);
        setActiveSession(null);
        setEvents([]);
        setTasks([]);
      }
    } catch (err) {
      console.error('Delete session failed:', err);
    }
  }, []);

  return {
    sessions,
    activeSessionId,
    activeSession,
    events,
    tasks,
    isSubmitting,
    isConnected,
    setActiveSessionId: switchSession,
    submitRequest,
    deleteSession,
    refreshSessions,
    adminPassword,
    updateAdminPassword,
    // verifyPassword call
    verifyPassword: async (pass) => {
      const res = await fetch(`${API}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      if (res.ok) updateAdminPassword(pass);
      return res.ok;
    }
  };
}
