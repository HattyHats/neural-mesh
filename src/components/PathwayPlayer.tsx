import { useEffect, useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { Play, Pause, SkipForward, SkipBack, X } from 'lucide-react';

export function PathwayPlayer() {
  const { pathway, isPathwayPlaying, setIsPathwayPlaying, setFocusNode, setSelectedNodeId, setPathway } = useGraphStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPathwayPlaying && pathway.length > 0) {
      // Focus the current node immediately when playing starts
      setFocusNode(pathway[currentIndex]);
      setSelectedNodeId(pathway[currentIndex]);
      
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= pathway.length) {
            setIsPathwayPlaying(false);
            return 0;
          }
          setFocusNode(pathway[next]);
          setSelectedNodeId(pathway[next]);
          return next;
        });
      }, 4000); // 4 seconds per node
    }
    return () => clearInterval(interval);
  }, [isPathwayPlaying, pathway, currentIndex, setFocusNode, setSelectedNodeId, setIsPathwayPlaying]);

  if (pathway.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(24, 24, 27, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '30px',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      zIndex: 1000,
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)'
    }}>
      <div style={{ color: '#a1a1aa', fontSize: '12px', marginRight: '10px' }}>
        Guided Tour ({currentIndex + 1}/{pathway.length})
      </div>
      
      <button 
        onClick={() => {
          const prev = Math.max(0, currentIndex - 1);
          setCurrentIndex(prev);
          setFocusNode(pathway[prev]);
          setSelectedNodeId(pathway[prev]);
        }}
        style={{ background: 'transparent', border: 'none', color: '#e4e4e7', cursor: 'pointer', display: 'flex' }}
      >
        <SkipBack size={18} />
      </button>

      <button 
        onClick={() => setIsPathwayPlaying(!isPathwayPlaying)}
        style={{ background: '#0ea5e9', border: 'none', borderRadius: '50%', color: '#fff', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isPathwayPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '3px' }} />}
      </button>

      <button 
        onClick={() => {
          const next = Math.min(pathway.length - 1, currentIndex + 1);
          setCurrentIndex(next);
          setFocusNode(pathway[next]);
          setSelectedNodeId(pathway[next]);
        }}
        style={{ background: 'transparent', border: 'none', color: '#e4e4e7', cursor: 'pointer', display: 'flex' }}
      >
        <SkipForward size={18} />
      </button>

      <div style={{ width: '1px', height: '20px', background: '#3f3f46', margin: '0 5px' }} />

      <button 
        onClick={() => {
          setIsPathwayPlaying(false);
          setPathway([]);
          setCurrentIndex(0);
        }}
        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', fontSize: '12px', alignItems: 'center', gap: '5px' }}
      >
        <X size={14} /> Clear
      </button>
    </div>
  );
}
