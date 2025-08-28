import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import type { ReceiptJWT } from './types.js';

const prisma = new PrismaClient();
const extSecret = Buffer.from(process.env.EXT_SECRET_BASE64!, 'base64');
const EXT_CLIENT_ID = process.env.EXT_CLIENT_ID!;
const EXT_OWNER_ID = process.env.EXT_OWNER_ID!;

let appToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (appToken && appToken.expiresAt - 60 > now) return appToken.token;
  const resp = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_APP_CLIENT_ID,
      client_secret: process.env.TWITCH_APP_CLIENT_SECRET,
      grant_type: 'client_credentials'
    }
  });
  appToken = { token: resp.data.access_token, expiresAt: now + resp.data.expires_in };
  return appToken.token;
}

export function verifyTransactionReceiptJWT(receipt: string): ReceiptJWT {
  const payload = jwt.verify(receipt, extSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload & ReceiptJWT;
  return payload;
}

export async function sendBroadcast(channelId: string, message: any) {
  const token = await getAppAccessToken();
  await axios.post(
    'https://api.twitch.tv/helix/extensions/pubsub',
    { broadcaster_id: channelId, message: JSON.stringify(message), target: ['broadcast'] },
    { headers: { 'Client-Id': EXT_CLIENT_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

export async function isSubscriber(broadcasterId: string, userId: string) {
  const tok = await prisma.broadcasterToken.findUnique({ where: { broadcasterId } });
  if (!tok) return false;
  try {
    const resp = await axios.get('https://api.twitch.tv/helix/subscriptions/user', {
      params: { broadcaster_id: broadcasterId, user_id: userId },
      headers: { 'Client-Id': process.env.TWITCH_APP_CLIENT_ID!, Authorization: `Bearer ${tok.accessToken}` }
    });
    return resp.data?.data?.length > 0;
  } catch {
    return false;
  }
}

export function signEBSJWT(channelId: string) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 3,
    user_id: EXT_OWNER_ID,
    channel_id: channelId,
    role: 'external',
    pubsub_perms: { send: ['broadcast'] }
  };
  return jwt.sign(payload, extSecret, { algorithm: 'HS256' });
}
