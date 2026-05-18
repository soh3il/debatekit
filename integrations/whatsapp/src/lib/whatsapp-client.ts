/**
 * WhatsApp Cloud API Client
 *
 * Wrapper around Meta's Graph API for sending messages, reactions,
 * and read receipts via the WhatsApp Cloud API.
 *
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// ---------------------------------------------------------------------------
// WhatsApp API message types
// ---------------------------------------------------------------------------

type WhatsAppTextPayload = {
  context?: { message_id: string };
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  text: { body: string; preview_url: boolean };
  to: string;
  type: 'text';
};

type WhatsAppReactionPayload = {
  messaging_product: 'whatsapp';
  reaction: { emoji: string; message_id: string };
  recipient_type: 'individual';
  to: string;
  type: 'reaction';
};

type WhatsAppReadReceiptPayload = {
  message_id: string;
  messaging_product: 'whatsapp';
  status: 'read';
};

type WhatsAppMessagePayload =
  | WhatsAppTextPayload
  | WhatsAppReactionPayload
  | WhatsAppReadReceiptPayload;

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

async function graphRequest(
  token: string,
  phoneNumberId: string,
  body: WhatsAppMessagePayload,
) {
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`WhatsApp API error (${response.status}):`, errorBody);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a text message. Optionally reply to a specific message.
 */
export async function sendTextMessage(
  token: string,
  phoneNumberId: string,
  to: string,
  text: string,
  replyMessageId?: string,
) {
  const body: WhatsAppTextPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };

  if (replyMessageId) {
    body.context = { message_id: replyMessageId };
  }

  return graphRequest(token, phoneNumberId, body);
}

/**
 * React to a message with an emoji.
 */
export async function sendReaction(
  token: string,
  phoneNumberId: string,
  to: string,
  messageId: string,
  emoji: string,
) {
  return graphRequest(token, phoneNumberId, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'reaction',
    reaction: { message_id: messageId, emoji },
  });
}

/**
 * Mark a message as read (blue ticks).
 */
export async function markAsRead(
  token: string,
  phoneNumberId: string,
  messageId: string,
) {
  return graphRequest(token, phoneNumberId, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}
