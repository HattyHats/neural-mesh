import React, { useEffect, useRef } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { broadcastCursor, broadcastNodeMove, broadcastNodeLock, syncGraph } from '../lib/webrtc';
import { applyPhysics } from '../lib/physics';

interface CanvasRendererProps {
  onDoubleClick: (x: number, y: number, nodeId?: string) => void;
}

const imageCache = new Map<string, HTMLImageElement>();

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ onDoubleClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setGraph = useGraphStore(state => state.setGraph);
  const addEdge = useGraphStore(state => state.addEdge);
  
  const transformRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 1 });
  const isDraggingCanvasRef = useRef(false);
  const nodeDraggingRef = useRef<string | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mouseCanvasPosRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const lastBroadcastRef = useRef<number>(0);

  const getCanvasPos = (clientX: number, clientY: number) => {
    const t = transformRef.current;
    return {
      x: (clientX - t.x) / t.scale,
      y: (clientY - t.y) / t.scale
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const { nodes, edges, selectedDate, focusNode } = useGraphStore.getState();
      
      if (focusNode) {
        const target = nodes.find(n => n.id === focusNode);
        if (target) {
          const t = transformRef.current;
          t.x = (window.innerWidth / 2) - target.x * t.scale;
          t.y = (window.innerHeight / 2) - target.y * t.scale;
        }
        useGraphStore.getState().setFocusNode(null);
      }

      const collapsedParents = nodes.filter(n => n.collapsed);
      const hiddenNodeIds = new Set<string>();
      collapsedParents.forEach(p => {
        edges.forEach(e => {
          if (e.source === p.id) hiddenNodeIds.add(e.target);
          if (e.target === p.id) hiddenNodeIds.add(e.source);
        });
      });

      let visibleNodes = nodes;
      let visibleEdges = edges;
      
      if (selectedDate) {
        const visibleNodeIds = new Set<string>();
        nodes.forEach(n => {
          if (n.date === selectedDate) visibleNodeIds.add(n.id);
        });
        edges.forEach(e => {
          if (visibleNodeIds.has(e.source)) visibleNodeIds.add(e.target);
          if (visibleNodeIds.has(e.target)) visibleNodeIds.add(e.source);
        });
        
        visibleNodes = nodes.filter(n => visibleNodeIds.has(n.id) && (!hiddenNodeIds.has(n.id) || n.isDateNode || n.isCategory || n.collapsed));
        visibleEdges = edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
      } else {
        visibleNodes = nodes.filter(n => !hiddenNodeIds.has(n.id) || n.isDateNode || n.isCategory || n.collapsed);
      }
      
      let newNodes = visibleNodes;
      if (visibleNodes.length > 0) {
        newNodes = applyPhysics(visibleNodes, visibleEdges, dt * 10);
        
        if (nodeDraggingRef.current) {
           const draggedNode = newNodes.find(n => n.id === nodeDraggingRef.current);
           if (draggedNode) {
             draggedNode.x = mouseCanvasPosRef.current.x;
             draggedNode.y = mouseCanvasPosRef.current.y;
             draggedNode.vx = 0;
             draggedNode.vy = 0;
           }
        }
        
        const updatedAllNodes = nodes.map(n => {
          const updated = newNodes.find(vn => vn.id === n.id);
          return updated ? updated : n;
        });
        
        useGraphStore.getState().updatePhysics(updatedAllNodes, edges);
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);

      if (nodes.length === 0) {
        ctx.fillStyle = '#52525b';
        ctx.font = '18px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Double-click anywhere to add a thought. Try typing '/red Urgent' or '/img https://...' !", width / 2, height / 2);
      }
      
      ctx.save();
      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);

      ctx.lineWidth = 2 / t.scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      visibleEdges.forEach(edge => {
        const source = newNodes.find(n => n.id === edge.source);
        const target = newNodes.find(n => n.id === edge.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });

      if (edgeSourceRef.current) {
        const source = newNodes.find(n => n.id === edgeSourceRef.current);
        if (source) {
          ctx.strokeStyle = 'rgba(0, 170, 255, 0.8)';
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(mouseCanvasPosRef.current.x, mouseCanvasPosRef.current.y);
          ctx.stroke();
        }
      }

      newNodes.forEach(node => {
        const size = node.radius || (node.isDateNode ? 30 : (node.isCategory ? 35 : 25));
        ctx.fillStyle = node.isDateNode ? '#3b82f6' : (node.isCategory ? '#a855f7' : (node.color || '#111'));
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = (node.collapsed ? 4 : 2) / t.scale;
        
        const isPeerLocked = useGraphStore.getState().peerLockedNodeId === node.id;
        ctx.strokeStyle = nodeDraggingRef.current === node.id ? '#00aaff' : (isPeerLocked ? '#ef4444' : (node.isDateNode ? '#60a5fa' : (node.isCategory ? '#d8b4fe' : (node.color ? '#fff' : '#444'))));
        ctx.stroke();

        if (isPeerLocked) {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.beginPath();
          ctx.arc(node.x, node.y, size + 10 / t.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (node.imageUrl) {
          if (!imageCache.has(node.imageUrl)) {
            const img = new Image();
            img.src = node.imageUrl;
            imageCache.set(node.imageUrl, img);
          }
          const img = imageCache.get(node.imageUrl);
          if (img && img.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, node.x - size, node.y - size, size*2, size*2);
            ctx.restore();
          }
        }

        if (node.details && node.details.trim().length > 0) {
          const badgeX = node.x + size * 0.7;
          const badgeY = node.y - size * 0.7;
          const badgeSize = 6;
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2 / t.scale;
          ctx.stroke();
        }

        const textToDraw = node.isLocked ? '🔒 [LOCKED]' : node.text;
        ctx.font = node.isDateNode || node.isCategory ? `bold 16px "Inter", sans-serif` : `14px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = node.isLocked ? '#a1a1aa' : (node.isDateNode || node.isCategory ? '#eff6ff' : '#eee');
        ctx.fillText(textToDraw, node.x, node.y + (node.isDateNode || node.isCategory ? 45 : 40));
      });

      ctx.restore();
      
      // Draw Minimap
      const mapSize = 150;
      const margin = 20;
      const mapX = width - mapSize - margin;
      const mapY = height - mapSize - margin;
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);
      
      if (nodes.length > 0) {
         let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
         nodes.forEach(n => {
           if (n.x < minX) minX = n.x;
           if (n.x > maxX) maxX = n.x;
           if (n.y < minY) minY = n.y;
           if (n.y > maxY) maxY = n.y;
         });
         const w = Math.max(maxX - minX, 1000);
         const h = Math.max(maxY - minY, 1000);
         const maxDim = Math.max(w, h);
         const mapScale = mapSize / maxDim;
         
         ctx.save();
         
         // Clip to minimap boundary
         ctx.beginPath();
         ctx.rect(mapX, mapY, mapSize, mapSize);
         ctx.clip();
         
         ctx.translate(mapX + mapSize/2, mapY + mapSize/2);
         ctx.scale(mapScale, mapScale);
         const cx = (minX + maxX)/2;
         const cy = (minY + maxY)/2;
         ctx.translate(-cx, -cy);
         
         ctx.fillStyle = '#fff';
         nodes.forEach(n => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, 30, 0, Math.PI*2);
            ctx.fill();
         });
         
         const t = transformRef.current;
         const vx = -t.x / t.scale;
         const vy = -t.y / t.scale;
         const vw = width / t.scale;
         const vh = height / t.scale;
         ctx.strokeStyle = '#3b82f6';
         ctx.lineWidth = 2 / mapScale;
         ctx.strokeRect(vx, vy, vw, vh);
         
         ctx.restore();
      }

      // Draw Peer Cursor
      const peerCursor = useGraphStore.getState().peerCursor;
      if (peerCursor) {
        ctx.save();
        const t = transformRef.current;
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(peerCursor.x, peerCursor.y);
        ctx.lineTo(peerCursor.x + 15 / t.scale, peerCursor.y + 15 / t.scale);
        ctx.lineTo(peerCursor.x + 5 / t.scale, peerCursor.y + 15 / t.scale);
        ctx.lineTo(peerCursor.x, peerCursor.y + 22 / t.scale);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.font = `${14 / t.scale}px "Inter", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Friend', peerCursor.x + 15 / t.scale, peerCursor.y + 20 / t.scale);
        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    const handleDblClick = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const pos = getCanvasPos(clientX, clientY);
      const state = useGraphStore.getState();
      const clickedNode = state.nodes.find(n => {
         const dx = n.x - pos.x;
         const dy = n.y - pos.y;
         const r = n.radius || (n.isDateNode ? 30 : 25);
         return Math.sqrt(dx*dx + dy*dy) < r;
      });
      if (clickedNode) {
        onDoubleClick(pos.x, pos.y, clickedNode.id);
      } else {
        onDoubleClick(pos.x, pos.y);
      }
    };

    canvas.addEventListener('dblclick', handleDblClick);

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const pos = getCanvasPos(e.clientX, e.clientY);
      const state = useGraphStore.getState();
      const clicked = state.nodes.find(n => {
         const dx = n.x - pos.x;
         const dy = n.y - pos.y;
         const r = n.radius || (n.isDateNode ? 30 : 25);
         return Math.sqrt(dx*dx + dy*dy) < r + 15;
      });
      if (clicked && (clicked.isDateNode || clicked.isCategory)) {
        state.toggleCollapse(clicked.id);
      }
    };
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [setGraph, onDoubleClick]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;
    
    const state = useGraphStore.getState();
    const { nodes, peerLockedNodeId } = state;
    const clickedNode = nodes.find(n => {
      const dx = n.x - pos.x;
      const dy = n.y - pos.y;
      const r = n.radius || 25;
      return dx * dx + dy * dy < r * r;
    });

    if (clickedNode) {
      if (peerLockedNodeId === clickedNode.id) {
        // Locked by peer
        return;
      }
      if (e.shiftKey) {
        edgeSourceRef.current = clickedNode.id;
      } else {
        nodeDraggingRef.current = clickedNode.id;
        broadcastNodeLock(clickedNode.id);
      }
    } else {
      isDraggingCanvasRef.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    mouseCanvasPosRef.current = pos;

    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      didDragRef.current = true;
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x += dx;
      transformRef.current.y += dy;
    }

    const now = Date.now();
    if (now - lastBroadcastRef.current > 50) {
      broadcastCursor(pos.x, pos.y);
      if (nodeDraggingRef.current) {
        const draggedNode = useGraphStore.getState().nodes.find(n => n.id === nodeDraggingRef.current);
        if (draggedNode) {
          broadcastNodeMove(draggedNode.id, draggedNode.x, draggedNode.y);
        }
      }
      lastBroadcastRef.current = now;
    }

    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (edgeSourceRef.current) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const { nodes } = useGraphStore.getState();
      const targetNode = nodes.find(n => {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        const r = n.radius || 25;
        return dx * dx + dy * dy < r * r;
      });

      if (targetNode && targetNode.id !== edgeSourceRef.current) {
        useGraphStore.getState().saveHistory();
        addEdge(edgeSourceRef.current, targetNode.id);
        setTimeout(syncGraph, 100);
      }
    }

    if (nodeDraggingRef.current) {
      const state = useGraphStore.getState();
      broadcastNodeLock(null);
      
      if (!didDragRef.current) {
         state.setSelectedNodeId(nodeDraggingRef.current);
      } else {
        const draggedNode = state.nodes.find(n => n.id === nodeDraggingRef.current);
        if (draggedNode) {
          const target = state.nodes.find(n => {
            if (n.id === draggedNode.id) return false;
            const r1 = draggedNode.radius || 25;
            const r2 = n.radius || 25;
            return Math.sqrt(Math.pow(n.x - draggedNode.x, 2) + Math.pow(n.y - draggedNode.y, 2)) < (r1 + r2) / 2 + 10;
          });
          if (target && !target.isDateNode && !draggedNode.isDateNode && !target.isCategory && !draggedNode.isCategory && !target.isLocked && !draggedNode.isLocked) {
            state.saveHistory();
            state.mergeNodes(target.id, draggedNode.id);
            setTimeout(syncGraph, 100);
          }
        }
      }
    }

    isDraggingCanvasRef.current = false;
    nodeDraggingRef.current = null;
    edgeSourceRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(Math.max(0.1, transformRef.current.scale + delta), 5);
    
    // Zoom towards mouse
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const t = transformRef.current;
    t.x = mouseX - (mouseX - t.x) * (newScale / t.scale);
    t.y = mouseY - (mouseY - t.y) * (newScale / t.scale);
    t.scale = newScale;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    onDoubleClick(pos.x, pos.y);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh', cursor: isDraggingCanvasRef.current ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  );
};
