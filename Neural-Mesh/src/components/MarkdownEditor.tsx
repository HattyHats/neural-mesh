import React, { useState, useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { syncGraph } from '../lib/webrtc';
import { X, Save, Maximize2, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownEditor() {
  const { selectedNodeId, setSelectedNodeId, updateNodeDetails, updateNodeRadius } = useGraphStore();
  
  const [text, setText] = useState('');
  const [radius, setRadius] = useState(25);
  const [isImage, setIsImage] = useState(false);
  const [nodeTitle, setNodeTitle] = useState('');
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (selectedNodeId) {
      const n = useGraphStore.getState().nodes.find(x => x.id === selectedNodeId);
      if (n) {
        setText(n.details || '');
        setRadius(n.radius || 25);
        setIsImage(!!n.imageUrl);
        setNodeTitle(n.text || 'Image Bubble');
      }
    }
  }, [selectedNodeId]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max = 300;
            if (width > max || height > max) {
              if (width > height) { height = (height / width) * max; width = max; }
              else { width = (width / height) * max; height = max; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.6);
            setText(prev => prev + `\n![Attached Image](${base64})\n`);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  };

  if (!selectedNodeId) return null;

  const handleSave = () => {
    useGraphStore.getState().saveHistory();
    updateNodeDetails(selectedNodeId, text);
    setSelectedNodeId(null);
    setTimeout(syncGraph, 100);
  };

  return (
    <div 
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); }}
      onDragLeave={e => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
      style={{
      position: 'absolute', right: 0, top: 0, width: '450px', height: '100vh',
      background: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(10px)',
      borderLeft: '1px solid #3f3f46', zIndex: 400, display: 'flex', flexDirection: 'column',
      color: '#fff', boxShadow: '-4px 0 15px rgba(0,0,0,0.5)'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeTitle}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsPreview(!isPreview)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '14px' }}>
            {isPreview ? <><Edit3 size={16} /> Edit</> : <><Eye size={16} /> Preview</>}
          </button>
          <button onClick={() => setSelectedNodeId(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {isImage && (
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Maximize2 size={16} color="#a1a1aa" />
          <input 
            type="range" min="10" max="250" value={radius} 
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setRadius(val);
              updateNodeRadius(selectedNodeId, val);
            }} 
            style={{ flex: 1, cursor: 'pointer' }} 
          />
          <span style={{ fontSize: '12px', color: '#a1a1aa', width: '35px', textAlign: 'right' }}>{radius}px</span>
        </div>
      )}

      <div 
        style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
      >
        {isPreview ? (
          <div style={{ color: '#e4e4e7', fontSize: '15px', lineHeight: '1.6', fontFamily: 'sans-serif', wordBreak: 'break-word' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              urlTransform={(value: string) => value}
            >
              {text || '*No notes yet. Switch to Edit mode to write.*'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
            placeholder={isImage ? "Add notes to this image...\n(Drag & Drop images here to attach them inline)" : "Write your deep thoughts here in Markdown...\n(Drag & Drop images here to attach them inline)"}
            style={{
              flex: 1, width: '100%', background: 'transparent', border: 'none', 
              color: '#e4e4e7', fontSize: '15px', lineHeight: '1.6', outline: 'none', resize: 'none',
              fontFamily: 'monospace'
            }}
          />
        )}
      </div>
      <div style={{ padding: '20px', borderTop: '1px solid #3f3f46', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', background: '#3b82f6', color: '#fff',
            border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
          }}
        >
          <Save size={18} />
          Save & Close
        </button>
      </div>
    </div>
  );
}
