/**
 * §10 ADMIN & GOVERNANCE.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { adapterModeEnum, adapterNameEnum, adapterStatusEnum, announcementStateEnum, auditSubjectTypeEnum, complianceArtifactTypeEnum, domainKindEnum, dsrRequestTypeEnum, dsrStateEnum, escalationStateEnum, escalationSubjectTypeEnum, escalationTypeEnum, flagScopeEnum, recordDataClassEnum, staffRoleEnum, supportTicketStateEnum, translationStatusEnum } from './enums';

export const adminUsers = pgTable('admin_users', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  staffRoles: staffRoleEnum('staff_roles').array().notNull(),
  twoFactorEnrolled: boolean('two_factor_enrolled').notNull().default(false),
  adminSessionPolicy: jsonb('admin_session_policy'),
  grantedByUserId: uuid('granted_by_user_id').references(() => users.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...timestamps,
});


export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    impersonatedUserId: uuid('impersonated_user_id').references(() => users.id),
    subjectType: auditSubjectTypeEnum('subject_type'),
    subjectId: uuid('subject_id'),
    eventType: text('event_type').notNull(),
    payloadDiff: jsonb('payload_diff'),
    reason: text('reason'),
    districtId: integer('district_id'),
    prevHash: text('prev_hash'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_events_actor_idx').on(t.actorUserId),
    index('audit_events_subject_idx').on(t.subjectType, t.subjectId),
    index('audit_events_occurred_idx').on(t.occurredAt),
  ],
);


export const recordAccessLogs = pgTable(
  'record_access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    subjectUserId: uuid('subject_user_id').references(() => users.id),
    subjectRef: uuid('subject_ref'),
    dataClass: recordDataClassEnum('data_class').notNull(),
    reason: text('reason').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('record_access_logs_actor_idx').on(t.actorUserId)],
);


export const adapterHealthSnapshots = pgTable('adapter_health_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  adapter: adapterNameEnum('adapter').notNull(),
  mode: adapterModeEnum('mode').notNull(),
  status: adapterStatusEnum('status').notNull(),
  errorRate: numeric('error_rate'),
  latencyMs: integer('latency_ms'),
  observedAt: timestamp('observed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


export const queueHealthSnapshots = pgTable('queue_health_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  queue: text('queue').notNull(),
  depth: integer('depth'),
  failed: integer('failed'),
  deadLetter: integer('dead_letter'),
  throughput: numeric('throughput'),
  observedAt: timestamp('observed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    value: jsonb('value'),
    scope: flagScopeEnum('scope').notNull().default('global'),
    districtId: integer('district_id'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    lastActorUserId: uuid('last_actor_user_id').references(() => users.id),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (t) => [index('feature_flags_key_idx').on(t.key)],
);


export const configEntries = pgTable(
  'config_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    configType: text('config_type').notNull(),
    value: jsonb('value'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    lockedOnUse: boolean('locked_on_use').notNull().default(false),
    reversible: boolean('reversible').notNull().default(true),
    lastActorUserId: uuid('last_actor_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('config_entries_type_idx').on(t.configType)],
);


export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectType: escalationSubjectTypeEnum('subject_type'),
  subjectId: uuid('subject_id'),
  type: escalationTypeEnum('type').notNull(),
  state: escalationStateEnum('state').notNull().default('open'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  resolutionNote: text('resolution_note'),
  districtId: integer('district_id'),
  ...timestamps,
});


export const impersonationSessions = pgTable('impersonation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffUserId: uuid('staff_user_id')
    .notNull()
    .references(() => users.id),
  targetUserId: uuid('target_user_id')
    .notNull()
    .references(() => users.id),
  reason: text('reason').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  actions: jsonb('actions'),
});


export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  audience: jsonb('audience'),
  bodyEn: text('body_en'),
  bodyRw: text('body_rw'),
  publishAt: timestamp('publish_at', { withTimezone: true }),
  state: announcementStateEnum('state').notNull().default('draft'),
  ...timestamps,
});


export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateKey: text('template_key').notNull(),
    subjectEn: text('subject_en'),
    subjectRw: text('subject_rw'),
    bodyEn: text('body_en'),
    bodyRw: text('body_rw'),
    version: integer('version').notNull().default(1),
    isTransactional: boolean('is_transactional').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('email_templates_key_idx').on(t.templateKey)],
);


export const complianceArtifacts = pgTable('compliance_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  artifactType: complianceArtifactTypeEnum('artifact_type').notNull(),
  details: jsonb('details'),
  processorName: text('processor_name'),
  reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
  ...timestamps,
});


export const dataSubjectRequests = pgTable('data_subject_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectUserId: uuid('subject_user_id').references(() => users.id),
  requestType: dsrRequestTypeEnum('request_type').notNull(),
  state: dsrStateEnum('state').notNull().default('received'),
  retentionExceptionApplied: boolean('retention_exception_applied')
    .notNull()
    .default(false),
  dualAuthorized: boolean('dual_authorized').notNull().default(false),
  ...timestamps,
});


export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterUserId: uuid('requester_user_id').references(() => users.id),
  workspaceContext: text('workspace_context'),
  category: text('category'),
  state: supportTicketStateEnum('state').notNull().default('open'),
  firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  csat: integer('csat'),
  escalationId: uuid('escalation_id').references(() => escalations.id),
  impersonationSessionId: uuid('impersonation_session_id').references(
    () => impersonationSessions.id,
  ),
  domain: domainKindEnum('domain'),
  districtId: integer('district_id'),
  // What the person actually wrote, and how to answer them (migration 0029).
  // The table used to hold a ticket's routing and nothing a support agent
  // could act on: no message, and no way to reply to a visitor who was not
  // signed in. So the public contact form could not be stored honestly, and
  // `POST /support/tickets` answered 501 rather than keep the row and drop the
  // message. `contact_email` is required by the contract for a signed-out
  // sender and optional for a signed-in one, whose account already has one.
  message: text('message'),
  contactEmail: text('contact_email'),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  ...timestamps,
});


export const translationEntries = pgTable(
  'translation_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    valueEn: text('value_en'),
    valueRw: text('value_rw'),
    status: translationStatusEnum('status').notNull().default('missing'),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (t) => [uniqueIndex('translation_entries_key_uk').on(t.key)],
);


export const savedDashboardScopes = pgTable('saved_dashboard_scopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  metricSet: jsonb('metric_set'),
  districtId: integer('district_id'),
  dateRange: jsonb('date_range'),
  ...timestamps,
});

// ===========================================================================
// §14 PMS OPERATIONS LAYER (ADR-016)
//
// The folio, the departments revenue posts to, the room a guest is given
// before they arrive, and the cleaning queue. §14 of architecture-schema.md
// designed this layer and ADR-016 ratified it with five corrections; where the
// two disagree the ADR wins, and the correction is named on the column.
// ===========================================================================
