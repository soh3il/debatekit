/**
 * Email Service using aws4fetch for Cloudflare Workers compatibility
 *
 * Follows the established service pattern (see stripe.service.ts):
 * 1. Zod config schema → inferred type
 * 2. Service class with .initialize(config) and lazy client creation
 * 3. initializeEmailService(env: ApiEnv['Bindings']) extracts from CloudflareEnv
 *
 * Uses aws4fetch instead of @aws-sdk/client-ses because:
 * - @aws-sdk/client-ses imports node:fs which is incompatible with Cloudflare Workers
 * - aws4fetch uses native Fetch API and SubtleCrypto, which work in Cloudflare Workers
 * - Reduces bundle size and improves cold start performance
 *
 * @see https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
 */

import { AwsClient } from 'aws4fetch';
import { renderToString } from 'react-dom/server';
import { z } from 'zod';

import { BRAND } from '@/constants';
import { MagicLink } from '@/emails/templates';
import { log } from '@/lib/logger';
import type { ApiEnv } from '@/types';

// ============================================================================
// SCHEMAS
// ============================================================================

const SesEmailResponseSchema = z.object({ MessageId: z.string() });

const EmailServiceConfigSchema = z.object({
  accessKeyId: z.string().min(1),
  fromEmail: z.string(),
  marketingFromEmail: z.string().optional(),
  region: z.string(),
  replyToEmail: z.string(),
  secretAccessKey: z.string().min(1),
}).strict();

export type EmailServiceConfig = z.infer<typeof EmailServiceConfigSchema>;

// ============================================================================
// SERVICE
// ============================================================================

class EmailService {
  private config: EmailServiceConfig | null = null;

  /**
   * Store config for use when sending emails.
   * Idempotent — only the first call takes effect.
   */
  initialize(config: EmailServiceConfig) {
    if (this.config) {
      return;
    }

    const result = EmailServiceConfigSchema.safeParse(config);
    if (!result.success) {
      log.error('Invalid email service configuration', {
        errors: result.error.message,
      });
      throw new Error(`Invalid email service configuration: ${result.error.message}`);
    }

    this.config = result.data;
  }

  private getConfig(): EmailServiceConfig {
    if (!this.config) {
      throw new Error(
        'Email service not initialized. Call initializeEmailService(env) first.',
      );
    }
    return this.config;
  }

  private getAwsClient(): AwsClient {
    const { accessKeyId, secretAccessKey } = this.getConfig();
    return new AwsClient({ accessKeyId, secretAccessKey });
  }

  private async sendEmail({
    html,
    subject,
    text,
    to,
  }: {
    html: string;
    subject: string;
    text?: string;
    to: string | string[];
  }) {
    const awsClient = this.getAwsClient();
    const config = this.getConfig();

    const toAddresses = Array.isArray(to) ? to : [to];

    // Construct SES v2 API request body
    // @see https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
    const requestBody = {
      Content: {
        Simple: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: html,
            },
            ...(text && {
              Text: {
                Charset: 'UTF-8',
                Data: text,
              },
            }),
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
      },
      Destination: {
        ToAddresses: toAddresses,
      },
      FromEmailAddress: config.fromEmail,
      ReplyToAddresses: [config.replyToEmail],
    };

