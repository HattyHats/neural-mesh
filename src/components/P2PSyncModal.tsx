import { useState, useEffect } from 'react';
import { X, Network, Copy, Check, UploadCloud } from 'lucide-react';
import { initP2P, generateOffer, receiveOfferAndGenerateAnswer, receiveAnswer, syncGraph, handleSyncMessage } from '../lib/webrtc';

export function P2PSyncModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState('Disconnected');
  const [localToken, setLocalToken] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'INIT' | 'HOST' | 'JOIN' | 'CONNECTED'>('INIT');

  useEffect(() => {
    initP2P((msg) => {
      setStatus(msg);
      if (msg === 'Connected! Ready to sync.') {
        setStep('CONNECTED');
        setTimeout(() => onClose(), 1000);
      }
    }, handleSyncMessage);
  }, []);

  const startHost = () => {
    setStatus('Generating Offer (gathering ICE candidates)...');
    generateOffer((offerStr) => {
      setLocalToken(offerStr);
      setStep('HOST');
      setStatus('Waiting for friend to join with your token.');
    });
  };

  const joinSession = async () => {
    if (!remoteToken) return;
    setStatus('Generating Answer...');
    await receiveOfferAndGenerateAnswer(remoteToken, (answerStr) => {
      setLocalToken(answerStr);
      setStep('JOIN');
      setStatus('Waiting for host to accept your answer.');
    });
  };

  const acceptAnswer = async () => {
    if (!remoteToken) return;
    await receiveAnswer(remoteToken);
    setStatus('Connecting...');
  };

  const copyToken = () => {
    navigator.clipboard.writeText(localToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '500px', background: '#18181b', borderRadius: '12px', border: '1px solid #3f3f46',
      zIndex: 500, color: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Network size={20}/> P2P Sync</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={20}/></button>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '14px', color: '#a1a1aa' }}>
          Connect directly to another device over WebRTC. Zero-Knowledge: Locked nodes remain mathematically encrypted during transfer.
        </div>
        
        <div style={{ background: '#27272a', padding: '10px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#3b82f6' }}>
          Status: {status}
        </div>

        {step === 'INIT' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={startHost} style={{ flex: 1, padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Host Session</button>
            <button onClick={() => setStep('JOIN')} style={{ flex: 1, padding: '12px', background: '#27272a', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Join Session</button>
          </div>
        )}

        {(step === 'HOST' || step === 'JOIN') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 600 }}>Your Handshake Token</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <input readOnly value={localToken} style={{ flex: 1, padding: '10px', background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                <button onClick={copyToken} style={{ padding: '10px', background: '#27272a', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', cursor: 'pointer' }}>
                  {copied ? <Check size={18} color="#22c55e" /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 600 }}>Friend's Handshake Token</label>
              <textarea 
                value={remoteToken} 
                onChange={(e) => setRemoteToken(e.target.value)}
                placeholder="Paste their token here..."
                style={{ width: '100%', padding: '10px', marginTop: '5px', background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', boxSizing: 'border-box', resize: 'none', height: '80px' }}
              />
            </div>

            {step === 'JOIN' && <button onClick={joinSession} style={{ padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Generate Answer</button>}
            {step === 'HOST' && <button onClick={acceptAnswer} style={{ padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Accept Answer</button>}
          </div>
        )}

        {step === 'CONNECTED' && (
          <button 
            onClick={syncGraph}
            style={{ padding: '15px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <UploadCloud size={20} />
            Sync Graph Now
          </button>
        )}
      </div>
    </div>
  );
}
