import React, { useState, useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { syncGraph } from '../lib/webrtc';
import { X, Save, Maximize2, Eye, Edit3, BrainCircuit, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { brainstormConcept } from '../lib/ai';

export function MarkdownEditor() {
  const { selectedNodeId, setSelectedNodeId, updateNodeDetails, updateNodeRadius, updateNodeStyle, updateNodeShape, toggleSticky } = useGraphStore();
  
  const [text, setText] = useState('');
  const [radius, setRadius] = useState(25);
  const [isImage, setIsImage] = useState(false);
  const [nodeColor, setNodeColor] = useState('#8b5cf6');
  const [nodeShape, setNodeShape] = useState<'circle' | 'square' | 'hexagon' | 'triangle'>('circle');
  const [isSticky, setIsSticky] = useState(false);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [nodeTitle, setNodeTitle] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [showAiWarning, setShowAiWarning] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  const startBrainstorm = async () => {
    setShowAiWarning(false);
    setIsAiLoading(true);
    setAiProgress("Starting local AI engine...");
    try {
      const ideas = await brainstormConcept(nodeTitle, setAiProgress);
      if (ideas.length > 0) {
        const state = useGraphStore.getState();
        const baseNode = state.nodes.find(n => n.id === selectedNodeId);
        if (baseNode) {
          ideas.forEach((idea, i) => {
            const newId = crypto.randomUUID();
            const angle = (i * Math.PI * 2) / ideas.length;
            const dist = 150;
            state.addNode({
              id: newId,
              text: idea,
              x: baseNode.x + Math.cos(angle) * dist,
              y: baseNode.y + Math.sin(angle) * dist,
              vx: 0, vy: 0,
              date: baseNode.date
            });
            state.addEdge(baseNode.id, newId);
          });
        }
      }
    } catch (e: any) {
      alert("AI Error: " + e.message);
    }
    setIsAiLoading(false);
    setAiProgress('');
  };

  useEffect(() => {
    if (selectedNodeId) {
      const n = useGraphStore.getState().nodes.find(x => x.id === selectedNodeId);
      if (n) {
        setText(n.details || '');
        setRadius(n.radius || 25);
        setIsImage(!!n.imageUrl);
        setNodeColor(n.color || (n.isDateNode ? '#27272a' : '#8b5cf6'));
        setNodeShape(n.shape || 'circle');
        setIsSticky(!!n.isSticky);
        setNodeTitle(n.text || (n.imageUrl?.includes('youtube.com') ? 'YouTube Video' : 'Image Bubble'));
        
        if (n.imageUrl) {
          const ytMatch = n.imageUrl.match(/img\.youtube\.com\/vi\/([^\/]+)/);
          setYoutubeId(ytMatch ? ytMatch[1] : null);
        } else {
          setYoutubeId(null);
        }
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

      <div style={{ padding: '10px 20px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Color</span>
          <input 
            type="color" 
            value={nodeColor}
            onChange={e => {
               setNodeColor(e.target.value);
               updateNodeStyle(selectedNodeId, e.target.value, undefined);
               setTimeout(syncGraph, 100);
            }}
            style={{ cursor: 'pointer', background: 'transparent', border: 'none', width: '24px', height: '24px', padding: 0 }}
          />
        </div>
        
        {showImageInput ? (
          <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
            <input 
              autoFocus
              placeholder="Paste URL + Enter"
              value={imageUrlInput}
              onChange={e => setImageUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (imageUrlInput) {
                    updateNodeStyle(selectedNodeId, undefined, imageUrlInput);
                    setIsImage(true);
                    setTimeout(syncGraph, 100);
                  }
                  setShowImageInput(false);
                  setImageUrlInput('');
                } else if (e.key === 'Escape') {
                  setShowImageInput(false);
                  setImageUrlInput('');
                }
              }}
              style={{ flex: 1, background: '#09090b', border: '1px solid #3f3f46', borderRadius: '4px', color: '#fff', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
            />
          </div>
        ) : (
          <button 
            onClick={() => setShowImageInput(true)}
            style={{ background: 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', color: '#e4e4e7', fontSize: '12px', padding: '4px 8px', cursor: 'pointer' }}
          >
            Set Image URL
          </button>
        )}
      </div>

      <div style={{ padding: '10px 20px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Shape</span>
          <select 
            value={nodeShape}
            onChange={e => {
              const shape = e.target.value as any;
              setNodeShape(shape);
              updateNodeShape(selectedNodeId, shape);
              setTimeout(syncGraph, 100);
            }}
            style={{ background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '4px', fontSize: '12px', padding: '2px 4px' }}
          >
            <option value="circle">Circle</option>
            <option value="square">Square</option>
            <option value="hexagon">Hexagon</option>
            <option value="triangle">Triangle</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => {
              toggleSticky(selectedNodeId);
              setIsSticky(!isSticky);
              setTimeout(syncGraph, 100);
            }}
            style={{ background: isSticky ? 'var(--accent-primary)' : 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', color: isSticky ? '#fff' : '#e4e4e7', fontSize: '12px', padding: '4px 8px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {isSticky ? 'Sticky Note: ON' : 'Sticky Note: OFF'}
          </button>
        </div>
      </div>

      {(isImage || isSticky) && (
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

      {youtubeId && (
        <div style={{ padding: '20px', borderBottom: '1px solid #3f3f46', background: '#09090b' }}>
          <iframe 
            width="100%" 
            height="230" 
            src={`https://www.youtube.com/embed/${youtubeId}`} 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            style={{ borderRadius: '8px', border: '1px solid #3f3f46' }}
          ></iframe>
        </div>
      )}

      {showAiWarning && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 500, padding: '40px', textAlign: 'center'
        }}>
          <BrainCircuit size={48} color="#8b5cf6" style={{ marginBottom: '20px' }} />
          <h3 style={{ margin: '0 0 15px', fontSize: '20px', color: '#fff' }}>Enable Offline AI</h3>
          <p style={{ color: '#a1a1aa', fontSize: '15px', marginBottom: '30px', lineHeight: '1.6' }}>
            This will download a ~1GB Language Model securely to your device. 
            Once downloaded, Neural-Mesh can generate unlimited connections completely offline!
          </p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={() => setShowAiWarning(false)} style={{ padding: '12px 24px', background: '#3f3f46', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button onClick={startBrainstorm} style={{ padding: '12px 24px', background: '#8b5cf6', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Accept & Download</button>
          </div>
        </div>
      )}

      {isAiLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 500, padding: '40px', textAlign: 'center'
        }}>
          <BrainCircuit size={48} color="#8b5cf6" style={{ marginBottom: '20px' }} />
          <h3 style={{ margin: '0 0 15px', fontSize: '20px', color: '#fff' }}>Brainstorming...</h3>
          <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {aiProgress}
          </p>
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
      <div style={{ padding: '20px', borderTop: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setShowAiWarning(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#8b5cf6', color: '#fff',
              border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
            title="Download & Run Local AI Model to brainstorm related concepts"
          >
            <BrainCircuit size={18} />
            Brainstorm
          </button>
          
          <button 
            onClick={() => {
               if (window.confirm("Are you sure you want to delete this thought?")) {
                  useGraphStore.getState().deleteNode(selectedNodeId);
                  useGraphStore.getState().setSelectedNodeId(null);
                  setTimeout(syncGraph, 100);
               }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', background: '#ef4444', color: '#fff',
              border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
            title="Delete this node completely"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
    </div>
  );
}
