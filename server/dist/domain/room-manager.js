import { randomUUID } from 'node:crypto';
export class RoomManager {
    maxParticipantsPerRoom;
    maxRoomsPerConnection;
    rooms = new Map();
    byConnection = new Map();
    constructor(maxParticipantsPerRoom, maxRoomsPerConnection) {
        this.maxParticipantsPerRoom = maxParticipantsPerRoom;
        this.maxRoomsPerConnection = maxRoomsPerConnection;
    }
    joinRoom(connectionId, userId, displayName, roomId) {
        const joinedRooms = this.byConnection.get(connectionId) ?? new Set();
        if (!joinedRooms.has(roomId) && joinedRooms.size >= this.maxRoomsPerConnection) {
            throw new Error('max_rooms_per_connection');
        }
        let room = this.rooms.get(roomId);
        if (!room) {
            room = { id: roomId, participants: new Map() };
            this.rooms.set(roomId, room);
        }
        if (room.participants.size >= this.maxParticipantsPerRoom) {
            throw new Error('room_full');
        }
        const peerId = randomUUID();
        const self = { peerId, userId, displayName, muted: false, connectionId };
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
    leaveRoom(connectionId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return [];
        const removed = [];
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
    leaveAll(connectionId) {
        const joined = this.byConnection.get(connectionId);
        if (!joined)
            return [];
        const events = [];
        for (const roomId of [...joined]) {
            const removed = this.leaveRoom(connectionId, roomId);
            for (const participant of removed) {
                events.push({ roomId, participant });
            }
        }
        return events;
    }
    setMute(connectionId, roomId, muted) {
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
    findParticipantByPeerId(peerId) {
        for (const room of this.rooms.values()) {
            const participant = room.participants.get(peerId);
            if (participant)
                return participant;
        }
        return undefined;
    }
    getRoomParticipants(roomId) {
        return [...(this.rooms.get(roomId)?.participants.values() ?? [])];
    }
    getConnectionRooms(connectionId) {
        return [...(this.byConnection.get(connectionId) ?? new Set())];
    }
    toView(participant) {
        return {
            peerId: participant.peerId,
            userId: participant.userId,
            displayName: participant.displayName,
            muted: participant.muted
        };
    }
}
