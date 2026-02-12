export const PROTOCOL_VERSION = '1.0.0';

export type ClientMessage =
  | { type: 'client_hello'; protocolVersion: string; clientId: string; authToken?: string }
  | { type: 'join_room'; roomId: string; displayName: string }
  | { type: 'leave_room'; roomId: string }
  | { type: 'webrtc_offer'; toPeerId: string; sdp: string }
  | { type: 'webrtc_answer'; toPeerId: string; sdp: string }
  | { type: 'webrtc_ice_candidate'; toPeerId: string; candidate: string }
  | { type: 'set_mute'; roomId: string; muted: boolean }
  | { type: 'ping' };

export interface Participant {
  peerId: string;
  userId: string;
  displayName: string;
  muted: boolean;
}

export type ServerMessage =
  | { type: 'room_joined'; roomId: string; selfPeerId: string; participants: Participant[] }
  | { type: 'participant_joined'; roomId: string; peerId: string; displayName: string; muted: boolean }
  | { type: 'participant_left'; roomId: string; peerId: string }
  | { type: 'participant_muted'; roomId: string; peerId: string; muted: boolean }
  | { type: 'webrtc_offer'; fromPeerId: string; sdp: string }
  | { type: 'webrtc_answer'; fromPeerId: string; sdp: string }
  | { type: 'webrtc_ice_candidate'; fromPeerId: string; candidate: string }
  | { type: 'pong'; ts: number }
  | { type: 'server_notice'; message: string }
  | { type: 'signal_error'; code: string; message: string };

export interface JoinSession {
  roomId: string;
  displayName: string;
}
