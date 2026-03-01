#!/usr/bin/env node
import net from 'node:net';
import dns from 'node:dns/promises';

const required = [
  'HOST',
  'PORT',
  'WEBRTC_DEV_JWT_SECRET',
  'CORS_ORIGINS',
  'TURN_HOST',
  'TURN_PORT',
  'TURN_SECRET',
];

const optional = ['TURN_TTL', 'NODE_ENV'];

function readEnv(name, fallback = '') {
  return (process.env[name] ?? fallback).toString().trim();
}

function mask(v) {
  if (!v) return '<empty>';
  if (v.length <= 6) return '***';
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

async function canResolve(host) {
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

async function canConnect(host, port, timeoutMs = 2500) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

async function main() {
  console.log('Vvoice remote readiness check\n');

  let failed = false;

  console.log('1) Environment variables');
  for (const name of required) {
    const val = readEnv(name);
    const ok = Boolean(val);
    if (!ok) failed = true;
    const display = name.includes('SECRET') ? mask(val) : val || '<empty>';
    console.log(` - ${ok ? 'OK ' : 'MISS'} ${name}=${display}`);
  }

  for (const name of optional) {
    const val = readEnv(name);
    console.log(` - INFO ${name}=${val || '<unset>'}`);
  }

  const host = readEnv('TURN_HOST');
  const turnPort = readEnv('TURN_PORT', '3478');

  console.log('\n2) DNS / network checks');
  if (host) {
    const resolvable = await canResolve(host);
    console.log(` - ${resolvable ? 'OK ' : 'WARN'} TURN_HOST resolves: ${host}`);

    const tcpReachable = await canConnect(host, turnPort);
    console.log(` - ${tcpReachable ? 'OK ' : 'WARN'} TURN TCP reachable at ${host}:${turnPort}`);
  } else {
    console.log(' - WARN TURN_HOST is empty, skipping TURN host checks');
  }

  console.log('\n3) Manual checks still required');
  console.log(' - Confirm router/cloud firewall opens TCP 3000 (or your signaling port)');
  console.log(' - Confirm TURN UDP/TCP 3478 and relay UDP range (e.g. 49160-49200) are open');
  console.log(' - Confirm HTTPS/WSS certificate setup in production');
  console.log(' - From another network, open: http(s)://<public-host>:<port>/health');

  if (failed) {
    console.log('\nResult: FAIL (missing required env vars)');
    process.exitCode = 1;
    return;
  }

  console.log('\nResult: PASS (env completeness check passed, see warnings/manual checks above)');
}

main().catch((err) => {
  console.error('Readiness check failed unexpectedly:', err);
  process.exit(1);
});
