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

export function mergeActiveUser(existing: ActiveUser, update: Partial<ActiveUser>): ActiveUser {
  const merged: ActiveUser = { ...existing };
  for (const [key, value] of Object.entries(update)) {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}
