import { useGraphStore } from '../store/useGraphStore';
import { X, Settings } from 'lucide-react';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useGraphStore();

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '400px', background: '#18181b', borderRadius: '12px', border: '1px solid #3f3f46',
      zIndex: 500, color: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20}/> Brain Settings</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20}/></button>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '10px', color: '#a1a1aa', fontSize: '14px', fontWeight: 600 }}>Visual Theme</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['dark', 'cyberpunk', 'space'].map(t => (
              <button
                key={t}
                onClick={() => setTheme(t as any)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                  background: theme === t ? '#3b82f6' : '#27272a',
                  color: '#fff', border: 'none', fontWeight: 600, textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
