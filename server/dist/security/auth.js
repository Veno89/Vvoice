import jwt from 'jsonwebtoken';
export function signToken(jwtSecret, userId, username, role = 'member') {
    return jwt.sign({ sub: userId, name: username, role }, jwtSecret, {
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
    const role = decoded.role === 'admin' ? 'admin' : 'member';
    return { sub: String(decoded.sub), name: String(decoded.name), role };
}
