import React from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { Calendar, X } from 'lucide-react';

interface CalendarSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ isOpen, onClose }) => {
  const { nodes, selectedDate, setSelectedDate } = useGraphStore();
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const datesWithNodes = new Set(nodes.map(n => n.date));

  const handleDateClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
    }
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
      const hasNodes = datesWithNodes.has(dateStr);
      const isSelected = selectedDate === dateStr;
      const isToday = pad(today.getDate()) === pad(d);

      days.push(
        <div
          key={dateStr}
          onClick={() => handleDateClick(dateStr)}
          style={{
            padding: '6px 2px',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '6px',
            background: isSelected ? '#3b82f6' : (isToday ? '#27272a' : 'transparent'),
            color: isSelected ? '#fff' : (hasNodes ? '#93c5fd' : '#a1a1aa'),
            fontWeight: hasNodes ? 600 : 400,
            border: isSelected ? '1px solid #60a5fa' : '1px solid transparent',
            boxSizing: 'border-box'
          }}
        >
          {d}
          {hasNodes && !isSelected && <div style={{ width: 4, height: 4, background: '#3b82f6', borderRadius: '50%', margin: '2px auto 0' }} />}
        </div>
      );
    }

    return days;
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: isOpen ? 0 : '-320px',
      width: '300px',
      height: 'calc(100vh - 80px)',
      background: 'rgba(24, 24, 27, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderLeft: '1px solid rgba(39, 39, 42, 0.5)',
      borderBottomLeftRadius: '24px',
      transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 50,
      padding: '20px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} />
          Timeline
        </h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '15px', fontWeight: 600 }}>
        {today.toLocaleString('default', { month: 'long' })} {currentYear}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '8px', textAlign: 'center', fontSize: '0.8rem', color: '#71717a' }}>
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {renderDays()}
      </div>

      <button 
        onClick={() => setSelectedDate(null)}
        style={{
          marginTop: '20px',
          width: '100%',
          padding: '10px',
          background: selectedDate === null ? '#3b82f6' : '#27272a',
          color: '#fff',
          border: selectedDate === null ? '1px solid #60a5fa' : '1px solid #3f3f46',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          transition: 'all 0.2s'
        }}
      >
        View All Thoughts
      </button>
      
      <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: '#71717a' }}>
        <p>• Click a day to filter thoughts.</p>
        <p>• New thoughts automatically link to the selected day.</p>
      </div>
    </div>
  );
};
