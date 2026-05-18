import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import * as z from 'zod';

import { emailPreference, emailSendLog, emailSuppression } from '@/db/tables/email';

// ============================================================================
// Email Send Log Metadata Schema - Single Source of Truth
// ============================================================================

/**
 * Email send log metadata Zod schema
 *
 * SINGLE SOURCE OF TRUTH for email send log metadata type.
 * The TypeScript type is inferred from this schema using z.infer<>
 * The database table uses this inferred type via $type<>
 */
export const EmailSendLogMetadataSchema = z.record(z.string(), z.string()).nullable();

export type EmailSendLogMetadataType = z.infer<typeof EmailSendLogMetadataSchema>;

// ============================================================================
// Email Preference Schemas
// ============================================================================

export const emailPreferenceSelectSchema = createSelectSchema(emailPreference);
export const emailPreferenceInsertSchema = createInsertSchema(emailPreference);
export const emailPreferenceUpdateSchema = createUpdateSchema(emailPreference);

// ============================================================================
// Email Send Log Schemas
// ============================================================================

export const emailSendLogSelectSchema = createSelectSchema(emailSendLog);
export const emailSendLogInsertSchema = createInsertSchema(emailSendLog);
export const emailSendLogUpdateSchema = createUpdateSchema(emailSendLog);

// ============================================================================
// Email Suppression Schemas
// ============================================================================

export const emailSuppressionSelectSchema = createSelectSchema(emailSuppression);
export const emailSuppressionInsertSchema = createInsertSchema(emailSuppression);
export const emailSuppressionUpdateSchema = createUpdateSchema(emailSuppression);

// ============================================================================
// Type Exports
// ============================================================================

export type EmailPreference = z.infer<typeof emailPreferenceSelectSchema>;
export type EmailPreferenceInsert = z.infer<typeof emailPreferenceInsertSchema>;
export type EmailPreferenceUpdate = z.infer<typeof emailPreferenceUpdateSchema>;

export type EmailSendLog = z.infer<typeof emailSendLogSelectSchema>;
export type EmailSendLogInsert = z.infer<typeof emailSendLogInsertSchema>;
export type EmailSendLogUpdate = z.infer<typeof emailSendLogUpdateSchema>;

export type EmailSuppression = z.infer<typeof emailSuppressionSelectSchema>;
export type EmailSuppressionInsert = z.infer<typeof emailSuppressionInsertSchema>;
export type EmailSuppressionUpdate = z.infer<typeof emailSuppressionUpdateSchema>;
