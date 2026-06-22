import React, { useState, useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { syncGraph } from '../lib/webrtc';
import { X, Save, Maximize2, Eye, Edit3, BrainCircuit, Trash2, ZoomIn, Link, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { brainstormConcept, findGhostLinks, devilsAdvocate } from '../lib/ai';

export function MarkdownEditor() {
  const { selectedNodeId, setSelectedNodeId, updateNodeDetails, updateNodeRadius, updateNodeStyle, updateNodeShape, toggleSticky, setCurrentParentId, toggleGravityWell, pathway, setPathway, activeFocusId, setActiveFocusId } = useGraphStore();
  
  const [text, setText] = useState('');
  const [radius, setRadius] = useState(25);
  const [isImage, setIsImage] = useState(false);
  const [nodeColor, setNodeColor] = useState('#8b5cf6');
  const [nodeShape, setNodeShape] = useState<'circle' | 'square' | 'hexagon' | 'triangle'>('circle');
  const [isSticky, setIsSticky] = useState(false);
  const [isGravityWell, setIsGravityWell] = useState(false);
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
              date: baseNode.date,
              parentId: state.currentParentId || undefined
            });
            state.addEdge(baseNode.id, newId);
          });
        }
      }
    } catch (e: unknown) {
      alert("AI Error: " + (e as Error).message);
    }
    setIsAiLoading(false);
    setAiProgress('');
  };

  const startGhostLinks = async () => {
    setShowAiWarning(false);
    setIsAiLoading(true);
    setAiProgress("Starting local AI engine...");
    try {
      const state = useGraphStore.getState();
      const allNodeTitles = state.nodes.filter(n => n.id !== selectedNodeId && n.text && !n.isDateNode).map(n => n.text);
      if (allNodeTitles.length === 0) throw new Error("No other thoughts available to link to.");

      const linkedTitles = await findGhostLinks(nodeTitle, allNodeTitles, setAiProgress);
      if (linkedTitles.length > 0) {
        const confirmMsg = `AI found the following conceptual links:\n\n${linkedTitles.map(t => `- ${t}`).join('\n')}\n\nDo you want to connect them?`;
        if (window.confirm(confirmMsg)) {
          useGraphStore.getState().saveHistory();
          const baseNode = state.nodes.find(n => n.id === selectedNodeId);
          if (baseNode) {
            linkedTitles.forEach(title => {
              const targetNode = state.nodes.find(n => n.text === title);
              if (targetNode) {
                const existingEdge = state.edges.find(e => (e.source === baseNode.id && e.target === targetNode.id) || (e.target === baseNode.id && e.source === targetNode.id));
                if (!existingEdge) {
                  state.addEdge(baseNode.id, targetNode.id);
                  // Mark edge as ghost
                  useGraphStore.setState(s => ({
                    edges: s.edges.map(e => (e.source === baseNode.id && e.target === targetNode.id) ? { ...e, isGhost: true } : e)
                  }));
                }
              }
            });
            setTimeout(syncGraph, 100);
          }
        }
      } else {
        alert("No serendipitous links found.");
      }
    } catch (e: unknown) {
      alert("AI Error: " + (e as Error).message);
    }
    setIsAiLoading(false);
    setAiProgress('');
  };

  const startDevilsAdvocate = async () => {
    setShowAiWarning(false);
    setIsAiLoading(true);
    setAiProgress("Starting local AI engine...");
    try {
      const critiques = await devilsAdvocate(nodeTitle, setAiProgress);
      if (critiques.length > 0) {
        const state = useGraphStore.getState();
        const baseNode = state.nodes.find(n => n.id === selectedNodeId);
        if (baseNode) {
          critiques.forEach((critique, i) => {
            const newId = crypto.randomUUID();
            const angle = (i * Math.PI) + Math.PI / 2; // spawn top and bottom
            const dist = 180;
            state.addNode({
              id: newId,
              text: "Devil's Advocate",
              details: critique,
              x: baseNode.x + Math.cos(angle) * dist,
              y: baseNode.y + Math.sin(angle) * dist,
              vx: 0, vy: 0,
              date: baseNode.date,
              color: '#ea580c', // Dark orange for devil's advocate
              shape: 'square',
              parentId: state.currentParentId || undefined
            });
            state.addEdge(baseNode.id, newId);
          });
          setTimeout(syncGraph, 100);
        }
      }
    } catch (e: unknown) {
      alert("AI Error: " + (e as Error).message);
    }
    setIsAiLoading(false);
    setAiProgress('');
  };

  useEffect(() => {
    if (selectedNodeId) {
      const n = useGraphStore.getState().nodes.find(x => x.id === selectedNodeId);
      if (n) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(n.details || '');
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRadius(n.radius || 25);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsImage(!!n.imageUrl);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNodeColor(n.color || (n.isDateNode ? '#27272a' : '#8b5cf6'));
        setNodeShape(n.shape || 'circle');
        setIsSticky(!!n.isSticky);
        setIsGravityWell(!!n.isGravityWell);
        setNodeTitle(n.text || (n.imageUrl?.includes('youtube.com') ? 'YouTube Video' : 'Image Bubble'));
        
        if (n.imageUrl) {
          const ytMatch = n.imageUrl.match(/img\.youtube\.com\/vi\/([^/]+)/);
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
      position: 'absolute', right: 20, top: 20, width: '450px', height: 'calc(100vh - 100px)',
      background: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
      border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', zIndex: 400, display: 'flex', flexDirection: 'column',
      color: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
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
              type="text" 
              placeholder="Paste Image URL..." 
              value={imageUrlInput}
              onChange={e => setImageUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const state = useGraphStore.getState();
                  state.updateNodeImageUrl(selectedNodeId, imageUrlInput);
                  setShowImageInput(false);
                  setTimeout(syncGraph, 100);
                }
                if (e.key === 'Escape') setShowImageInput(false);
              }}
              style={{ flex: 1, background: '#18181b', color: '#fff', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
            />
            <button onClick={() => setShowImageInput(false)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={14}/></button>
          </div>
        ) : (
           <button onClick={() => setShowImageInput(true)} style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
             Set Image URL
           </button>
        )}
      </div>

      <div style={{ padding: '10px 20px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Shape</span>
          <select 
            value={nodeShape} 
            onChange={e => {
              const s = e.target.value as any;
              setNodeShape(s);
              updateNodeShape(selectedNodeId, s);
              setTimeout(syncGraph, 100);
            }}
            style={{ background: '#18181b', color: '#fff', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
          >
            <option value="circle">Circle</option>
            <option value="square">Square</option>
            <option value="hexagon">Hexagon</option>
            <option value="triangle">Triangle</option>
          </select>
        </div>

        <button 
          onClick={() => {
            const next = !isSticky;
            setIsSticky(next);
            toggleSticky(selectedNodeId);
            setTimeout(syncGraph, 100);
          }}
          style={{ background: isSticky ? '#fbbf24' : 'transparent', color: isSticky ? '#000' : '#a1a1aa', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: isSticky ? 600 : 400 }}
        >
          Sticky Note: {isSticky ? 'ON' : 'OFF'}
        </button>

        <button 
          onClick={() => {
            const next = !isGravityWell;
            setIsGravityWell(next);
            toggleGravityWell(selectedNodeId);
            setTimeout(syncGraph, 100);
          }}
          style={{ background: isGravityWell ? '#a855f7' : 'transparent', color: isGravityWell ? '#fff' : '#a1a1aa', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: isGravityWell ? 600 : 400 }}
        >
          Gravity Well: {isGravityWell ? 'ON' : 'OFF'}
        </button>

        <button 
          onClick={() => {
            if (pathway.isActive) {
              setPathway(false);
            } else {
              setPathway(true, selectedNodeId);
            }
          }}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', background: (pathway.isActive && pathway.sourceId === selectedNodeId) ? '#10b981' : 'transparent', color: (pathway.isActive && pathway.sourceId === selectedNodeId) ? '#fff' : '#a1a1aa', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
        >
          <Target size={12} /> {pathway.isActive ? 'Cancel' : 'Pathway'}
        </button>
      </div>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {showAiWarning && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>
            <strong>Local AI Not Ready.</strong> The system is still loading the Web-LLM model. This can take several minutes the first time as it downloads the neural network weights to your browser cache.
          </div>
        )}
        
        {isAiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#60a5fa', marginBottom: '20px', padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <BrainCircuit className="spin-slow" size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{aiProgress}</span>
          </div>
        )}

        {youtubeId && !isAiLoading && (
          <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <iframe width="100%" height="240" src={`https://www.youtube.com/embed/${youtubeId}`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}

        {!youtubeId && isImage && !isAiLoading && (
          <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <img src={useGraphStore.getState().nodes.find(n => n.id === selectedNodeId)?.imageUrl} alt="Node Graphic" style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        {isPreview ? (
          <div className="prose prose-invert max-w-none" style={{ color: '#e4e4e7', lineHeight: '1.7' }}>
            {text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : <span style={{color: '#71717a', fontStyle: 'italic'}}>No content...</span>}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => {
               setText(e.target.value);
               useGraphStore.getState().updateNodeDetails(selectedNodeId, e.target.value);
            }}
            placeholder="Type your markdown thoughts here... You can also drag & drop images!"
            style={{
              width: '100%', height: '100%', minHeight: '300px', background: 'transparent', color: '#e4e4e7',
              border: 'none', resize: 'none', outline: 'none', fontSize: '15px', lineHeight: '1.7', fontFamily: 'monospace'
            }}
          />
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={startBrainstorm}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#a855f7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', flex: 1 }}
          >
            <BrainCircuit size={14} /> Brainstorm
          </button>
          
          <button 
            onClick={startDevilsAdvocate}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#ea580c', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', flex: 1 }}
          >
            <Target size={14} /> Advocate
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={startGhostLinks}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#d946ef', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', flex: 1 }}
            title="Find serendipitous ghost links"
          >
            <Link size={16} />
          </button>
          
          <button 
            onClick={() => {
              setCurrentParentId(selectedNodeId);
              setSelectedNodeId(null);
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', flex: 1 }}
            title="Dive into this node"
          >
            <ZoomIn size={16} />
          </button>

          <button 
            onClick={() => {
              if (activeFocusId === selectedNodeId) setActiveFocusId(null);
              else setActiveFocusId(selectedNodeId);
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeFocusId === selectedNodeId ? '#fbbf24' : '#64748b', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', flex: 1 }}
            title="Focus Mode"
          >
            <Target size={16} />
          </button>

          <button 
            onClick={() => {
               if (window.confirm("Delete this thought?")) {
                  useGraphStore.getState().deleteNode(selectedNodeId);
                  useGraphStore.getState().setSelectedNodeId(null);
                  setTimeout(syncGraph, 100);
               }
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', flex: 1 }}
            title="Delete this node"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <button 
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', width: '100%', marginTop: '4px' }}
        >
          <Save size={16} /> Save & Close
        </button>
      </div>
    </div>
  );
}
