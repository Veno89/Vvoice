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
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { LoginModal } from "./components/LoginModal";
import { SettingsModal } from "./components/SettingsModal";
import { useMumbleEvents } from "./hooks/useMumbleEvents";
import { ChatPanel } from "./components/ChatPanel";
import type { ActiveUser, Channel, ChatMessage } from "./types/voice";


import { ActiveUser, Channel, ChatMessage, mergeActiveUser } from "./types/mumble";

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [audioSettings, setAudioSettings] = useState<{ device: string | null, vad: number }>({
    device: null,
    vad: 0.005
  });

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  const [currentUser] = useState({
    name: "AllowedUser",
    status: "online",
    role: "User"
  });

  const { channels, activeUsers, messages, reset } = useMumbleEvents();
  const [channels, setChannels] = useState<Channel[]>([]);

  // ... (inside component)

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenRemove: (() => void) | undefined;
    let unlistenUpdateChannel: (() => void) | undefined;
    let unlistenRemoveChannel: (() => void) | undefined;
    let unlistenTextMessage: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenUpdate = await listen<Partial<ActiveUser> & { session: number }>('user_update', (event) => {
        console.log("User Update:", event.payload);
        const user = event.payload;
        // Payload matches Mumble UserState proto: { session, name, user_id, channel_id, ... }

        setActiveUsers(prev => {
          const exists = prev.find(u => u.session === user.session);
          if (exists) {
            // Update existing: Partial update logic (don't overwrite with nulls)
            console.log("Updating existing user:", exists, "with:", user);
            const merged = mergeActiveUser(exists, user);
            const merged: ActiveUser = { ...exists };
            for (const [key, value] of Object.entries(user)) {
              if (value !== null && value !== undefined) {
                merged[key] = value;
              }
            }
            return prev.map(u => u.session === user.session ? merged : u);
          } else {
            // Add new
            return [...prev, { ...user, isSpeaking: false }];
          }
        });
      });

      unlistenRemove = await listen<{ session: number }>('user_remove', (event) => {
        console.log("User Remove:", event.payload);
        const remove = event.payload; // { session, ... }
        setActiveUsers(prev => prev.filter(u => u.session !== remove.session));
      });

      unlistenUpdateChannel = await listen<Channel>('channel_update', (event) => {
        const channel = event.payload;
        console.log("Channel Update:", channel);
        setChannels(prev => {
          const exists = prev.find(c => c.channel_id === channel.channel_id);
          if (exists) {
            return prev.map(c => c.channel_id === channel.channel_id ? { ...c, ...channel } : c);
          } else {
            return [...prev, channel];
          }
        });
      });

      unlistenRemoveChannel = await listen<{ channel_id: number }>('channel_remove', (event) => {
        const remove = event.payload;
        setChannels(prev => prev.filter(c => c.channel_id !== remove.channel_id));
      });
      unlistenTextMessage = await listen<ChatMessage>('text_message', (event) => {
        console.log("Text Message:", event.payload);
        setMessages(prev => [...prev, event.payload]);
      });
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenRemove) unlistenRemove();
      if (unlistenUpdateChannel) unlistenUpdateChannel();
      if (unlistenRemoveChannel) unlistenRemoveChannel();
      if (unlistenTextMessage) unlistenTextMessage();
    };
  }, []);

  const handleConnect = async (username: string, password: string) => {
    setIsConnecting(true);
    try {
      // Clear list on connect
      reset();
      await invoke("connect_voice", {
        username,
        password,
        inputDevice: audioSettings.device,
        vadThreshold: audioSettings.vad
      });
      setIsConnected(true);
    } catch (e) {
      console.error("Connection failed:", e);
      alert(`Connection failed: ${e}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await invoke("disconnect_voice");
      setIsConnected(false);
      reset();
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

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
              const myUser = activeUsers.find(u => u.name === currentUser.name);
              const currentChannelId = myUser?.channel_id || 0;
              const isActive = ch.channel_id === currentChannelId;

              return (
                <div key={ch.channel_id} className="channel-group">
                  <div
                    className={`channel-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      console.log("Clicked channel:", ch.channel_id);
                      invoke('join_channel', { channelId: ch.channel_id })
                        .then(() => console.log("Invoke join_channel success"))
                        .catch(e => console.error("Invoke join_channel error:", e));
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
              <div className="username">{currentUser.name}</div>
              <div className="user-role">
                <ShieldCheck size={10} style={{ color: 'var(--primary)' }} />
                {currentUser.role}
              </div>
            </div>
            <button className="icon-btn" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
            </button>
          </div>

          <div className="control-bar">
            <button
              onClick={() => {
                const newState = !isMuted;
                setIsMuted(newState);
                invoke('set_mute', { mute: newState });
              }}
              className={`icon-btn ${isMuted ? 'active' : ''}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => {
                const newState = !isDeafened;
                setIsDeafened(newState);
                invoke('set_deaf', { deaf: newState });
                if (newState) setIsMuted(true); // Implicit mute logic
              }}
              className={`icon-btn ${isDeafened ? 'active' : ''}`}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--border)', height: 16, alignSelf: 'center' }}></div>
            <button
              onClick={isConnected ? handleDisconnect : undefined}
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
              onClick={() => invoke('send_message', { message: "/echo" })}
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
                <LoginModal onConnect={handleConnect} isConnecting={isConnecting} />
              </div>
            ) : (
              <ChatPanel
                messages={messages}
                activeUsers={activeUsers}
                channels={channels}
                currentUsername={currentUser.name}
                inputMessage={inputMessage}
                onInputMessageChange={setInputMessage}
              />
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
