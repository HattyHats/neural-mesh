import type { Node, Edge } from '../store/useGraphStore';

const REPULSION_FORCE = 6000;
const ATTRACTION_FORCE = 0.08;
const SPRING_LENGTH = 150;
const DAMPING = 0.70;

export function applyPhysics(nodes: Node[], edges: Edge[], dt: number): Node[] {
  const newNodes = nodes.map(n => ({ ...n }));

  for (let i = 0; i < newNodes.length; i++) {
    const nodeA = newNodes[i];
    let fx = 0;
    let fy = 0;

    // Repulsion from all other nodes
    for (let j = 0; j < newNodes.length; j++) {
      if (i === j) continue;
      const nodeB = newNodes[j];
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < 160000) { // Limit repulsion distance to 400px
        const dist = Math.sqrt(distSq);
        const force = REPULSION_FORCE / distSq;
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
        const dx = otherNode.x - nodeA.x;
        const dy = otherNode.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const force = ATTRACTION_FORCE * (dist - SPRING_LENGTH);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }
    });

    // Gravity well attraction for Category nodes
    for (let j = 0; j < newNodes.length; j++) {
      if (i === j) continue;
      const nodeB = newNodes[j];
      if (nodeB.isCategory && !nodeA.isCategory) {
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0 && distSq < 250000) { // 500px radius
          const dist = Math.sqrt(distSq);
          const force = 80 / dist;
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
    newNodes[i].x += newNodes[i].vx;
    newNodes[i].y += newNodes[i].vy;
  }

  return newNodes;
}
