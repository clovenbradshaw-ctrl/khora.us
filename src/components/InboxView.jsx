import { useState } from 'react';
import Icon from './common/Icon.jsx';

/**
 * InboxView — messaging interface for case communication.
 *
 * In the real app, each conversation is a Matrix room.
 * Demo mode shows sample conversations.
 */

const DEMO_CONVERSATIONS = [
  {
    id: 'conv_001',
    name: 'T. Khan',
    role: 'Caseworker',
    lastMessage: 'I submitted the housing application for Maria.',
    time: '2:30 PM',
    unread: 2,
    messages: [
      { id: 'm1', text: 'Hi, I just finished the intake for Maria Gonzalez.', sender: '@jreyes:khora.us', time: '9:30 AM' },
      { id: 'm2', text: 'Thanks. I\'ll take over from here. Can you send the docs?', sender: '@tkhan:khora.us', time: '10:15 AM' },
      { id: 'm3', text: 'Already uploaded to her vault. All verified.', sender: '@jreyes:khora.us', time: '10:20 AM' },
      { id: 'm4', text: 'Perfect. I\'ll schedule the first meeting.', sender: '@tkhan:khora.us', time: '10:22 AM' },
      { id: 'm5', text: 'I submitted the housing application for Maria.', sender: '@tkhan:khora.us', time: '2:30 PM' },
    ],
  },
  {
    id: 'conv_002',
    name: 'M. Chen',
    role: 'Supervisor',
    lastMessage: 'Safety plan filed. Please review the assessment.',
    time: '9:00 AM',
    unread: 0,
    messages: [
      { id: 'm6', text: 'I completed the safety screening for the Gonzalez case.', sender: '@mchen:khora.us', time: '8:45 AM' },
      { id: 'm7', text: 'I upgraded the assessment to moderate based on the DV history.', sender: '@mchen:khora.us', time: '8:50 AM' },
      { id: 'm8', text: 'Safety plan filed. Please review the assessment.', sender: '@mchen:khora.us', time: '9:00 AM' },
    ],
  },
  {
    id: 'conv_003',
    name: 'HomeStart',
    role: 'Housing Partner',
    lastMessage: 'We have a 2BR available in Dorchester.',
    time: 'Yesterday',
    unread: 1,
    messages: [
      { id: 'm9', text: 'Referral received for Maria Gonzalez. We\'ll review this week.', sender: '@homestart:partner.us', time: 'Jul 15' },
      { id: 'm10', text: 'We have a 2BR available in Dorchester.', sender: '@homestart:partner.us', time: 'Yesterday' },
    ],
  },
  {
    id: 'conv_004',
    name: 'Team Updates',
    role: 'Team Channel',
    lastMessage: 'Weekly standup notes posted.',
    time: 'Mon',
    unread: 0,
    messages: [
      { id: 'm11', text: 'Weekly standup notes posted.', sender: '@tkhan:khora.us', time: 'Mon' },
    ],
  },
];

export default function InboxView() {
  const [activeConv, setActiveConv] = useState(DEMO_CONVERSATIONS[0]?.id);
  const [newMessage, setNewMessage] = useState('');

  const conversation = DEMO_CONVERSATIONS.find(c => c.id === activeConv);
  const currentUser = '@demo:khora.us';

  return (
    <div className="inbox-wrap">
      <div className="inbox-panel" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Conversation list */}
        <div className="inbox-list">
          <div className="inbox-list-header">
            <span>Messages</span>
          </div>
          <div className="scroll-y" style={{ flex: 1 }}>
            {DEMO_CONVERSATIONS.map(conv => (
              <div
                key={conv.id}
                className={`inbox-item ${activeConv === conv.id ? 'active' : ''}`}
                onClick={() => setActiveConv(conv.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar avatar-sm" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                    {conv.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="inbox-item-name">{conv.name}</span>
                      <span className="inbox-item-time">{conv.time}</span>
                    </div>
                    <div className="inbox-item-preview">{conv.lastMessage}</div>
                  </div>
                  {conv.unread > 0 && (
                    <div className="sidebar-nav-badge">{conv.unread}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="inbox-chat">
          {conversation ? (
            <>
              <div className="inbox-chat-header">
                <div className="avatar" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                  {conversation.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-0)' }}>{conversation.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{conversation.role}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn-icon">
                    <Icon name="lock" size={14} color="var(--green)" />
                  </button>
                </div>
              </div>

              <div className="inbox-msgs">
                {conversation.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`inbox-msg ${msg.sender === currentUser ? 'sent' : 'received'}`}
                  >
                    <div>{msg.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4, textAlign: 'right' }}>
                      {msg.time}
                    </div>
                  </div>
                ))}
              </div>

              <div className="inbox-compose">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMessage.trim()) {
                      setNewMessage('');
                    }
                  }}
                />
                <button className="btn-primary btn-sm">
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <Icon name="lock" size={40} color="var(--tx-3)" className="empty-state-icon" />
              <div className="empty-state-title">End-to-end encrypted</div>
              <div className="empty-state-desc">Select a conversation to view messages.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
