import { useEffect, useRef } from 'react';
import { useVoiceStore } from '../store/useVoiceStore';

// Individual Stream Component to handle lifecycles cleanly
const StreamPlayer = ({ stream, peerId }: { stream: MediaStream; peerId: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
            // Ensure audio plays even if no interaction (might need user gesture helper in main app)
            audioRef.current.play().catch(e =>
                console.error(`[AudioRenderer] Failed to play stream for ${peerId}`, e)
            );
        }
    }, [stream, peerId]);

    return (
        <audio
            ref={audioRef}
            controls={false} // Hidden audio
            autoPlay
            style={{ display: 'none' }}
        />
    );
};

export const AudioRenderer = () => {
    // Select only what we need to minimize re-renders
    const remoteStreams = useVoiceStore(state => state.remoteStreams);

    return (
        <div id="webrtc-audio-container" style={{ display: 'none' }}>
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                <StreamPlayer key={peerId} peerId={peerId} stream={stream} />
            ))}
            <audio id="echo-audio" style={{ display: 'none' }} autoPlay playsInline />
        </div>
    );
};
