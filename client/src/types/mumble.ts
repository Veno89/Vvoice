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
  [key: string]: unknown;
};

export type ChatMessage = {
  actor?: number;
  message: string;
  timestamp?: number;
};

export type UserRemoveEvent = {
  session: number;
};

export type ChannelRemoveEvent = {
  channel_id: number;
};
