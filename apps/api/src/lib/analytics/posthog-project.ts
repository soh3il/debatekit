/**
 * PostHog Project Lifecycle Tracking
 *
 * Event capture for project CRUD operations.
 * Tracks project updates and deletions for usage analytics.
 */

import * as z from 'zod';

import { log } from '@/lib/logger';

import { getPostHogClient } from './posthog-server';

const PROJECT_EVENT_TYPE_VALUES = [
  'project_created',
  'project_updated',
  'project_deleted',
] as const;

const _ProjectEventTypeSchema = z.enum(PROJECT_EVENT_TYPE_VALUES);

type ProjectEventType = z.infer<typeof _ProjectEventTypeSchema>;

export const DEFAULT_PROJECT_EVENT_TYPE: ProjectEventType = 'project_created';

export const ProjectEventTypes = {
  CREATED: 'project_created' as const,
  DELETED: 'project_deleted' as const,
  UPDATED: 'project_updated' as const,
} as const;

const _ProjectEventPropertiesSchema = z.object({
  changes: z.array(z.string()).optional(),
  project_id: z.string(),
  thread_count: z.number().optional(),
});
type ProjectEventProperties = z.infer<typeof _ProjectEventPropertiesSchema>;

const _ProjectDeletedPropsSchema = _ProjectEventPropertiesSchema.extend({
  thread_count: z.number(),
});
type ProjectDeletedProps = z.infer<typeof _ProjectDeletedPropsSchema>;

const _ProjectUpdatedPropsSchema = _ProjectEventPropertiesSchema.extend({
  changes: z.array(z.string()),
});
type ProjectUpdatedProps = z.infer<typeof _ProjectUpdatedPropsSchema>;

async function captureProjectEvent(
  eventType: ProjectEventType,
  properties: ProjectEventProperties,
  userId: string,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  posthog.capture({
    distinctId: userId,
    event: eventType,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Project] Captured and flushed ${eventType} for ${userId} - project: ${properties.project_id}`);
}

export const projectTracking = {
  projectCreated: async (
    props: ProjectEventProperties,
    userId: string,
  ) => await captureProjectEvent(ProjectEventTypes.CREATED, props, userId),

  projectDeleted: async (
    props: ProjectDeletedProps,
    userId: string,
  ) => await captureProjectEvent(ProjectEventTypes.DELETED, props, userId),

  projectUpdated: async (
    props: ProjectUpdatedProps,
    userId: string,
  ) => await captureProjectEvent(ProjectEventTypes.UPDATED, props, userId),
};
