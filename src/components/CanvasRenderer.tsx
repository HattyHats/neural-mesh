import React, { useEffect, useRef, useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { broadcastCursor, broadcastNodeMove, broadcastNodeLock, syncGraph } from '../lib/webrtc';
import { applyPhysics } from '../lib/physics';
import { Palette, Trash2, Hexagon, Circle, Square } from 'lucide-react';

interface CanvasRendererProps {
  onDoubleClick: (x: number, y: number, nodeId?: string) => void;
}

const imageCache = new Map<string, HTMLImageElement>();

const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  let lines = 1;

  for(let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
      lines++;
    }
    else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return lines * lineHeight;
};

const buildShapePath = (ctx: CanvasRenderingContext2D, node: any, size: number) => {
  ctx.beginPath();
  const shape = node.shape || 'circle';
  if (shape === 'square') {
    ctx.rect(node.x - size, node.y - size, size * 2, size * 2);
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = node.x + size * Math.cos(angle);
      const py = node.y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'triangle') {
    ctx.moveTo(node.x, node.y - size * 1.2);
    ctx.lineTo(node.x + size * 1.2, node.y + size * 0.8);
    ctx.lineTo(node.x - size * 1.2, node.y + size * 0.8);
    ctx.closePath();
  } else {
    ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
  }
};

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ onDoubleClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setGraph = useGraphStore(state => state.setGraph);
  const addEdge = useGraphStore(state => state.addEdge);
  
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  
  const transformRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 1 });
  const isDraggingCanvasRef = useRef(false);
  const nodeDraggingRef = useRef<string | null>(null);
  const nodeResizingRef = useRef<string | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mouseCanvasPosRef = useRef({ x: 0, y: 0 });
  const lassoStartRef = useRef<{ x: number, y: number } | null>(null);
  const lassoEndRef = useRef<{ x: number, y: number } | null>(null);
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
    const handleZoomIn = () => {
      const t = transformRef.current;
      t.scale = Math.min(5, t.scale * 1.2);
    };
    const handleZoomOut = () => {
      const t = transformRef.current;
      t.scale = Math.max(0.1, t.scale / 1.2);
    };
    const handleRecenter = () => {
      const nodes = useGraphStore.getState().nodes;
      if (nodes.length === 0) {
        transformRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 1 };
        return;
      }
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      });
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      
      transformRef.current = { 
        x: window.innerWidth / 2 - cx, 
        y: window.innerHeight / 2 - cy, 
        scale: 1 
      };
    };

    window.addEventListener('zoomIn', handleZoomIn);
    window.addEventListener('zoomOut', handleZoomOut);
    window.addEventListener('recenter', handleRecenter);

    return () => {
      window.removeEventListener('zoomIn', handleZoomIn);
      window.removeEventListener('zoomOut', handleZoomOut);
      window.removeEventListener('recenter', handleRecenter);
    };
  }, []);

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

      const { nodes, edges, selectedDate, focusNode, currentParentId } = useGraphStore.getState();
      
      if (focusNode) {
        const target = nodes.find(n => n.id === focusNode);
        if (target) {
          const t = transformRef.current;
          const targetX = (window.innerWidth / 2) - target.x * t.scale;
          const targetY = (window.innerHeight / 2) - target.y * t.scale;
          
          t.x += (targetX - t.x) * dt * 4;
          t.y += (targetY - t.y) * dt * 4;
          
          // Stop focusing if we are close enough
          if (Math.abs(targetX - t.x) < 5 && Math.abs(targetY - t.y) < 5) {
            useGraphStore.getState().setFocusNode(null);
          }
        } else {
          useGraphStore.getState().setFocusNode(null);
        }
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

      // Filter by parentId (Infinite Depth)
      visibleNodes = visibleNodes.filter(n => (n.parentId || null) === currentParentId);
      visibleEdges = visibleEdges.filter(e => visibleNodes.find(n => n.id === e.source) && visibleNodes.find(n => n.id === e.target));
      
      if (selectedDate) {
        const visibleNodeIds = new Set<string>();
        visibleNodes.forEach(n => {
          if (n.date === selectedDate) visibleNodeIds.add(n.id);
        });
        visibleEdges.forEach(e => {
          if (visibleNodeIds.has(e.source)) visibleNodeIds.add(e.target);
          if (visibleNodeIds.has(e.target)) visibleNodeIds.add(e.source);
        });
        
        visibleNodes = visibleNodes.filter(n => visibleNodeIds.has(n.id) && (!hiddenNodeIds.has(n.id) || n.isDateNode || n.isCategory || n.collapsed));
        visibleEdges = visibleEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
      } else {
        visibleNodes = visibleNodes.filter(n => !hiddenNodeIds.has(n.id) || n.isDateNode || n.isCategory || n.collapsed);
      }
      
      let newNodes = visibleNodes;
      if (visibleNodes.length > 0) {
        newNodes = applyPhysics(visibleNodes, visibleEdges, dt * 10);
        
        if (nodeDraggingRef.current) {
           const draggedNode = newNodes.find(n => n.id === nodeDraggingRef.current);
           const originalNode = nodes.find(n => n.id === nodeDraggingRef.current);
           if (draggedNode && originalNode) {
             draggedNode.x = originalNode.x;
             draggedNode.y = originalNode.y;
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

      // Draw subtle background mesh
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 100 * transformRef.current.scale;
      const offsetX = transformRef.current.x % gridSize;
      const offsetY = transformRef.current.y % gridSize;
      
      ctx.beginPath();
      for (let x = offsetX - gridSize; x < width + gridSize; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = offsetY - gridSize; y < height + gridSize; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();

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

      // Draw Groups
      newNodes.filter(n => n.isGroup).forEach(group => {
         const w = group.width || 400;
         const h = group.height || 400;
         const isSelected = useGraphStore.getState().selectedNodeIds.includes(group.id) || nodeDraggingRef.current === group.id;
         
         ctx.fillStyle = 'rgba(24, 24, 27, 0.4)';
         ctx.strokeStyle = isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.1)';
         ctx.lineWidth = (isSelected ? 4 : 2) / t.scale;
         
         ctx.beginPath();
         ctx.roundRect(group.x - w/2, group.y - h/2, w, h, 20);
         ctx.fill();
         ctx.stroke();
         
         // Title Bar Separator
         ctx.beginPath();
         ctx.moveTo(group.x - w/2, group.y - h/2 + 45);
         ctx.lineTo(group.x + w/2, group.y - h/2 + 45);
         ctx.stroke();
         
         ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
         ctx.font = `bold 16px "Inter", sans-serif`;
         ctx.textAlign = 'left';
         ctx.textBaseline = 'top';
         ctx.fillText(group.text, group.x - w/2 + 20, group.y - h/2 + 15);
         
         // Resize Handle
         ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
         ctx.beginPath();
         ctx.moveTo(group.x + w/2, group.y + h/2 - 20);
         ctx.lineTo(group.x + w/2, group.y + h/2);
         ctx.lineTo(group.x + w/2 - 20, group.y + h/2);
         ctx.closePath();
         ctx.fill();
      });

      // Calculate Focus Set
      const focusNodeId = useGraphStore.getState().activeFocusId;
      const focusSet = new Set<string>();
      if (focusNodeId) {
        const queue = [focusNodeId];
        focusSet.add(focusNodeId);
        let idx = 0;
        while (idx < queue.length) {
          const current = queue[idx++];
          edges.forEach(e => {
            if (e.source === current && !focusSet.has(e.target)) {
              focusSet.add(e.target);
              queue.push(e.target);
            }
            if (e.target === current && !focusSet.has(e.source)) {
              focusSet.add(e.source);
              queue.push(e.source);
            }
          });
        }
      }

      visibleEdges.forEach(edge => {
        const source = newNodes.find(n => n.id === edge.source);
        const target = newNodes.find(n => n.id === edge.target);
        if (source && target) {
          const timeFilter = useGraphStore.getState().timeFilter;
          if (timeFilter !== null) {
             if (source.createdAt && source.createdAt > timeFilter) return;
             if (target.createdAt && target.createdAt > timeFilter) return;
          }

          const maxInteractions = Math.max(source.interactionCount || 0, target.interactionCount || 0);
          const thickness = Math.min(2 + (maxInteractions * 0.1), 8); // Max thickness of 8
          ctx.lineWidth = thickness / t.scale;

          if (edge.isGhost) {
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
            ctx.setLineDash([5, 10]);
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([]);
          }

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const angle = Math.atan2(dy, dx);
          const targetRadius = target.radius || (target.isDateNode ? 30 : 25);
          
          const dist = Math.sqrt(dx*dx + dy*dy);
          const arrowTipX = target.x - Math.cos(angle) * (targetRadius + 6);
          const arrowTipY = target.y - Math.sin(angle) * (targetRadius + 6);
          
          if (focusNodeId) {
             ctx.globalAlpha = (!focusSet.has(edge.source) || !focusSet.has(edge.target)) ? 0.05 : 1.0;
          }

          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          
          if (dist > targetRadius + 6) {
             ctx.lineTo(arrowTipX, arrowTipY);
          } else {
             ctx.lineTo(target.x, target.y);
          }
          
          if (!edge.isGhost) {
            const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
            const sourceColor = source.color || (source.isDateNode ? '#3b82f6' : (source.isCategory ? '#a855f7' : '#8b5cf6'));
            const targetColor = target.color || (target.isDateNode ? '#3b82f6' : (target.isCategory ? '#a855f7' : '#8b5cf6'));
            grad.addColorStop(0, sourceColor + '66');
            grad.addColorStop(1, targetColor + '66');
            ctx.strokeStyle = grad;
            ctx.fillStyle = targetColor;
          } else {
            ctx.fillStyle = 'rgba(139, 92, 246, 0.6)';
          }
          
          ctx.stroke();
          
          // Draw Arrowhead
          if (dist > targetRadius + 20) {
            ctx.beginPath();
            ctx.moveTo(arrowTipX, arrowTipY);
            ctx.lineTo(arrowTipX - 12 * Math.cos(angle - Math.PI / 6), arrowTipY - 12 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(arrowTipX - 12 * Math.cos(angle + Math.PI / 6), arrowTipY - 12 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }

          // Draw Neural Energy Particle
          if (!edge.isGhost && dist > targetRadius + 20) {
            const time = Date.now();
            const phase = (time % 2000) / 2000; // 0 to 1 over 2 seconds
            const startX = source.x + 20 * Math.cos(angle);
            const startY = source.y + 20 * Math.sin(angle);
            const travelDist = dist - 20 - targetRadius - 10;
            
            const targetColor = target.color || (target.isDateNode ? '#3b82f6' : (target.isCategory ? '#a855f7' : '#8b5cf6'));
            ctx.fillStyle = targetColor;
            ctx.shadowColor = targetColor;
            
            // Primary particle
            const particleX = startX + travelDist * phase * Math.cos(angle);
            const particleY = startY + travelDist * phase * Math.sin(angle);
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 3, 0, 2 * Math.PI);
            ctx.fill();
            
            // Secondary staggered particle
            const phase2 = ((time + 1000) % 2000) / 2000;
            const particleX2 = startX + travelDist * phase2 * Math.cos(angle);
            const particleY2 = startY + travelDist * phase2 * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(particleX2, particleY2, 2, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.shadowBlur = 0;
          }

          // Draw Label
          if (edge.label) {
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.font = `12px "Inter", sans-serif`;
            const textWidth = ctx.measureText(edge.label).width;
            
            ctx.fillStyle = 'rgba(24, 24, 27, 0.8)';
            ctx.beginPath();
            ctx.roundRect(midX - textWidth / 2 - 6, midY - 10, textWidth + 12, 20, 10);
            ctx.fill();
            
            ctx.fillStyle = '#a1a1aa';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(edge.label, midX, midY);
          }
          
          ctx.setLineDash([]); // Reset dash
        }
      });
      ctx.globalAlpha = 1.0;

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
        if (node.isGroup) return;

        const timeFilter = useGraphStore.getState().timeFilter;
        if (timeFilter !== null && node.createdAt && node.createdAt > timeFilter) return;

        const isPeerLocked = useGraphStore.getState().peerLockedNodeId === node.id;
        
        // Heatmap Logic
        let opacity = 1.0;
        if (node.lastInteraction) {
           const daysOld = (Date.now() - node.lastInteraction) / (1000 * 60 * 60 * 24);
           opacity = Math.max(0.4, 1.0 - (daysOld * 0.1)); // Fades completely over 6 days
        }
        if (focusNodeId && !focusSet.has(node.id)) {
           opacity = 0.1;
        }
        ctx.globalAlpha = opacity;
        ctx.globalAlpha = opacity;

        const baseSize = node.radius || (node.isDateNode ? 30 : (node.isCategory ? 35 : 25));
        const size = baseSize;
        
        let animatedSize = size;
        if (node.createdAt) {
          const age = Date.now() - node.createdAt;
          if (age < 500) {
            const t = age / 500;
            const easeOutBack = 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
            animatedSize = size * Math.max(0.01, Math.min(easeOutBack, 1.5));
          }
        }
        
        if (node.isSticky) {
          const w = node.width || animatedSize * 4;
          const h = node.height || animatedSize * 4;
          const left = node.x - w/2;
          const top = node.y - h/2;

          ctx.fillStyle = node.color || '#fef08a';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 5;
          ctx.fillRect(left, top, w, h);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          ctx.strokeStyle = nodeDraggingRef.current === node.id ? '#00aaff' : (isPeerLocked ? '#ef4444' : 'rgba(0,0,0,0.1)');
          ctx.lineWidth = 2 / t.scale;
          ctx.strokeRect(left, top, w, h);

          ctx.fillStyle = '#18181b';
          ctx.font = `12px "Inter", sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          
          ctx.save();
          ctx.beginPath();
          ctx.rect(left, top, w, h);
          ctx.clip();
          const contentHeight = wrapText(ctx, node.details || node.text || 'Empty Sticky', left + 10, top + 10 - (node.scrollY || 0), w - 20, 16);
          node.maxScrollY = Math.max(0, contentHeight - h + 20);
          ctx.restore();
          
          // Resize Handle
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.beginPath();
          ctx.moveTo(node.x + w/2, node.y + h/2 - 20);
          ctx.lineTo(node.x + w/2, node.y + h/2);
          ctx.lineTo(node.x + w/2 - 20, node.y + h/2);
          ctx.closePath();
          ctx.fill();
          
          return;
        }

        const baseColor = node.isDateNode ? '#3b82f6' : (node.isCategory ? '#a855f7' : (node.color || '#8b5cf6'));
        
        if (baseColor.startsWith('#')) {
          if (node.shape && node.shape !== 'circle') {
            ctx.fillStyle = baseColor + 'ee';
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 15;
          } else {
            const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, animatedSize);
            grad.addColorStop(0.3, baseColor + 'ff');
            grad.addColorStop(0.8, baseColor + 'aa');
            grad.addColorStop(1, baseColor + '00');
            ctx.fillStyle = grad;
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 15;
          }
        } else {
          ctx.fillStyle = baseColor;
        }

        buildShapePath(ctx, node, animatedSize);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = (node.collapsed ? 4 : 2) / t.scale;
        
        const strokeColor = nodeDraggingRef.current === node.id ? '#00aaff' : (isPeerLocked ? '#ef4444' : (node.isDateNode ? '#60a5fa' : (node.isCategory ? '#d8b4fe' : (node.color ? '#fff' : '#444'))));
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        if (isPeerLocked) {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          buildShapePath(ctx, node, animatedSize + 10 / t.scale);
          ctx.fill();
          ctx.restore();
        }

        const isSelected = useGraphStore.getState().selectedNodeIds.includes(node.id);
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
          ctx.lineWidth = 3 / t.scale;
          ctx.setLineDash([8 / t.scale, 8 / t.scale]);
          buildShapePath(ctx, node, animatedSize + 12 / t.scale);
          ctx.stroke();
          ctx.restore();
        }

        if (node.imageUrl) {
          if (!imageCache.has(node.imageUrl)) {
            const img = new Image();
            img.src = node.imageUrl;
            imageCache.set(node.imageUrl, img);
          }
          const img = imageCache.get(node.imageUrl);
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            buildShapePath(ctx, node, animatedSize);
            ctx.clip();
            try {
              ctx.drawImage(img, node.x - animatedSize, node.y - animatedSize, animatedSize*2, animatedSize*2);
            } catch (e: unknown) {
              console.warn("Failed to draw node image:", e);
            }
            ctx.restore();
          }
        }

        if (node.details && node.details.trim().length > 0) {
          const badgeX = node.x + animatedSize * 0.7;
          const badgeY = node.y - animatedSize * 0.7;
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
        
        if (node.timeString) {
          ctx.font = `11px "Inter", sans-serif`;
          ctx.fillStyle = '#9ca3af'; // gray-400
          ctx.fillText(node.timeString, node.x, node.y + (node.isDateNode || node.isCategory ? 62 : 57));
        }
      });

      if (lassoStartRef.current && lassoEndRef.current) {
        ctx.save();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 1 / t.scale;
        
        const x = lassoStartRef.current.x;
        const y = lassoStartRef.current.y;
        const w = lassoEndRef.current.x - x;
        const h = lassoEndRef.current.y - y;
        
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      }

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
            if (n.isGroup) return; // Skip groups in minimap dots
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

      // Sync Embed Positions
      const embeds = document.querySelectorAll('[data-embed-id]');
      embeds.forEach((el) => {
         const id = el.getAttribute('data-embed-id');
         const node = nodes.find(n => n.id === id);
         if (node) {
            const t = transformRef.current;
            const x = (node.x - 160) * t.scale + t.x;
            const y = (node.y + (node.radius || 25) + 20) * t.scale + t.y;
            (el as HTMLElement).style.transform = `translate(${x}px, ${y}px) scale(${t.scale})`;
            (el as HTMLElement).style.transformOrigin = '0 0';
         }
      });

      // Draw Peer Cursors
      const peerCursors = useGraphStore.getState().peerCursors;
      Object.values(peerCursors).forEach(cursor => {
        ctx.save();
        const t = transformRef.current;
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(cursor.x, cursor.y);
        ctx.lineTo(cursor.x + 15 / t.scale, cursor.y + 15 / t.scale);
        ctx.lineTo(cursor.x + 5 / t.scale, cursor.y + 15 / t.scale);
        ctx.lineTo(cursor.x, cursor.y + 22 / t.scale);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.font = `${14 / t.scale}px "Inter", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(cursor.name || 'Friend', cursor.x + 15 / t.scale, cursor.y + 20 / t.scale);
        ctx.restore();
      });

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
      } else if (clicked && !clicked.isGroup) {
        setContextMenuNodeId(clicked.id);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setHoveredNodeId(null);
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
    if (e.button === 2) return; // Completely ignore right-clicks here to prevent selection/opening
    
    setContextMenuNodeId(null);
    setHoveredNodeId(null);
    const pos = getCanvasPos(e.clientX, e.clientY);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;
    
    const state = useGraphStore.getState();
    const { nodes, peerLockedNodeId } = state;
    
    // Check for resize handle first
    let resizingNode = nodes.slice().reverse().find(n => {
       if (!n.isGroup && !n.isSticky) return false;
       const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
       const w = n.width || (n.isSticky ? baseSize * 4 : 400);
       const h = n.height || (n.isSticky ? baseSize * 4 : 400);
       const right = n.x + w/2;
       const bottom = n.y + h/2;
       return pos.x >= right - 25 && pos.x <= right && pos.y >= bottom - 25 && pos.y <= bottom;
    });
    
    if (resizingNode) {
       nodeResizingRef.current = resizingNode.id;
       return;
    }

    let clickedNode = nodes.slice().reverse().find(n => {
      if (n.isGroup) return false;

      if (n.isSticky) {
        const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
        const w = n.width || baseSize * 4;
        const h = n.height || baseSize * 4;
        return pos.x >= n.x - w/2 && pos.x <= n.x + w/2 && pos.y >= n.y - h/2 && pos.y <= n.y + h/2;
      } else {
        const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        return dx * dx + dy * dy < baseSize * baseSize;
      }
    });

    if (!clickedNode) {
      clickedNode = nodes.slice().reverse().find(n => {
        if (!n.isGroup) return false;
        const w = n.width || 400;
        const h = n.height || 400;
        // Only allow dragging by clicking the top 40px (Title Bar)
        const isTitleBar = pos.x >= n.x - w/2 && pos.x <= n.x + w/2 && pos.y >= n.y - h/2 && pos.y <= n.y - h/2 + 40;
        return isTitleBar;
      });
    }

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
      if (e.shiftKey) {
        lassoStartRef.current = { x: pos.x, y: pos.y };
        lassoEndRef.current = { x: pos.x, y: pos.y };
        useGraphStore.getState().setSelectedNodeIds([]);
      } else {
        isDraggingCanvasRef.current = true;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    mouseCanvasPosRef.current = pos;

    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    
    if ((nodeDraggingRef.current || isDraggingCanvasRef.current || lassoStartRef.current) && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      didDragRef.current = true;
    }

    if (!didDragRef.current && (nodeDraggingRef.current || isDraggingCanvasRef.current)) {
       return; // Ignore micro-twitches on click
    }
    
    if (!isDraggingCanvasRef.current && !nodeDraggingRef.current && !lassoStartRef.current && !contextMenuNodeId) {
      const state = useGraphStore.getState();
      const hovered = state.nodes.slice().reverse().find(n => {
        if (n.isGroup) return false;
        if (n.isSticky) {
          const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
          const w = n.width || baseSize * 4;
          const h = n.height || baseSize * 4;
          return pos.x >= n.x - w/2 && pos.x <= n.x + w/2 && pos.y >= n.y - h/2 && pos.y <= n.y + h/2;
        } else {
          const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
          const dx = n.x - pos.x;
          const dy = n.y - pos.y;
          return dx * dx + dy * dy < baseSize * baseSize;
        }
      });
      
      setHoveredNodeId(hovered ? hovered.id : null);
      if (hovered) {
         setHoverPos({ x: e.clientX, y: e.clientY });
      }
    } else {
      if (hoveredNodeId) setHoveredNodeId(null);
    }

    if (nodeResizingRef.current) {
      const state = useGraphStore.getState();
      const node = state.nodes.find(n => n.id === nodeResizingRef.current);
      if (node) {
        const moveX = dx / transformRef.current.scale;
        const moveY = dy / transformRef.current.scale;
        
        const baseSize = node.radius || (node.isDateNode ? 30 : (node.isCategory ? 35 : 25));
        const defaultW = node.isSticky ? baseSize * 4 : 400;
        const defaultH = node.isSticky ? baseSize * 4 : 400;
        const w = node.width || defaultW;
        const h = node.height || defaultH;
        
        // Keep top-left anchored
        const topLeftX = node.x - w/2;
        const topLeftY = node.y - h/2;
        
        node.width = Math.max(100, w + moveX);
        node.height = Math.max(100, h + moveY);
        
        node.x = topLeftX + node.width / 2;
        node.y = topLeftY + node.height / 2;
      }
    } else if (lassoStartRef.current) {
      lassoEndRef.current = pos;
      
      const minX = Math.min(lassoStartRef.current.x, pos.x);
      const maxX = Math.max(lassoStartRef.current.x, pos.x);
      const minY = Math.min(lassoStartRef.current.y, pos.y);
      const maxY = Math.max(lassoStartRef.current.y, pos.y);
      
      const newSelected = useGraphStore.getState().nodes.filter(n => 
        n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY
      ).map(n => n.id);
      
      useGraphStore.getState().setSelectedNodeIds(newSelected);
    } else if (isDraggingCanvasRef.current) {
      transformRef.current.x += dx;
      transformRef.current.y += dy;
    } else if (nodeDraggingRef.current) {
      const state = useGraphStore.getState();
      const draggedNode = state.nodes.find(n => n.id === nodeDraggingRef.current);
      if (draggedNode && !draggedNode.isLocked) {
        const moveX = dx / transformRef.current.scale;
        const moveY = dy / transformRef.current.scale;
        
        draggedNode.x += moveX;
        draggedNode.y += moveY;
        draggedNode.vx = 0;
        draggedNode.vy = 0;

        if (draggedNode.isGroup) {
           state.nodes.forEach(n => {
             if (n.groupId === draggedNode.id && !n.isLocked) {
                n.x += moveX;
                n.y += moveY;
             }
           });
        } else if (state.selectedNodeIds.includes(draggedNode.id)) {
           state.nodes.forEach(n => {
             if (n.id !== draggedNode.id && state.selectedNodeIds.includes(n.id) && !n.isLocked) {
                n.x += moveX;
                n.y += moveY;
             }
           });
        }
      }
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
    nodeResizingRef.current = null;
    
    if (lassoStartRef.current) {
      lassoStartRef.current = null;
      lassoEndRef.current = null;
    }

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
          if (!draggedNode.isGroup) {
            const targetGroup = state.nodes.slice().reverse().find(g => {
              if (!g.isGroup) return false;
              const w = g.width || 400;
              const h = g.height || 400;
              return draggedNode.x >= g.x - w/2 && draggedNode.x <= g.x + w/2 &&
                     draggedNode.y >= g.y - h/2 && draggedNode.y <= g.y + h/2;
            });
            if (targetGroup) {
              state.setNodeGroup(draggedNode.id, targetGroup.id);
            } else {
              state.setNodeGroup(draggedNode.id, undefined);
            }
          }
          const target = state.nodes.find(n => {
            if (n.id === draggedNode.id) return false;
            const r1 = draggedNode.radius || 25;
            const r2 = n.radius || 25;
            return Math.sqrt(Math.pow(n.x - draggedNode.x, 2) + Math.pow(n.y - draggedNode.y, 2)) < (r1 + r2) / 2 + 10;
          });
          if (target && !target.isDateNode && !draggedNode.isDateNode && !target.isCategory && !draggedNode.isCategory && !target.isLocked && !draggedNode.isLocked && !target.isGroup && !draggedNode.isGroup && !target.isSticky && !draggedNode.isSticky) {
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
    const pos = getCanvasPos(e.clientX, e.clientY);
    const state = useGraphStore.getState();
    
    // Check if hovering over a sticky note
    let hoveredSticky = state.nodes.slice().reverse().find(n => {
      if (!n.isGroup && n.isSticky) {
        const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
        const w = n.width || baseSize * 4;
        const h = n.height || baseSize * 4;
        return pos.x >= n.x - w/2 && pos.x <= n.x + w/2 && pos.y >= n.y - h/2 && pos.y <= n.y + h/2;
      }
      return false;
    });

    if (hoveredSticky) {
      const maxScroll = hoveredSticky.maxScrollY || 0;
      if (maxScroll > 0) {
        hoveredSticky.scrollY = Math.max(0, Math.min(maxScroll, (hoveredSticky.scrollY || 0) + e.deltaY));
        return; // Prevent canvas zoom
      }
    }

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

  const contextNode = contextMenuNodeId ? useGraphStore.getState().nodes.find(n => n.id === contextMenuNodeId) : null;
  const hoveredNode = hoveredNodeId ? useGraphStore.getState().nodes.find(n => n.id === hoveredNodeId) : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        /* eslint-disable-next-line react-hooks/refs */
        style={{ display: 'block', width: '100vw', height: '100vh', cursor: isDraggingCanvasRef.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      />
      
      {/* Hover Preview */}
      {hoveredNode && !contextMenuNodeId && !isDraggingCanvasRef.current && !nodeDraggingRef.current && (
        <div style={{
          position: 'absolute',
          left: hoverPos.x + 20,
          top: hoverPos.y + 20,
          background: 'rgba(24, 24, 27, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '12px 16px',
          color: '#fff',
          pointerEvents: 'none',
          maxWidth: '300px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: hoveredNode.color || '#e4e4e7' }}>
            {hoveredNode.text || 'Untitled'}
          </h4>
          {hoveredNode.details && (
            <p style={{ margin: 0, fontSize: '13px', color: '#a1a1aa', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {hoveredNode.details.substring(0, 150)}...
            </p>
          )}
        </div>
      )}

      {/* Radial Context Menu */}
      {contextMenuNodeId && contextNode && (
        <div 
           style={{
             position: 'absolute',
             left: contextMenuPos.x,
             top: contextMenuPos.y,
             width: '0px', height: '0px',
             zIndex: 200,
             pointerEvents: 'none'
           }}
        >
          <div style={{ position: 'absolute', left: -70, top: -70, pointerEvents: 'auto' }}>
            <button 
              onClick={() => { useGraphStore.getState().updateNodeShape(contextMenuNodeId, 'circle'); setContextMenuNodeId(null); setTimeout(syncGraph, 100); }}
              style={{ background: '#3f3f46', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <Circle size={18} />
            </button>
          </div>
          <div style={{ position: 'absolute', left: -20, top: -90, pointerEvents: 'auto' }}>
            <button 
              onClick={() => { useGraphStore.getState().updateNodeShape(contextMenuNodeId, 'square'); setContextMenuNodeId(null); setTimeout(syncGraph, 100); }}
              style={{ background: '#3f3f46', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <Square size={18} />
            </button>
          </div>
          <div style={{ position: 'absolute', left: 30, top: -70, pointerEvents: 'auto' }}>
            <button 
              onClick={() => { useGraphStore.getState().updateNodeShape(contextMenuNodeId, 'hexagon'); setContextMenuNodeId(null); setTimeout(syncGraph, 100); }}
              style={{ background: '#3f3f46', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <Hexagon size={18} />
            </button>
          </div>

          <div style={{ position: 'absolute', left: -70, top: 30, pointerEvents: 'auto' }}>
            <button 
              onClick={() => { useGraphStore.getState().updateNodeStyle(contextMenuNodeId, '#' + Math.floor(Math.random()*16777215).toString(16)); setContextMenuNodeId(null); setTimeout(syncGraph, 100); }}
              style={{ background: '#3b82f6', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <Palette size={18} />
            </button>
          </div>
          <div style={{ position: 'absolute', left: 30, top: 30, pointerEvents: 'auto' }}>
            <button 
              onClick={() => { useGraphStore.getState().deleteNode(contextMenuNodeId); setContextMenuNodeId(null); setTimeout(syncGraph, 100); }}
              style={{ background: '#ef4444', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
