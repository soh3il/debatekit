import {
  CREDIT_ACTIONS,
  CREDIT_TRANSACTION_TYPES,
  PLAN_TYPES,
  PlanTypes,
} from '@debatekit/shared/enums';
import { relations, sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { CreditTransactionMetadata } from '../schemas/credit-metadata';
import { user } from './auth';
import { chatThread } from './chat';

export const userCreditBalance = sqliteTable(
  'user_credit_balance',
  {
    balance: integer('balance').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    id: text('id').primaryKey(),
    lastRefillAt: integer('last_refill_at', { mode: 'timestamp_ms' }),
    monthlyCredits: integer('monthly_credits').notNull().default(0),
    nextRefillAt: integer('next_refill_at', { mode: 'timestamp_ms' }),
    planType: text('plan_type', { enum: PLAN_TYPES })
      .notNull()
      .default(PlanTypes.FREE),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
  },
  table => [
    index('user_credit_balance_user_idx').on(table.userId),
    index('user_credit_balance_next_refill_idx').on(table.nextRefillAt),
    check('check_balance_non_negative', sql`${table.balance} >= 0`),
    check('check_monthly_credits_non_negative', sql`${table.monthlyCredits} >= 0`),
    check('check_version_positive', sql`${table.version} > 0`),
  ],
);

export const creditTransaction = sqliteTable(
  'credit_transaction',
  {
    action: text('action', { enum: CREDIT_ACTIONS }),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    creditsUsed: integer('credits_used'),
    description: text('description'),
    id: text('id').primaryKey(),
    inputTokens: integer('input_tokens'),
    messageId: text('message_id'),
    metadata: text('metadata', { mode: 'json' }).$type<CreditTransactionMetadata>(),
    modelId: text('model_id'),
    modelPricingInputPerMillion: integer('model_pricing_input_per_million'),
    modelPricingOutputPerMillion: integer('model_pricing_output_per_million'),
    outputTokens: integer('output_tokens'),
    streamId: text('stream_id'),
    threadId: text('thread_id')
      .references(() => chatThread.id, { onDelete: 'set null' }),
    totalTokens: integer('total_tokens'),
    type: text('type', { enum: CREDIT_TRANSACTION_TYPES }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  table => [
    index('credit_tx_user_idx').on(table.userId),
    index('credit_tx_type_idx').on(table.type),
    index('credit_tx_created_idx').on(table.createdAt),
    index('credit_tx_thread_idx').on(table.threadId),
    index('credit_tx_stream_idx').on(table.streamId),
    index('credit_tx_action_idx').on(table.action),
    index('credit_tx_user_created_idx').on(table.userId, table.createdAt),
    index('credit_tx_user_type_idx').on(table.userId, table.type),
  ],
);

export const userCreditBalanceRelations = relations(userCreditBalance, ({ one }) => ({
  user: one(user, {
    fields: [userCreditBalance.userId],
    references: [user.id],
  }),
}));

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
  thread: one(chatThread, {
    fields: [creditTransaction.threadId],
    references: [chatThread.id],
  }),
  user: one(user, {
    fields: [creditTransaction.userId],
    references: [user.id],
  }),
}));
