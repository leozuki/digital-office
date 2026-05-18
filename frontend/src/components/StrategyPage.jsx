import { useState, useEffect } from 'react';

export default function StrategyPage() {
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/knowledge')
      .then(res => res.json())
      .then(data => {
        setKnowledge(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = {
    seo:      { icon: '🔍', color: '#0891b2', bg: '#ecfeff' },
    strategy: { icon: '🎯', color: '#5b4fff', bg: '#f5f3ff' },
    tone:     { icon: '🗣️', color: '#d97706', bg: '#fffbeb' },
    general:  { icon: '💡', color: '#6b7280', bg: '#f3f4f6' }
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', background: '#f8f9fa' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Strategic Memory</h1>
        <p style={{ color: '#6b7280', marginTop: 4 }}>Learnings and insights extracted from autonomous workflow cycles.</p>
      </div>

      {loading ? (
        <div style={{ color: '#9ca3af' }}>Loading memory...</div>
      ) : knowledge.length === 0 ? (
        <div style={{ 
          padding: 48, textAlign: 'center', background: '#fff', borderRadius: 16, 
          border: '2px dashed #e5e7eb' 
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <h3 style={{ color: '#374151', margin: 0 }}>Memory is empty</h3>
          <p style={{ color: '#9ca3af' }}>Run autonomous workflows to start collecting strategic insights.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {knowledge.map((item) => {
            const cat = categories[item.category] || categories.general;
            return (
              <div key={item.id} style={{
                background: '#fff', padding: 20, borderRadius: 16,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ 
                  position: 'absolute', top: 0, left: 0, width: 4, height: '100%', 
                  background: cat.color 
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: 6, background: cat.bg, 
                    color: cat.color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    {cat.icon} {item.category.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                    {new Date(item.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8, marginTop: 0 }}>
                  {item.key}
                </h3>
                <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>
                  {item.value}
                </p>

                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 2 }}>
                    <div style={{ 
                      width: `${item.confidence * 100}%`, height: '100%', 
                      background: cat.color, borderRadius: 2 
                    }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>
                    {Math.round(item.confidence * 100)}% Confidence
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
