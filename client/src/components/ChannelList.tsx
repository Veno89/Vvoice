import { Hash, User } from "lucide-react";
import { useVoiceStore } from "../store/useVoiceStore";
import { UserProfileTooltip } from "./UserProfileTooltip";


export function ChannelList() {
    const { channels, activeUsers, currentUsername, joinChannel, isConnected } = useVoiceStore();

    // Sort channels by position/id
    const sortedChannels = [...channels].sort((a, b) => (a.channel_id - b.channel_id));

    return (
        <nav className="sidebar-content">
            <div className="section-label">
                <span>Voice Channels</span>
            </div>
            <div className="channel-tree">
                {channels.length === 0 && isConnected && (
                    <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading channels...</div>
                )}
                {sortedChannels.map(ch => {
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

                            {/* Users in this channel - Mini User List */}
                            <div className="channel-users">
                                {activeUsers.filter(u => (u.channel_id || 0) === ch.channel_id).map(user => (
                                    <UserProfileTooltip key={user.session} user={user}>
                                        <div className="sidebar-user">
                                            <div className="user-avatar-small">
                                                {user.avatar_url ? (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.name}
                                                        className="avatar-img"
                                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <User size={12} />
                                                )}
                                                {user.isSpeaking && <div className="speaking-dot"></div>}
                                            </div>
                                            <span className="sidebar-username">{user.name ?? `User ${user.session}`}</span>
                                        </div>
                                    </UserProfileTooltip>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </nav>
    );
}