    try {
      // Make authenticated request to SES v2 API using aws4fetch
      const response = await awsClient.fetch(
        `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`,
        {
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        log.error('SES API error', {
          errorBody: errorBody.slice(0, 500),
          region: config.region,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(
          `Failed to send email via SES: ${response.status} ${response.statusText}. ${errorBody}`,
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      log.error('Email sending failed', error instanceof Error ? error : { error: String(error) });
      if (error instanceof Error) {
        throw new TypeError(`Email sending failed: ${error.message}`);
      }
      throw new Error('Email sending failed: Unknown error occurred');
    }
  }

  async sendMagicLink(to: string, magicLink: string, expirationMinutes = 15) {
    // Render React Email template to HTML using renderToString (sync)
    // Cloudflare Workers doesn't support renderToReadableStream used by @react-email/render
    const markup = renderToString(MagicLink({
      expirationTime: `${expirationMinutes} minutes`,
      loginUrl: magicLink,
    }));
    // Add DOCTYPE for proper email rendering
    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${markup}`;

    const text = `Sign in to ${BRAND.displayName} using this link: ${magicLink}. This link expires in ${expirationMinutes} minutes.`;

    return await this.sendEmail({
      html,
      subject: `Sign in to ${BRAND.displayName}`,
      text,
      to,
    });
  }

  /**
   * Send a marketing email with RFC 8058 one-click unsubscribe headers.
   *
   * Uses the `debatekit-marketing` SES configuration set for engagement tracking
   * and a separate FROM address for marketing sends.
   *
   * @returns SES MessageId for send_log correlation
   */
  async sendMarketingEmail({
    category,
    html,
    listUnsubscribePost,
    listUnsubscribeUrl,
    subject,
    text,
    to,
  }: {
    category: string;
    html: string;
    listUnsubscribePost?: string;
    listUnsubscribeUrl: string;
    subject: string;
    text?: string;
    to: string;
  }): Promise<string> {
    const awsClient = this.getAwsClient();
    const config = this.getConfig();

    const fromAddress = config.marketingFromEmail || config.fromEmail;

    // Build RFC 8058 List-Unsubscribe headers
    const headers = [
      { Name: 'List-Unsubscribe', Value: `<${listUnsubscribeUrl}>` },
      { Name: 'List-Unsubscribe-Post', Value: listUnsubscribePost || 'List-Unsubscribe=One-Click' },
    ];

    // Construct SES v2 API request body with marketing-specific fields
    // @see https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
    const requestBody = {
      ConfigurationSetName: 'debatekit-marketing',
      Content: {
        Simple: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: html,
            },
            ...(text && {
              Text: {
                Charset: 'UTF-8',
                Data: text,
              },
            }),
          },
          Headers: headers,
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
      },
      Destination: {
        ToAddresses: [to],
      },
      FromEmailAddress: fromAddress,
      ReplyToAddresses: [config.replyToEmail],
    };

    try {
      const response = await awsClient.fetch(
        `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`,
        {
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        log.error('SES marketing email error', {
          category,
          errorBody: errorBody.slice(0, 500),
          region: config.region,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(
          `Failed to send marketing email via SES: ${response.status} ${response.statusText}. ${errorBody}`,
        );
      }

      const result = SesEmailResponseSchema.parse(await response.json());

      log.info('Marketing email sent', {
        category,
        messageId: result.MessageId,
        to,
      });

      return result.MessageId;
    } catch (error) {
      log.error('Marketing email sending failed', error instanceof Error ? error : { error: String(error) });
      if (error instanceof Error) {
        throw new TypeError(`Marketing email sending failed: ${error.message}`);
      }
      throw new Error('Marketing email sending failed: Unknown error occurred');
    }
  }
}

// Export a singleton instance
export const emailService = new EmailService();

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the email service from CloudflareEnv bindings.
 * Follows the same pattern as initializeStripe(env) and initializeOpenRouter(env).
 *
 * IMPORTANT: Must be called while still in the Workers async context.
 * Better Auth's internal processing can break the cloudflare:workers async context,
 * so this must be called from the auth handler (sendMagicLink callback)
 * before any async operations within Better Auth.
 */
export function initializeEmailService(env: ApiEnv['Bindings']) {
  emailService.initialize({
    accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
    fromEmail: env.FROM_EMAIL,
    marketingFromEmail: env.MARKETING_FROM_EMAIL,
    region: env.AWS_SES_REGION,
    replyToEmail: env.SES_REPLY_TO_EMAIL,
    secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
  });
}
