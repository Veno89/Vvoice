export type Channel = {
  channel_id: number;
  name?: string;
};

export type ActiveUser = {
  session: number;
  name?: string;
  channel_id?: number;
  isSpeaking?: boolean;
  self_mute?: boolean;
  self_deaf?: boolean;
  avatar_url?: string;
  comment?: string;
  [key: string]: unknown;
};

export type ChatMessage = {
  actor?: number;
  message: string;
  timestamp?: number;
};
