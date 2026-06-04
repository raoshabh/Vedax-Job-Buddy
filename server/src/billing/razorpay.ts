/**
 * Razorpay integration (India-first). Live when RAZORPAY_KEY_ID/SECRET are set;
 * otherwise the app runs in demo mode where upgrades are simulated locally.
 * Uses the REST API + Node crypto directly (no extra dependency).
 */
import crypto from 'crypto';
import { config } from '../config.js';

export function billingLive(): boolean {
  return Boolean(config.razorpayKeyId && config.razorpayKeySecret);
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  key_id: string;
}

/** Create a one-month Pro order for Razorpay Checkout. */
export async function createRazorpayOrder(userId: string): Promise<RazorpayOrder> {
  const amount = config.proPriceInr * 100; // paise
  const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: `pro_${userId}`.slice(0, 40),
      notes: { user_id: userId, plan: 'pro' },
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  return { id: order.id, amount: order.amount, currency: order.currency, key_id: config.razorpayKeyId };
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Verify a Razorpay Checkout success signature: HMAC_SHA256(order_id|payment_id, secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!config.razorpayKeySecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}
