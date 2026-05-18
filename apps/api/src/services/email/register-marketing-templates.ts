/**
 * Marketing Email Template Registrations
 *
 * Registers all marketing email templates with the template registry.
 * Call `registerMarketingTemplates()` at startup to populate the registry.
 */

import { EmailTemplateIds } from '@debatekit/shared/enums';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import * as z from 'zod';

import {
  Sorry,
  WhatYouLose,
  WinbackOffer,
} from '@/emails/templates/churn';
import {
  CreditsDepleted,
  CreditsLow,
  FeatureLimit,
  SocialProof,
} from '@/emails/templates/conversion';
import { WeeklyDigest } from '@/emails/templates/newsletter';
import {
  CreditsReminder,
  FirstThreadGuide,
  InviteFriends,
  PowerTips,
  ProTeaser,
  Welcome,
} from '@/emails/templates/onboarding';
import {
  FeaturesTour,
  ProTips,
  ProWelcome,
} from '@/emails/templates/pro';
import {
  Inactive7d,
  Inactive14d,
  Inactive30d,
  Winback,
} from '@/emails/templates/retention';

import { registerTemplate } from './email-template-registry';

// ============================================================================
// HELPERS
// ============================================================================

/** DOCTYPE for proper email client rendering (matches ses-service.ts pattern) */
const EMAIL_DOCTYPE = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

/**
 * Render a React Email component to full HTML with DOCTYPE.
 * Uses react-dom/server renderToString (sync) because Cloudflare Workers
 * does not support renderToReadableStream used by @react-email/render.
 */
function renderTemplate(element: ReactElement) {
  return `${EMAIL_DOCTYPE}${renderToString(element)}`;
}

/**
 * Strip HTML tags to produce a plain-text version of the email.
 */
function htmlToPlainText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// REGISTRATION
// ============================================================================

let registered = false;

