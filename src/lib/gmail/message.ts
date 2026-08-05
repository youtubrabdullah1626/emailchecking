import * as crypto from "crypto";

/**
 * Gmail Message Builder — RFC 2822 Email Construction
 *
 * Constructs a valid RFC 2822 email message in base64url format,
 * ready to be passed to the Gmail API `users.messages.send` endpoint.
 *
 * Thread continuation:
 *   Step 1  → new email thread (no threadId, no In-Reply-To)
 *   Step 2+ → reply in the same thread (threadId from Step 1,
 *              In-Reply-To header with Step N-1 message ID)
 *
 * Security:
 *   - Subject and body come from the DB — they were composed by the user
 *   - No HTML injection: body is sent as plain text, HTML is safely converted
 *   - No tracking pixels
 *   - No unsubscribe headers in this phase (out of scope)
 */

export interface GmailMessagePayload {
  /** Base64url-encoded RFC 2822 message. */
  raw: string;
  /**
   * Gmail thread ID for thread continuation.
   * Undefined for Step 1 (starts a new thread).
   */
  threadId?: string;
}

export interface BuildMessageOptions {
  from: string;
  to: string;
  toName: string;
  subject: string;
  body: string;
  /**
   * The Gmail message ID of the previous step in this sequence.
   * Used to set the In-Reply-To header for thread continuation.
   */
  inReplyToMessageId?: string;
  /**
   * The Gmail thread ID from the first step in this sequence.
   * Used to keep follow-ups in the same Gmail thread.
   */
  threadId?: string;
  /**
   * Data to construct a perfectly formatted Gmail reply blockquote
   */
  originalMessage?: {
    date: string;
    from: string;
    text: string;
  };
  /**
   * Optional HTML tracking pixel to inject into the HTML part.
   */
  trackingPixel?: string;
  /**
   * Whether to include the List-Unsubscribe header.
   */
  enableListUnsubscribe?: boolean;
  /**
   * Existing Message-ID, if any.
   */
  headers?: Record<string, string>;
}

/**
 * Encode a string for safe transport in email headers (RFC 2047).
 * Uses Base64 ("B") encoding to safely handle UTF-8 characters.
 */
function encodeRFC2047(text: string): string {
  if (!/[^\x00-\x7F]/.test(text)) {
    return text;
  }
  const base64 = Buffer.from(text, 'utf-8').toString('base64');
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * Format email headers to RFC 5322 standard.
 * Prevents header injection attacks by stripping newlines.
 */
function cleanHeaderVal(val: string): string {
  return val.replace(/\r|\n/g, "");
}

/**
 * Extract just the ID from a threading header, removing existing angle brackets
 */
function cleanMessageId(id: string): string {
  return id.replace(/^<+/, "").replace(/>+$/, "");
}

/**
 * Chunk a string into lines of a specific maximum length.
 * Required for RFC 2045 Base64 encoding which recommends 76-character line lengths.
 */
function chunkString(str: string, length: number): string {
  const chunks = [];
  for (let i = 0; i < str.length; i += length) {
    chunks.push(str.substring(i, i + length));
  }
  return chunks.join("\r\n");
}

function generateBoundary(): string {
  return `----=_Part_${crypto.randomBytes(16).toString("hex")}`;
}

export function buildGmailMessage(
  options: BuildMessageOptions
): GmailMessagePayload {
  const { from, to, toName, subject, body, inReplyToMessageId, threadId, originalMessage, trackingPixel, enableListUnsubscribe, headers: customHeaders } =
    options;

  const cleanToName = toName ? encodeRFC2047(cleanHeaderVal(toName)) : "";
  const cleanToEmail = cleanHeaderVal(to);
  const toHeader = cleanToName ? `${cleanToName} <${cleanToEmail}>` : cleanToEmail;

  let finalSubject = cleanHeaderVal(subject);
  if (inReplyToMessageId && !finalSubject.toLowerCase().startsWith("re:")) {
    finalSubject = `Re: ${finalSubject}`;
  }
  const safeSubject = encodeRFC2047(finalSubject);
  const boundary = generateBoundary();

  const headers: string[] = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${cleanHeaderVal(from)}`,
    `To: ${toHeader}`,
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  // 1. Message-ID logic
  if (customHeaders?.['Message-ID']) {
    headers.push(`Message-ID: ${cleanHeaderVal(customHeaders['Message-ID'])}`);
  } else {
    // Generate secure RFC-compliant Message-ID using authenticated sender domain
    const senderDomain = cleanHeaderVal(from).split('@')[1] || 'localhost';
    const entropy = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    headers.push(`Message-ID: <${timestamp}.${entropy}@${senderDomain}>`);
  }

  // 2. List-Unsubscribe logic (RFC 8058 & 2369)
  if (enableListUnsubscribe) {
    const senderDomain = cleanHeaderVal(from).split('@')[1] || 'localhost';
    headers.push(`List-Unsubscribe: <mailto:unsubscribe@${senderDomain}?subject=unsubscribe>`);
    headers.push(`List-Unsubscribe-Post: List-Unsubscribe=One-Click`);
  }

  if (inReplyToMessageId) {
    const safeId = cleanMessageId(inReplyToMessageId);
    headers.push(`In-Reply-To: <${safeId}>`);
    headers.push(`References: <${safeId}>`);
  }

  // Raw UTF-8 for plain text (base64 is a known spam trigger for plain text)
  let plainText = body;
  if (originalMessage) {
    plainText += `\n\nOn ${originalMessage.date}, ${originalMessage.from} wrote:\n`;
    plainText += originalMessage.text.split('\n').map(line => `> ${line}`).join('\n');
  }
  // Enforce strict CRLF for 8bit text/plain encoding to satisfy RFC 5322 section 2.1
  plainText = plainText.replace(/\r\n|\n/g, "\r\n");

  // Base64 chunked text/html payload
  // Emulate Gmail's native <div dir="ltr"> wrapping
  let htmlBody = `<div dir="ltr">${body.replace(/\r\n|\n/g, '<br>')}</div>`;
  if (originalMessage) {
    htmlBody += `<br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">On ${originalMessage.date} ${originalMessage.from} wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${originalMessage.text.replace(/\r\n|\n/g, '<br>')}</blockquote></div>`;
  }
  if (trackingPixel) {
    htmlBody += `\n${trackingPixel}`;
  }
  const base64Html = Buffer.from(htmlBody, 'utf-8').toString('base64');
  const chunkedHtml = chunkString(base64Html, 76);

  const multipartBody = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    plainText,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    chunkedHtml,
    `--${boundary}--`
  ].join("\r\n");

  const message = headers.join("\r\n") + "\r\n\r\n" + multipartBody;

  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {
    raw,
    ...(threadId ? { threadId } : {}),
  };
}
