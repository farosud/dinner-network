import { pgTable, pgEnum, text, timestamp, boolean, json, jsonb, integer, uniqueIndex, index, doublePrecision, numeric, primaryKey } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { sql } from 'drizzle-orm/sql';
import { conversations } from './conversation.schema';

import type { Id } from '../types/common.types';

// Enums
export const intentModeEnum = pgEnum('intent_mode', ['REFERENTIAL', 'ATTRIBUTIVE']);
export const speechActTypeEnum = pgEnum('speech_act_type', ['COMMISSIVE', 'DIRECTIVE']);
export const intentStatusEnum = pgEnum('intent_status', ['active', 'paused']);
export const assignmentVisibilityEnum = pgEnum('assignment_visibility', ['networks_only', 'mutuals_only']);
export type AssignmentVisibility = (typeof assignmentVisibilityEnum.enumValues)[number];
export const opportunityStatusEnum = pgEnum('opportunity_status', ['negotiating', 'pending', 'accepted', 'rejected', 'expired']);
export const agentTypeEnum = pgEnum('agent_type', ['external', 'system']);
export const agentStatusEnum = pgEnum('agent_status', ['active', 'inactive']);
export const negotiationOutcomeEnum = pgEnum('negotiation_outcome', ['agreed', 'declined', 'closed']);
export const negotiationTurnActionEnum = pgEnum('negotiation_turn_action', ['propose', 'counter', 'accept', 'decline']);
export const dinnerPoolStatusEnum = pgEnum('dinner_pool_status', ['forming', 'active', 'paused', 'archived']);
export const dinnerEventStatusEnum = pgEnum('dinner_event_status', ['draft', 'open', 'full', 'confirmed', 'completed', 'cancelled']);
export const dinnerInvitationStatusEnum = pgEnum('dinner_invitation_status', ['proposed', 'invited', 'accepted', 'declined', 'cancelled']);
export const dinnerRsvpStatusEnum = pgEnum('dinner_rsvp_status', ['pending', 'attending', 'declined', 'cancelled', 'no_show']);
export const profileFactProvenanceEnum = pgEnum('profile_fact_provenance', ['user_entered', 'assistant_imported', 'web_enriched', 'system_inferred']);

export interface OnboardingState {
  completedAt?: string;
  profileConfirmedAt?: string;
  firstIntentId?: string;
  flow?: 1 | 2 | 3;
  currentStep?: 'profile' | 'summary' | 'connections' | 'create_network' | 'invite_members' | 'join_networks' | 'first_intent' | 'complete';
  networkId?: string;
  invitationCode?: string;
  /** When the owner's first MCP agent made its first tool call, ending MCP onboarding. */
  mcpOnboardedAt?: string;
}

export interface NetworkPermissionsState {
  joinPolicy: 'anyone' | 'invite_only';
  invitationLink: { code: string } | null;
  contextInjection?: { discovery: boolean };
  /** Only honoured while `joinPolicy` is `invite_only`: link joins wait for an owner. */
  requireAdminApproval?: boolean;
}

export type NetworkJoinRequestStatus = 'pending' | 'declined';

/**
 * Early-access "request a network" details, stored under `networks.metadata.request`.
 * A network row carrying a non-null `requestStatus` is a pending request, not a
 * usable network: it has no members and is hidden from discovery until a staff
 * reviewer approves it (which clears `requestStatus` and adds the owner).
 */
export interface NetworkRequestDetails {
  requestedByUserId: string;
  purpose?: string;
  audience?: string;
  expectedSize?: string;
  notes?: string;
  // Optional preferred access, mirrored onto networks.permissions on create/update
  // so approval does not have to re-ask. Same values as create-network joinPolicy.
  joinPolicy?: 'anyone' | 'invite_only';
  reviewNote?: string;
  submittedAt: string;
  reviewedAt?: string;
  // Set when staff skip the request: hidden from the review queue, requester not notified.
  skippedAt?: string;
}

