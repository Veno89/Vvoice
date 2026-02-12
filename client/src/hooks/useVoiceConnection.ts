import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

type AudioSettings = {
  device: string | null;
  vad: number;
};

export function useVoiceConnection(resetState: () => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("AllowedUser");
  const [currentUserRole] = useState("User");

  const connect = useCallback(async (username: string, password: string, audioSettings: AudioSettings) => {
    setIsConnecting(true);
    try {
      resetState();
      await invoke("connect_voice", {
        username,
        password,
        inputDevice: audioSettings.device,
        vadThreshold: audioSettings.vad,
      });
      setCurrentUsername(username);
      setIsConnected(true);
    } catch (e) {
      console.error("Connection failed:", e);
      alert(`Connection failed: ${e}`);
    } finally {
      setIsConnecting(false);
    }
  }, [resetState]);

  const disconnect = useCallback(async () => {
    try {
      await invoke("disconnect_voice");
      setIsConnected(false);
      setIsMuted(false);
      setIsDeafened(false);
      resetState();
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  }, [resetState]);

  const joinChannel = useCallback(async (channelId: number) => {
    try {
      await invoke("join_channel", { channelId });
    } catch (e) {
      console.error("Invoke join_channel error:", e);
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    try {
      await invoke("send_message", { message });
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  }, []);

  const toggleEcho = useCallback(async () => {
    await sendMessage("/echo");
  }, [sendMessage]);

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      await invoke("set_mute", { mute: next });
    } catch (e) {
      console.error("Failed to set mute:", e);
      setIsMuted(!next);
    }
  }, [isMuted]);

  const toggleDeaf = useCallback(async () => {
    const next = !isDeafened;
    setIsDeafened(next);
    try {
      await invoke("set_deaf", { deaf: next });
      if (next) {
        setIsMuted(true);
      }
    } catch (e) {
      console.error("Failed to set deaf:", e);
      setIsDeafened(!next);
    }
  }, [isDeafened]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    isConnecting,
    currentUsername,
    currentUserRole,
    connect,
    disconnect,
    joinChannel,
    sendMessage,
    toggleEcho,
    toggleMute,
    toggleDeaf,
  };
}
