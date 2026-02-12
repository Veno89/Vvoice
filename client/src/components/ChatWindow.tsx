import { MessageSquare, Send } from "lucide-react";
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
  const activeChannelName =
    channels.find(
      (c) =>
        c.channel_id ===
        (activeUsers.find((u) => u.name === currentUsername)?.channel_id || 0),
    )?.name || "General";

  return (
    <>
      <div className="chat-messages-main">
        {messages.length === 0 && (
          <div className="empty-chat-state">
            <MessageSquare size={48} />
            <p>Welcome to the channel!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const actor =
            activeUsers.find((u) => u.session === msg.actor)?.name ||
            `User ${msg.actor}`;
          return (
            <div key={i} className="chat-message">
              <div className="message-header">
                <span className="message-author">{actor}</span>
                <span className="message-time">
                  {msg.timestamp
                    ? new Date(msg.timestamp * 1000).toLocaleTimeString()
                    : new Date().toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">{msg.message}</div>
            </div>
          );
        })}
      </div>

      <div className="chat-input-area-main">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputMessage.trim()) {
              void onSendMessage(inputMessage);
              onInputChange("");
            }
          }}
          className="chat-form"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`Message ${activeChannelName}...`}
            className="chat-input"
          />
          <button type="submit" className="chat-send-btn">
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
}
