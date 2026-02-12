import { useEffect, useRef } from "react";
import { MessageSquare, Send, User } from "lucide-react";
import type { ActiveUser, Channel, ChatMessage } from "../types/voice";

type ChatWindowProps = {
  messages: ChatMessage[];
  activeUsers: ActiveUser[];
  channels: Channel[];
  currentUsername: string;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSendMessage: (message: string) => Promise<void>;
};

export function ChatWindow({
  messages,
  activeUsers,
  channels,
  currentUsername,
  inputMessage,
  onInputChange,
  onSendMessage,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChannelName =
    channels.find(
      (c) =>
        c.channel_id ===
        (activeUsers.find((u) => u.name === currentUsername)?.channel_id || 0),
    )?.name || "General";

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <div className="chat-messages-main" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-chat-state">
            <div className="splash-icon" style={{ width: 80, height: 80, marginBottom: 0 }}>
              <MessageSquare size={32} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Welcome to #{activeChannelName}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-dim)' }}>This is the start of the conversation.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const authorUser = activeUsers.find((u) => u.session === msg.actor);
          let authorName = authorUser?.name;

          if (!authorName) {
            if (msg.message.startsWith('[History]')) {
              authorName = ""; // Hide name header for history, since it's in the body
            } else if (msg.actor) {
              authorName = `User ${msg.actor}`;
            } else {
              authorName = "System";
            }
          }

          const avatarUrl = authorUser?.avatar_url;
          const isMe = authorUser?.name === currentUsername; // Check strictly against logged in user

          return (
            <div key={i} className={`chat-message-group`} style={{
              display: 'flex',
              gap: 12,
              marginBottom: 16,
              flexDirection: isMe ? 'row-reverse' : 'row'
            }}>
              <div className="avatar-small" style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--glass-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                border: 'var(--glass-border)'
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={16} />
                )}
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '70%'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isMe ? 'var(--primary)' : 'var(--text-main)' }}>{authorName}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date((msg.timestamp || Date.now() / 1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="glass-panel" style={{
                  padding: '10px 16px',
                  borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  background: isMe ? 'rgba(124, 77, 255, 0.15)' : 'var(--glass-surface)',
                  border: isMe ? '1px solid rgba(124, 77, 255, 0.2)' : 'var(--glass-border)',
                  color: isMe ? 'white' : 'var(--text-dim)'
                }}>
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="chat-input-area-main">
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (inputMessage.trim()) {
              void onSendMessage(inputMessage);
              onInputChange("");
            }
          }}
        >
          <input
            type="text"
            className="chat-input"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`Message #${activeChannelName}...`}
          />
          <button type="submit" className="message-input-btn">
            <Send size={20} />
          </button>
        </form>
      </div>
    </>
  );
}