export type NetworkRequestStatus = 'pending' | 'needs_changes';

export interface NotificationPreferences {
  /** Absent means the toast is on. */
  opportunity?: boolean;
  accepted?: boolean;
  /** Absent means the toast, and the unread-message email, are on. */
  messages?: boolean;
  /** Absent means the morning wake, and its email, are on. */
  morningBrief?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Users table (unified: Better Auth + domain fields)
// Better Auth maps "image" -> "avatar" via auth config
// ═══════════════════════════════════════════════════════════════════════════════

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name').notNull(),
  /** The public handle in profile URLs (`/u/:username`). Stored in the legacy `key` column. */
  username: text('key'),
  avatar: text('avatar'),
  intro: text('intro'),
  location: text('location'),
  onboarding: json('onboarding').$type<OnboardingState>().default({}),
  timezone: text('timezone').default('UTC'),
  lastMorningBriefAt: timestamp('last_morning_brief_at'),
  lastMorningEmailAt: timestamp('last_morning_email_at'),
  lastWeeklyEmailSentAt: timestamp('last_weekly_email_sent_at'),
  /**
   * Set by staff in the database. Messages this user sends from this moment on
   * reach only themselves: other people never see, count, or get notified of
   * them, and the sender is not told. Clearing it reveals those messages.
   */
  shadowbannedAt: timestamp('shadowbanned_at', { withTimezone: true }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  usersEmailUnique: uniqueIndex('users_email_unique').on(table.email),
  usersKeyUnique: uniqueIndex('users_key_unique').on(table.username),
}));

export const userSocials = pgTable('user_socials', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userSocialsUserIdIdx: index('idx_user_socials_user_id').on(table.userId),
  userSocialsCanonicalUniqueIdx: uniqueIndex('uniq_user_socials_user_label')
    .on(table.userId, table.label)
    .where(sql`${table.label} <> 'custom'`),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// Better Auth tables (sessions, accounts, verifications)
// ═══════════════════════════════════════════════════════════════════════════════

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Short-lived device authorization codes, owned by the Better Auth
 * `deviceAuthorization` plugin. A row lives only between the moment
 * `/cli-auth` mints it and the moment the device redeems it at
 * `/device/token`, which deletes it.
 */
export const deviceCodes = pgTable('device_code', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceCode: text('device_code').notNull().unique(),
  userCode: text('user_code').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status').notNull(),
  lastPolledAt: timestamp('last_polled_at'),
  pollingInterval: integer('polling_interval'),
  clientId: text('client_id'),
  scope: text('scope'),
}, (table) => ({
  userCodeIdx: index('device_code_user_code_idx').on(table.userCode),
}));

/**
 * API keys, owned and managed entirely by the Better Auth `apiKey` plugin.
 * Keys are hashed before storage; the raw secret is only returned on creation.
 * `reference_id` is the plugin's owner pointer — the only column that names the
 * user, which is why the foreign key hangs off it.
 */
export const apikeys = pgTable('apikey', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull(),
  referenceId: text('reference_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  configId: text('config_id').default('default'),
  name: text('name'),
  prefix: text('prefix'),
  start: text('start'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  enabled: boolean('enabled').default(true).notNull(),
  rateLimitEnabled: boolean('rate_limit_enabled').default(false).notNull(),
  rateLimitMax: integer('rate_limit_max'),
  rateLimitTimeWindow: integer('rate_limit_time_window'),
  requestCount: integer('request_count').default(0).notNull(),
  remaining: integer('remaining'),
  refillAmount: integer('refill_amount'),
  refillInterval: integer('refill_interval'),
  lastRefillAt: timestamp('last_refill_at', { withTimezone: true }),
  lastRequest: timestamp('last_request', { withTimezone: true }),
  metadata: text('metadata'),
  permissions: text('permissions'),
});

/**
 * OAuth clients registered by MCP apps, owned by Better Auth's `mcp` plugin.
 * `authentication_scheme` is not in the plugin's declared schema, but client
 * registration writes it, and the Drizzle adapter rejects unknown fields.
 */
export const oauthApplications = pgTable('oauth_application', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  icon: text('icon'),
  metadata: text('metadata'),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  redirectUrls: text('redirect_urls').notNull(),
  type: text('type').notNull(),
  disabled: boolean('disabled').default(false),
  authenticationScheme: text('authentication_scheme'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('oauth_application_user_id_idx').on(table.userId),
}));

