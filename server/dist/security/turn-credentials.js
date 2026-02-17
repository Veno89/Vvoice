import { createHmac } from 'node:crypto';
/**
 * Generate time-limited TURN credentials using HMAC-SHA1.
 * Compatible with COTURN's `use-auth-secret` mode.
 *
 * The username is `expiry_timestamp:userId` and the credential
 * is HMAC-SHA1(secret, username). COTURN validates this on its end.
 */
export function generateTurnCredentials(cfg, userId) {
    const servers = [
        // Always include public STUN
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];
    if (!cfg.turnEnabled) {
        return servers;
    }
    const expiry = Math.floor(Date.now() / 1000) + cfg.turnTtlSeconds;
    const username = `${expiry}:${userId}`;
    const credential = createHmac('sha1', cfg.turnSecret)
        .update(username)
        .digest('base64');
    servers.push({ urls: `turn:${cfg.turnHost}:${cfg.turnPort}?transport=udp`, username, credential }, { urls: `turn:${cfg.turnHost}:${cfg.turnPort}?transport=tcp`, username, credential });
    return servers;
}
