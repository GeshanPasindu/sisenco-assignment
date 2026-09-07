-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "task_manager";

-- Required for UUID equality in the reporting-period GiST exclusion.
-- Qualifying its operator class below avoids relying on Prisma's search_path.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED');

-- CreateEnum
CREATE TYPE "review_decision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "task_section" AS ENUM ('THIS_WEEK', 'NEXT_WEEK');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('DEVELOPMENT', 'TESTING', 'MEETINGS', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "blocker_status" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "email_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('REPORT_SUBMITTED', 'REPORT_RESUBMITTED', 'REPORT_APPROVED', 'REPORT_NEEDS_CORRECTION', 'TASK_ASSIGNED');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "employee_id" VARCHAR(30) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT,
    "position" VARCHAR(100),
    "contact_number" VARCHAR(30),
    "personal_email" VARCHAR(254),
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reporting_periods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_week" DATE NOT NULL,
    "end_week" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "email_delivery_status" "email_delivery_status" NOT NULL DEFAULT 'PENDING',
    "email_sent_at" TIMESTAMPTZ(6),
    "email_attempt_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "client_name" VARCHAR(150),
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "planned_date" DATE NOT NULL,
    "due_date" DATE,
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "task_status" NOT NULL DEFAULT 'NOT_STARTED',
    "task_type" "task_type" NOT NULL DEFAULT 'OTHER',
    "planned_completion_pct" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "actual_completion_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "planned_minutes" INTEGER NOT NULL DEFAULT 0,
    "deliverable" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "lock_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_time_entries" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_versions" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "notes" TEXT,
    "lock_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_tasks" (
    "id" UUID NOT NULL,
    "report_version_id" UUID NOT NULL,
    "source_task_id" UUID,
    "project_id" UUID,
    "project_name_snapshot" VARCHAR(150),
    "section" "task_section" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "task_status",
    "planned_completion_pct" DECIMAL(5,2),
    "actual_completion_pct" DECIMAL(5,2),
    "planned_minutes" INTEGER,
    "actual_minutes" INTEGER,
    "task_type" "task_type" NOT NULL DEFAULT 'OTHER',
    "deliverable" TEXT,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "report_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_blockers" (
    "id" UUID NOT NULL,
    "report_version_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "is_key" BOOLEAN NOT NULL DEFAULT false,
    "status" "blocker_status" NOT NULL DEFAULT 'OPEN',
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "report_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_achievements" (
    "id" UUID NOT NULL,
    "report_version_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "is_key" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "report_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_reviews" (
    "id" UUID NOT NULL,
    "report_version_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "review_decision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "event_key" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "report_version_id" UUID,
    "report_review_id" UUID,
    "task_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_reporting_periods_user_id_start_week_key" ON "user_reporting_periods"("user_id", "start_week");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "user_invitations_user_id_created_at_idx" ON "user_invitations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_invitations_invited_by_idx" ON "user_invitations"("invited_by");

-- CreateIndex
CREATE INDEX "user_invitations_email_delivery_status_created_at_idx" ON "user_invitations"("email_delivery_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_outstanding_key" ON "user_invitations"("user_id") WHERE (consumed_at IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE INDEX "projects_archived_at_name_id_idx" ON "projects"("archived_at", "name", "id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_planned_date_id_idx" ON "tasks"("assignee_id", "planned_date", "id");

-- CreateIndex
CREATE INDEX "tasks_project_id_planned_date_id_idx" ON "tasks"("project_id", "planned_date", "id");

-- CreateIndex
CREATE INDEX "tasks_planned_date_id_idx" ON "tasks"("planned_date", "id");

-- CreateIndex
CREATE INDEX "tasks_created_by_idx" ON "tasks"("created_by");

-- CreateIndex
CREATE INDEX "task_time_entries_task_id_work_date_idx" ON "task_time_entries"("task_id", "work_date");

-- CreateIndex
CREATE INDEX "task_time_entries_user_id_work_date_id_idx" ON "task_time_entries"("user_id", "work_date", "id");

-- CreateIndex
CREATE INDEX "reports_week_start_status_member_id_idx" ON "reports"("week_start", "status", "member_id");

-- CreateIndex
CREATE INDEX "reports_member_id_week_start_id_idx" ON "reports"("member_id", "week_start" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_member_id_week_start_key" ON "reports"("member_id", "week_start");

-- CreateIndex
CREATE INDEX "report_versions_submitted_idx" ON "report_versions"("report_id", "submitted_at" DESC) WHERE (submitted_at IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_report_id_version_number_key" ON "report_versions"("report_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_editable_key" ON "report_versions"("report_id") WHERE (submitted_at IS NULL);

-- CreateIndex
CREATE INDEX "report_tasks_report_version_id_idx" ON "report_tasks"("report_version_id");

-- CreateIndex
CREATE INDEX "report_tasks_project_id_idx" ON "report_tasks"("project_id");

-- CreateIndex
CREATE INDEX "report_tasks_source_task_idx" ON "report_tasks"("source_task_id") WHERE (source_task_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "report_tasks_imported_key" ON "report_tasks"("report_version_id", "source_task_id", "section") WHERE (source_task_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "report_blockers_report_version_id_idx" ON "report_blockers"("report_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_blockers_key_item_key" ON "report_blockers"("report_version_id") WHERE (is_key = true);

-- CreateIndex
CREATE INDEX "report_achievements_report_version_id_idx" ON "report_achievements"("report_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_achievements_key_item_key" ON "report_achievements"("report_version_id") WHERE (is_key = true);

-- CreateIndex
CREATE UNIQUE INDEX "report_reviews_report_version_id_key" ON "report_reviews"("report_version_id");

-- CreateIndex
CREATE INDEX "report_reviews_reviewer_id_created_at_idx" ON "report_reviews"("reviewer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "report_reviews_created_at_id_idx" ON "report_reviews"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "report_reviews_id_report_version_id_key" ON "report_reviews"("id", "report_version_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_id_idx" ON "notifications"("recipient_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_unread_idx" ON "notifications"("recipient_id", "created_at" DESC, "id" DESC) WHERE (read_at IS NULL);

-- CreateIndex
CREATE INDEX "notifications_actor_id_idx" ON "notifications"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_report_version_id_idx" ON "notifications"("report_version_id");

-- CreateIndex
CREATE INDEX "notifications_report_review_id_report_version_id_idx" ON "notifications"("report_review_id", "report_version_id");

-- CreateIndex
CREATE INDEX "notifications_task_id_idx" ON "notifications"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_id_event_key_key" ON "notifications"("recipient_id", "event_key");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_reporting_periods" ADD CONSTRAINT "user_reporting_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_tasks" ADD CONSTRAINT "report_tasks_report_version_id_fkey" FOREIGN KEY ("report_version_id") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_tasks" ADD CONSTRAINT "report_tasks_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_tasks" ADD CONSTRAINT "report_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_blockers" ADD CONSTRAINT "report_blockers_report_version_id_fkey" FOREIGN KEY ("report_version_id") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_achievements" ADD CONSTRAINT "report_achievements_report_version_id_fkey" FOREIGN KEY ("report_version_id") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_report_version_id_fkey" FOREIGN KEY ("report_version_id") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_version_id_fkey" FOREIGN KEY ("report_version_id") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_review_id_fkey" FOREIGN KEY ("report_review_id") REFERENCES "report_reviews"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_review_version_fkey" FOREIGN KEY ("report_review_id", "report_version_id") REFERENCES "report_reviews"("id", "report_version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Custom PostgreSQL constraints: Prisma 7.9 cannot express CHECK or EXCLUDE.
-- Nullable comparisons intentionally allow NULL where the dictionary does.
-- Nonblank human-entered text rejects spaces, tabs and line breaks.
ALTER TABLE "roles"
  ADD CONSTRAINT "roles_name_nonblank_check" CHECK (name ~ '[^[:space:]]');

ALTER TABLE "users"
  ADD CONSTRAINT "users_first_name_nonblank_check" CHECK (first_name ~ '[^[:space:]]'),
  ADD CONSTRAINT "users_last_name_nonblank_check" CHECK (last_name ~ '[^[:space:]]'),
  ADD CONSTRAINT "users_email_nonblank_check" CHECK (email ~ '[^[:space:]]'),
  ADD CONSTRAINT "users_email_normalized_check" CHECK (email = lower(btrim(email))),
  ADD CONSTRAINT "users_activation_password_check" CHECK (
    (activated_at IS NULL AND password_hash IS NULL)
    OR (activated_at IS NOT NULL AND password_hash IS NOT NULL)
  ),
  ADD CONSTRAINT "users_activation_date_check" CHECK (activated_at >= created_at),
  ADD CONSTRAINT "users_deactivation_date_check" CHECK (deactivated_at >= created_at);

ALTER TABLE "user_reporting_periods"
  ADD CONSTRAINT "user_reporting_periods_start_monday_check" CHECK (extract(isodow FROM start_week) = 1),
  ADD CONSTRAINT "user_reporting_periods_end_monday_check" CHECK (extract(isodow FROM end_week) = 1),
  ADD CONSTRAINT "user_reporting_periods_date_order_check" CHECK (end_week >= start_week),
  ADD CONSTRAINT "user_reporting_periods_no_overlap" EXCLUDE USING gist (
    user_id public.gist_uuid_ops WITH =,
    daterange(start_week, end_week, '[]') WITH &&
  );

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_token_hash_check" CHECK (refresh_token_hash::text ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "auth_sessions_expiry_check" CHECK (expires_at > created_at),
  ADD CONSTRAINT "auth_sessions_last_used_check" CHECK (last_used_at >= created_at),
  ADD CONSTRAINT "auth_sessions_revoked_check" CHECK (revoked_at >= created_at);

ALTER TABLE "user_invitations"
  ADD CONSTRAINT "user_invitations_token_hash_check" CHECK (token_hash::text ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "user_invitations_expiry_check" CHECK (expires_at > created_at),
  ADD CONSTRAINT "user_invitations_consumed_date_check" CHECK (consumed_at >= created_at AND consumed_at < expires_at),
  ADD CONSTRAINT "user_invitations_revoked_date_check" CHECK (revoked_at >= created_at),
  ADD CONSTRAINT "user_invitations_email_sent_date_check" CHECK (email_sent_at >= created_at),
  ADD CONSTRAINT "user_invitations_state_check" CHECK (consumed_at IS NULL OR revoked_at IS NULL),
  ADD CONSTRAINT "user_invitations_attempt_count_check" CHECK (email_attempt_count >= 0),
  ADD CONSTRAINT "user_invitations_sent_check" CHECK (email_delivery_status <> 'SENT' OR email_sent_at IS NOT NULL);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_name_nonblank_check" CHECK (name ~ '[^[:space:]]'),
  ADD CONSTRAINT "projects_date_order_check" CHECK (end_date >= start_date);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_name_nonblank_check" CHECK (name ~ '[^[:space:]]'),
  ADD CONSTRAINT "tasks_due_date_check" CHECK (due_date >= planned_date),
  ADD CONSTRAINT "tasks_planned_completion_check" CHECK (planned_completion_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT "tasks_actual_completion_check" CHECK (actual_completion_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT "tasks_planned_minutes_check" CHECK (planned_minutes >= 0),
  ADD CONSTRAINT "tasks_lock_version_check" CHECK (lock_version > 0),
  ADD CONSTRAINT "tasks_completion_check" CHECK (
    (status = 'COMPLETED' AND actual_completion_pct = 100 AND completed_at IS NOT NULL)
    OR (status <> 'COMPLETED' AND completed_at IS NULL)
  );

ALTER TABLE "task_time_entries"
  ADD CONSTRAINT "task_time_entries_minutes_check" CHECK (minutes > 0 AND minutes <= 1440);

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_week_monday_check" CHECK (extract(isodow FROM week_start) = 1);

ALTER TABLE "report_versions"
  ADD CONSTRAINT "report_versions_number_check" CHECK (version_number > 0),
  ADD CONSTRAINT "report_versions_lock_version_check" CHECK (lock_version > 0),
  ADD CONSTRAINT "report_versions_submitted_date_check" CHECK (submitted_at >= created_at);

ALTER TABLE "report_tasks"
  ADD CONSTRAINT "report_tasks_name_nonblank_check" CHECK (name ~ '[^[:space:]]'),
  ADD CONSTRAINT "report_tasks_planned_completion_check" CHECK (planned_completion_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT "report_tasks_actual_completion_check" CHECK (actual_completion_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT "report_tasks_planned_minutes_check" CHECK (planned_minutes >= 0),
  ADD CONSTRAINT "report_tasks_actual_minutes_check" CHECK (actual_minutes >= 0),
  ADD CONSTRAINT "report_tasks_display_order_check" CHECK (display_order >= 0),
  ADD CONSTRAINT "report_tasks_next_week_check" CHECK (
    section <> 'NEXT_WEEK'
    OR (actual_completion_pct IS NULL AND actual_minutes IS NULL AND status IS NULL)
  );

ALTER TABLE "report_blockers"
  ADD CONSTRAINT "report_blockers_description_nonblank_check" CHECK (description ~ '[^[:space:]]'),
  ADD CONSTRAINT "report_blockers_display_order_check" CHECK (display_order >= 0);

ALTER TABLE "report_achievements"
  ADD CONSTRAINT "report_achievements_description_nonblank_check" CHECK (description ~ '[^[:space:]]'),
  ADD CONSTRAINT "report_achievements_display_order_check" CHECK (display_order >= 0);

ALTER TABLE "report_reviews"
  ADD CONSTRAINT "report_reviews_correction_comment_check" CHECK (
    decision <> 'CHANGES_REQUESTED'
    OR (comment IS NOT NULL AND comment ~ '[^[:space:]]')
  );

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_title_nonblank_check" CHECK (title ~ '[^[:space:]]'),
  ADD CONSTRAINT "notifications_message_nonblank_check" CHECK (message ~ '[^[:space:]]'),
  ADD CONSTRAINT "notifications_read_date_check" CHECK (read_at >= created_at),
  ADD CONSTRAINT "notifications_target_check" CHECK (
    (type IN ('REPORT_SUBMITTED', 'REPORT_RESUBMITTED')
      AND report_version_id IS NOT NULL AND report_review_id IS NULL AND task_id IS NULL)
    OR (type IN ('REPORT_APPROVED', 'REPORT_NEEDS_CORRECTION')
      AND report_version_id IS NOT NULL AND report_review_id IS NOT NULL AND task_id IS NULL)
    OR (type = 'TASK_ASSIGNED'
      AND task_id IS NOT NULL AND report_version_id IS NULL AND report_review_id IS NULL)
  );