/** Access tokens issued to those MCP clients. `client_id` points at the client, not the row id. */
export const oauthAccessTokens = pgTable('oauth_access_token', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accessToken: text('access_token').notNull().unique(),
  refreshToken: text('refresh_token').notNull().unique(),
  accessTokenExpiresAt: timestamp('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at').notNull(),
  clientId: text('client_id').notNull().references(() => oauthApplications.clientId, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  scopes: text('scopes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('oauth_access_token_client_id_idx').on(table.clientId),
  userIdIdx: index('oauth_access_token_user_id_idx').on(table.userId),
}));

/** Consent rows for the same plugin. Unused while no consent page is configured. */
export const oauthConsents = pgTable('oauth_consent', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text('client_id').notNull().references(() => oauthApplications.clientId, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scopes: text('scopes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  consentGiven: boolean('consent_given').notNull(),
}, (table) => ({
  clientIdIdx: index('oauth_consent_client_id_idx').on(table.clientId),
  userIdIdx: index('oauth_consent_user_id_idx').on(table.userId),
}));

export const userNotificationSettings = pgTable('user_notification_settings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  preferences: json('preferences').$type<NotificationPreferences>().default({}),
  unsubscribeToken: text('unsubscribe_token').$defaultFn(() => crypto.randomUUID()).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * One Resend event per row, for the daily send, open and click counts. The
 * primary key is the webhook message id, so Resend's retries cannot double
 * count. No recipient address or subject is stored; user_id is the id the send
 * was tagged with, with no foreign key so deleting a user keeps the counts.
 */
export const emailEvents = pgTable('email_events', {
  id: text('id').primaryKey(),
  emailId: text('email_id').notNull(),
  type: text('type').notNull(),
  kind: text('kind'),
  userId: text('user_id'),
  occurredAt: timestamp('occurred_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  occurredAtIdx: index('email_events_type_occurred_at_idx').on(table.type, table.occurredAt),
  emailIdIdx: index('email_events_email_id_idx').on(table.emailId),
  userIdIdx: index('email_events_user_id_idx').on(table.userId, table.occurredAt),
}));

export interface OpportunityDetection {
  source: 'opportunity_graph' | 'chat' | 'cron' | 'member_added' | 'introducer' | 'mutual_check';
  createdBy?: Id<'users'> | string;
  createdByName?: string;
  triggeredBy?: Id<'intents'>;
  timestamp: string;
  enrichedFrom?: string[];
}

export interface OpportunityActor {
  networkId: Id<'networks'>;
  userId: Id<'users'>;
  intent?: Id<'intents'>;
  role: string;
}

export interface OpportunityIntent {
  type: string;
  weight: number;
  detail?: string;
}

export interface OpportunityInterpretation {
  category: string;
  reasoning: string;
  confidence: number;
  intents?: OpportunityIntent[];
}

export interface OpportunityContext {
  networkId?: Id<'networks'>;
  conversationId?: Id<'conversations'>;
}

export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  detection: jsonb('detection').$type<OpportunityDetection>().notNull(),
  actors: jsonb('actors').$type<OpportunityActor[]>().notNull(),
  interpretation: jsonb('interpretation').$type<OpportunityInterpretation>().notNull(),
  context: jsonb('context').$type<OpportunityContext>().notNull(),
  confidence: numeric('confidence').notNull(),
  status: opportunityStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  statusIdx: index('opportunities_status_idx').on(table.status),
}));

