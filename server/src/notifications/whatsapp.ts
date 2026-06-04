/**
 * WhatsApp delivery via Meta WhatsApp Cloud API.
 *
 * Degrades gracefully: when no credentials are configured, messages are
 * "sent" to the console (mock mode) so the whole flow is testable locally.
 * Point WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID at Meta (or a BSP that
 * exposes the Cloud API, e.g. 360dialog/Gupshup) to go live.
 *
 * Compliance: business-initiated messages outside the 24h customer-service
 * window require a pre-approved TEMPLATE. Set WHATSAPP_TEMPLATE_NAME to use
 * one; otherwise free-form text is sent (valid within the window / for tests).
 */
import { config } from '../config.js';

export interface SendResult {
  sent: boolean;
  mock: boolean;
  channel: 'meta-cloud' | 'mock';
  error?: string;
}

export function whatsappConfigured(): boolean {
  return Boolean(config.whatsappToken && config.whatsappPhoneNumberId);
}

/** Normalize to digits-only for the Cloud API `to` field (drops a leading +). */
function toApiNumber(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

interface MetaPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'template';
  text?: { body: string; preview_url?: boolean };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: string;
      parameters: Array<{ type: 'text'; text: string }>;
    }>;
  };
}

/**
 * Send a WhatsApp message. `templateParams` (when a template is configured)
 * are mapped to the template body's {{1}}, {{2}}… placeholders in order.
 */
export async function sendWhatsApp(
  phone: string,
  text: string,
  templateParams?: string[]
): Promise<SendResult> {
  if (!whatsappConfigured()) {
    // Mock mode — log so the flow is observable without credentials.
    console.error(`\n[whatsapp:mock] → ${phone}\n${text}\n`);
    return { sent: true, mock: true, channel: 'mock' };
  }

  const url = `https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;

  let payload: MetaPayload;
  if (config.whatsappTemplateName && templateParams && templateParams.length > 0) {
    payload = {
      messaging_product: 'whatsapp',
      to: toApiNumber(phone),
      type: 'template',
      template: {
        name: config.whatsappTemplateName,
        language: { code: config.whatsappTemplateLang },
        components: [
          {
            type: 'body',
            parameters: templateParams.map((t) => ({ type: 'text', text: t })),
          },
        ],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: toApiNumber(phone),
      type: 'text',
      text: { body: text, preview_url: true },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        sent: false,
        mock: false,
        channel: 'meta-cloud',
        error: `Meta API ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    return { sent: true, mock: false, channel: 'meta-cloud' };
  } catch (err) {
    return {
      sent: false,
      mock: false,
      channel: 'meta-cloud',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
