import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireExtJWT } from '../auth.js';
import { sendBroadcast } from '../twitch.js';

const prisma = new PrismaClient();
export const comments = Router();

comments.get('/queue', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  if (ext.role !== 'broadcaster' && ext.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
  const items = await prisma.photoComment.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' }
  });
  res.json(items.map(i => ({ id: i.id, photoId: i.photoId, text: i.text, createdAt: i.createdAt })));
});

comments.post('/:id/approve', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  if (ext.role !== 'broadcaster' && ext.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
  const id = req.params.id;
  const c = await prisma.photoComment.update({ where: { id }, data: { status: 'APPROVED' } });
  await sendBroadcast(ext.channel_id, { type: 'comment:approved', photoId: c.photoId, id: c.id, text: c.text });
  res.json({ ok: true });
});

comments.delete('/:id', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  if (ext.role !== 'broadcaster' && ext.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
  const id = req.params.id;
  await prisma.photoComment.update({ where: { id }, data: { status: 'REMOVED' } });
  res.json({ ok: true });
});
