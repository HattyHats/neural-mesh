import { useGraphStore, type Node, type Edge } from '../store/useGraphStore';

const REPULSION_FORCE = 6000;
const ATTRACTION_FORCE = 0.08;
const SPRING_LENGTH = 150;
const DAMPING = 0.70;

const getEffectiveRadius = (n: Node): number => {
  const baseSize = n.radius || (n.isDateNode ? 30 : (n.isCategory ? 35 : 25));
  if (n.isSticky) {
    // Sticky notes are drawn as squares with width = size * 4, 
    // so the distance from center to corner is about size * 2.8.
    return baseSize * 3;
  }
  return baseSize;
};

export function applyPhysics(nodes: Node[], edges: Edge[], dt: number): Node[] {
  const newNodes = nodes.map(n => ({ ...n }));

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

  for (let i = 0; i < newNodes.length; i++) {
    const nodeA = newNodes[i];
    if (nodeA.isGroup) continue; // Groups are entirely immune to physics forces
    let fx = 0;
    let fy = 0;

    // Repulsion from all other nodes
    for (let j = 0; j < newNodes.length; j++) {
      if (i === j) continue;
      const nodeB = newNodes[j];
      
      if (nodeB.isGroup) {
         if (nodeA.groupId === nodeB.id) continue; // Node belongs inside the group
         if (nodeA.date !== nodeB.date) continue; // Different dates ignore each other
         
         const w = nodeB.width || 400;
         const h = nodeB.height || 400;
         const dx = nodeA.x - nodeB.x;
         const dy = nodeA.y - nodeB.y;
         
         const margin = getEffectiveRadius(nodeA) + 20;
         const rightEdge = w/2 + margin;
         const bottomEdge = h/2 + margin;
         
         if (Math.abs(dx) < rightEdge && Math.abs(dy) < bottomEdge) {
            const distToRight = rightEdge - dx;
            const distToLeft = dx - (-rightEdge); 
            const distToBottom = bottomEdge - dy;
            const distToTop = dy - (-bottomEdge);
            
            const minDist = Math.min(distToRight, distToLeft, distToBottom, distToTop);
            const force = minDist * 10; 
            
            if (minDist === distToRight) fx += force;
            else if (minDist === distToLeft) fx -= force;
            else if (minDist === distToBottom) fy += force;
            else if (minDist === distToTop) fy -= force;
         }
         continue;
      }
      
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const distSq = dx * dx + dy * dy;
      
      const radiusA = getEffectiveRadius(nodeA);
      const radiusB = getEffectiveRadius(nodeB);
      
      let safeDistance = radiusA + radiusB + 40;
      let repulsionForce = REPULSION_FORCE;

      // Push thoughts from different dates away from each other
      if (nodeA.date !== nodeB.date) {
         continue; // Do not apply physical repulsion across different dates
      }
      
      const safeDistSq = safeDistance * safeDistance;
      
      if (distSq > 0 && distSq < Math.max(160000, safeDistSq * 1.5)) { 
        const dist = Math.sqrt(distSq);
        const overlap = Math.max(0, safeDistance - dist);
        
        // Base force + spike if they overlap
        const force = (repulsionForce / distSq) + (overlap * 20);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
    }

    // Attraction from connected edges
    edges.forEach(edge => {
      let otherNode: Node | undefined;
      if (edge.source === nodeA.id) {
        otherNode = newNodes.find(n => n.id === edge.target);
      } else if (edge.target === nodeA.id) {
        otherNode = newNodes.find(n => n.id === edge.source);
      }

      if (otherNode) {
        // If they are from different dates, do not pull them together
        if (otherNode.date !== nodeA.date) return;

        const dx = otherNode.x - nodeA.x;
        const dy = otherNode.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const radiusA = getEffectiveRadius(nodeA);
        const radiusB = getEffectiveRadius(otherNode);
        const dynamicSpringLength = Math.max(SPRING_LENGTH, radiusA + radiusB + 50);

        if (dist > 0) {
          const force = ATTRACTION_FORCE * (dist - dynamicSpringLength);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }
    });

    // Gravity well attraction for Category or explicit Gravity Well nodes
    for (let j = 0; j < newNodes.length; j++) {
      if (i === j) continue;
      const nodeB = newNodes[j];
      if ((nodeB.isCategory || nodeB.isGravityWell) && !nodeA.isGravityWell) {
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distSq = dx * dx + dy * dy;
        const pullRadius = nodeB.isGravityWell ? 1000000 : 250000; // 1000px vs 500px radius
        const pullForce = nodeB.isGravityWell ? 150 : 80;
        
        if (distSq > 0 && distSq < pullRadius) { 
          const dist = Math.sqrt(distSq);
          const force = pullForce / dist;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }
    }

    // Focus mode attraction
    if (focusNodeId && focusSet.has(nodeA.id) && nodeA.id !== focusNodeId) {
      const focusNode = newNodes.find(n => n.id === focusNodeId);
      if (focusNode) {
        const dx = focusNode.x - nodeA.x;
        const dy = focusNode.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 200) {
           const force = 0.05 * (dist - 200);
           fx += (dx / dist) * force;
           fy += (dy / dist) * force;
        }
      }
    }

    // Update velocity
    nodeA.vx = (nodeA.vx + fx * dt) * DAMPING;
    nodeA.vy = (nodeA.vy + fy * dt) * DAMPING;
    
    // Safety cap on velocity to prevent explosions
    const maxV = 20;
    const currentV = Math.sqrt(nodeA.vx * nodeA.vx + nodeA.vy * nodeA.vy);
    if (currentV > maxV) {
      nodeA.vx = (nodeA.vx / currentV) * maxV;
      nodeA.vy = (nodeA.vy / currentV) * maxV;
    }
    
    // Stop completely if moving very slowly to prevent endless jiggling
    if (currentV < 0.1) {
      nodeA.vx = 0;
      nodeA.vy = 0;
    }
  }

  // Update positions
  for (let i = 0; i < newNodes.length; i++) {
    if (newNodes[i].isLocked || newNodes[i].isGroup) {
      newNodes[i].vx = 0;
      newNodes[i].vy = 0;
      continue;
    }
    newNodes[i].x += newNodes[i].vx;
    newNodes[i].y += newNodes[i].vy;
  }

  return newNodes;
}
