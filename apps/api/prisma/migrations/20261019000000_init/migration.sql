-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('VEG', 'NON_VEG');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('DEFAULT', 'MANUAL', 'PLAN_AHEAD_DATE', 'PLAN_AHEAD_WEEKDAY', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'PAUSED_LEAVE', 'CANCELLED_BY_CLOSURE');

-- CreateEnum
CREATE TYPE "BookingEventType" AS ENUM ('CREATED', 'SLOT_CHANGED', 'DIET_CHANGED', 'CANCELLED', 'PAUSED_FOR_LEAVE', 'RESUMED_AFTER_LEAVE', 'CANCELLED_BY_CLOSURE', 'RESTORED_AFTER_CLOSURE', 'COMPLETED', 'MARKED_NO_SHOW', 'STATUS_CORRECTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('STUDENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DateExceptionAction" AS ENUM ('BOOK', 'SKIP');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CredentialResetKind" AS ENUM ('PASSWORD', 'REGISTRATION');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveChangeKind" AS ENUM ('EXTENDED', 'ENDED_EARLY', 'CORRECTED');

-- CreateEnum
CREATE TYPE "NoShowStatus" AS ENUM ('COUNTED', 'HELD_FOR_REVIEW', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "NoShowExclusionCause" AS ENUM ('APPEAL_APPROVED', 'STAFF_RESET', 'OUTAGE_REVIEW_DISMISSED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('FACE_VERIFICATION', 'MANUAL_FALLBACK', 'IMPORT');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('COMPLAINT', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('FOOD_QUALITY', 'FOREIGN_OBJECT', 'CLEANLINESS', 'SERVICE', 'MENU', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintPrivacyMode" AS ENUM ('ANONYMOUS', 'PRIVATE_IDENTIFIED');

-- CreateEnum
CREATE TYPE "SlotFullFallback" AS ENUM ('AUTO_NEXT_AVAILABLE', 'ASK_STUDENT');

-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ClosureKind" AS ENUM ('MESS_CLOSED', 'FESTIVAL', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ClosureStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'HOSTEL', 'BLOCK', 'ACADEMIC_YEAR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ANNOUNCEMENT', 'BOOKING', 'REMINDER', 'WARNING', 'LEAVE', 'COMPLAINT', 'MENU', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('ROSTER', 'ATTENDANCE');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportRowOutcome" AS ENUM ('VALID', 'INVALID', 'DUPLICATE_IN_FILE', 'EXISTING_UNCHANGED', 'EXISTING_UPDATE');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "hostels" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_blocks" (
    "id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hostel_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "college_roster" (
    "id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "hostel_block_id" UUID,
    "room_number" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_import_job_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "college_roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "roster_entry_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "full_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "hostel_block_id" UUID,
    "room_number" TEXT,
    "phone" TEXT,
    "parent_phone" TEXT,
    "email" TEXT,
    "photo_key" TEXT,
    "onboarding_completed_at" TIMESTAMPTZ,
    "default_booking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_sessions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_reset_tickets" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "kind" "CredentialResetKind" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "invalidated_at" TIMESTAMPTZ,
    "issued_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_reset_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" UUID NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "service_start_minute" INTEGER NOT NULL,
    "service_end_minute" INTEGER NOT NULL,
    "attendance_grace_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_slots" (
    "id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "default_capacity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_weekday_capacities" (
    "slot_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "slot_weekday_capacities_pkey" PRIMARY KEY ("slot_id","weekday")
);

-- CreateTable
CREATE TABLE "slot_capacity_overrides" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "slot_capacity_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_policy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "allow_over_capacity_booking" BOOLEAN NOT NULL DEFAULT false,
    "default_slot_full_fallback" "SlotFullFallback" NOT NULL DEFAULT 'ASK_STUDENT',
    "leave_requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "complaint_privacy_mode" "ComplaintPrivacyMode" NOT NULL DEFAULT 'PRIVATE_IDENTIFIED',
    "no_show_window_days" INTEGER NOT NULL DEFAULT 30,
    "no_show_warning_threshold" INTEGER NOT NULL DEFAULT 3,
    "no_show_disable_threshold" INTEGER NOT NULL DEFAULT 5,
    "cancellation_cutoff_minutes" INTEGER NOT NULL DEFAULT 60,
    "booking_horizon_days" INTEGER NOT NULL DEFAULT 7,
    "diet_type_change_cutoff_minutes" INTEGER NOT NULL DEFAULT 60,
    "filling_fast_threshold_pct" INTEGER NOT NULL DEFAULT 80,
    "recommended_max_occupancy_pct" INTEGER NOT NULL DEFAULT 60,
    "forecast_lookback_days" INTEGER NOT NULL DEFAULT 14,
    "college_controlled_fields" TEXT[] DEFAULT ARRAY['fullName', 'department', 'academicYear']::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mess_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_policy_history" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mess_policy_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "meal_id" UUID NOT NULL,
    "status" "MenuStatus" NOT NULL DEFAULT 'DRAFT',
    "is_special" BOOLEAN NOT NULL DEFAULT false,
    "special_title" TEXT,
    "published_at" TIMESTAMPTZ,
    "content_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "diet_type" "DietType" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_closures" (
    "id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "kind" "ClosureKind" NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ClosureStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID NOT NULL,
    "removed_by_id" UUID,
    "removed_at" TIMESTAMPTZ,
    "removal_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mess_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_closure_meals" (
    "closure_id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,

    CONSTRAINT "mess_closure_meals_pkey" PRIMARY KEY ("closure_id","meal_id")
);

-- CreateTable
CREATE TABLE "meal_preferences" (
    "student_id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "slot_id" UUID,
    "diet_type" "DietType" NOT NULL DEFAULT 'VEG',
    "auto_disabled_at" TIMESTAMPTZ,
    "auto_disabled_by_event_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_preferences_pkey" PRIMARY KEY ("student_id","meal_id")
);

-- CreateTable
CREATE TABLE "weekday_rules" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "meal_id" UUID NOT NULL,
    "weekdays" INTEGER[],
    "slot_id" UUID NOT NULL,
    "diet_type" "DietType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weekday_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_exceptions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "meal_id" UUID NOT NULL,
    "action" "DateExceptionAction" NOT NULL,
    "slot_id" UUID,
    "diet_type" "DietType",
    "origin" "BookingSource" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "date_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "meal_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "diet_type" "DietType" NOT NULL,
    "source" "BookingSource" NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "is_over_capacity" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ,
    "last_actor_type" "ActorType" NOT NULL,
    "last_actor_staff_id" UUID,
    "last_override_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "type" "BookingEventType" NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus",
    "payload" JSONB,
    "actor_type" "ActorType" NOT NULL,
    "actor_staff_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "actor_key" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "start_meal_type" "MealType" NOT NULL,
    "end_date" DATE NOT NULL,
    "end_meal_type" "MealType" NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "created_by_staff_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_changes" (
    "id" UUID NOT NULL,
    "leave_id" UUID NOT NULL,
    "kind" "LeaveChangeKind" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_staff_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "booking_id" UUID,
    "student_id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "meal_id" UUID NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "verified_at" TIMESTAMPTZ,
    "recorded_at" TIMESTAMPTZ NOT NULL,
    "recorded_by_id" UUID,
    "import_job_id" UUID,
    "outage_window_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_outage_windows" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "reason" TEXT NOT NULL,
    "started_by_id" UUID NOT NULL,
    "ended_by_id" UUID,

    CONSTRAINT "attendance_outage_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "no_show_events" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "meal_date" DATE NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "status" "NoShowStatus" NOT NULL,
    "exclusion_cause" "NoShowExclusionCause",
    "excluded_by_id" UUID,
    "excluded_reason" TEXT,
    "excluded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_show_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "no_show_appeals" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ,
    "decision_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_show_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "reference_code" TEXT NOT NULL,
    "student_id" UUID,
    "hostel_block_id" UUID,
    "privacy_mode" "ComplaintPrivacyMode" NOT NULL,
    "submitter_token_hash" TEXT,
    "type" "ComplaintType" NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "meal_type" "MealType",
    "meal_date" DATE,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" UUID,
    "student_response" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_photos" (
    "id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_notes" (
    "id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_status_history" (
    "id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "from_status" "ComplaintStatus",
    "to_status" "ComplaintStatus" NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "dedupe_key" TEXT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "audience_type" "AnnouncementAudience" NOT NULL,
    "audience_filter" JSONB NOT NULL,
    "channels" "NotificationChannel"[],
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_for" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_deliveries" (
    "id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "delivered_at" TIMESTAMPTZ,

    CONSTRAINT "announcement_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "password_changed_at" TIMESTAMPTZ,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret_enc" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "staff_user_roles" (
    "staff_user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "staff_user_roles_pkey" PRIMARY KEY ("staff_user_id","role_id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_type" "ActorType" NOT NULL,
    "actor_roles" TEXT[],
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "context" JSONB,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_rows" (
    "id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "outcome" "ImportRowOutcome" NOT NULL,
    "errors" JSONB,

    CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job_name" TEXT NOT NULL,
    "run_key" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "error" TEXT,
    "stats" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hostels_name_key" ON "hostels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_blocks_hostel_id_name_key" ON "hostel_blocks"("hostel_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "college_roster_reference_number_key" ON "college_roster"("reference_number");

-- CreateIndex
CREATE INDEX "college_roster_hostel_block_id_idx" ON "college_roster"("hostel_block_id");

-- CreateIndex
CREATE INDEX "college_roster_department_academic_year_idx" ON "college_roster"("department", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "students_roster_entry_id_key" ON "students"("roster_entry_id");

-- CreateIndex
CREATE INDEX "students_hostel_block_id_status_idx" ON "students"("hostel_block_id", "status");

-- CreateIndex
CREATE INDEX "students_academic_year_idx" ON "students"("academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "student_sessions_token_hash_key" ON "student_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "student_sessions_student_id_revoked_at_idx" ON "student_sessions"("student_id", "revoked_at");

-- CreateIndex
CREATE INDEX "student_sessions_family_id_idx" ON "student_sessions"("family_id");

-- CreateIndex
CREATE INDEX "credential_reset_tickets_student_id_used_at_idx" ON "credential_reset_tickets"("student_id", "used_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_student_id_idx" ON "push_tokens"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "meals_meal_type_key" ON "meals"("meal_type");

-- CreateIndex
CREATE INDEX "meal_slots_meal_id_is_active_sort_order_idx" ON "meal_slots"("meal_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "slot_capacity_overrides_meal_date_idx" ON "slot_capacity_overrides"("meal_date");

-- CreateIndex
CREATE UNIQUE INDEX "slot_capacity_overrides_slot_id_meal_date_key" ON "slot_capacity_overrides"("slot_id", "meal_date");

-- CreateIndex
CREATE INDEX "mess_policy_history_created_at_idx" ON "mess_policy_history"("created_at");

-- CreateIndex
CREATE INDEX "menus_status_meal_date_idx" ON "menus"("status", "meal_date");

-- CreateIndex
CREATE UNIQUE INDEX "menus_meal_date_meal_id_key" ON "menus"("meal_date", "meal_id");

-- CreateIndex
CREATE INDEX "menu_items_menu_id_sort_order_idx" ON "menu_items"("menu_id", "sort_order");

-- CreateIndex
CREATE INDEX "mess_closures_meal_date_status_idx" ON "mess_closures"("meal_date", "status");

-- CreateIndex
CREATE INDEX "mess_closure_meals_meal_id_idx" ON "mess_closure_meals"("meal_id");

-- CreateIndex
CREATE INDEX "weekday_rules_student_id_meal_id_is_active_idx" ON "weekday_rules"("student_id", "meal_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "date_exceptions_student_id_meal_date_meal_id_key" ON "date_exceptions"("student_id", "meal_date", "meal_id");

-- CreateIndex
CREATE INDEX "bookings_meal_date_meal_id_slot_id_status_idx" ON "bookings"("meal_date", "meal_id", "slot_id", "status");

-- CreateIndex
CREATE INDEX "bookings_status_meal_date_idx" ON "bookings"("status", "meal_date");

-- CreateIndex
CREATE INDEX "bookings_student_id_meal_id_meal_date_idx" ON "bookings"("student_id", "meal_id", "meal_date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_student_id_meal_date_meal_id_key" ON "bookings"("student_id", "meal_date", "meal_id");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_events_type_created_at_idx" ON "booking_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_actor_key_key_key" ON "idempotency_keys"("actor_key", "key");

-- CreateIndex
CREATE INDEX "leaves_student_id_status_start_date_end_date_idx" ON "leaves"("student_id", "status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "leaves_status_start_date_idx" ON "leaves"("status", "start_date");

-- CreateIndex
CREATE INDEX "leave_changes_leave_id_created_at_idx" ON "leave_changes"("leave_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_booking_id_key" ON "attendance_records"("booking_id");

-- CreateIndex
CREATE INDEX "attendance_records_meal_date_meal_id_idx" ON "attendance_records"("meal_date", "meal_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_student_id_meal_date_meal_id_key" ON "attendance_records"("student_id", "meal_date", "meal_id");

-- CreateIndex
CREATE INDEX "attendance_outage_windows_started_at_ended_at_idx" ON "attendance_outage_windows"("started_at", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "no_show_events_booking_id_key" ON "no_show_events"("booking_id");

-- CreateIndex
CREATE INDEX "no_show_events_student_id_meal_type_status_meal_date_idx" ON "no_show_events"("student_id", "meal_type", "status", "meal_date");

-- CreateIndex
CREATE INDEX "no_show_events_status_meal_date_idx" ON "no_show_events"("status", "meal_date");

-- CreateIndex
CREATE INDEX "no_show_appeals_status_created_at_idx" ON "no_show_appeals"("status", "created_at");

-- CreateIndex
CREATE INDEX "no_show_appeals_event_id_idx" ON "no_show_appeals"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_reference_code_key" ON "complaints"("reference_code");

-- CreateIndex
CREATE INDEX "complaints_status_created_at_idx" ON "complaints"("status", "created_at");

-- CreateIndex
CREATE INDEX "complaints_category_meal_type_meal_date_idx" ON "complaints"("category", "meal_type", "meal_date");

-- CreateIndex
CREATE INDEX "complaints_student_id_created_at_idx" ON "complaints"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "complaints_hostel_block_id_idx" ON "complaints"("hostel_block_id");

-- CreateIndex
CREATE INDEX "complaint_photos_complaint_id_idx" ON "complaint_photos"("complaint_id");

-- CreateIndex
CREATE INDEX "complaint_notes_complaint_id_created_at_idx" ON "complaint_notes"("complaint_id", "created_at");

-- CreateIndex
CREATE INDEX "complaint_status_history_complaint_id_created_at_idx" ON "complaint_status_history"("complaint_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_student_id_read_at_created_at_idx" ON "notifications"("student_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "announcements_status_scheduled_for_idx" ON "announcements"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "announcement_deliveries_announcement_id_status_idx" ON "announcement_deliveries"("announcement_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_deliveries_announcement_id_student_id_channel_key" ON "announcement_deliveries"("announcement_id", "student_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE INDEX "role_permissions_permission_key_idx" ON "role_permissions"("permission_key");

-- CreateIndex
CREATE INDEX "staff_user_roles_role_id_idx" ON "staff_user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_user_id_revoked_at_idx" ON "staff_sessions"("staff_user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "staff_sessions_family_id_idx" ON "staff_sessions"("family_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "import_jobs_type_created_at_idx" ON "import_jobs"("type", "created_at");

-- CreateIndex
CREATE INDEX "import_job_rows_import_job_id_outcome_idx" ON "import_job_rows"("import_job_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "import_job_rows_import_job_id_row_number_key" ON "import_job_rows"("import_job_id", "row_number");

-- CreateIndex
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs"("job_name", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_job_name_run_key_key" ON "job_runs"("job_name", "run_key");

-- AddForeignKey
ALTER TABLE "hostel_blocks" ADD CONSTRAINT "hostel_blocks_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_roster" ADD CONSTRAINT "college_roster_hostel_block_id_fkey" FOREIGN KEY ("hostel_block_id") REFERENCES "hostel_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_roster" ADD CONSTRAINT "college_roster_last_import_job_id_fkey" FOREIGN KEY ("last_import_job_id") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_roster_entry_id_fkey" FOREIGN KEY ("roster_entry_id") REFERENCES "college_roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_hostel_block_id_fkey" FOREIGN KEY ("hostel_block_id") REFERENCES "hostel_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_reset_tickets" ADD CONSTRAINT "credential_reset_tickets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_reset_tickets" ADD CONSTRAINT "credential_reset_tickets_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_slots" ADD CONSTRAINT "meal_slots_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_weekday_capacities" ADD CONSTRAINT "slot_weekday_capacities_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_capacity_overrides" ADD CONSTRAINT "slot_capacity_overrides_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_capacity_overrides" ADD CONSTRAINT "slot_capacity_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_policy" ADD CONSTRAINT "mess_policy_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_policy_history" ADD CONSTRAINT "mess_policy_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_closures" ADD CONSTRAINT "mess_closures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_closures" ADD CONSTRAINT "mess_closures_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_closure_meals" ADD CONSTRAINT "mess_closure_meals_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "mess_closures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_closure_meals" ADD CONSTRAINT "mess_closure_meals_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_preferences" ADD CONSTRAINT "meal_preferences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_preferences" ADD CONSTRAINT "meal_preferences_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_preferences" ADD CONSTRAINT "meal_preferences_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_preferences" ADD CONSTRAINT "meal_preferences_auto_disabled_by_event_id_fkey" FOREIGN KEY ("auto_disabled_by_event_id") REFERENCES "no_show_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekday_rules" ADD CONSTRAINT "weekday_rules_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekday_rules" ADD CONSTRAINT "weekday_rules_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekday_rules" ADD CONSTRAINT "weekday_rules_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_exceptions" ADD CONSTRAINT "date_exceptions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_exceptions" ADD CONSTRAINT "date_exceptions_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_exceptions" ADD CONSTRAINT "date_exceptions_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_last_actor_staff_id_fkey" FOREIGN KEY ("last_actor_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_changes" ADD CONSTRAINT "leave_changes_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leaves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_outage_window_id_fkey" FOREIGN KEY ("outage_window_id") REFERENCES "attendance_outage_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_outage_windows" ADD CONSTRAINT "attendance_outage_windows_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_outage_windows" ADD CONSTRAINT "attendance_outage_windows_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_events" ADD CONSTRAINT "no_show_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_events" ADD CONSTRAINT "no_show_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_events" ADD CONSTRAINT "no_show_events_excluded_by_id_fkey" FOREIGN KEY ("excluded_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_appeals" ADD CONSTRAINT "no_show_appeals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "no_show_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_appeals" ADD CONSTRAINT "no_show_appeals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_appeals" ADD CONSTRAINT "no_show_appeals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_photos" ADD CONSTRAINT "complaint_photos_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_notes" ADD CONSTRAINT "complaint_notes_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_notes" ADD CONSTRAINT "complaint_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_deliveries" ADD CONSTRAINT "announcement_deliveries_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_deliveries" ADD CONSTRAINT "announcement_deliveries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
