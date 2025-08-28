import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireExtJWT } from '../auth.js';
import { sendBroadcast, verifyTransactionReceiptJWT } from '../twitch.js';

const prisma = new PrismaClient();
export const transactions = Router();

const SKU_TO_BITS: Record<string, number> = {
  TIP_100: 100,
  TIP_500: 500,
  TIP_1000: 1000,
  COMMENT_500: 500
};

transactions.post('/complete', requireExtJWT, async (req, res) => {
  const ext = (req as any).ext as any;
  const { transactionReceipt, sku, photoId, commentText } = req.body as {
    transactionReceipt: string;
    sku: string;
    photoId: string;
    commentText?: string;
  };
  if (!transactionReceipt || !sku || !photoId) return res.status(400).json({ error: 'bad_request' });

  let payload;
  try {
    payload = verifyTransactionReceiptJWT(transactionReceipt);
  } catch {
    return res.status(403).json({ error: 'invalid_receipt' });
  }

  if (payload.channel_id !== ext.channel_id) return res.status(400).json({ error: 'channel_mismatch' });
  if (payload.product.sku !== sku) return res.status(400).json({ error: 'sku_mismatch' });

  const seenTip = await prisma.photoTip.findUnique({ where: { transactionId: payload.transaction_id } }).catch(() => null);
  const seenComment = await prisma.photoComment.findUnique({ where: { transactionId: payload.transaction_id } }).catch(() => null);
  if (seenTip || seenComment) return res.json({ ok: true, duplicate: true });

  const bits = SKU_TO_BITS[sku] ?? payload.product.cost.amount;

  if (sku.startsWith('TIP_')) {
    await prisma.$transaction([
      prisma.photoTip.create({
        data: {
          photoId,
          transactionId: payload.transaction_id,
          bits,
          viewerId: ext.user_id || null,
          opaqueId: ext.opaque_user_id
        }
      }),
      prisma.photoCounter.update({ where: { photoId }, data: { totalBits: { increment: bits } } })
    ]);
    await sendBroadcast(ext.channel_id, { type: 'tip', photoId, bits });
    return res.json({ ok: true });
  }

  if (sku === 'COMMENT_500') {
    const clean = String(commentText || '').trim().slice(0, 500);
    if (!clean) return res.status(400).json({ error: 'empty_comment' });
    await prisma.$transaction([
      prisma.photoComment.create({
        data: {
          photoId,
          transactionId: payload.transaction_id,
          text: clean,
          viewerId: ext.user_id || null,
          opaqueId: ext.opaque_user_id,
          status: 'PENDING'
        }
      }),
      prisma.photoCounter.update({ where: { photoId }, data: { comments: { increment: 1 } } })
    ]);
    await sendBroadcast(ext.channel_id, { type: 'comment:new', photoId });
    return res.json({ ok: true, status: 'pending' });
  }

  return res.status(400).json({ error: 'unknown_sku' });
});
