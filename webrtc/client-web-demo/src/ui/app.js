import { SignalingClient } from '../signaling/client';
import { WebRTCManager } from '../rtc/manager';
export class App {
    signaling;
    rtc;
    clientId;
    // UI Elements
    btnConnect;
    btnJoin;
    btnMute;
    inputRoom;
    inputName;
    statusDiv;
    peerListDiv;
    audioContainer;
    currentRoom = '';
    isMuted = false;
    peers = new Map();
    constructor() {
        this.clientId = 'web-' + Math.random().toString(36).substr(2, 9);
        // Initialize with placeholder token, will be replaced in joinRoom
        this.signaling = new SignalingClient('ws://localhost:3000/ws', this.clientId, '');
        this.rtc = new WebRTCManager(this.signaling);
        // UI Bindings
        this.btnConnect = document.getElementById('btn-connect');
        this.btnJoin = document.getElementById('btn-join');
        this.btnMute = document.getElementById('btn-mute');
        this.inputRoom = document.getElementById('input-room');
        this.inputName = document.getElementById('input-name');
        this.statusDiv = document.getElementById('status');
        this.peerListDiv = document.getElementById('peer-list');
        this.audioContainer = document.getElementById('audio-container');
        this.setupListeners();
    }
    setupListeners() {
        // Remove btnConnect logic as we connect after login now
        this.btnConnect.style.display = 'none';
        this.btnJoin.onclick = async () => {
            await this.joinRoom();
        };
        this.btnMute.onclick = () => {
            this.isMuted = !this.isMuted;
            this.rtc.setMute(this.isMuted);
            this.signaling.setMute(this.currentRoom, this.isMuted);
            this.btnMute.textContent = this.isMuted ? 'Unmute' : 'Mute';
        };
    }
    async joinRoom() {
        const username = this.inputName.value.trim();
        const roomId = this.inputRoom.value.trim();
        if (!username || !roomId) {
            alert('Enter room and name');
            return;
        }
        this.currentRoom = roomId;
        this.setStatus(`Logging in as ${username}...`);
        try {
            const res = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if (!res.ok)
                throw new Error('Login failed');
            const { token } = await res.json();
            this.setStatus('Authenticated. Connecting...');
            // Re-init with token
            this.signaling.disconnect(); // Ensure old one is closed if open
            this.signaling = new SignalingClient('ws://localhost:3000/ws', username, token);
            this.rtc = new WebRTCManager(this.signaling);
            this.setupSignalingEvents(roomId, username);
            this.setupRTCEvents();
            this.signaling.connect();
            this.btnJoin.disabled = true;
            this.btnMute.disabled = false;
        }
        catch (e) {
            console.error(e);
            this.setStatus(`Error: ${e.message || e}`);
            alert('Failed to connect: ' + (e.message || e));
            this.btnJoin.disabled = false; // Re-enable join button on failure
            this.btnConnect.disabled = false; // Re-enable connect button on failure
        }
    }
    setupSignalingEvents(roomId, username) {
        if (!this.signaling)
            return;
        this.signaling.onOpen = async () => {
            this.setStatus('Connected to Signaling Server. Joining room...');
            this.signaling.joinRoom(roomId, username);
            try {
                await this.rtc.getLocalAudio(); // Get local audio after joining room
                this.setStatus(`Joined ${roomId} as ${username}`);
            }
            catch (e) {
                this.setStatus('Error getting audio: ' + (e.message || e));
            }
        };
        this.signaling.onClose = () => {
            this.setStatus('Disconnected');
            this.btnConnect.disabled = false;
            this.btnJoin.disabled = false;
            this.btnMute.disabled = true;
            this.signaling = null; // Clear signaling client
            this.rtc = null; // Clear RTC manager
            this.audioContainer.innerHTML = ''; // Clear remote audios
            this.peerListDiv.innerHTML = ''; // Clear peer list
        };
        this.signaling.onMessage = (msg) => {
            if (!this.rtc)
                return;
            this.rtc.handleMessage(msg);
            if (msg.type === 'room_joined') {
                this.renderPeers(msg.participants);
            }
            else if (msg.type === 'participant_joined') {
                this.addPeerLog(`${msg.displayName} joined`);
                this.renderPeers(msg.participants); // Update peer list
            }
            else if (msg.type === 'participant_left') {
                this.addPeerLog(`Peer ${msg.peerId} left`);
                this.renderPeers(msg.participants); // Update peer list
            }
            else if (msg.type === 'participant_muted') {
                this.addPeerLog(`Peer ${msg.peerId} ${msg.muted ? 'muted' : 'unmuted'}`);
            }
        };
    }
    setupRTCEvents() {
        if (!this.rtc)
            return;
        this.rtc.onRemoteStream = (peerId, stream) => {
            let audio = document.getElementById(`audio-${peerId}`);
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = `audio-${peerId}`;
                audio.autoplay = true;
                audio.controls = true;
                this.audioContainer.appendChild(audio);
            }
            audio.srcObject = stream;
            audio.play().catch(e => console.error('[UI] Autoplay blocked:', e));
        };
        this.rtc.onPeerLeft = (peerId) => {
            const audio = document.getElementById(`audio-${peerId}`);
            if (audio)
                audio.remove();
        };
    }
    setStatus(msg) {
        this.statusDiv.textContent = `Status: ${msg}`;
    }
    renderPeers(participants) {
        this.peerListDiv.innerHTML = '<h3>Participants:</h3>' +
            participants.map(p => `<div>${p.displayName} (${p.peerId})</div>`).join('');
    }
    addPeerLog(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        this.peerListDiv.appendChild(div);
    }
}
