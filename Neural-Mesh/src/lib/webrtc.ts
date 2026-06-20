import { useGraphStore } from '../store/useGraphStore';

let peerConnection: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export const initP2P = (onStatus: (msg: string) => void, onMessage: (data: any) => void) => {
  peerConnection = new RTCPeerConnection(rtcConfig);

  dataChannel = peerConnection.createDataChannel('sync');

  peerConnection.ondatachannel = (event) => {
    event.channel.onmessage = (e) => {
      try {
         onMessage(JSON.parse(e.data));
      } catch (err) {}
    };
  };

  dataChannel.onopen = () => {
    onStatus('Connected! Ready to sync.');
    useGraphStore.getState().setIsP2PConnected(true);
  };
  const handleDisconnect = () => {
    useGraphStore.getState().setPeerCursor(null);
    useGraphStore.getState().setPeerLockedNode(null);
    useGraphStore.getState().setIsP2PConnected(false);
  };

  dataChannel.onclose = () => {
    onStatus('Disconnected.');
    handleDisconnect();
  };

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection?.iceConnectionState;
    onStatus(`ICE State: ${state}`);
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      handleDisconnect();
    }
  };
};

export const generateOffer = async (onIceComplete: (offerBase64: string) => void) => {
  if (!peerConnection) return;
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  peerConnection.onicecandidate = (e) => {
    if (e.candidate === null && peerConnection) {
      const desc = peerConnection.localDescription;
      onIceComplete(btoa(JSON.stringify(desc)));
    }
  };
};

export const receiveOfferAndGenerateAnswer = async (offerBase64: string, onIceComplete: (answerBase64: string) => void) => {
  if (!peerConnection) return;
  const offer = JSON.parse(atob(offerBase64));
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  peerConnection.onicecandidate = (e) => {
    if (e.candidate === null && peerConnection) {
      const desc = peerConnection.localDescription;
      onIceComplete(btoa(JSON.stringify(desc)));
    }
  };
};

export const receiveAnswer = async (answerBase64: string) => {
  if (!peerConnection) return;
  const answer = JSON.parse(atob(answerBase64));
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
};

export const syncGraph = () => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  
  const { nodes, edges } = useGraphStore.getState();
  
  // Zero-Knowledge: If a node is locked, its text/details are stored as ciphertext in state.
  // Therefore sending the state array as-is transmits encrypted data that cannot be read without the vault key!
  const payload = { type: 'SYNC', nodes, edges };
  
  dataChannel.send(JSON.stringify(payload));
};

export const handleSyncMessage = (data: any) => {
  const store = useGraphStore.getState();
  
  if (data.type === 'SYNC') {
    store.mergeGraph(data.nodes, data.edges);
  } else if (data.type === 'CURSOR') {
    store.setPeerCursor({ x: data.x, y: data.y });
  } else if (data.type === 'NODE_MOVE') {
    const node = store.nodes.find(n => n.id === data.id);
    if (node) {
      store.updateNodePos(data.id, data.x, data.y);
      store.updateNodeVelocity(data.id, 0, 0);
    }
  } else if (data.type === 'NODE_LOCK') {
    store.setPeerLockedNode(data.id);
  } else if (data.type === 'CHAT') {
    store.addChatMessage(data.message, 'friend');
  }
};

export const broadcastCursor = (x: number, y: number) => {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'CURSOR', x, y }));
  }
};

export const broadcastNodeMove = (id: string, x: number, y: number) => {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'NODE_MOVE', id, x, y }));
  }
};

export const broadcastNodeLock = (id: string | null) => {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'NODE_LOCK', id }));
  }
};

export const broadcastChat = (message: string) => {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'CHAT', message }));
  }
};
