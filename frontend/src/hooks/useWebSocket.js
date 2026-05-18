import { useState, useEffect, useCallback, useRef } from 'react';

// Tự động dùng host + port hiện tại của browser → hoạt động trên dev lẫn production
// Dev: vite proxy /ws → ws://localhost:3001/ws | Production: backend serve frontend trực tiếp
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const BACKOFF_BASE_MS  = 3000;  // bắt đầu từ 3s
const BACKOFF_MAX_MS   = 60000; // tối đa 60s

export function useWebSocket() {
  const [isConnected, setIsConnected]   = useState(false);
  const [lastMessage, setLastMessage]   = useState(null);
  const wsRef                           = useRef(null);
  const reconnectTimer                  = useRef(null);
  const attemptRef                      = useRef(0); // đếm số lần reconnect

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      attemptRef.current = 0; // reset backoff khi kết nối thành công
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastMessage(msg);
      } catch {}
    };

    ws.onclose = () => {
      setIsConnected(false);
      attemptRef.current += 1;
      // Exponential backoff: 3s, 6s, 12s, 24s, ... tối đa 60s
      const delay = Math.min(BACKOFF_BASE_MS * (2 ** (attemptRef.current - 1)), BACKOFF_MAX_MS);
      console.log(`[WS] Disconnected — reconnecting in ${delay / 1000}s (attempt #${attemptRef.current})...`);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      console.warn('[WS] Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
