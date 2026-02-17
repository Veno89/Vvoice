import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Settings2, Activity, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/settingsStore';
import { useVoiceStore } from '../store/useVoiceStore';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { inputDevice, vadThreshold: storeVad, setInputDevice, setVadThreshold } = useSettingsStore();
    const { currentUsername, activeUsers, setProfile, startAudioAnalysis, toggleEcho, isEchoTesting } = useVoiceStore();
    const currentUser = activeUsers.find(u => u.name === currentUsername);

    // Local state for "draft" settings before saving
    const [devices, setDevices] = useState<string[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string | null>(inputDevice);
    const [vadThreshold, setVadThresholdLocal] = useState(storeVad);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [bio, setBio] = useState('');

    // Volume Visualization
    const [volume, setVolume] = useState(0);

    useEffect(() => {
        if (isOpen) {
            // Start analysis
            const stopAnalysis = startAudioAnalysis((vol) => {
                setVolume(vol);
            });
            return () => stopAnalysis();
        }
    }, [isOpen, startAudioAnalysis]);

    useEffect(() => {
        if (isOpen) {
            // Sync with store on open
            setSelectedDevice(inputDevice);
            setVadThresholdLocal(storeVad);
            setAvatarUrl(currentUser?.avatar_url || '');
            setBio(currentUser?.bio || '');

            invoke<string[]>('get_input_devices')
                .then(devs => {
                    console.log("Devices:", devs);
                    setDevices(devs);
                    // If no device selected and devices exist, select first
                    if (!inputDevice && !selectedDevice && devs.length > 0) {
                        setSelectedDevice(devs[0]);
                    }
                })
                .catch(e => console.error("Failed to get devices:", e));
        }
    }, [isOpen, inputDevice, storeVad, currentUser]);

    const handleSave = () => {
        // Save to store (persists to disk)
        setInputDevice(selectedDevice);
        setVadThreshold(vadThreshold);
        void setProfile(avatarUrl, bio);

        // Apply immediately if connected
        invoke('set_vad_threshold', { threshold: vadThreshold })
            .catch(() => { });

        if (isEchoTesting) {
            void toggleEcho(); // Stop echo on close/save
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-overlay">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="settings-modal"
                    >
                        <div className="modal-header">
                            <div className="modal-title">
                                <Settings2 size={20} />
                                <span>Audio Settings</span>
                            </div>
                            <button onClick={onClose} className="icon-btn">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Input Device */}
                            <div className="setting-group">
                                <label>
                                    <Mic size={16} />
                                    <span>Input Device</span>
                                </label>
                                <select
                                    value={selectedDevice || ""}
                                    onChange={e => setSelectedDevice(e.target.value || null)}
                                    className="device-select"
                                >
                                    <option value="">Default System Device</option>
                                    {devices.map((d, i) => (
                                        <option key={i} value={d}>{d}</option>
                                    ))}
                                </select>

                                {/* Volume Meter */}
                                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ flex: 1, background: 'var(--bg-tertiary)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                        <motion.div
                                            style={{
                                                width: `${volume}%`,
                                                height: '100%',
                                                background: volume > (vadThreshold * 1000) ? 'var(--positive)' : 'var(--primary)',
                                                transition: 'width 0.05s ease-out'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => void toggleEcho()}
                                        className={`btn-text ${isEchoTesting ? 'active' : ''}`}
                                        style={{ fontSize: '0.8rem', padding: '4px 8px', background: isEchoTesting ? 'var(--positive)' : 'var(--bg-tertiary)', color: isEchoTesting ? '#fff' : 'var(--text-primary)' }}
                                    >
                                        {isEchoTesting ? "Stop Echo" : "Test Mic"}
                                    </button>
                                </div>
                            </div>

                            {/* VAD Threshold */}
                            <div className="setting-group">
                                <label>
                                    <Activity size={16} />
                                    <span>Voice Activation Threshold</span>
                                </label>
                                <div className="vad-control">
                                    <input
                                        type="range"
                                        min="0"
                                        max="0.1"
                                        step="0.001"
                                        value={vadThreshold}
                                        onChange={e => setVadThresholdLocal(parseFloat(e.target.value))}
                                    />
                                    <span className="value-badge">{vadThreshold.toFixed(4)}</span>
                                </div>
                                <p className="setting-hint">Adjust until background noise is ignored.</p>
                            </div>

                            {/* Profile Settings */}
                            <div className="setting-group" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <label style={{ marginBottom: 8 }}>
                                    <User size={16} />
                                    <span>Profile Settings</span>
                                </label>

                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Avatar URL</label>
                                    <input
                                        type="text"
                                        value={avatarUrl}
                                        onChange={e => setAvatarUrl(e.target.value)}
                                        className="device-select"
                                        placeholder="https://example.com/avatar.png"
                                    />
                                    {avatarUrl && (
                                        <div style={{ marginTop: 8, width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                                            <img
                                                src={avatarUrl}
                                                alt="Preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Bio</label>
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        className="device-select"
                                        style={{ height: 80, resize: 'vertical', fontFamily: 'inherit' }}
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button onClick={onClose} className="btn-text">Cancel</button>
                            <button onClick={handleSave} className="btn-primary">Save Changes</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
