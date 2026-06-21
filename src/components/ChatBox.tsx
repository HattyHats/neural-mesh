import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useGraphStore } from '../store/useGraphStore';
import { broadcastChat } from '../lib/webrtc';

export function ChatBox({ isConnected }: { isConnected: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState('');
  const chatMessages = useGraphStore(state => state.chatMessages);
  const addChatMessage = useGraphStore(state => state.addChatMessage);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessages.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
  }, [chatMessages.length]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  if (!isConnected) return null;

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute', bottom: 20, right: 20, zIndex: 50,
          background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '50%',
          width: '50px', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center',
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    broadcastChat(message.trim());
    addChatMessage(message.trim(), 'me');
    setMessage('');
  };

  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20, zIndex: 50,
      width: '300px', height: '400px', background: '#18181b', border: '1px solid #3f3f46',
      borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px', background: '#27272a', borderBottom: '1px solid #3f3f46',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 600, fontSize: '14px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
          P2P Chat
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '12px' }}
        >
          Hide
        </button>
      </div>

      <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {chatMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#71717a', fontSize: '12px', marginTop: 'auto', marginBottom: 'auto' }}>
            Say hello to your friend!
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} style={{
              alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
              background: msg.sender === 'me' ? '#3b82f6' : '#3f3f46',
              color: '#fff', padding: '8px 12px', borderRadius: '12px',
              borderBottomRightRadius: msg.sender === 'me' ? '2px' : '12px',
              borderBottomLeftRadius: msg.sender === 'friend' ? '2px' : '12px',
              maxWidth: '80%', fontSize: '14px', wordBreak: 'break-word'
            }}>
              {msg.text}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', padding: '10px', borderTop: '1px solid #3f3f46', background: '#09090b' }}>
        <input 
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1, background: 'transparent', border: 'none', color: '#fff',
            outline: 'none', fontSize: '14px', padding: '8px'
          }}
        />
        <button type="submit" style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '8px' }}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