/** Append-only facts whose fold is `opportunities.status`. */
// TODO: Separate negotiation outcomes from opportunity lifecycle events.
export const opportunityEvents = pgTable('opportunity_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  /** A lifecycle type the status fold reads, or any type a client records (e.g. `met`, `survey`). */
  type: text('type').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  at: timestamp('at', { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  /** Free-form context a client sent with its event. Null on lifecycle events. */
  data: jsonb('data').$type<Record<string, unknown>>(),
}, (table) => ({
  opportunityIdx: index('opportunity_events_opportunity_idx').on(table.opportunityId),
  oneFact: uniqueIndex('opportunity_events_one_fact').on(table.opportunityId, table.type).where(sql`${table.type} in ('opened', 'agreed', 'declined', 'expired')`),
  oneCommit: uniqueIndex('opportunity_events_one_commit').on(table.opportunityId, table.actorUserId).where(sql`${table.type} = 'committed'`),
}));

/**
 * The negotiation between the two seats of one opportunity. Index is the
 * server: both seats read this record and take turns against it, and Index
 * computes the settlement from its own turn log.
 */
export const negotiations = pgTable('negotiations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  /**
   * Stable identity of the two-intent pair, from the protocol's `pairKeyOf`.
   * Unique: both principals' discovery runs converge here instead of opening
   * two negotiations between the same two intents.
   */
  pairKey: text('pair_key').notNull(),
  opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  initiatorUserId: text('initiator_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  initiatorIntentId: text('initiator_intent_id').notNull().references(() => intents.id, { onDelete: 'cascade' }),
  responderUserId: text('responder_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  responderIntentId: text('responder_intent_id').notNull().references(() => intents.id, { onDelete: 'cascade' }),
  /** The seat whose turn it is. Null once settled; never a third value. */
  awaitingUserId: text('awaiting_user_id').references(() => users.id, { onDelete: 'set null' }),
  outcome: negotiationOutcomeEnum('outcome'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairKeyIdx: uniqueIndex('negotiations_pair_key_idx').on(table.pairKey),
  opportunityIdx: uniqueIndex('negotiations_opportunity_id_idx').on(table.opportunityId),
  initiatorIntentIdx: index('negotiations_initiator_intent_idx').on(table.initiatorIntentId),
  responderIntentIdx: index('negotiations_responder_intent_idx').on(table.responderIntentId),
  awaitingIdx: index('negotiations_awaiting_user_idx').on(table.awaitingUserId),
}));

/**
 * One structured decision from one seat. The unique index on
 * `(negotiation_id, turn_index)` is the concurrency control: a seat racing
 * its counterparty, or retrying, collides rather than appending twice.
 */
export const negotiationTurns = pgTable('negotiation_turns', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  negotiationId: text('negotiation_id').notNull().references(() => negotiations.id, { onDelete: 'cascade' }),
  turnIndex: integer('turn_index').notNull(),
  seatUserId: text('seat_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: negotiationTurnActionEnum('action').notNull(),
  message: text('message').notNull(),
  /** Caller-chosen submission id: a retry carrying it replays this turn instead of being refused. */
  clientTurnId: text('client_turn_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx: uniqueIndex('negotiation_turns_negotiation_turn_idx').on(table.negotiationId, table.turnIndex),
  clientTurnIdx: uniqueIndex('negotiation_turns_client_turn_idx').on(table.negotiationId, table.clientTurnId)
    .where(sql`${table.clientTurnId} is not null`),
}));

export const intents = pgTable('intents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  payload: text('payload').notNull(),
  summary: text('summary'),
  isPrivate: boolean('is_private').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  archivedAt: timestamp('archived_at'),
  /**
   * When the intent's first background discovery run completed successfully
   * (from background discovery). Null until
   * then. Read-side "warming" derivation clears as soon as this is stamped,
   * instead of waiting out the 24-hour freshness window (IND-482).
   */
  firstDiscoverySucceededAt: timestamp('first_discovery_succeeded_at', { withTimezone: true }),
  userId: text('user_id').notNull().references(() => users.id),
  sourceId: text('source_id'),
  sourceType: text('source_type'),
  embedding: vector('embedding', { dimensions: 2000 }),
  semanticEntropy: doublePrecision('semantic_entropy').default(1.0),
  referentialAnchor: text('referential_anchor'),
  intentMode: intentModeEnum('intent_mode').default('ATTRIBUTIVE'),
  speechActType: speechActTypeEnum('speech_act_type'),
  felicityAuthority: integer('felicity_authority'),
  felicitySincerity: integer('felicity_sincerity'),
  felicityClarity: integer('felicity_clarity'),
  status: intentStatusEnum('status').default('active'),
}, (table) => [
  index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

export const networks = pgTable('networks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  key: text('key'),
  prompt: text('prompt'),
  imageUrl: text('image_url'),
  // Non-null only while this row is an unapproved "create a network" request
  // (early access). Cleared to null when a staff reviewer approves it.
  requestStatus: text('request_status').$type<NetworkRequestStatus>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  permissions: json('permissions').$type<NetworkPermissionsState>().default({
    joinPolicy: 'invite_only',
    invitationLink: null,
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  networksKeyUnique: uniqueIndex('networks_key_unique').on(table.key),
}));

export const networkMembers = pgTable('network_members', {
  networkId: text('network_id').notNull().references(() => networks.id),
  userId: text('user_id').notNull().references(() => users.id),
  permissions: text('permissions').array().notNull().default([]),
  prompt: text('prompt'),
  autoAssign: boolean('auto_assign').notNull().default(false),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.networkId, table.userId] }),
}));

