export type MessageType =
    | 'client_hello'
    | 'join_room'
    | 'leave_room'
    | 'webrtc_offer'
    | 'webrtc_answer'
    | 'webrtc_ice_candidate'
    | 'set_mute'
    | 'heartbeat'
    | 'room_joined'
    | 'participant_joined'
    | 'participant_left'
    | 'participant_muted'
    | 'signal_error'
    | 'server_notice'
    | 'pong'
    | 'ping'
    | 'chat_message';

export interface BaseMessage {
    type: MessageType;
}

// --- Client -> Server (Flat) ---

export type ClientHello = {
    type: 'client_hello';
    protocolVersion: string;
    authToken: string;
};

export interface JoinRoom extends BaseMessage {
    type: 'join_room';
    roomId: string;
    displayName: string;
}

export interface LeaveRoom extends BaseMessage {
    type: 'leave_room';
    roomId: string;
}

export interface ClientWebRTCOffer extends BaseMessage {
    type: 'webrtc_offer';
    toPeerId: string;
    sdp: string; // Serialized SDP
}

export interface ClientWebRTCAnswer extends BaseMessage {
    type: 'webrtc_answer';
    toPeerId: string;
    sdp: string; // Serialized SDP
}

export interface ClientWebRTCIceCandidate extends BaseMessage {
    type: 'webrtc_ice_candidate';
    toPeerId: string;
    candidate: string; // Serialized candidate
}

export interface SetMute extends BaseMessage {
    type: 'set_mute';
    roomId: string;
    muted: boolean;
}

export interface Ping extends BaseMessage {
    type: 'ping'; // heartbeat
}

// --- Server -> Client (Flat) ---

export interface RoomJoined extends BaseMessage {
    type: 'room_joined';
    roomId: string;
    selfPeerId: string;
    participants: Array<{
        peerId: string;
        displayName: string;
        muted: boolean;
    }>;
}

export interface ParticipantJoined extends BaseMessage {
    type: 'participant_joined';
    peerId: string;
    displayName: string;
    muted?: boolean;
}

export interface ParticipantLeft extends BaseMessage {
    type: 'participant_left';
    peerId: string;
}

export interface ParticipantMuted extends BaseMessage {
    type: 'participant_muted';
    peerId: string;
    muted: boolean;
}

export interface ServerWebRTCOffer extends BaseMessage {
    type: 'webrtc_offer';
    fromPeerId: string;
    sdp: string;
}

export interface ServerWebRTCAnswer extends BaseMessage {
    type: 'webrtc_answer';
    fromPeerId: string;
    sdp: string;
}

export interface ServerWebRTCIceCandidate extends BaseMessage {
    type: 'webrtc_ice_candidate';
    fromPeerId: string;
    candidate: string;
}

export interface SignalError extends BaseMessage {
    type: 'signal_error';
    code: string;
    message: string;
}

export interface ServerNotice extends BaseMessage {
    type: 'server_notice';
    message: string;
}

export interface Pong extends BaseMessage {
    type: 'pong';
    ts: number;
}

export interface ClientChatMessage extends BaseMessage {
    type: 'chat_message';
    roomId: string;
    content: string;
}

export interface ServerChatMessage extends BaseMessage {
    type: 'chat_message';
    roomId: string;
    senderId: string;
    displayName: string;
    content: string;
    timestamp: number;
}

// Union types
export type ClientMessage =
    | ClientHello
    | JoinRoom
    | LeaveRoom
    | ClientWebRTCOffer
    | ClientWebRTCAnswer
    | ClientWebRTCIceCandidate
    | SetMute
    | Ping
    | ClientChatMessage;

export type ServerMessage =
    | RoomJoined
    | ParticipantJoined
    | ParticipantLeft
    | ParticipantMuted
    | ServerWebRTCOffer
    | ServerWebRTCAnswer
    | ServerWebRTCIceCandidate
    | SignalError
    | ServerNotice
    | Pong
    | ServerChatMessage;
