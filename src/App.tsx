import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CanvasRenderer } from './components/CanvasRenderer';
import { useGraphStore, type Node } from './store/useGraphStore';
import { syncGraph } from './lib/webrtc';
import { generateKey, exportKey, importKey, encryptPayload, decryptPayload, parseHash, updateHash, deriveKeyFromPassword, bufferToBase64UrlSafe, base64UrlSafeToBuffer } from './lib/crypto';
import { Skull, AlertTriangle, ShieldAlert, Calendar as CalendarIcon, Download, Flame, Info, Lock, Image as ImageIcon, Search, Undo, Redo, Activity, Settings as SettingsIcon, Network, Save, ZoomIn, ZoomOut, Target, BrainCircuit } from 'lucide-react';
import { CalendarSidebar } from './components/CalendarSidebar';
import { MarkdownEditor } from './components/MarkdownEditor';
import { InsightsPanel } from './components/InsightsPanel';
import { SettingsModal } from './components/SettingsModal';
import { P2PSyncModal } from './components/P2PSyncModal';
import { ChatBox } from './components/ChatBox';
import { PathwayPlayer } from './components/PathwayPlayer';
import { createStegoImage, extractStegoImage } from './lib/steganography';
import { autoClusterNodes } from './lib/ai';
import JSZip from 'jszip';
import './index.css';