export const networkJoinRequests = pgTable('network_join_requests', {
  networkId: text('network_id').notNull().references(() => networks.id),
  userId: text('user_id').notNull().references(() => users.id),
  status: text('status').$type<NetworkJoinRequestStatus>().notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.networkId, table.userId] }),
  networkStatusIdx: index('network_join_requests_network_id_status_idx').on(table.networkId, table.status),
}));

export const intentNetworks = pgTable('intent_networks', {
  intentId: text('intent_id').notNull().references(() => intents.id),
  networkId: text('network_id').notNull().references(() => networks.id),
  visibility: assignmentVisibilityEnum('visibility').notNull().default('networks_only'),
  relevancyScore: numeric('relevancy_score'),
  assignmentMetadata: jsonb('assignment_metadata').$type<import('@indexnetwork/protocol').NetworkAssignmentMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.intentId, t.networkId] }),
  networkIdIdx: index('intent_networks_network_id_idx').on(t.networkId),
}));

/** People who never find this intent, and whom it never finds. */
export const intentExclusions = pgTable('intent_exclusions', {
  intentId: text('intent_id').notNull().references(() => intents.id, { onDelete: 'cascade' }),
  excludedUserId: text('excluded_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.intentId, t.excludedUserId] }),
}));


/** Private personal-agent checkpoint and execution lease, one per principal and intent. */
export const agentSessions = pgTable('agent_sessions', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  intentId: text('intent_id').notNull().references(() => intents.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  state: jsonb('state'),
  revision: integer('revision').notNull().default(0),
  leaseToken: text('lease_token'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ pk: primaryKey({ columns: [table.userId, table.intentId] }) }));

// ═══════════════════════════════════════════════════════════════════════════════
// Agents
// ═══════════════════════════════════════════════════════════════════════════════