export function registerMarketingTemplates() {
  if (registered) {
    return;
  }
  registered = true;

  // --------------------------------------------------------------------------
  // ONBOARDING
  // --------------------------------------------------------------------------

  registerTemplate(EmailTemplateIds.ONBOARDING_WELCOME, (vars) => {
    const html = renderTemplate(Welcome({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Welcome to DebateKit',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.ONBOARDING_FIRST_THREAD, (vars) => {
    const html = renderTemplate(FirstThreadGuide({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: '3 steps to your first AI brainstorm',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.ONBOARDING_POWER_TIPS, (vars) => {
    const html = renderTemplate(PowerTips({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: '3 DebateKit features most people miss',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.ONBOARDING_INVITE, (vars) => {
    const html = renderTemplate(InviteFriends({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your brainstorms are worth sharing',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.ONBOARDING_PRO_TEASER, (vars) => {
    const currentModelLimit = z.coerce.number().safeParse(vars.currentModelLimit);
    const html = renderTemplate(ProTeaser({
      currentModelLimit: currentModelLimit.success ? currentModelLimit.data : undefined,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'You\'ve been using DebateKit with training wheels',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.ONBOARDING_CREDITS_REMINDER, (vars) => {
    const creditPercentage = z.coerce.number().safeParse(vars.creditPercentage);
    const creditsRemaining = z.coerce.number().safeParse(vars.creditsRemaining);
    const html = renderTemplate(CreditsReminder({
      creditPercentage: creditPercentage.success ? creditPercentage.data : undefined,
      creditsRemaining: creditsRemaining.success ? creditsRemaining.data : undefined,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your free credits won\'t last forever',
      text: htmlToPlainText(html),
    };
  });

  // --------------------------------------------------------------------------
  // RETENTION
  // --------------------------------------------------------------------------

  registerTemplate(EmailTemplateIds.RETENTION_7D, (vars) => {
    const html = renderTemplate(Inactive7d({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your AI advisors are waiting',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.RETENTION_14D, (vars) => {
    const html = renderTemplate(Inactive14d({
      lastThreadTitle: vars.lastThreadTitle,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your threads are still here',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.RETENTION_30D, (vars) => {
    const html = renderTemplate(Inactive30d({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'We\'ll keep your threads safe',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.RETENTION_WINBACK, (vars) => {
    const html = renderTemplate(Winback({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'A lot has changed since you left',
      text: htmlToPlainText(html),
    };
  });

  // --------------------------------------------------------------------------
  // CONVERSION
  // --------------------------------------------------------------------------

  registerTemplate(EmailTemplateIds.CONVERSION_CREDITS_LOW, (vars) => {
    const creditPercentage = z.coerce.number().safeParse(vars.creditPercentage);
    const creditsRemaining = z.coerce.number().safeParse(vars.creditsRemaining);
    const html = renderTemplate(CreditsLow({
      creditPercentage: creditPercentage.success ? creditPercentage.data : undefined,
      creditsRemaining: creditsRemaining.success ? creditsRemaining.data : undefined,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your credits are running low',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.CONVERSION_CREDITS_DEPLETED, (vars) => {
    const html = renderTemplate(CreditsDepleted({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your credits have run out',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.CONVERSION_FEATURE_LIMIT, (vars) => {
    const limitHitCount = z.coerce.number().safeParse(vars.limitHitCount);
    const html = renderTemplate(FeatureLimit({
      limitHitCount: limitHitCount.success ? limitHitCount.data : undefined,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Stop hitting limits',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.CONVERSION_SOCIAL_PROOF, (vars) => {
    const proUserCount = z.coerce.number().safeParse(vars.proUserCount);
    const html = renderTemplate(SocialProof({
      proUserCount: proUserCount.success ? proUserCount.data : undefined,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'See why others upgraded to Pro',
      text: htmlToPlainText(html),
    };
  });

  // --------------------------------------------------------------------------
  // PRO
  // --------------------------------------------------------------------------

  registerTemplate(EmailTemplateIds.PRO_WELCOME, (vars) => {
    const html = renderTemplate(ProWelcome({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Welcome to Pro - all limits removed',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.PRO_FEATURES_TOUR, (vars) => {
    const html = renderTemplate(FeaturesTour({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: '5 Pro features you should try today',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.PRO_TIPS, (vars) => {
    const html = renderTemplate(ProTips({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Pro tip: make AI models disagree on purpose',
      text: htmlToPlainText(html),
    };
  });

  // --------------------------------------------------------------------------
  // CHURN
  // --------------------------------------------------------------------------

  registerTemplate(EmailTemplateIds.CHURN_SORRY, (vars) => {
    const html = renderTemplate(Sorry({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'We\'re sorry to see you go',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.CHURN_WHAT_YOU_LOSE, (vars) => {
    const html = renderTemplate(WhatYouLose({
      proExpiryDate: vars.proExpiryDate,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Here\'s what changes when Pro ends',
      text: htmlToPlainText(html),
    };
  });

  registerTemplate(EmailTemplateIds.CHURN_WINBACK_OFFER, (vars) => {
    const html = renderTemplate(WinbackOffer({
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Come back - special offer inside',
      text: htmlToPlainText(html),
    };
  });

  // --------------------------------------------------------------------------
  // NEWSLETTER
  // --------------------------------------------------------------------------

  registerTemplate(EmailTemplateIds.NEWSLETTER_WEEKLY_DIGEST, (vars) => {
    const DigestItemSchema = z.object({ summary: z.string(), title: z.string(), url: z.string() });
    const JsonArraySchema = z.string().transform((s) => {
      try {
        // JSON.parse returns any; piped through z.array() below for validation
        const parsed: unknown = JSON.parse(s);
        return parsed;
      } catch {
        return [];
      }
    });
    const digestItemsResult = JsonArraySchema.pipe(z.array(DigestItemSchema)).safeParse(vars.digestItems ?? '[]');
    const newFeaturesResult = JsonArraySchema.pipe(z.array(z.string())).safeParse(vars.newFeatures ?? '[]');

    const html = renderTemplate(WeeklyDigest({
      digestItems: digestItemsResult.success ? digestItemsResult.data : undefined,
      newFeatures: newFeaturesResult.success ? newFeaturesResult.data : undefined,
      sendLogId: vars.sendLogId,
      unsubscribeUrl: vars.unsubscribeUrl ?? '',
      userName: vars.userName,
    }));
    return {
      html,
      subject: 'Your Weekly DebateKit Digest',
      text: htmlToPlainText(html),
    };
  });
}
