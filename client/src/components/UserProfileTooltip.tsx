import { useState } from 'react';
import { ActiveUser } from '../types/voice';
import { User, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
    user: ActiveUser;
    children: React.ReactNode;
}

export function UserProfileTooltip({ user, children }: Props) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setCoords({ x: rect.right + 10, y: rect.top });
        setIsVisible(true);
    };

    return (
        <div
            className="tooltip-wrapper"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
            style={{ position: 'relative' }} // Changed to relative for simpler positioning if needed, or keeping it strictly purely hover-based
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: -5 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            top: coords.y,
                            left: coords.x,
                            zIndex: 1000,
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: 16,
                            width: 240,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            pointerEvents: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', marginRight: 12, backgroundColor: 'var(--bg-tertiary)' }}>
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={24} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{user.name}</div>
                                {/* Mock Role for now if not in ActiveUser, or use logic */}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {user.role === 'admin' && <ShieldCheck size={12} color="var(--primary)" />}
                                    <span style={{ color: user.role === 'admin' ? 'var(--primary)' : 'inherit', fontWeight: user.role === 'admin' ? 600 : 400 }}>
                                        {user.role === 'admin' ? 'Administrator' : 'Member'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {user.bio && (
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                {user.bio}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