export default function App() {
  const { nodes, edges, addNode, setGraph, clearGraph, addEdge, selectedDate, isP2PConnected } = useGraphStore();
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  
  const [floatingInput, setFloatingInput] = useState<{ x: number, y: number, screenX: number, screenY: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  
  const [isIncognito, setIsIncognito] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [urlWarning, setUrlWarning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const [showStartup, setShowStartup] = useState(false);
  const [startupSaveData, setStartupSaveData] = useState<unknown>(null);
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [cryptoSalt, setCryptoSalt] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [quickCaptureText, setQuickCaptureText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  const { setTheme } = useGraphStore();

  useEffect(() => {
    const savedTheme = localStorage.getItem('neural_mesh_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, [setTheme]);


  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const { payload, key: keyStr, burn, salt } = parseHash();
        
        if (payload && salt && !keyStr) {
          setCryptoSalt(salt);
          setShowPasswordPrompt(true);
          setIsReady(true);
          return; // Wait for user password
        }
        
        if (payload && keyStr) {
          const key = await importKey(keyStr);
          setCryptoKey(key);
          const jsonStr = await decryptPayload(key, payload);
          const data = JSON.parse(jsonStr);
          
          const loadedNodes: Node[] = data.nodes || [];
          // Migrate old date nodes
          loadedNodes.forEach(n => {
            if (n.isDateNode && n.text.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const [year, month, day] = n.text.split('-');
              const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              const monthName = dateObj.toLocaleString('default', { month: 'short' });
              n.text = `${monthName}/${day}/${year}`;
            }
          });
          
          setGraph(loadedNodes, data.edges || [], data.vaultSalt || null);
          setTimeout(() => window.dispatchEvent(new CustomEvent('recenter')), 100);
          if (burn) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else {
          const savedStr = localStorage.getItem('neural_mesh_autosave');
          if (savedStr && window.location.pathname === '/') {
            try {
              const savedData = JSON.parse(savedStr);
              setStartupSaveData(savedData);
              setShowStartup(true);
            } catch (e: unknown) {
              const key = await generateKey();
              setCryptoKey(key);
            }
          } else {
            const key = await generateKey();
            setCryptoKey(key);
          }
        }
      } catch (e: unknown) {
        console.error("Failed to decrypt or initialize", e);
        const key = await generateKey();
        setCryptoKey(key);
      }
      setIsReady(true);
    };
    init();
  }, [setGraph]);

  // Auto-save loop
  useEffect(() => {
    if (!isReady || showPasswordPrompt || showStartup || !cryptoKey) return;
    const saveState = {
      nodes: useGraphStore.getState().nodes,
      edges: useGraphStore.getState().edges,
      vaultSalt: useGraphStore.getState().vaultSalt,
      timestamp: Date.now()
    };
    localStorage.setItem('neural_mesh_autosave', JSON.stringify(saveState));
  }, [nodes, edges, isReady, showPasswordPrompt, showStartup, cryptoKey]);

  useEffect(() => {
    const handleGlobalSearch = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleGlobalSearch);
    return () => window.removeEventListener('keydown', handleGlobalSearch);
  }, []);

  useEffect(() => {
    if ((window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge?.onQuickCapture) {
      (window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge.onQuickCapture(() => {
        setShowQuickCapture(true);
      });
    }
  }, []);

  const handlePasswordSubmit = async () => {
    try {
      const { payload, burn } = parseHash();
      if (!payload || !cryptoSalt) return;
      
      const saltBuffer = base64UrlSafeToBuffer(cryptoSalt);
      const key = await deriveKeyFromPassword(passwordInput, saltBuffer);
      
      const jsonStr = await decryptPayload(key, payload);
      const data = JSON.parse(jsonStr);
      setCryptoKey(key);
      setGraph(data.nodes || [], data.edges || []);
      setTimeout(() => window.dispatchEvent(new CustomEvent('recenter')), 100);
      
      if (burn) window.history.replaceState(null, '', window.location.pathname);
      
      setShowPasswordPrompt(false);
      setIsReady(true);
    } catch (e: unknown) {
      alert("Incorrect password or corrupted data.");
    }
  };

  const lockBrain = async () => {
    const pwd = prompt("Enter a master password to encrypt your entire brain. WARNING: If you forget this password, your data is lost forever.");
    if (!pwd) return;
    
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltStr = bufferToBase64UrlSafe(salt);
    const newKey = await deriveKeyFromPassword(pwd, salt);
    
    setCryptoKey(newKey);
    setCryptoSalt(saltStr);
    alert("Brain locked! The URL has been updated. Bookmark it now. Anyone with the link will need your password to view it.");
  };

  // Sync to URL
  const syncTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isReady || !cryptoKey) return;
    if ((window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge) return; // Do not use URL hash for storage in Electron
    
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    
    syncTimeoutRef.current = window.setTimeout(async () => {
      try {
        const state = useGraphStore.getState();
        const data = { nodes: state.nodes, edges: state.edges, vaultSalt: state.vaultSalt };
        const jsonStr = JSON.stringify(data);
        const encrypted = await encryptPayload(cryptoKey, jsonStr);
        
        if (encrypted.length > 2000) {
          setUrlWarning(true);
        } else {
          setUrlWarning(false);
        }
        
        let keyStr: string | undefined = undefined;
        if (!cryptoSalt) {
           keyStr = await exportKey(cryptoKey);
        }
        
        updateHash(encrypted, keyStr, cryptoSalt || undefined);
      } catch (e: unknown) {
        console.error("Sync failed", e);
      }
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [nodes, edges, cryptoKey, isReady, cryptoSalt]);

  // Panic Burn
  const panicBurn = useCallback(async () => {
    if (window.confirm("Are you sure you want to Panic Burn? This will irreversibly delete all data.")) {
      clearGraph();
      window.history.replaceState(null, '', window.location.pathname);
      const newKey = await generateKey();
      setCryptoKey(newKey);
      setFloatingInput(null);
      setInputValue('');
    }
  }, [clearGraph]);

  // Blur event for Incognito Mode
  useEffect(() => {
    const handleBlur = () => {
      if (isIncognito) {
        panicBurn();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isIncognito, panicBurn]);

  const handleDoubleClick = async (x: number, y: number, nodeId?: string) => {
    useGraphStore.getState().saveHistory();
    if (nodeId) {
      const state = useGraphStore.getState();
      const node = state.nodes.find(n => n.id === nodeId);
      if (node && node.isLocked) {
         let activeKey = state.vaultKey;
         if (!activeKey) {
            const pwd = prompt("Enter Vault Password to unlock this thought:");
            if (!pwd) return;
            const saltBuffer = base64UrlSafeToBuffer(state.vaultSalt!);
            try {
               activeKey = await deriveKeyFromPassword(pwd, saltBuffer);
               useGraphStore.getState().setVault(state.vaultSalt!, activeKey);
            } catch (e: unknown) { alert("Wrong password!"); return; }
         }
         try {
           const decryptedText = await decryptPayload(activeKey, node.text);
           useGraphStore.getState().unlockNode(node.id, decryptedText);
         } catch (e: unknown) { alert("Failed to decrypt."); }
      }
      return;
    }
    setFloatingInput({ x, y, screenX: window.innerWidth / 2, screenY: window.innerHeight / 2 });
    setInputValue('');
  };

  const getOrCreateDateNode = (dateStr: string, x: number, y: number) => {
    const state = useGraphStore.getState();
    let dateNode = state.nodes.find(n => n.isDateNode && n.date === dateStr);
    if (!dateNode) {
      const [year, month, day] = dateStr.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const monthName = dateObj.toLocaleString('default', { month: 'short' });
      const displayText = `${monthName}/${day}/${year}`;

      dateNode = { id: crypto.randomUUID(), text: displayText, x: x - 150, y: y - 150, vx: 0, vy: 0, date: dateStr, isDateNode: true };
      addNode(dateNode);
    }
    return dateNode;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useGraphStore.getState().undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useGraphStore.getState().redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setSearchQuery('');
        setSearchIndex(0);
      }
      
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        const selectedId = useGraphStore.getState().selectedNodeId;
        if (selectedId) {
           useGraphStore.getState().saveHistory();
           useGraphStore.getState().deleteNode(selectedId);
           useGraphStore.getState().setSelectedNodeId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const submitNode = async () => {
    if (!floatingInput || !inputValue.trim()) {
      setFloatingInput(null);
      return;
    }

    useGraphStore.getState().saveHistory();

    const newId = crypto.randomUUID();
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    
    let text = inputValue.trim();
    
    let isLocked = false;
    let isCategory = false;
    let isGroup = false;

    if (text === '/cluster') {
       setFloatingInput(null);
       setInputValue('');
       try {
         setIsAiThinking(true);
         setAiMessage("Clustering thoughts...");
         const state = useGraphStore.getState();
         const nodesToCluster = state.nodes.filter(n => !n.isDateNode && !n.isGroup && !n.isCategory && !n.isGhost);
         
         const clusters = await autoClusterNodes(
           nodesToCluster.map(n => ({ id: n.id, text: n.text })), 
           (msg) => setAiMessage(msg)
         );
         
         const spreadRadius = 500;
         const startX = floatingInput.x;
         const startY = floatingInput.y;
         
         clusters.forEach((cluster, idx) => {
            if (cluster.nodeIds.length === 0) return;
            const angle = (idx / clusters.length) * Math.PI * 2;
            const clusterX = startX + Math.cos(angle) * spreadRadius;
            const clusterY = startY + Math.sin(angle) * spreadRadius;
            
            // Create a Group Node for the cluster
            const groupId = crypto.randomUUID();
            addNode({
               id: groupId,
               text: cluster.category,
               x: clusterX,
               y: clusterY,
               vx: 0, vy: 0,
               date: todayStr,
               isGroup: true,
               width: 350,
               height: 350
            });
            
            // Move nodes to cluster location
            cluster.nodeIds.forEach((nid, i) => {
               const node = state.nodes.find(n => n.id === nid);
               if (node && !node.isLocked) {
                  const nodeAngle = (i / cluster.nodeIds.length) * Math.PI * 2;
                  const offsetR = 100 * Math.random();
                  node.x = clusterX + Math.cos(nodeAngle) * offsetR;
                  node.y = clusterY + Math.sin(nodeAngle) * offsetR;
               }
            });
         });
         
         window.dispatchEvent(new CustomEvent('recenter'));
         setTimeout(syncGraph, 100);
       } catch (e: unknown) {
         alert("Clustering failed: " + (e as Error).message);
       } finally {
         setIsAiThinking(false);
         setAiMessage("");
       }
       return;
    }

    if (text.startsWith('/lock ')) {
       isLocked = true;
       text = text.replace('/lock ', '');
    } else if (text.startsWith('/group ')) {
       isCategory = true;
       text = text.replace('/group ', '');
    } else if (text.startsWith('/box ')) {
       isGroup = true;
       text = text.replace('/box ', '');
    }

    const tagMatch = text.match(/\[\[(.*?)\]\]/);
    let targetText = '';
    if (tagMatch) {
      targetText = tagMatch[1];
      text = text.replace(tagMatch[0], '').trim();
    }

    let color = undefined;
    let imageUrl = undefined;
    let embedUrl = undefined;
    if (text.startsWith('/red ')) { color = '#ef4444'; text = text.replace('/red ', ''); }
    else if (text.startsWith('/blue ')) { color = '#3b82f6'; text = text.replace('/blue ', ''); }
    else if (text.startsWith('/green ')) { color = '#22c55e'; text = text.replace('/green ', ''); }
    
    if (text.startsWith('/img ')) {
       const parts = text.split(' ');
       imageUrl = parts[1];
       text = parts.slice(2).join(' ');
    } else if (text.startsWith('/embed ')) {
       const parts = text.split(' ');
       embedUrl = parts[1];
       if (embedUrl.includes('youtube.com/watch?v=')) {
          embedUrl = embedUrl.replace('watch?v=', 'embed/');
       } else if (embedUrl.includes('youtu.be/')) {
          embedUrl = embedUrl.replace('youtu.be/', 'youtube.com/embed/');
       }
       text = parts.slice(2).join(' ') || "Embed";
    } else {
       const ytMatch = text.match(/(?:https?:\/\/(?:www\.)?)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
       if (ytMatch) {
         imageUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
         text = text.replace(ytMatch[0], '').trim() || "YouTube Video";
       } else {
         const imgMatch = text.match(/(https?:\/\/[^\s]+\.(jpeg|jpg|gif|png|webp))/i);
         if (imgMatch) {
            imageUrl = imgMatch[1];
            text = text.replace(imgMatch[0], '').trim() || "Image";
         }
       }
    }

    if (isLocked) {
       const state = useGraphStore.getState();
       let activeVaultKey = state.vaultKey;
       
       if (!state.vaultSalt) {
          const pwd = prompt("Set a Vault Password to encrypt this and future locked thoughts:");
          if (!pwd) return;
          const salt = window.crypto.getRandomValues(new Uint8Array(16));
          const saltStr = bufferToBase64UrlSafe(salt);
          activeVaultKey = await deriveKeyFromPassword(pwd, salt);
          useGraphStore.getState().setVault(saltStr, activeVaultKey);
       } else if (!activeVaultKey) {
          const pwd = prompt("Enter Vault Password to lock this thought:");
          if (!pwd) return;
          const saltBuffer = base64UrlSafeToBuffer(state.vaultSalt);
          try {
            activeVaultKey = await deriveKeyFromPassword(pwd, saltBuffer);
            useGraphStore.getState().setVault(state.vaultSalt, activeVaultKey);
          } catch (e: unknown) {
            alert("Wrong password!"); return;
          }
       }
       if (activeVaultKey) {
         text = await encryptPayload(activeVaultKey, text);
       }
    }

    if (tagMatch) {
      const state = useGraphStore.getState();
      let targetNode = state.nodes.find(n => n.text.toLowerCase() === targetText.toLowerCase());
      
      if (!targetNode) {
        const targetId = crypto.randomUUID();
        targetNode = { id: targetId, text: targetText, x: floatingInput.x + 100, y: floatingInput.y + 100, vx: 0, vy: 0, date: todayStr };
        addNode(targetNode);
      }
      
      addNode({ id: newId, text: text || 'New Node', x: floatingInput.x, y: floatingInput.y, vx: 0, vy: 0, date: todayStr, color, imageUrl, embedUrl, isLocked, isCategory, isGroup, parentId: useGraphStore.getState().currentParentId || undefined });
      addEdge(newId, targetNode.id);
    } else {
      addNode({ id: newId, text: text || 'New Node', x: floatingInput.x, y: floatingInput.y, vx: 0, vy: 0, date: todayStr, color, imageUrl, embedUrl, isLocked, isCategory, isGroup, parentId: useGraphStore.getState().currentParentId || undefined });
    }

    // Ensure the Date Node exists for today, but do NOT automatically connect it
    // to prevent visual clutter and give users complete organizational control.
    getOrCreateDateNode(todayStr, floatingInput.x, floatingInput.y);

    if (selectedDate && selectedDate !== todayStr) {
      getOrCreateDateNode(selectedDate, floatingInput.x, floatingInput.y);
    }
    
    setFloatingInput(null);
    setInputValue('');
    setTimeout(syncGraph, 100);
  };

  const exportMarkdown = () => {
    const { nodes } = useGraphStore.getState();
    const nodesByDate: Record<string, typeof nodes> = {};
    nodes.filter(n => !n.isDateNode).forEach(n => {
      if (!nodesByDate[n.date]) nodesByDate[n.date] = [];
      nodesByDate[n.date].push(n);
    });

    let md = "# Neural-Mesh Journal\n\n";
    Object.keys(nodesByDate).sort().reverse().forEach(date => {
      const [year, month, day] = date.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const displayDate = `${dateObj.toLocaleString('default', { month: 'long' })} ${day}, ${year}`;
      md += `## ${displayDate}\n`;
      nodesByDate[date].forEach(n => {
        md += `- ${n.text}\n`;
      });
      md += "\n";
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neural-mesh-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBurnLink = () => {
    const url = new URL(window.location.href);
    url.hash = url.hash + '&burn=true';
    navigator.clipboard.writeText(url.toString());
    alert("Burn link copied to clipboard!");
  };

  const exportStego = async () => {
    try {
      if (!cryptoKey) return;
      const state = useGraphStore.getState();
      const data = { nodes: state.nodes, edges: state.edges, vaultSalt: state.vaultSalt };
      const jsonStr = JSON.stringify(data);
      const encrypted = await encryptPayload(cryptoKey, jsonStr);
      
      let keyStr: string | undefined = undefined;
      if (!cryptoSalt) {
         keyStr = await exportKey(cryptoKey);
      }
      
      const params = new URLSearchParams();
      params.set('data', encrypted);
      if (keyStr) params.set('key', keyStr);
      if (cryptoSalt) params.set('salt', cryptoSalt);
      const payload = params.toString();

      const dataUrl = await createStegoImage(payload);
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `neural-mesh-stego-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to create steganography image.");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const stegoData = await extractStegoImage(event.target?.result as string);
          window.location.hash = '#' + stegoData;
          window.location.reload();
        } catch (e: unknown) {
          handleImageUpload(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6);

        useGraphStore.getState().saveHistory();
        const today = selectedDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/ /g, '/').replace(',', '');
        const id = Date.now().toString();

        addNode({
          id,
          text: '',
          imageUrl: base64,
          x: 0, y: 0,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          date: today,
          parentId: useGraphStore.getState().currentParentId || undefined
        });

        const { nodes } = useGraphStore.getState();
        if (selectedDate) {
          const dateNode = nodes.find(n => n.text === today && n.isDateNode);
          if (!dateNode) {
            const dateNodeId = `date-${today}`;
            addNode({ id: dateNodeId, text: today, x: -100, y: -100, isDateNode: true, date: today, vx: 0, vy: 0 });
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isReady) return <div style={{ background: '#000', height: '100vh', width: '100vw' }} />;

  return (
    <div 
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDraggingFile(false); }}
      onDrop={handleDrop}
    >
      <CanvasRenderer onDoubleClick={handleDoubleClick} />
      <CalendarSidebar isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />
      <MarkdownEditor />
      <ChatBox isConnected={isP2PConnected} />
      
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === 'image/png') {
              extractStegoImage(file as any).then(payloadStr => {
                const payload = JSON.parse(payloadStr);
                if (payload.type === 'NEURAL_MESH_EXPORT') {
                  useGraphStore.getState().setGraph(payload.nodes, payload.edges, payload.vaultSalt);
                  setTimeout(() => window.dispatchEvent(new CustomEvent('recenter')), 100);
                }
              }).catch(() => handleImageUpload(file));
            } else {
              handleImageUpload(file);
            }
          }
        }} 
      />

      {/* Side Bar Overlay */}
      <div 
        style={{ 
          position: 'absolute', top: 20, left: 20, 
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', 
          zIndex: 10, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', paddingRight: '10px',
          scrollbarWidth: 'none', msOverflowStyle: 'none'
        }}
        className="no-scrollbar"
      >
        <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        
        {useGraphStore.getState().currentParentId && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(24,24,27,0.8)', backdropFilter: 'blur(10px)', padding: '10px 20px', borderRadius: '20px', border: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '15px' }}>
             <button 
                onClick={() => useGraphStore.getState().setCurrentParentId(null)}
                style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
             >
               Root Canvas
             </button>
             <span style={{ color: '#3f3f46' }}>/</span>
             <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
               {useGraphStore.getState().nodes.find(n => n.id === useGraphStore.getState().currentParentId)?.text || 'Nested Canvas'}
             </span>
          </div>
        )}

        <div className="sidebar-section-title">Application</div>
        
        <button className="btn-pill" onClick={() => setIsIncognito(!isIncognito)}>
          <ShieldAlert size={18} />
          {isIncognito ? 'Incognito: ON' : 'Incognito: OFF'}
        </button>

        <button className="btn-pill" onClick={() => setShowSettings(true)}>
          <SettingsIcon size={18} />
          Settings
        </button>

        <button className="btn-pill" onClick={() => setShowInsights(true)}>
          <Activity size={18} />
          Insights
        </button>

        {!((window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge) && (
          <>
            <div className="sidebar-section-title">Security</div>
            
            <button className="btn-pill danger" onClick={panicBurn}>
              <Skull size={18} />
              Panic Burn
            </button>

            <button className="btn-pill warning" onClick={copyBurnLink}>
              <Flame size={18} />
              Burn Link
            </button>
            
            <button className={`btn-pill ${cryptoSalt ? 'primary' : ''}`} onClick={lockBrain}>
              <Lock size={18} />
              {cryptoSalt ? 'Brain Locked' : 'Lock Brain'}
            </button>
          </>
        )}

        {!!(window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge && (
          <>
            <div className="sidebar-section-title">Security</div>
            
            <button className="btn-pill danger" onClick={panicBurn}>
              <Skull size={18} />
              Panic Burn
            </button>
          </>
        )}

        <div className="sidebar-section-title">Tools</div>
        
        <button className="btn-pill" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={18} />
          Upload Image
        </button>

        <button className="btn-pill" onClick={() => setIsCalendarOpen(true)}>
          <CalendarIcon size={18} />
          Timeline
        </button>

        <button className="btn-pill" onClick={() => setShowSearch(true)}>
          <Search size={18} />
          Search
        </button>



        <div className="sidebar-section-title">Network & IO</div>

        <button className="btn-pill" onClick={() => setShowSync(true)}>
          <Network size={18} />
          Sync P2P
        </button>
        
        <button className="btn-pill" onClick={exportStego}>
          <ImageIcon size={18} />
          Stego Export
        </button>

        <button className="btn-pill" onClick={exportMarkdown}>
          <Download size={18} />
          Export MD
        </button>

        <button className="btn-pill" onClick={async () => {
          const state = useGraphStore.getState();
          const zip = new JSZip();
          state.nodes.forEach(node => {
            let content = node.details || "";
            const connections = state.edges
              .filter(e => e.source === node.id || e.target === node.id)
              .map(e => {
                const linkedNodeId = e.source === node.id ? e.target : e.source;
                return state.nodes.find(n => n.id === linkedNodeId)?.text;
              })
              .filter(Boolean);
            if (connections.length > 0) {
              content += "\n\n---\n### Links\n" + connections.map(c => `[[${c}]]`).join('\n');
            }
            zip.file(`${node.text.replace(/[/\\?%*:|"<>]/g, '-')}.md`, content);
          });
          const blob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'NeuralMesh-Obsidian-Vault.zip';
          a.click();
          URL.revokeObjectURL(url);
        }}>
          <Download size={18} />
          Obsidian Vault
        </button>

        {!!(window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge && (
          <>
            <button 
              className="btn-pill success"
              onClick={async () => {
                const state = useGraphStore.getState();
                const data = JSON.stringify({ nodes: state.nodes, edges: state.edges, vaultSalt: state.vaultSalt });
                await (window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge.saveMeshFile(data);
              }}
            >
              <Save size={18} />
              Save .mesh
            </button>
            <button 
              className="btn-pill success"
              onClick={async () => {
                const data = await (window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge.openMeshFile();
                if (data) {
                  const payload = JSON.parse(data);
                  useGraphStore.getState().setGraph(payload.nodes, payload.edges, payload.vaultSalt);
                  setTimeout(() => window.dispatchEvent(new CustomEvent('recenter')), 100);
                }
              }}
            >
              <Download size={18} />
              Load .mesh
            </button>
          </>
        )}

        <div className="sidebar-section-title">Misc</div>

        <button className="btn-pill" onClick={() => setShowInfo(true)}>
          <Info size={18} />
          Info
        </button>

        <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
          <button className="btn-pill" onClick={() => useGraphStore.getState().undo()} title="Undo (Cmd+Z)">
            <Undo size={18} />
          </button>
          <button className="btn-pill" onClick={() => useGraphStore.getState().redo()} title="Redo (Cmd+Shift+Z)">
            <Redo size={18} />
          </button>
        </div>
      </div>

      {showInfo && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: '#18181b', padding: '30px', borderRadius: '12px', maxWidth: '650px', border: '1px solid #3f3f46',
            color: '#e4e4e7', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#fff' }}>Welcome to Neural-Mesh</h2>
            <p style={{ marginBottom: '25px' }}>A zero-backend, cryptographic spatial mind-mapping tool.</p>
            
            <h3 style={{ color: '#fff', borderBottom: '1px solid #3f3f46', paddingBottom: '10px' }}>General Features</h3>
            <ul style={{ lineHeight: '1.6', marginBottom: '25px' }}>
              <li><strong>Lasso Selection:</strong> Hold <strong>Shift</strong> and drag over the canvas to draw a selection box. All selected thoughts can be dragged simultaneously.</li>
              <li><strong>Live AI Clustering:</strong> Type <code>/cluster</code> to let the local AI read all your thoughts, group them into semantic categories, and physically organize them into bounding boxes.</li>
              <li><strong>Deep Thoughts:</strong> Select a thought and press the 'Edit' button in the bottom right to open the Markdown editor. You can drag and drop images directly into the text!</li>
              <li><strong>Node Merging:</strong> Drag and hold one thought over another to fuse them together.</li>
              <li><strong>Multiplayer P2P:</strong> Click 'Sync P2P' to generate a handshake link. Your friends can join your session via WebRTC to view live cursors, chat instantly, and collaborate in real-time.</li>
              <li><strong>Privacy & Security:</strong> Everything is completely offline. Auto-saves continuously back up your brain to your local storage, and the AI Brainstorming runs locally via WebGPU!</li>
            </ul>

            <h3 style={{ color: '#fff', borderBottom: '1px solid #3f3f46', paddingBottom: '10px' }}>Controls & Commands</h3>
            <ul style={{ lineHeight: '1.6' }}>
              <li><strong>Thought Creation:</strong> Double-Click anywhere to create a thought. Double-Click a thought to edit its title.</li>
              <li><strong>Manual Connections:</strong> Hold <strong>Shift</strong> and drag from one thought to another to connect them. Directed arrows will appear pointing to the target.</li>
              <li><strong>Bounding Boxes:</strong> Type <code>/box [Name]</code> to spawn a spatial glassmorphic group container. Dragging the box drags all contained thoughts!</li>
              <li><strong>Live Web Embeds:</strong> Type <code>/embed [URL]</code> (like a YouTube video link) to spawn a fully interactive, synced HTML iframe on the mesh!</li>
              <li><strong>Auto-Tagging:</strong> Type <code>[[Tag Name]]</code> inside a thought's title to automatically connect it to an overarching Category Node.</li>
              <li><strong>Color Commands:</strong> Start a thought's title with <code>/red</code>, <code>/blue</code>, or <code>/green</code> to change its color.</li>
              <li><strong>Rich Media:</strong> Type or paste a direct image link (or use <code>/img [URL]</code>) to instantly render it as a floating thumbnail!</li>
              <li><strong>Search Teleport:</strong> Press <code>Cmd+K</code> (or Ctrl+K) to instantly search and teleport to any thought.</li>
            </ul>

            <button 
              className="btn-pill primary"
              onClick={() => setShowInfo(false)}
              style={{ marginTop: '25px', width: '100%', justifyContent: 'center' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showInsights && <InsightsPanel onClose={() => setShowInsights(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSync && <P2PSyncModal onClose={() => setShowSync(false)} />}
      {showPasswordPrompt && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          background: '#09090b', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff'
        }}>
          <div style={{
            background: '#18181b', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '100%', border: '1px solid #3f3f46', textAlign: 'center'
          }}>
            <Lock size={48} color="#3b82f6" style={{ margin: '0 auto 15px' }} />
            <h2 style={{ marginTop: 0 }}>Brain Locked</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '20px' }}>Enter your master password to decrypt this brain.</p>
            <input 
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password"
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46', background: '#27272a', color: '#fff', fontSize: '16px', marginBottom: '15px', boxSizing: 'border-box'
              }}
            />
            <button 
              onClick={handlePasswordSubmit}
              style={{
                width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '16px', marginBottom: '10px'
              }}
            >
              Decrypt & Open
            </button>
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to Panic Burn? This will irreversibly delete this locked graph.")) {
                  window.location.hash = '';
                  window.location.reload();
                }
              }}
              style={{
                width: '100%', padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '16px'
              }}
            >
              Panic Burn
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div 
          onClick={() => setShowSearch(false)}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 300,
            display: 'flex', justifyContent: 'center', paddingTop: '100px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '600px', background: '#18181b', borderRadius: '12px', border: '1px solid #3f3f46', overflow: 'hidden' }}
          >
            <div style={{ padding: '15px', borderBottom: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Search size={20} color="#a1a1aa" />
              <input 
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setShowSearch(false);
                  const results = useGraphStore.getState().nodes.filter(n => n.text.toLowerCase().includes(searchQuery.toLowerCase()));
                  if (e.key === 'ArrowDown') setSearchIndex(i => Math.min(i + 1, results.length - 1));
                  if (e.key === 'ArrowUp') setSearchIndex(i => Math.max(i - 1, 0));
                  if (e.key === 'Enter' && results[searchIndex]) {
                    useGraphStore.getState().setFocusNode(results[searchIndex].id);
                    setShowSearch(false);
                  }
                }}
                placeholder="Search thoughts... (Cmd+K)"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '18px' }}
              />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {useGraphStore.getState().nodes.filter(n => n.text.toLowerCase().includes(searchQuery.toLowerCase())).map((node, i) => (
                <div 
                  key={node.id}
                  onMouseEnter={() => setSearchIndex(i)}
                  onClick={() => {
                    useGraphStore.getState().setFocusNode(node.id);
                    setShowSearch(false);
                  }}
                  style={{
                    padding: '12px 15px', cursor: 'pointer',
                    background: i === searchIndex ? '#3f3f46' : 'transparent',
                    color: node.isLocked ? '#a1a1aa' : '#fff'
                  }}
                >
                  {node.isLocked ? '🔒 [LOCKED]' : node.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showQuickCapture && (
        <div 
          onClick={() => setShowQuickCapture(false)}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', paddingTop: '150px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '600px', background: '#18181b', borderRadius: '16px', border: '1px solid #3b82f6', overflow: 'hidden', padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
          >
            <h3 style={{ color: '#3b82f6', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BrainCircuit size={20} />
              Quick Capture
            </h3>
            <input 
              autoFocus
              value={quickCaptureText}
              onChange={e => setQuickCaptureText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setShowQuickCapture(false);
                if (e.key === 'Enter' && quickCaptureText.trim()) {
                  const todayStr = selectedDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/ /g, '/').replace(',', '');
                  useGraphStore.getState().addNode({
                     id: crypto.randomUUID(),
                     text: quickCaptureText,
                     x: (Math.random() - 0.5) * 400,
                     y: (Math.random() - 0.5) * 400,
                     vx: 0, vy: 0,
                     date: todayStr,
                     parentId: useGraphStore.getState().currentParentId || undefined
                  });
                  setQuickCaptureText('');
                  setShowQuickCapture(false);
                  setTimeout(syncGraph, 100);
                }
              }}
              placeholder="What's on your mind? (Press Enter to save)"
              style={{ width: '100%', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', padding: '15px', color: '#fff', fontSize: '18px', outline: 'none' }}
            />
            <div style={{ color: '#a1a1aa', fontSize: '12px', marginTop: '10px', textAlign: 'right' }}>
              Press Esc to cancel
            </div>
          </div>
        </div>
      )}


      {showStartup && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(10px)', zIndex: 10000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ background: '#18181b', padding: '30px', borderRadius: '16px', border: '1px solid #3f3f46', textAlign: 'center', maxWidth: '400px' }}>
            <BrainCircuit size={48} color="#3b82f6" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ color: '#fff', margin: '0 0 10px 0' }}>Welcome back!</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '24px' }}>We found a saved session. Would you like to resume where you left off?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={async () => {
                  const key = await generateKey();
                  setCryptoKey(key);
                  setShowStartup(false);
                }}
                style={{ padding: '12px', background: '#3f3f46', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Create New Brain
              </button>
              <button 
                onClick={async () => {
                  if (startupSaveData) {
                    setGraph((startupSaveData as any).nodes || [], (startupSaveData as any).edges || [], (startupSaveData as any).vaultSalt);
                    setTimeout(() => window.dispatchEvent(new CustomEvent('recenter')), 100);
                    if ((startupSaveData as any).vaultSalt) {
                       setCryptoSalt((startupSaveData as any).vaultSalt);
                       setShowPasswordPrompt(true);
                    } else {
                       const key = await generateKey();
                       setCryptoKey(key);
                    }
                  }
                  setShowStartup(false);
                }}
                style={{ padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Load Last Session
              </button>
            </div>
          </div>
        </div>
      )}

      {isDraggingFile && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(59, 130, 246, 0.2)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
          border: '4px dashed #3b82f6', boxSizing: 'border-box'
        }}>
          <h2 style={{ color: '#fff', fontSize: '32px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            Drop Stego-Image to Load Brain
          </h2>
        </div>
      )}

      {urlWarning && !(window as unknown as { electronBridge?: any; handleOpenMeshFile?: any }).electronBridge && (
        <div style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          background: '#854d0e', color: '#fef08a',
          padding: '10px 16px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600
        }}>
          <AlertTriangle size={18} />
          URL Hash limit approaching
        </div>
      )}

      {isAiThinking && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: 'rgba(24, 24, 27, 0.8)', backdropFilter: 'blur(10px)',
          border: '1px solid #3b82f6', borderRadius: '20px', padding: '10px 20px',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
        }}>
          <BrainCircuit size={18} color="#3b82f6" className="spin-slow" />
          <span style={{ fontWeight: 600 }}>{aiMessage || 'AI is thinking...'}</span>
        </div>
      )}

      {/* Live Embed Overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5, width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {nodes.filter(n => n.embedUrl).map(n => (
          <div 
            key={n.id} 
            data-embed-id={n.id}
            style={{ 
               position: 'absolute', 
               top: 0, left: 0, 
               width: 320, height: 180, 
               pointerEvents: 'auto',
               borderRadius: '12px',
               overflow: 'hidden',
               boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)',
               border: '1px solid rgba(255,255,255,0.1)',
               background: '#000',
               transform: 'translate(-9999px, -9999px)' // hidden until synced
            }}
          >
            <iframe src={n.embedUrl} width="100%" height="100%" frameBorder="0" allowFullScreen />
          </div>
        ))}
      </div>

      {/* Zoom UI Widget */}
      <div style={{
        position: 'absolute', bottom: 30, right: 30, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'rgba(24, 24, 27, 0.4)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        padding: '8px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <button onClick={() => window.dispatchEvent(new CustomEvent('zoomIn'))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom In">
          <ZoomIn size={20} />
        </button>
        <div style={{ height: '1px', background: 'rgba(63, 63, 70, 0.5)', width: '100%' }} />
        <button onClick={() => window.dispatchEvent(new CustomEvent('recenter'))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Recenter (Reset Zoom)">
          <Target size={20} />
        </button>
        <div style={{ height: '1px', background: 'rgba(63, 63, 70, 0.5)', width: '100%' }} />
        <button onClick={() => window.dispatchEvent(new CustomEvent('zoomOut'))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Zoom Out">
          <ZoomOut size={20} />
        </button>
      </div>

      {/* Floating Input */}
      {floatingInput && (
        <div style={{
          position: 'absolute',
          top: floatingInput.screenY - 20,
          left: floatingInput.screenX - 100,
          zIndex: 20,
          background: 'rgba(24, 24, 27, 0.4)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}>
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNode();
              if (e.key === 'Escape') setFloatingInput(null);
            }}
            placeholder="Type thought... [[Tag]]"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              outline: 'none',
              width: '200px',
              fontSize: '16px',
            }}
          />
        </div>
      )}

      <PathwayPlayer />
    </div>
  );
}
