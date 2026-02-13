import jwt from 'jsonwebtoken';
export function signDevToken(jwtSecret, username) {
    return jwt.sign({ sub: `dev:${username}`, name: username }, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: '8h'
    });
}
export function verifyToken(jwtSecret, token) {
    if (!token) {
        throw new Error('missing_token');
    }
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded !== 'object' || !decoded.sub || !decoded.name) {
        throw new Error('invalid_token');
    }
    return { sub: String(decoded.sub), name: String(decoded.name) };
}