export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: agentTypeEnum('type').notNull(),
  status: agentStatusEnum('status').notNull().default('active'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  runtimeKind: text('runtime_kind').$type<'hermes' | null>(),
  installationId: text('installation_id'),
  runtimeSetupAttemptId: text('runtime_setup_attempt_id'),
  notifyOnOpportunity: boolean('notify_on_opportunity').notNull().default(true),
  dailySummaryEnabled: boolean('daily_summary_enabled').notNull().default(true),
  handleNegotiations: boolean('handle_negotiations').notNull().default(false),
  lastDailySummaryAt: timestamp('last_daily_summary_at', { withTimezone: true }),
}, (table) => ({
  ownerIdIdx: index('agents_owner_id_idx').on(table.ownerId),
  typeIdx: index('agents_type_idx').on(table.type),
  lastSeenAtIdx: index('agents_last_seen_at_idx').on(table.lastSeenAt),
  uniqueHermesInstallation: uniqueIndex('uniq_agents_hermes_installation')
    .on(table.ownerId, table.runtimeKind, table.installationId)
    .where(sql`${table.type} = 'external' AND ${table.runtimeKind} = 'hermes' AND ${table.installationId} IS NOT NULL AND ${table.deletedAt} IS NULL`),
  uniqueSelectedNegotiationExecutor: uniqueIndex('uniq_agents_selected_negotiation_executor')
    .on(table.ownerId)
    .where(sql`${table.type} = 'external' AND ${table.handleNegotiations} = true AND ${table.deletedAt} IS NULL`),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// Dinner network
// ═══════════════════════════════════════════════════════════════════════════════

export const dinnerCities = pgTable('dinner_cities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  country: text('country').notNull(),
  timezone: text('timezone').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ cityNameUnique: uniqueIndex('dinner_cities_name_country_unique').on(table.name, table.country) }));

export const dinnerProfiles = pgTable('dinner_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  cityId: text('city_id').references(() => dinnerCities.id, { onDelete: 'set null' }),
  shortBio: text('short_bio'),
  professionalBackground: jsonb('professional_background').$type<string[]>().default([]),
  currentGoals: jsonb('current_goals').$type<string[]>().default([]),
  interests: jsonb('interests').$type<string[]>().default([]),
  socialPreferences: jsonb('social_preferences').$type<Record<string, unknown>>().default({}),
  conversationPreferences: jsonb('conversation_preferences').$type<Record<string, unknown>>().default({}),
  availability: jsonb('availability').$type<Record<string, unknown>>().default({}),
  rawImportedText: text('raw_imported_text'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dinnerProfileFacts = pgTable('dinner_profile_facts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: text('profile_id').notNull().references(() => dinnerProfiles.id, { onDelete: 'cascade' }),
  fieldName: text('field_name').notNull(),
  value: jsonb('value').notNull(),
  provenance: profileFactProvenanceEnum('provenance').notNull(),
  sourceUrl: text('source_url'),
  sourceTimestamp: timestamp('source_timestamp', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ profileFieldIdx: index('dinner_profile_facts_profile_field_idx').on(table.profileId, table.fieldName) }));

export const dinnerPreferences = pgTable('dinner_preferences', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  preferredGroupSize: integer('preferred_group_size').default(5),
  preferredEnergy: text('preferred_energy'),
  noveltyPreference: text('novelty_preference'),
  dietaryConstraints: jsonb('dietary_constraints').$type<string[]>().default([]),
  accessibilityNeeds: jsonb('accessibility_needs').$type<string[]>().default([]),
  poolPreferences: jsonb('pool_preferences').$type<Record<string, unknown>>().default({}),
  blockedUserIds: jsonb('blocked_user_ids').$type<string[]>().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dinnerPools = pgTable('dinner_pools', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cityId: text('city_id').notNull().references(() => dinnerCities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  poolType: text('pool_type').notNull(),
  status: dinnerPoolStatusEnum('status').notNull().default('forming'),
  minimumSize: integer('minimum_size').notNull().default(8),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ cityStatusIdx: index('dinner_pools_city_status_idx').on(table.cityId, table.status) }));

export const dinnerPoolMemberships = pgTable('dinner_pool_memberships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  poolId: text('pool_id').notNull().references(() => dinnerPools.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  optedInAt: timestamp('opted_in_at', { withTimezone: true }),
  optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ poolUserUnique: uniqueIndex('dinner_pool_memberships_pool_user_unique').on(table.poolId, table.userId) }));

