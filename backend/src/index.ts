import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { photos } from './routes/photos.js';
import { transactions } from './routes/transactions.js';
import { comments } from './routes/comments.js';
import axios from 'axios';

const app = express();
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/photos', photos);
app.use('/api/transactions', transactions);
app.use('/api/comments', comments);

// Broadcaster OAuth (to read subs)
app.get('/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_APP_CLIENT_ID!,
    redirect_uri: process.env.OAUTH_REDIRECT_URI!,
    response_type: 'code',
    scope: 'channel:read:subscriptions'
  });
  res.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const token = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_APP_CLIENT_ID!,
      client_secret: process.env.TWITCH_APP_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.OAUTH_REDIRECT_URI!
    }
  });
  const user = await axios.get('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-Id': process.env.TWITCH_APP_CLIENT_ID!,
      Authorization: `Bearer ${token.data.access_token}`
    }
  });
  const broadcasterId = user.data.data[0].id as string;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.broadcasterToken.upsert({
    where: { broadcasterId },
    update: {
      accessToken: token.data.access_token,
      refreshToken: token.data.refresh_token,
      expiresAt: new Date(Date.now() + token.data.expires_in * 1000)
    },
    create: {
      broadcasterId,
      accessToken: token.data.access_token,
      refreshToken: token.data.refresh_token,
      expiresAt: new Date(Date.now() + token.data.expires_in * 1000)
    }
  });
  res.send('<script>window.close()</script>Authorized. You can close this window.');
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, () => console.log('EBS listening on', port));
