import { useGraphStore } from '../store/useGraphStore';
import { X, Settings } from 'lucide-react';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useGraphStore();

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('neural_mesh_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '400px', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)',
      zIndex: 500, color: 'var(--text-primary)', boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20}/> Brain Settings</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20}/></button>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Visual Theme</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {['dark', 'light', 'cyberpunk', 'ocean'].map(t => (
              <button
                key={t}
                onClick={() => changeTheme(t)}
                style={{
                  padding: '10px', borderRadius: '8px', cursor: 'pointer',
                  background: theme === t ? 'var(--accent-primary)' : 'transparent',
                  border: `1px solid ${theme === t ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize',
                  transition: 'all 0.2s ease'
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
