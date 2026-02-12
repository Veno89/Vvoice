import jwt from 'jsonwebtoken';

export interface AuthClaims {
  sub: string;
  name: string;
}

export function signDevToken(jwtSecret: string, username: string): string {
  return jwt.sign({ sub: `dev:${username}`, name: username }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '8h'
  });
}

export function verifyToken(jwtSecret: string, token?: string): AuthClaims {
  if (!token) {
    return { sub: 'anonymous', name: 'Anonymous' };
  }

  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded !== 'object' || !decoded.sub || !decoded.name) {
    throw new Error('invalid_token');
  }

  return { sub: String(decoded.sub), name: String(decoded.name) };
}
