import { randomUUID } from 'node:crypto';
import type { ParticipantView } from '../types/protocol.js';

export interface Participant {
  peerId: string;
  userId: string;
  displayName: string;
  muted: boolean;
  connectionId: string;
}

export interface Room {
  id: string;
  participants: Map<string, Participant>;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private byConnection = new Map<string, Set<string>>();

  constructor(
    private readonly maxParticipantsPerRoom: number,
    private readonly maxRoomsPerConnection: number
  ) {}

  joinRoom(connectionId: string, userId: string, displayName: string, roomId: string): { self: Participant; participants: ParticipantView[] } {
    const joinedRooms = this.byConnection.get(connectionId) ?? new Set<string>();
    if (!joinedRooms.has(roomId) && joinedRooms.size >= this.maxRoomsPerConnection) {
      throw new Error('max_rooms_per_connection');
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = { id: roomId, participants: new Map<string, Participant>() };
      this.rooms.set(roomId, room);
    }

    if (room.participants.size >= this.maxParticipantsPerRoom) {
      throw new Error('room_full');
    }

    const peerId = randomUUID();
    const self: Participant = { peerId, userId, displayName, muted: false, connectionId };
    room.participants.set(peerId, self);

    joinedRooms.add(roomId);
    this.byConnection.set(connectionId, joinedRooms);

    return {
      self,
      participants: [...room.participants.values()]
        .filter((p) => p.peerId !== peerId)
        .map(this.toView)
    };
  }

  leaveRoom(connectionId: string, roomId: string): Participant[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const removed: Participant[] = [];
    for (const [peerId, participant] of room.participants.entries()) {
      if (participant.connectionId === connectionId) {
        room.participants.delete(peerId);
        removed.push(participant);
      }
    }

    const joined = this.byConnection.get(connectionId);
    joined?.delete(roomId);
    if (joined && joined.size === 0) {
      this.byConnection.delete(connectionId);
    }

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    }

    return removed;
  }

  leaveAll(connectionId: string): Array<{ roomId: string; participant: Participant }> {
    const joined = this.byConnection.get(connectionId);
    if (!joined) return [];

    const events: Array<{ roomId: string; participant: Participant }> = [];
    for (const roomId of [...joined]) {
      const removed = this.leaveRoom(connectionId, roomId);
      for (const participant of removed) {
        events.push({ roomId, participant });
      }
    }

    return events;
  }

  setMute(connectionId: string, roomId: string, muted: boolean): Participant {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('room_not_found');
    }

    const participant = [...room.participants.values()].find((p) => p.connectionId === connectionId);
    if (!participant) {
      throw new Error('participant_not_found');
    }

    participant.muted = muted;
    return participant;
  }

  findParticipantByPeerId(peerId: string): Participant | undefined {
    for (const room of this.rooms.values()) {
      const participant = room.participants.get(peerId);
      if (participant) return participant;
    }
    return undefined;
  }

  findSenderPeerForTarget(connectionId: string, targetPeerId: string): string | undefined {
    for (const room of this.rooms.values()) {
      const target = room.participants.get(targetPeerId);
      if (!target) {
        continue;
      }

      const sender = [...room.participants.values()].find((participant) => participant.connectionId === connectionId);
      return sender?.peerId;
    }

    return undefined;
  }

  getRoomParticipants(roomId: string): Participant[] {
    return [...(this.rooms.get(roomId)?.participants.values() ?? [])];
  }

  getConnectionRooms(connectionId: string): string[] {
    return [...(this.byConnection.get(connectionId) ?? new Set<string>())];
  }

  private toView(participant: Participant): ParticipantView {
    return {
      peerId: participant.peerId,
      userId: participant.userId,
      displayName: participant.displayName,
      muted: participant.muted
    };
  }
}
