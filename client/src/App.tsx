import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Settings,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Hash,
  LogOut,
  Radio,
  User,
  ShieldCheck,
  MoreVertical,
  MessageSquare,
  Send
} from "lucide-react";
import { LoginModal } from "./components/LoginModal";
import { SettingsModal } from "./components/SettingsModal";
import { useMumbleEvents } from "./hooks/useMumbleEvents";
import { useVoiceConnection } from "./hooks/useVoiceConnection";

export default function App() {
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [audioSettings, setAudioSettings] = useState<{ device: string | null, vad: number }>({
    device: null,
    vad: 0.005
  });

  // Chat State
  const [inputMessage, setInputMessage] = useState("");

  const { channels, activeUsers, messages, reset } = useMumbleEvents();
  const {
    isConnected,
    isMuted,
    isDeafened,
    isConnecting,
    currentUsername,
    currentUserRole,
    connect,
    disconnect,
    joinChannel,
    sendMessage,
    toggleEcho,
    toggleMute,
    toggleDeaf,
  } = useVoiceConnection(reset);

  return (
    <div className="app-container">
      {/* Sidebar - Channels */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img src="/vvoice2.png" alt="Vvoice" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="logo-text">Vvoice</span>
        </div>

        <nav className="sidebar-content">
          <div className="section-label">
            <span>Voice Channels</span>
            <Settings size={12} className="icon-hover" />
          </div>
          <div className="channel-tree">
            {channels.length === 0 && isConnected && (
              <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading channels...</div>
            )}
            {[...channels].sort((a, b) => (a.channel_id - b.channel_id)).map(ch => {
              const myUser = activeUsers.find(u => u.name === currentUsername);
              const currentChannelId = myUser?.channel_id || 0;
              const isActive = ch.channel_id === currentChannelId;

              return (
                <div key={ch.channel_id} className="channel-group">
                  <div
                    className={`channel-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      void joinChannel(ch.channel_id);
                    }}
                  >
                    <Hash size={16} className="channel-icon" />
                    <span className="channel-name">{ch.name || `Channel ${ch.channel_id}`}</span>
                  </div>

                  {/* Users in this channel */}
                  <div className="channel-users">
                    {activeUsers.filter(u => (u.channel_id || 0) === ch.channel_id).map(user => (
                      <div key={user.session} className="sidebar-user">
                        <div className="user-avatar-small">
                          <User size={12} />
                          {user.isSpeaking && <div className="speaking-dot"></div>}
                        </div>
                        <span className="sidebar-username">{user.name ?? `User ${user.session}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* User Card */}
        <section className="user-card">
          <div className="user-info">
            <div className="avatar-container">
              <div className="avatar">
                <User size={22} color="white" />
              </div>
              <div className="status-indicator"></div>
            </div>
            <div className="user-details">
              <div className="username">{currentUsername}</div>
              <div className="user-role">
                <ShieldCheck size={10} style={{ color: 'var(--primary)' }} />
                {currentUserRole}
              </div>
            </div>
            <button className="icon-btn" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
            </button>
          </div>

          <div className="control-bar">
            <button
              onClick={() => {
                void toggleMute();
              }}
              className={`icon-btn ${isMuted ? 'active' : ''}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => {
                void toggleDeaf();
              }}
              className={`icon-btn ${isDeafened ? 'active' : ''}`}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--border)', height: 16, alignSelf: 'center' }}></div>
            <button
              onClick={isConnected ? disconnect : undefined}
              disabled={isConnecting || !isConnected}
              className={`icon-btn primary ${isConnected ? 'active' : ''} ${isConnecting ? 'loading' : ''}`}
              title={isConnected ? "Disconnect" : "Connect"}
            >
              {isConnected ? <LogOut size={18} /> : <Radio size={18} />}
            </button>
          </div>
        </section>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        <div className="glow-effect"></div>

        <header className="main-header">
          <div className="header-title">
            <Hash size={20} color="var(--text-muted)" />
            <span>General</span>
          </div>
          <div className="header-actions">

            <button
              className="btn-small secondary"
              onClick={() => {
                void toggleEcho();
              }}
              title="Toggle Loopback Test"
              style={{ marginRight: 8 }}
            >
              Echo Test
            </button>
            <div className="user-stack">
              {/* Future: dynamic user stack */}
            </div>
            <button className="icon-btn">
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        <section className="chat-container-main">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <div className="splash-container">
                <LoginModal onConnect={(username, password) => connect(username, password, audioSettings)} isConnecting={isConnecting} />
              </div>
            ) : (
              <>
                <div className="chat-messages-main">
                  {messages.length === 0 && (
                    <div className="empty-chat-state">
                      <MessageSquare size={48} />
                      <p>Welcome to the channel!</p>
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const actor = activeUsers.find(u => u.session === msg.actor)?.name || `User ${msg.actor}`;
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
                        void sendMessage(inputMessage);
                        setInputMessage("");
                      }
                    }}
                    className="chat-form"
                  >
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={e => setInputMessage(e.target.value)}
                      placeholder={`Message ${channels.find(c => c.channel_id === (activeUsers.find(u => u.name === currentUsername)?.channel_id || 0))?.name || "General"}...`}
                      className="chat-input"
                    />
                    <button type="submit" className="chat-send-btn">
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </AnimatePresence>
        </section>
      </main>



      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentDevice={audioSettings.device}
        currentVad={audioSettings.vad}
        onSave={(device, vad) => setAudioSettings({ device, vad })}
      />
    </div >
  );
}
