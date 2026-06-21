import React, { useState, useRef, useEffect } from 'react';
import { X, ExternalLink, RefreshCw, Link as LinkIcon, PenTool } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';
import { syncGraph } from '../lib/webrtc';

export function QuickPadModal({ onClose }: { onClose: () => void }) {
  const { quickPadUrl, setQuickPadUrl } = useGraphStore();
  const [pasteUrl, setPasteUrl] = useState('');
  
  // Dragging state
  const [position, setPosition] = useState({ x: window.innerWidth - 600, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  // Resizing state
  const [size, setSize] = useState({ width: 550, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, y: 0 });
  const initialSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - size.width, initialPosRef.current.x + dx)),
          y: Math.max(0, Math.min(window.innerHeight - size.height, initialPosRef.current.y + dy))
        });
      } else if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        setSize({
          width: Math.max(300, initialSizeRef.current.w + dx),
          height: Math.max(300, initialSizeRef.current.h + dy)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, size.width, size.height]);

  const generatePad = () => {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const key = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const url = `https://hatsquickpad.netlify.app/?workspace=${token}#${key}`;
    setQuickPadUrl(url);
    setTimeout(syncGraph, 100);
  };

  const handlePaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (pasteUrl.includes('hatsquickpad.netlify.app')) {
      setQuickPadUrl(pasteUrl);
      setTimeout(syncGraph, 100);
    } else {
      alert("Please enter a valid Quick-Pad URL.");
    }
  };

  return (
    <div style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      width: size.width,
      height: size.height,
      background: '#18181b',
      border: '1px solid #3f3f46',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      overflow: 'hidden'
    }}>
      {/* Header (Draggable) */}
      <div 
        onMouseDown={(e) => {
          setIsDragging(true);
          dragStartRef.current = { x: e.clientX, y: e.clientY };
          initialPosRef.current = { x: position.x, y: position.y };
        }}
        style={{
          padding: '12px 16px', background: '#27272a', borderBottom: '1px solid #3f3f46',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 600 }}>
          <PenTool size={18} color="#10b981" />
          Quick-Pad
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {quickPadUrl && (
             <a href={quickPadUrl} target="_blank" rel="noreferrer" title="Open in new tab" style={{ color: '#a1a1aa', cursor: 'pointer', padding: '4px' }}>
               <ExternalLink size={16} />
             </a>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {!quickPadUrl ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <PenTool size={48} color="#10b981" style={{ marginBottom: '10px' }} />
            <h3 style={{ color: '#fff', margin: 0 }}>Embedded Scratchpad</h3>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, maxWidth: '300px' }}>
              Quick-Pad is a zero-knowledge real-time notepad. Create a new pad to take notes during your brainstorm session.
            </p>
            
            <button onClick={generatePad} style={{
              background: '#10b981', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', 
              fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center'
            }}>
              <RefreshCw size={18} />
              Generate Secure Pad
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <div style={{ height: '1px', background: '#3f3f46', flex: 1 }} />
              <span style={{ fontSize: '12px' }}>OR</span>
              <div style={{ height: '1px', background: '#3f3f46', flex: 1 }} />
            </div>

            <form onSubmit={handlePaste} style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input 
                type="text" 
                placeholder="Paste existing URL..." 
                value={pasteUrl}
                onChange={e => setPasteUrl(e.target.value)}
                style={{ flex: 1, background: '#27272a', border: '1px solid #3f3f46', borderRadius: '6px', padding: '10px', color: '#fff' }}
              />
              <button type="submit" style={{ background: '#3f3f46', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <LinkIcon size={16} />
              </button>
            </form>
          </div>
        ) : (
          <>
            <iframe 
              src={quickPadUrl} 
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Quick-Pad"
              allow="clipboard-read; clipboard-write"
            />
            {/* Overlay to prevent iframe from capturing pointer events during drag/resize */}
            {(isDragging || isResizing) && (
               <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }} />
            )}
          </>
        )}
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={(e) => {
          setIsResizing(true);
          resizeStartRef.current = { x: e.clientX, y: e.clientY };
          initialSizeRef.current = { w: size.width, h: size.height };
        }}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: '15px', height: '15px', cursor: 'se-resize', zIndex: 20
        }}
      />
    </div>
  );
}