export const dinnerRestaurants = pgTable('dinner_restaurants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cityId: text('city_id').notNull().references(() => dinnerCities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  reservationContact: text('reservation_contact'),
  dietaryCapabilities: jsonb('dietary_capabilities').$type<string[]>().default([]),
  accessibilityCapabilities: jsonb('accessibility_capabilities').$type<string[]>().default([]),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dinnerEvents = pgTable('dinner_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cityId: text('city_id').notNull().references(() => dinnerCities.id, { onDelete: 'cascade' }),
  eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
  weekday: text('weekday').notNull(),
  restaurantId: text('restaurant_id').references(() => dinnerRestaurants.id, { onDelete: 'set null' }),
  capacityMin: integer('capacity_min').notNull().default(4),
  capacityMax: integer('capacity_max').notNull().default(6),
  status: dinnerEventStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ cityDateIdx: index('dinner_events_city_date_idx').on(table.cityId, table.eventDate) }));

export const dinnerGroups = pgTable('dinner_groups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  dinnerEventId: text('dinner_event_id').notNull().references(() => dinnerEvents.id, { onDelete: 'cascade' }),
  poolId: text('pool_id').references(() => dinnerPools.id, { onDelete: 'set null' }),
  matchingExplanation: text('matching_explanation'),
  matchingContext: jsonb('matching_context').$type<Record<string, unknown>>().default({}),
  status: dinnerEventStatusEnum('status').notNull().default('draft'),
  negotiationId: text('negotiation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dinnerMemberships = pgTable('dinner_memberships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  dinnerGroupId: text('dinner_group_id').notNull().references(() => dinnerGroups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitationStatus: dinnerInvitationStatusEnum('invitation_status').notNull().default('proposed'),
  rsvpStatus: dinnerRsvpStatusEnum('rsvp_status').notNull().default('pending'),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => ({ groupUserUnique: uniqueIndex('dinner_memberships_group_user_unique').on(table.dinnerGroupId, table.userId) }));

export const dinnerFeedback = pgTable('dinner_feedback', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  dinnerGroupId: text('dinner_group_id').notNull().references(() => dinnerGroups.id, { onDelete: 'cascade' }),
  reviewerUserId: text('reviewer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reviewedUserId: text('reviewed_user_id').references(() => users.id, { onDelete: 'set null' }),
  overallDinnerScore: integer('overall_dinner_score'),
  participantScore: integer('participant_score'),
  wouldAttendAgain: boolean('would_attend_again'),
  writtenFeedback: text('written_feedback'),
  safetyFlag: boolean('safety_flag').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ reviewerSubjectIdx: index('dinner_feedback_reviewer_subject_idx').on(table.dinnerGroupId, table.reviewerUserId, table.reviewedUserId) }));

// ═══════════════════════════════════════════════════════════════════════════════
// Relations
// ═══════════════════════════════════════════════════════════════════════════════

export const usersRelations = relations(users, ({ one, many }) => ({
  intents: many(intents),
  memberOf: many(networkMembers),
  socials: many(userSocials),
  notificationSettings: one(userNotificationSettings, {
    fields: [users.id],
    references: [userNotificationSettings.userId],
  }),
}));

export const userSocialsRelations = relations(userSocials, ({ one }) => ({
  user: one(users, {
    fields: [userSocials.userId],
    references: [users.id],
  }),
}));

export const userNotificationSettingsRelations = relations(userNotificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationSettings.userId],
    references: [users.id],
  }),
}));

