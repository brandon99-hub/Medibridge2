-- Migration: Add Hospital Staff Invitation System
-- This migration adds support for email invitations and temporary credentials

-- Add email and invitation fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited_by" INTEGER REFERENCES "users"("id");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invitation_expires_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_invitation_active" BOOLEAN DEFAULT FALSE;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

-- Add index for invitation tracking
CREATE INDEX IF NOT EXISTS "users_invitation_expires_idx" ON "users" ("invitation_expires_at", "is_invitation_active");

-- Add constraint to ensure email is unique when not null
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email") WHERE "email" IS NOT NULL;

-- Add check constraint for invitation expiry
ALTER TABLE "users" ADD CONSTRAINT "users_invitation_expiry_check" 
  CHECK ("invitation_expires_at" IS NULL OR "invitation_expires_at" > "created_at");

-- Create hospital staff invitations table for tracking
CREATE TABLE IF NOT EXISTS "hospital_staff_invitations" (
    "id" serial PRIMARY KEY,
    "email" text NOT NULL,
    "hospital_id" integer NOT NULL REFERENCES "users"("id"),
    "invited_by" integer NOT NULL REFERENCES "users"("id"),
    "role" text NOT NULL,
    "department" text NOT NULL,
    "invitation_token" text NOT NULL UNIQUE,
    "status" text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "accepted_at" timestamp,
    "accepted_user_id" integer REFERENCES "users"("id")
);

-- Add indexes for invitation tracking
CREATE INDEX IF NOT EXISTS "hospital_staff_invitations_email_idx" ON "hospital_staff_invitations" ("email");
CREATE INDEX IF NOT EXISTS "hospital_staff_invitations_hospital_id_idx" ON "hospital_staff_invitations" ("hospital_id");
CREATE INDEX IF NOT EXISTS "hospital_staff_invitations_token_idx" ON "hospital_staff_invitations" ("invitation_token");
CREATE INDEX IF NOT EXISTS "hospital_staff_invitations_status_idx" ON "hospital_staff_invitations" ("status", "expires_at");

-- Add constraint for invitation status
ALTER TABLE "hospital_staff_invitations" ADD CONSTRAINT "hospital_staff_invitations_status_check" 
  CHECK ("status" IN ('pending', 'accepted', 'expired', 'cancelled'));

-- Add constraint for invitation expiry
ALTER TABLE "hospital_staff_invitations" ADD CONSTRAINT "hospital_staff_invitations_expiry_check" 
  CHECK ("expires_at" > "created_at"); 