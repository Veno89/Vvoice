import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Hash, MoreVertical, X } from "lucide-react";
import { LoginModal } from "./components/LoginModal";
import { ChatWindow } from "./components/ChatWindow";
import { ChannelList } from "./components/ChannelList";
import { CurrentUserCard } from "./components/CurrentUserCard";
import { AudioRenderer } from "./components/AudioRenderer";
import { useSettingsStore } from "./store/settingsStore";
import { useVoiceStore } from "./store/useVoiceStore";
import "./App.css";

export default function App() {
  const { inputDevice, vadThreshold, loadSettings } = useSettingsStore();
  const [inputMessage, setInputMessage] = useState("");

  const {
    isConnected,
    isConnecting,
    isReconnecting,
    currentUsername,
    channels,
    activeUsers,
    messages,
    register,
    connect,
    sendMessage,
    toggleEcho,
    connectionError,
    clearConnectionError,
    setupListeners
  } = useVoiceStore();

  const currentUser = activeUsers.find(u => u.name === currentUsername);

  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | undefined;

    const init = async () => {
      await loadSettings();
      const result = await setupListeners();

      if (isMounted) {
        unlistenFn = result;
      } else {
        result();
      }
    };

    init();

    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, [setupListeners, loadSettings]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img src="/vvoice2.png" alt="Vvoice" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="logo-text">Vvoice</span>
        </div>

        <ChannelList />
        <CurrentUserCard />
      </aside>

      <main className="main-content">
        <div className="glow-effect"></div>

        {isReconnecting && (
          <div className="reconnecting-banner">
            <div className="spinner"></div>
            <span>Reconnecting to server...</span>
          </div>
        )}

        {connectionError && (
          <div className="error-toast">
            <span>{connectionError}</span>
            <button
              onClick={clearConnectionError}
              className="icon-btn"
              style={{ padding: 4 }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <header className="main-header">
          <div className="header-title">
            <Hash size={20} color="var(--text-muted)" />
            <span>{channels.find(c => c.channel_id === (currentUser?.channel_id || 0))?.name || "General"}</span>
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
            <div className="user-stack"></div>
            <button className="icon-btn">
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

        <section className="chat-container-main">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <div className="splash-container">
                <LoginModal
                  onConnect={(username, password, serverAddress) => connect(username, password, serverAddress, { device: inputDevice, vad: vadThreshold })}
                  onRegister={(username, password, serverAddress) => register(username, password, serverAddress)}
                  isConnecting={isConnecting}
                />
              </div>
            ) : (
              <ChatWindow
                messages={messages}
                activeUsers={activeUsers}
                channels={channels}
                currentUsername={currentUsername}
                inputMessage={inputMessage}
                onInputChange={setInputMessage}
                onSendMessage={sendMessage}
              />
            )}
          </AnimatePresence>
        </section>
      </main>

      <AudioRenderer />
    </div>
  );
}
