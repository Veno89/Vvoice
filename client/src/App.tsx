import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Zap,
  MoreVertical
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [currentUser] = useState({
    name: "AllowedUser",
    status: "online",
    role: "User"
  });

  const [channels] = useState([
    { id: 0, name: "General", active: true },
    { id: 1, name: "Gaming", active: false },
    { id: 2, name: "AFK", active: false },
  ]);

  // ... (inside component)

  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenRemove: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenUpdate = await listen('user_update', (event: any) => {
        console.log("User Update:", event.payload);
        const user = event.payload;
        // Payload matches Mumble UserState proto: { session, name, user_id, channel_id, ... }

        setActiveUsers(prev => {
          const exists = prev.find(u => u.session === user.session);
          if (exists) {
            // Update existing
            return prev.map(u => u.session === user.session ? { ...u, ...user } : u);
          } else {
            // Add new
            return [...prev, { ...user, isSpeaking: false }];
          }
        });
      });

      unlistenRemove = await listen('user_remove', (event: any) => {
        console.log("User Remove:", event.payload);
        const remove = event.payload; // { session, ... }
        setActiveUsers(prev => prev.filter(u => u.session !== remove.session));
      });
    };

    setupListeners();

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenRemove) unlistenRemove();
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Clear list on connect
      setActiveUsers([]);
      await invoke("connect_voice", { username: currentUser.name });
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
      setActiveUsers([]);
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
            <Zap size={18} fill="white" />
          </div>
          <span className="logo-text">Vvoice</span>
        </div>

        <nav className="sidebar-content">
          <div className="section-label">
            <span>Voice Channels</span>
            <Settings size={12} className="icon-hover" />
          </div>
          <div className="channel-list">
            {channels.map(ch => (
              <div
                key={ch.id}
                className={`channel-item ${ch.active ? 'active' : ''}`}
              >
                <Hash size={16} className="channel-icon" />
                <span className="channel-name">{ch.name}</span>
              </div>
            ))}
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
            <button className="icon-btn">
              <Settings size={16} />
            </button>
          </div>

          <div className="control-bar">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`icon-btn ${isMuted ? 'active' : ''}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => setIsDeafened(!isDeafened)}
              className={`icon-btn ${isDeafened ? 'active' : ''}`}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--border)', height: 16, alignSelf: 'center' }}></div>
            <button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={isConnecting}
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

        <section className="content-body">
          <AnimatePresence mode="wait">
            {!isConnected && !isConnecting ? (
              <motion.div
                key="splash"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="splash-container"
              >
                <div className="splash-icon">
                  <Radio size={48} />
                </div>
                <h3 className="splash-title">Ready to Connect?</h3>
                <p className="splash-desc">Jump into the conversation with crystal-clear audio powered by the Vvoice engine.</p>
                <button
                  onClick={handleConnect}
                  className="btn-large"
                >
                  Connect to Bridge
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="user-grid"
              >
                {activeUsers.map(user => (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`user-tile ${user.isSpeaking ? 'speaking' : ''}`}
                  >
                    <div className="avatar-large">
                      <User size={40} />
                      {user.isSpeaking && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          style={{
                            position: 'absolute',
                            inset: -8,
                            borderRadius: 24,
                            backgroundColor: 'var(--primary)',
                            zIndex: -1
                          }}
                        />
                      )}
                    </div>
                    <div className="tile-info">
                      <div className="tile-name">{user.name}</div>
                      <div className="speaking-status">
                        {user.isSpeaking ? 'Speaking' : 'Idle'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
