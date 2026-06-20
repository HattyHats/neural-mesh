import { useGraphStore } from '../store/useGraphStore';
import { X, Activity } from 'lucide-react';

export function InsightsPanel({ onClose }: { onClose: () => void }) {
  const { nodes, edges } = useGraphStore();

  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  
  const orphans = nodes.filter(n => !edges.some(e => e.source === n.id || e.target === n.id)).length;
  
  const connectionsCount = nodes.map(n => {
    const count = edges.filter(e => e.source === n.id || e.target === n.id).length;
    return { ...n, count };
  }).sort((a, b) => b.count - a.count);

  const topNodes = connectionsCount.slice(0, 3);
  const density = totalNodes > 1 ? (totalEdges / (totalNodes * (totalNodes - 1) / 2)).toFixed(3) : 0;

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '400px', background: '#18181b', borderRadius: '12px', border: '1px solid #3f3f46',
      zIndex: 500, color: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20}/> Neural Insights</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20}/></button>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: '#27272a', padding: '15px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Total Thoughts</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalNodes}</div>
          </div>
          <div style={{ background: '#27272a', padding: '15px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Orphaned Ideas</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: orphans > 0 ? '#ef4444' : '#22c55e' }}>{orphans}</div>
          </div>
        </div>
        
        <div style={{ background: '#27272a', padding: '15px', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '10px' }}>Core Concepts (Most Connected)</div>
          {topNodes.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? '1px solid #3f3f46' : 'none' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{n.text}</span>
              <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{n.count} edges</span>
            </div>
          ))}
          {topNodes.length === 0 && <div style={{ color: '#a1a1aa' }}>No connections yet.</div>}
        </div>

        <div style={{ fontSize: '12px', color: '#a1a1aa', textAlign: 'center' }}>
          Network Density: {density}
        </div>
      </div>
    </div>
  );
}