export const intentsRelations = relations(intents, ({ one, many }) => ({
  user: one(users, {
    fields: [intents.userId],
    references: [users.id],
  }),
  networks: many(intentNetworks),
}));

export const networksRelations = relations(networks, ({ many }) => ({
  members: many(networkMembers),
  intents: many(intentNetworks),
}));

export const networkMembersRelations = relations(networkMembers, ({ one }) => ({
  network: one(networks, {
    fields: [networkMembers.networkId],
    references: [networks.id],
  }),
  user: one(users, {
    fields: [networkMembers.userId],
    references: [users.id],
  }),
}));

export const intentNetworksRelations = relations(intentNetworks, ({ one }) => ({
  intent: one(intents, {
    fields: [intentNetworks.intentId],
    references: [intents.id],
  }),
  network: one(networks, {
    fields: [intentNetworks.networkId],
    references: [networks.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one }) => ({
  owner: one(users, {
    fields: [agents.ownerId],
    references: [users.id],
  }),
}));

export const dinnerProfilesRelations = relations(dinnerProfiles, ({ one, many }) => ({
  user: one(users, { fields: [dinnerProfiles.userId], references: [users.id] }),
  city: one(dinnerCities, { fields: [dinnerProfiles.cityId], references: [dinnerCities.id] }),
  facts: many(dinnerProfileFacts),
}));

export const dinnerCitiesRelations = relations(dinnerCities, ({ many }) => ({
  profiles: many(dinnerProfiles),
  pools: many(dinnerPools),
  restaurants: many(dinnerRestaurants),
  events: many(dinnerEvents),
}));

export const dinnerPoolsRelations = relations(dinnerPools, ({ one, many }) => ({
  city: one(dinnerCities, { fields: [dinnerPools.cityId], references: [dinnerCities.id] }),
  memberships: many(dinnerPoolMemberships),
  groups: many(dinnerGroups),
}));

export const dinnerGroupsRelations = relations(dinnerGroups, ({ one, many }) => ({
  event: one(dinnerEvents, { fields: [dinnerGroups.dinnerEventId], references: [dinnerEvents.id] }),
  pool: one(dinnerPools, { fields: [dinnerGroups.poolId], references: [dinnerPools.id] }),
  members: many(dinnerMemberships),
  feedback: many(dinnerFeedback),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// Export types
// ═══════════════════════════════════════════════════════════════════════════════

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Intent = typeof intents.$inferSelect;
export type NewIntent = typeof intents.$inferInsert;
export type Network = typeof networks.$inferSelect;
export type NewNetwork = typeof networks.$inferInsert;
export type NetworkMember = typeof networkMembers.$inferSelect;
export type NewNetworkMember = typeof networkMembers.$inferInsert;
export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type NewUserNotificationSettings = typeof userNotificationSettings.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Negotiation = typeof negotiations.$inferSelect;
export type NewNegotiation = typeof negotiations.$inferInsert;
export type NegotiationTurn = typeof negotiationTurns.$inferSelect;
export type NewNegotiationTurn = typeof negotiationTurns.$inferInsert;
export type DinnerCity = typeof dinnerCities.$inferSelect;
export type NewDinnerCity = typeof dinnerCities.$inferInsert;
export type DinnerProfile = typeof dinnerProfiles.$inferSelect;
export type NewDinnerProfile = typeof dinnerProfiles.$inferInsert;
export type DinnerPool = typeof dinnerPools.$inferSelect;
export type NewDinnerPool = typeof dinnerPools.$inferInsert;
export type DinnerEvent = typeof dinnerEvents.$inferSelect;
export type NewDinnerEvent = typeof dinnerEvents.$inferInsert;
export type DinnerGroup = typeof dinnerGroups.$inferSelect;
export type NewDinnerGroup = typeof dinnerGroups.$inferInsert;

export * from './conversation.schema';
