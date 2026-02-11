import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Settings2, Activity } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentDevice: string | null;
    currentVad: number;
    onSave: (device: string | null, vad: number) => void;
}

export function SettingsModal({ isOpen, onClose, currentDevice, currentVad, onSave }: SettingsModalProps) {
    const [devices, setDevices] = useState<string[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string | null>(currentDevice);
    const [vadThreshold, setVadThreshold] = useState(currentVad);

    useEffect(() => {
        if (isOpen) {
            invoke<string[]>('get_input_devices')
                .then(devs => {
                    console.log("Devices:", devs);
                    setDevices(devs);
                    // If no device selected and devices exist, select first
                    if (!selectedDevice && devs.length > 0) {
                        setSelectedDevice(devs[0]);
                    }
                })
                .catch(e => console.error("Failed to get devices:", e));
        }
    }, [isOpen]);

    const handleSave = () => {
        onSave(selectedDevice, vadThreshold);
        // If connected, apply VAD immediately
        invoke('set_vad_threshold', { threshold: vadThreshold })
            .catch(() => { }); // If not connected, it's fine
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
                                        onChange={e => setVadThreshold(parseFloat(e.target.value))}
                                    />
                                    <span className="value-badge">{vadThreshold.toFixed(4)}</span>
                                </div>
                                <p className="setting-hint">Adjust until background noise is ignored.</p>
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
