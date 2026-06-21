import { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';

export function ReplaySlider() {
  const { nodes, setTimeFilter } = useGraphStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(100);
  
  const minTime = useRef<number>(Date.now());
  const maxTime = useRef<number>(Date.now());

  // Calculate the time boundaries based on the graph
  useEffect(() => {
    let min = Date.now();
    let max = Date.now();
    let hasValidTimestamps = false;
    
    nodes.forEach(n => {
      if (n.createdAt) {
        if (n.createdAt < min) min = n.createdAt;
        if (n.createdAt > max) max = n.createdAt;
        hasValidTimestamps = true;
      }
    });

    if (hasValidTimestamps) {
      minTime.current = min;
      maxTime.current = max;
    }
  }, [nodes]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      if (isPlaying) {
        const delta = timestamp - lastTimestamp;
        setCurrentProgress(prev => {
          // Complete replay in ~15 seconds
          const increment = (delta / 15000) * 100;
          const next = prev + increment;
          if (next >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return next;
        });
      }
      lastTimestamp = timestamp;
      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(loop);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (currentProgress === 100) {
      setTimeFilter(null);
    } else {
      const range = maxTime.current - minTime.current;
      const targetTime = minTime.current + (range * (currentProgress / 100));
      setTimeFilter(targetTime);
    }
  }, [currentProgress, setTimeFilter]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentProgress(parseFloat(e.target.value));
  };

  const togglePlay = () => {
    if (currentProgress === 100 && !isPlaying) {
      setCurrentProgress(0); // Restart from beginning
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{
      position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
      width: '600px', maxWidth: '80vw',
      background: 'rgba(24, 24, 27, 0.6)', backdropFilter: 'blur(30px)',
      border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '30px',
      padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '15px',
      zIndex: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
    }}>
      <button onClick={togglePlay} style={{
        background: '#3b82f6', border: 'none', color: '#fff', 
        width: '36px', height: '36px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
      }}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
        <input 
          type="range" 
          min="0" 
          max="100" 
          step="0.1" 
          value={currentProgress} 
          onChange={handleSliderChange}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa' }}>
          <span>{new Date(minTime.current).toLocaleDateString()}</span>
          <span>Time Machine</span>
          <span>{new Date(maxTime.current).toLocaleDateString()}</span>
        </div>
      </div>
      
      <button onClick={() => setCurrentProgress(100)} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa',
        width: '32px', height: '32px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
      }} title="Skip to present">
        <FastForward size={14} />
      </button>
    </div>
  );
}
