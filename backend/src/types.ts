export type ExtJWT = {
  channel_id: string;
  exp: number;
  opaque_user_id: string;
  user_id?: string;
  role: 'broadcaster' | 'moderator' | 'viewer' | 'external';
  pubsub_perms: { listen?: string[]; send?: string[] };
};

export type ReceiptJWT = {
  exp: number;
  channel_id: string;
  transaction_id: string;
  product: { sku: string; cost: { type: 'bits'; amount: number } };
  user_id?: string;
};
