import { PeerManager } from '../rtc/peer-manager';
import { SignalingClient } from '../signaling/ws-client';
const participants = new Map();
let selfPeerId = '';
let currentRoomId = '';
let muted = false;
const statusEl = must('status');
const participantsEl = must('participants');
const logEl = must('log');
const localAudioEl = must('localAudio');
const remoteAudioContainer = must('remoteAudioContainer');
const signaling = new SignalingClient({
    wsUrl: getInput('wsUrl').value,
    authBaseUrl: getInput('apiBaseUrl').value,
    clientId: crypto.randomUUID(),
    onMessage,
    onStatus: (status) => setStatus(`signal:${status}`)
});
const peerManager = new PeerManager({
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['turn:localhost:3478'], username: 'dev', credential: 'dev' }
    ],
    onIceCandidate: (toPeerId, candidate) => {
        signaling.send({ type: 'webrtc_ice_candidate', toPeerId, candidate });
    },
    onOffer: (toPeerId, sdp) => {
        signaling.send({ type: 'webrtc_offer', toPeerId, sdp });
    },
    onAnswer: (toPeerId, sdp) => {
        signaling.send({ type: 'webrtc_answer', toPeerId, sdp });
    },
    onConnectionState: (peerId, state) => {
        appendLog(`Peer ${peerId} connection state: ${state}`);
    },
    onRemoteTrack: (peerId, stream) => {
        let audio = document.getElementById(`remote-${peerId}`);
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = `remote-${peerId}`;
            audio.autoplay = true;
            audio.controls = true;
            remoteAudioContainer.appendChild(audio);
        }
        audio.srcObject = stream;
    }
});
export function wireUi() {
    document.getElementById('joinForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = getInput('username').value.trim();
        currentRoomId = getInput('roomId').value.trim();
        const micDeviceId = document.getElementById('micDevice').value;
        if (!username || !currentRoomId) {
            appendLog('Username and room are required.');
            return;
        }
        setStatus('connecting');
        try {
            const localStream = await peerManager.setupLocalAudio(micDeviceId || undefined);
            localAudioEl.srcObject = localStream;
            localAudioEl.muted = true;
            await signaling.connect(username, { roomId: currentRoomId, displayName: username });
            await refreshAudioInputs();
        }
        catch (error) {
            appendLog(`Failed to join: ${error instanceof Error ? error.message : 'unknown error'}`);
            setStatus('failed');
        }
    });
    document.getElementById('leaveBtn')?.addEventListener('click', () => {
        if (currentRoomId) {
            signaling.leaveRoom(currentRoomId);
        }
        peerManager.closeAll();
        participants.clear();
        renderParticipants();
        setStatus('disconnected');
    });
    document.getElementById('muteBtn')?.addEventListener('click', () => {
        muted = !muted;
        peerManager.setMuted(muted);
        if (currentRoomId) {
            signaling.send({ type: 'set_mute', roomId: currentRoomId, muted });
        }
        const muteBtn = document.getElementById('muteBtn');
        muteBtn.textContent = muted ? 'Unmute' : 'Mute';
    });
    refreshAudioInputs().catch(() => appendLog('Could not enumerate mics.'));
}
async function onMessage(message) {
    switch (message.type) {
        case 'room_joined': {
            selfPeerId = message.selfPeerId;
            participants.clear();
            for (const participant of message.participants) {
                participants.set(participant.peerId, participant);
                await peerManager.createOffer(participant.peerId);
            }
            renderParticipants();
            setStatus('connected');
            appendLog(`Joined room ${message.roomId} as ${selfPeerId}`);
            break;
        }
        case 'participant_joined': {
            participants.set(message.peerId, {
                peerId: message.peerId,
                userId: 'unknown',
                displayName: message.displayName,
                muted: message.muted
            });
            renderParticipants();
            appendLog(`${message.displayName} joined.`);
            break;
        }
        case 'participant_left': {
            participants.delete(message.peerId);
            peerManager.removePeer(message.peerId);
            const remoteEl = document.getElementById(`remote-${message.peerId}`);
            remoteEl?.remove();
            renderParticipants();
            appendLog(`Peer ${message.peerId} left.`);
            break;
        }
        case 'participant_muted': {
            const existing = participants.get(message.peerId);
            if (existing) {
                existing.muted = message.muted;
                participants.set(message.peerId, existing);
                renderParticipants();
            }
            break;
        }
        case 'webrtc_offer':
            await peerManager.handleOffer(message.fromPeerId, message.sdp);
            break;
        case 'webrtc_answer':
            await peerManager.handleAnswer(message.fromPeerId, message.sdp);
            break;
        case 'webrtc_ice_candidate':
            await peerManager.handleIceCandidate(message.fromPeerId, message.candidate);
            break;
        case 'server_notice':
            appendLog(`Notice: ${message.message}`);
            break;
        case 'signal_error':
            appendLog(`Signal error (${message.code}): ${message.message}`);
            break;
        case 'pong':
            break;
        default:
            appendLog('Unhandled server message');
    }
}
async function refreshAudioInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const micSelect = document.getElementById('micDevice');
    const mics = devices.filter((device) => device.kind === 'audioinput');
    micSelect.innerHTML = '';
    mics.forEach((mic) => {
        const option = document.createElement('option');
        option.value = mic.deviceId;
        option.textContent = mic.label || `Microphone ${micSelect.options.length + 1}`;
        micSelect.appendChild(option);
    });
}
function renderParticipants() {
    participantsEl.innerHTML = '';
    const selfLabel = document.createElement('li');
    selfLabel.textContent = `You (${selfPeerId || 'pending'}) ${muted ? '[muted]' : ''}`;
    participantsEl.appendChild(selfLabel);
    for (const participant of participants.values()) {
        const li = document.createElement('li');
        li.textContent = `${participant.displayName} (${participant.peerId.slice(0, 8)}) ${participant.muted ? '[muted]' : ''}`;
        participantsEl.appendChild(li);
    }
}
function setStatus(text) {
    statusEl.textContent = text;
}
function appendLog(line) {
    const timestamp = new Date().toLocaleTimeString();
    logEl.textContent = `[${timestamp}] ${line}\n${logEl.textContent}`;
}
function must(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required element: #${id}`);
    }
    return element;
}
function getInput(id) {
    return must(id);
}
