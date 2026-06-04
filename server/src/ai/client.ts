/**
 * Anthropic client singleton. Gated on ANTHROPIC_API_KEY — when absent,
 * getAnthropic() returns null and callers fall back to a template generator.
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(config.anthropicApiKey);
}

export function getAnthropic(): Anthropic | null {
  if (!aiEnabled()) return null;
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}
