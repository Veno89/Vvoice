export interface Channel {
  channel_id: number;
  name: string;
  parent_id: number;
  description: string;
  temporary: boolean;
  position: number;
  links: number[];
}

export interface ActiveUser {
  session: number;
  peerId: string;
  name: string;
  channel_id: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  avatar_url: string | null;
  bio?: string;
  role?: string;
}

export interface ChatMessage {
  session: number;
  channel_id: number[];
  actor: number; // Keep for compatibility with session ID
  message: string;
  timestamp: number;
}
