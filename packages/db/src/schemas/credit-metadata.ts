import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import * as z from 'zod';

import {
  creditTransaction,
  userCreditBalance,
} from '../tables/credits';

// ============================================================================
// Credit Transaction Metadata Schema - Single Source of Truth
// ============================================================================

export const CreditTransactionMetadataSchema = z.object({
  adjustedBy: z.string().optional(),
  adjustmentReason: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  streamCompletedAt: z.string().datetime().optional(),
  streamStartedAt: z.string().datetime().optional(),
  stripePaymentIntentId: z.string().optional(),
  stripePriceId: z.string().optional(),
}).strict();

export type CreditTransactionMetadata = z.infer<typeof CreditTransactionMetadataSchema>;

// ============================================================================
// User Credit Balance Schemas
// ============================================================================

export const userCreditBalanceSelectSchema = createSelectSchema(userCreditBalance);
export const userCreditBalanceInsertSchema = createInsertSchema(userCreditBalance);
export const userCreditBalanceUpdateSchema = createUpdateSchema(userCreditBalance);

export type UserCreditBalance = z.infer<typeof userCreditBalanceSelectSchema>;
export type UserCreditBalanceInsert = z.infer<typeof userCreditBalanceInsertSchema>;
export type UserCreditBalanceUpdate = z.infer<typeof userCreditBalanceUpdateSchema>;

// ============================================================================
// Credit Transaction Schemas
// ============================================================================

export const creditTransactionSelectSchema = createSelectSchema(creditTransaction);
export const creditTransactionInsertSchema = createInsertSchema(creditTransaction);

export type CreditTransaction = z.infer<typeof creditTransactionSelectSchema>;
export type CreditTransactionInsert = z.infer<typeof creditTransactionInsertSchema>;
