import jwt from 'jsonwebtoken';

export type UserRole = 'admin' | 'member';

export interface AuthClaims {
  sub: string;
  name: string;
  role: UserRole;
}

export function signToken(jwtSecret: string, userId: string, username: string, role: UserRole = 'member'): string {
  return jwt.sign({ sub: userId, name: username, role }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '8h'
  });
}

export function verifyToken(jwtSecret: string, token?: string): AuthClaims {
  if (!token) {
    throw new Error('missing_token');
  }

  const decoded = jwt.verify(token, jwtSecret);
  if (typeof decoded !== 'object' || !decoded.sub || !decoded.name) {
    throw new Error('invalid_token');
  }

  const role: UserRole = (decoded as Record<string, unknown>).role === 'admin' ? 'admin' : 'member';
  return { sub: String(decoded.sub), name: String(decoded.name), role };
}

