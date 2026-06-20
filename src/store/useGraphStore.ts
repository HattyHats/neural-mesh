import { create } from 'zustand';

export interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  date: string; // YYYY-MM-DD
  isDateNode?: boolean;
  color?: string;
  imageUrl?: string;
  isLocked?: boolean;
  isCategory?: boolean;
  collapsed?: boolean;
  details?: string;
  radius?: number;
  shape?: 'circle' | 'square' | 'hexagon' | 'triangle';
  isSticky?: boolean;
}

export interface Edge {
  source: string;
  target: string;
}

export interface GraphState {
  theme: 'dark' | 'cyberpunk' | 'space';
  nodes: Node[];
  edges: Edge[];
  past: { nodes: Node[], edges: Edge[] }[];
  future: { nodes: Node[], edges: Edge[] }[];
  selectedDate: string | null;
  selectedNodeId: string | null;
  vaultSalt: string | null;
  vaultKey: CryptoKey | null;
  focusNode: string | null;
  peerCursor: { x: number, y: number } | null;
  peerLockedNodeId: string | null;
  isP2PConnected: boolean;
  chatMessages: { id: string, text: string, sender: 'me' | 'friend' }[];
  addChatMessage: (text: string, sender: 'me' | 'friend') => void;
  addNode: (node: Node) => void;
  updateNodePos: (id: string, x: number, y: number) => void;
  updateNodeVelocity: (id: string, vx: number, vy: number) => void;
  addEdge: (source: string, target: string) => void;
  setGraph: (nodes: Node[], edges: Edge[], vaultSalt?: string | null) => void;
  updatePhysics: (nodes: Node[], edges: Edge[]) => void;
  clearGraph: () => void;
  setSelectedDate: (date: string | null) => void;
  setVault: (salt: string, key: CryptoKey) => void;
  unlockNode: (id: string, text: string) => void;
  setFocusNode: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  toggleCollapse: (id: string) => void;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  updateNodeDetails: (id: string, details: string) => void;
  updateNodeRadius: (id: string, radius: number) => void;
  mergeNodes: (targetId: string, sourceId: string) => void;
  mergeGraph: (incomingNodes: Node[], incomingEdges: Edge[]) => void;
  setTheme: (theme: string) => void;
  updateNodeStyle: (id: string, color?: string, imageUrl?: string) => void;
  updateNodeShape: (id: string, shape: 'circle' | 'square' | 'hexagon' | 'triangle') => void;
  toggleSticky: (id: string) => void;
  setPeerCursor: (cursor: { x: number, y: number } | null) => void;
  setPeerLockedNode: (id: string | null) => void;
  setIsP2PConnected: (isConnected: boolean) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  theme: 'dark',
  nodes: [],
  edges: [],
  past: [],
  future: [],
  selectedDate: null,
  selectedNodeId: null,
  focusNode: null,
  vaultSalt: null,
  vaultKey: null,
  peerCursor: null,
  peerLockedNodeId: null,
  isP2PConnected: false,
  chatMessages: [],
  addChatMessage: (text, sender) => set((state) => ({ 
    chatMessages: [...state.chatMessages, { id: crypto.randomUUID(), text, sender }] 
  })),
  addNode: (node) => {
    set((state) => {
      if (state.nodes.some(n => n.id === node.id)) return state;
      return { nodes: [...state.nodes, node] };
    });
  },
  updateNodePos: (id, x, y) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, x, y } : n)
  })),
  updateNodeVelocity: (id, vx, vy) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, vx, vy } : n)
  })),
  addEdge: (source, target) => {
    set((state) => {
      if (state.edges.some(e => (e.source === source && e.target === target) || (e.source === target && e.target === source))) return state;
      return { edges: [...state.edges, { source, target }] };
    });
  },
  setGraph: (nodes, edges, vaultSalt) => set({ nodes, edges, past: [], future: [], vaultSalt: vaultSalt || null, vaultKey: null }),
  updatePhysics: (nodes, edges) => set({ nodes, edges }),
  clearGraph: () => {
    set({ nodes: [], edges: [], vaultSalt: null, vaultKey: null, selectedDate: null });
  },
  setSelectedDate: (date) => set({ selectedDate: date }),
  setVault: (salt, key) => set({ vaultSalt: salt, vaultKey: key }),
  unlockNode: (id, text) => set(state => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, text, isLocked: false } : n)
  })),
  setFocusNode: (id) => set({ focusNode: id }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  toggleCollapse: (id) => set(state => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n)
  })),
  saveHistory: () => set(state => ({
    past: [...state.past, { nodes: state.nodes.map(n => ({...n})), edges: state.edges.map(e => ({...e})) }],
    future: []
  })),
  undo: () => set(state => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      past: newPast,
      nodes: previous.nodes,
      edges: previous.edges,
      future: [{ nodes: state.nodes.map(n => ({...n})), edges: state.edges.map(e => ({...e})) }, ...state.future]
    };
  }),
  redo: () => set(state => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      past: [...state.past, { nodes: state.nodes.map(n => ({...n})), edges: state.edges.map(e => ({...e})) }],
      nodes: next.nodes,
      edges: next.edges,
      future: newFuture
    };
  }),
  updateNodeDetails: (id, details) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, details } : n)
    }));
  },
  updateNodeRadius: (id, radius) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, radius } : n)
    }));
  },
  updateNodeStyle: (id, color, imageUrl) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id === id) {
          const updated = { ...n };
          if (color !== undefined) updated.color = color;
          if (imageUrl !== undefined) updated.imageUrl = imageUrl;
          return updated;
        }
        return n;
      })
    }));
  },
  updateNodeShape: (id, shape) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, shape } : n)
    }));
  },
  toggleSticky: (id) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, isSticky: !n.isSticky } : n)
    }));
  },
  mergeNodes: (targetId, sourceId) => {
    set(state => {
      const source = state.nodes.find(n => n.id === sourceId);
      const target = state.nodes.find(n => n.id === targetId);
      if (!source || !target) return state;

      const newText = target.text + ' & ' + source.text;
      const newDetails = [target.details, source.details].filter(Boolean).join('\n\n---\n\n');
      
      const newNodes = state.nodes.filter(n => n.id !== sourceId).map(n => 
        n.id === targetId ? { ...n, text: newText, details: newDetails } : n
      );
      
      const newEdges = state.edges.map(e => ({
         source: e.source === sourceId ? targetId : e.source,
         target: e.target === sourceId ? targetId : e.target
      })).filter((e, idx, arr) => 
         e.source !== e.target && 
         arr.findIndex(a => (a.source === e.source && a.target === e.target) || (a.source === e.target && a.target === e.source)) === idx
      );
      
      return { nodes: newNodes, edges: newEdges };
    });
  },
  mergeGraph: (incomingNodes, incomingEdges) => {
    set(state => {
      const newNodes = [...state.nodes];
      for (const inc of incomingNodes) {
        if (!newNodes.some(n => n.id === inc.id)) {
           newNodes.push(inc);
        }
      }
      
      const newEdges = [...state.edges];
      for (const inc of incomingEdges) {
        const exists = newEdges.some(e => (e.source === inc.source && e.target === inc.target) || (e.source === inc.target && e.target === inc.source));
        if (!exists) {
          newEdges.push(inc);
        }
      }
      return { nodes: newNodes, edges: newEdges };
    });
  },
  setTheme: (theme) => set({ theme }),
  setPeerCursor: (cursor) => set({ peerCursor: cursor }),
  setPeerLockedNode: (id) => set({ peerLockedNodeId: id }),
  setIsP2PConnected: (isConnected) => set({ isP2PConnected: isConnected })
}));
