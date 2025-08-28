import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireExtJWT } from '../auth.js';
import { isSubscriber } from '../twitch.js';

const prisma = new PrismaClient();
export const photos = Router();

photos.get('/', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  const { channel_id, user_id } = ext;
  if (!user_id) return res.status(403).json({ error: 'link_identity' });

  const ok = await isSubscriber(channel_id, user_id);
  if (!ok) return res.status(403).json({ error: 'not_subscribed' });

  const list = await prisma.photo.findMany({
    where: { broadcasterId: channel_id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { counters: true }
  });

  res.json(
    list.map(p => ({
      id: p.id,
      url: p.url,
      title: p.title,
      description: p.description,
      totalBits: p.counters?.totalBits ?? 0,
      comments: p.counters?.comments ?? 0
    }))
  );
});

photos.post('/', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  if (ext.role !== 'broadcaster') return res.status(403).json({ error: 'forbidden' });
  const { url, title, description } = req.body as { url: string; title?: string; description?: string };
  if (!url) return res.status(400).json({ error: 'url_required' });

  const p = await prisma.photo.create({
    data: { broadcasterId: ext.channel_id, url, title, description, counters: { create: {} } }
  });
  res.json({ id: p.id });
});

photos.delete('/:id', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  if (ext.role !== 'broadcaster') return res.status(403).json({ error: 'forbidden' });
  const id = req.params.id;
  await prisma.photo.update({ where: { id }, data: { status: 'DELETED' } });
  res.json({ ok: true });
});
