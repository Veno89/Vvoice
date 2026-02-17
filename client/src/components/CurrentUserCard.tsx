import { useState } from "react";
import { Settings, Mic, MicOff, Volume2, VolumeX, LogOut, Radio, User, ShieldCheck } from "lucide-react";
import { useVoiceStore } from "../store/useVoiceStore";
import { SettingsModal } from "./SettingsModal";

export function CurrentUserCard() {
    const [showSettings, setShowSettings] = useState(false);
    const {
        currentUsername,
        currentUserRole,
        activeUsers,
        isMuted,
        isDeafened,
        isConnected,
        isConnecting,
        disconnect,
        toggleMute,
        toggleDeaf
    } = useVoiceStore();

    const currentUser = activeUsers.find(u => u.name === currentUsername);

    return (
        <>
            <section className="user-card">
                <div className="user-info">
                    <div className="avatar-container">
                        <div className="avatar">
                            {currentUser?.avatar_url ? (
                                <img
                                    src={currentUser.avatar_url}
                                    alt={currentUsername}
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <User size={22} color="white" />
                            )}
                        </div>
                        <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></div>
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
                        onClick={() => void toggleMute()}
                        className={`icon-btn ${isMuted ? 'active' : ''}`}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                        onClick={() => void toggleDeaf()}
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

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </>
    );
}
