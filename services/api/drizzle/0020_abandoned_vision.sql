CREATE TYPE "public"."dinner_event_status" AS ENUM('draft', 'open', 'full', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dinner_invitation_status" AS ENUM('proposed', 'invited', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dinner_pool_status" AS ENUM('forming', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."dinner_rsvp_status" AS ENUM('pending', 'attending', 'declined', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."profile_fact_provenance" AS ENUM('user_entered', 'assistant_imported', 'web_enriched', 'system_inferred');--> statement-breakpoint
CREATE TABLE "dinner_cities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"timezone" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_events" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"weekday" text NOT NULL,
	"restaurant_id" text,
	"capacity_min" integer DEFAULT 4 NOT NULL,
	"capacity_max" integer DEFAULT 6 NOT NULL,
	"status" "dinner_event_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"dinner_group_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"reviewed_user_id" text,
	"overall_dinner_score" integer,
	"participant_score" integer,
	"would_attend_again" boolean,
	"written_feedback" text,
	"safety_flag" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"dinner_event_id" text NOT NULL,
	"pool_id" text,
	"matching_explanation" text,
	"matching_context" jsonb DEFAULT '{}'::jsonb,
	"status" "dinner_event_status" DEFAULT 'draft' NOT NULL,
	"negotiation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"dinner_group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"invitation_status" "dinner_invitation_status" DEFAULT 'proposed' NOT NULL,
	"rsvp_status" "dinner_rsvp_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dinner_pool_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"opted_in_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"pool_type" text NOT NULL,
	"status" "dinner_pool_status" DEFAULT 'forming' NOT NULL,
	"minimum_size" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"preferred_group_size" integer DEFAULT 5,
	"preferred_energy" text,
	"novelty_preference" text,
	"dietary_constraints" jsonb DEFAULT '[]'::jsonb,
	"accessibility_needs" jsonb DEFAULT '[]'::jsonb,
	"pool_preferences" jsonb DEFAULT '{}'::jsonb,
	"blocked_user_ids" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dinner_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dinner_profile_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"field_name" text NOT NULL,
	"value" jsonb NOT NULL,
	"provenance" "profile_fact_provenance" NOT NULL,
	"source_url" text,
	"source_timestamp" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"city_id" text,
	"short_bio" text,
	"professional_background" jsonb DEFAULT '[]'::jsonb,
	"current_goals" jsonb DEFAULT '[]'::jsonb,
	"interests" jsonb DEFAULT '[]'::jsonb,
	"social_preferences" jsonb DEFAULT '{}'::jsonb,
	"conversation_preferences" jsonb DEFAULT '{}'::jsonb,
	"availability" jsonb DEFAULT '{}'::jsonb,
	"raw_imported_text" text,
	"approved_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dinner_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dinner_restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"reservation_contact" text,
	"dietary_capabilities" jsonb DEFAULT '[]'::jsonb,
	"accessibility_capabilities" jsonb DEFAULT '[]'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dinner_events" ADD CONSTRAINT "dinner_events_city_id_dinner_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."dinner_cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_events" ADD CONSTRAINT "dinner_events_restaurant_id_dinner_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."dinner_restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_feedback" ADD CONSTRAINT "dinner_feedback_dinner_group_id_dinner_groups_id_fk" FOREIGN KEY ("dinner_group_id") REFERENCES "public"."dinner_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_feedback" ADD CONSTRAINT "dinner_feedback_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_feedback" ADD CONSTRAINT "dinner_feedback_reviewed_user_id_users_id_fk" FOREIGN KEY ("reviewed_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_groups" ADD CONSTRAINT "dinner_groups_dinner_event_id_dinner_events_id_fk" FOREIGN KEY ("dinner_event_id") REFERENCES "public"."dinner_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_groups" ADD CONSTRAINT "dinner_groups_pool_id_dinner_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."dinner_pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_memberships" ADD CONSTRAINT "dinner_memberships_dinner_group_id_dinner_groups_id_fk" FOREIGN KEY ("dinner_group_id") REFERENCES "public"."dinner_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_memberships" ADD CONSTRAINT "dinner_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_pool_memberships" ADD CONSTRAINT "dinner_pool_memberships_pool_id_dinner_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."dinner_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_pool_memberships" ADD CONSTRAINT "dinner_pool_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_pools" ADD CONSTRAINT "dinner_pools_city_id_dinner_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."dinner_cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_preferences" ADD CONSTRAINT "dinner_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_profile_facts" ADD CONSTRAINT "dinner_profile_facts_profile_id_dinner_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."dinner_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_profiles" ADD CONSTRAINT "dinner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_profiles" ADD CONSTRAINT "dinner_profiles_city_id_dinner_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."dinner_cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_restaurants" ADD CONSTRAINT "dinner_restaurants_city_id_dinner_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."dinner_cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dinner_cities_name_country_unique" ON "dinner_cities" USING btree ("name","country");--> statement-breakpoint
CREATE INDEX "dinner_events_city_date_idx" ON "dinner_events" USING btree ("city_id","event_date");--> statement-breakpoint
CREATE INDEX "dinner_feedback_reviewer_subject_idx" ON "dinner_feedback" USING btree ("dinner_group_id","reviewer_user_id","reviewed_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dinner_memberships_group_user_unique" ON "dinner_memberships" USING btree ("dinner_group_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dinner_pool_memberships_pool_user_unique" ON "dinner_pool_memberships" USING btree ("pool_id","user_id");--> statement-breakpoint
CREATE INDEX "dinner_pools_city_status_idx" ON "dinner_pools" USING btree ("city_id","status");--> statement-breakpoint
CREATE INDEX "dinner_profile_facts_profile_field_idx" ON "dinner_profile_facts" USING btree ("profile_id","field_name");