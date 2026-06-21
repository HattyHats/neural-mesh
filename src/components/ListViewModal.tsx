import { useState } from 'react';
import { X, AlignLeft, Search } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';

export function ListViewModal({ onClose }: { onClose: () => void }) {
  const nodes = useGraphStore(state => state.nodes);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Group by date
  const grouped = nodes.reduce((acc, node) => {
    if (node.isDateNode || node.isCategory || node.isGroup) return acc;
    if (searchQuery && !node.text.toLowerCase().includes(searchQuery.toLowerCase())) return acc;
    if (!acc[node.date]) acc[node.date] = [];
    acc[node.date].push(node);
    return acc;
  }, {} as Record<string, typeof nodes>);

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // Newest first

  const updateNodeText = (id: string, text: string) => {
    useGraphStore.getState().saveHistory();
    const stateNodes = useGraphStore.getState().nodes;
    const node = stateNodes.find(n => n.id === id);
    if (node && node.text !== text) {
      node.text = text;
      useGraphStore.getState().updatePhysics(stateNodes, useGraphStore.getState().edges);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '800px', maxWidth: '90vw', height: '80vh',
      background: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', whiteSpace: 'nowrap' }}><AlignLeft size={20}/> Plain Text View</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', flex: 1, margin: '0 30px', maxWidth: '400px' }}>
          <Search size={16} color="#a1a1aa" />
          <input 
            type="text" 
            placeholder="Search thoughts..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '10px', width: '100%', fontSize: '14px' }}
          />
        </div>

        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20}/></button>
      </div>

      <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {dates.length === 0 ? (
          <div style={{ color: '#a1a1aa', textAlign: 'center', marginTop: '40px' }}>No thoughts yet. Double click the canvas to add some!</div>
        ) : (
          dates.map(date => (
            <div key={date}>
              <h2 style={{ margin: '0 0 15px 0', color: '#3b82f6', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', paddingBottom: '5px' }}>{date}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {grouped[date].map(node => (
                  <div key={node.id} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <div style={{ color: '#9ca3af', fontSize: '12px', minWidth: '70px', paddingTop: '4px' }}>
                      {node.timeString || '---'}
                    </div>
                    <textarea
                      defaultValue={node.text}
                      onBlur={(e) => {
                        updateNodeText(node.id, e.target.value);
                        e.target.style.border = '1px solid transparent';
                      }}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: '#eee',
                        fontSize: '15px',
                        lineHeight: '1.5',
                        fontFamily: 'inherit',
                        resize: 'none',
                        overflow: 'hidden',
                        minHeight: '24px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        transition: 'border 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
