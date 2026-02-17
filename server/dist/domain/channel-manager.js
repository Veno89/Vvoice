/**
 * Manages the persistent list of voice channels.
 * Backed by SQLite via channel-repo.
 */
import * as repo from '../db/channel-repo.js';
export class ChannelManager {
    listChannels() {
        return repo.listChannels().map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            position: row.position,
        }));
    }
    createChannel(name, description = '') {
        const row = repo.createChannel(name, description);
        return { id: row.id, name: row.name, description: row.description, position: row.position };
    }
    deleteChannel(channelId) {
        return repo.deleteChannel(channelId);
    }
    renameChannel(channelId, name) {
        const row = repo.renameChannel(channelId, name);
        if (!row)
            return null;
        return { id: row.id, name: row.name, description: row.description, position: row.position };
    }
    getChannel(channelId) {
        return repo.getChannel(channelId) ?? undefined;
    }
}
