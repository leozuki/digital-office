import React, { useState, useEffect } from 'react';
import { useOfficeStore } from '../hooks/useOfficeStore';

export default function KeysConfig() {
  const { adminPassword } = useOfficeStore();
  const [keys, setKeys] = useState({
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OLLAMA_BASE_URL: ''
  });
  const [status, setStatus] = useState('');

  const API = 'http://localhost:3001/api';

  useEffect(() => {
    if (!adminPassword) return;
    fetch(`${API}/keys`, {
      headers: { 'X-Admin-Password': adminPassword }
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 50)}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server did not return JSON. Check if backend is running on port 3001.');
        }
        return res.json();
      })
      .then(data => setKeys(data))
      .catch(err => {
        console.error('Failed to load keys:', err);
        setStatus(`❌ ${err.message}`);
      });
  }, [adminPassword]);

  const handleSave = async () => {
    setStatus('Saving...');
    try {
      const res = await fetch(`${API}/keys`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword 
        },
        body: JSON.stringify(keys)
      });
      if (res.ok) {
        setStatus('✅ Keys updated successfully!');
        setTimeout(() => setStatus(''), 3000);
      } else {
        const err = await res.json();
        setStatus(`❌ Error: ${err.error || 'Failed to save'}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  if (!adminPassword) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        <p>Vui lòng nhập mật khẩu Admin ở thanh Navbar để quản lý API Keys.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>🔑</span> API Keys Configuration
      </h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
        Cấu hình các khóa API để kết nối với AI providers. Các khóa này được lưu trữ an toàn trên server.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Google Gemini API Key
          </label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={keys.GEMINI_API_KEY}
            onChange={(e) => setKeys({ ...keys, GEMINI_API_KEY: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Anthropic API Key
          </label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={keys.ANTHROPIC_API_KEY}
            onChange={(e) => setKeys({ ...keys, ANTHROPIC_API_KEY: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Ollama Base URL (Local AI)
          </label>
          <input
            type="text"
            placeholder="http://localhost:11434"
            value={keys.OLLAMA_BASE_URL}
            onChange={(e) => setKeys({ ...keys, OLLAMA_BASE_URL: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>

        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 24px', background: '#111827', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Save Keys
          </button>
          {status && <span style={{ fontSize: 13, fontWeight: 500 }}>{status}</span>}
        </div>
      </div>

      <div style={{ marginTop: 32, padding: 16, background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: 14 }}>💡 Lưu ý bảo mật</h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
          <li>Keys được ẩn bớt ký tự sau khi lưu để đảm bảo an toàn.</li>
          <li>Chỉ điền vào các ô bạn muốn cập nhật.</li>
          <li>Mật khẩu Admin là bắt buộc để thực hiện thay đổi.</li>
        </ul>
      </div>
    </div>
  );
}
