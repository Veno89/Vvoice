/**
 * Manages the persistent list of voice channels.
 * Backed by SQLite via channel-repo.
 */

import * as repo from '../db/channel-repo.js';

export interface ChannelInfo {
    id: string;
    name: string;
    description: string;
    position: number;
}

export class ChannelManager {
    listChannels(): ChannelInfo[] {
        return repo.listChannels().map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            position: row.position,
        }));
    }

    createChannel(name: string, description = ''): ChannelInfo {
        const row = repo.createChannel(name, description);
        return { id: row.id, name: row.name, description: row.description, position: row.position };
    }

    deleteChannel(channelId: string): boolean {
        return repo.deleteChannel(channelId);
    }

    renameChannel(channelId: string, name: string): ChannelInfo | null {
        const row = repo.renameChannel(channelId, name);
        if (!row) return null;
        return { id: row.id, name: row.name, description: row.description, position: row.position };
    }

    getChannel(channelId: string): ChannelInfo | undefined {
        return repo.getChannel(channelId) ?? undefined;
    }
}
