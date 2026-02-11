import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import type { ActiveUser, Channel, ChatMessage } from "../types/voice";

export function useMumbleEvents() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const reset = useCallback(() => {
    setChannels([]);
    setActiveUsers([]);
    setMessages([]);
  }, []);

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  ActiveUser,
  Channel,
  ChannelRemoveEvent,
  ChatMessage,
  UserRemoveEvent,
} from "../types/mumble";

type UseMumbleEventsParams = {
  setActiveUsers: Dispatch<SetStateAction<ActiveUser[]>>;
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export function useMumbleEvents({
  setActiveUsers,
  setChannels,
  setMessages,
}: UseMumbleEventsParams) {
  useEffect(() => {
    let unlistenUpdate: (() => void) | undefined;
    let unlistenRemove: (() => void) | undefined;
    let unlistenUpdateChannel: (() => void) | undefined;
    let unlistenRemoveChannel: (() => void) | undefined;
    let unlistenTextMessage: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenUpdate = await listen<Partial<ActiveUser> & { session: number }>("user_update", (event) => {
        const user = event.payload;

        setActiveUsers((prev) => {
          const exists = prev.find((u) => u.session === user.session);
          if (exists) {
            const merged: ActiveUser = { ...exists };
      unlistenUpdate = await listen<Partial<ActiveUser> & { session: number }>(
        "user_update",
        (event) => {
          const user = event.payload;

          setActiveUsers((prev) => {
            const existing = prev.find((u) => u.session === user.session);
            if (!existing) {
              return [...prev, { ...user, isSpeaking: false }];
            }

            const merged: ActiveUser = { ...existing };
            for (const [key, value] of Object.entries(user)) {
              if (value !== null && value !== undefined) {
                merged[key] = value;
              }
            }
            return prev.map((u) => (u.session === user.session ? merged : u));
          }

          return [...prev, { ...user, isSpeaking: false }];
        });
      });

      unlistenRemove = await listen<{ session: number }>("user_remove", (event) => {

            return prev.map((u) => (u.session === user.session ? merged : u));
          });
        },
      );

      unlistenRemove = await listen<UserRemoveEvent>("user_remove", (event) => {
        const remove = event.payload;
        setActiveUsers((prev) => prev.filter((u) => u.session !== remove.session));
      });

      unlistenUpdateChannel = await listen<Channel>("channel_update", (event) => {
        const channel = event.payload;
        setChannels((prev) => {
          const exists = prev.find((c) => c.channel_id === channel.channel_id);
          if (exists) {
            return prev.map((c) => (c.channel_id === channel.channel_id ? { ...c, ...channel } : c));
          }
            return prev.map((c) =>
              c.channel_id === channel.channel_id ? { ...c, ...channel } : c,
            );
          }

          return [...prev, channel];
        });
      });

      unlistenRemoveChannel = await listen<{ channel_id: number }>("channel_remove", (event) => {
        const remove = event.payload;
        setChannels((prev) => prev.filter((c) => c.channel_id !== remove.channel_id));
      });
      unlistenRemoveChannel = await listen<ChannelRemoveEvent>(
        "channel_remove",
        (event) => {
          const remove = event.payload;
          setChannels((prev) =>
            prev.filter((c) => c.channel_id !== remove.channel_id),
          );
        },
      );

      unlistenTextMessage = await listen<ChatMessage>("text_message", (event) => {
        setMessages((prev) => [...prev, event.payload]);
      });
    };

    void setupListeners();
    setupListeners();

    return () => {
      unlistenUpdate?.();
      unlistenRemove?.();
      unlistenUpdateChannel?.();
      unlistenRemoveChannel?.();
      unlistenTextMessage?.();
    };
  }, []);

  return {
    channels,
    activeUsers,
    messages,
    reset,
  };
  }, [setActiveUsers, setChannels, setMessages]);
}
