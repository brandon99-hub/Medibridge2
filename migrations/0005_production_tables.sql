-- Migration: Add Production Tables for Emergency Consent and Hospital Staff
-- This migration adds the necessary tables for production-ready emergency consent functionality

-- Hospital staff table for emergency consent verification
CREATE TABLE IF NOT EXISTS "hospital_staff" (
    "id" serial PRIMARY KEY,
    "staff_id" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "role" text NOT NULL,
    "license_number" text NOT NULL,
    "department" text NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "is_on_duty" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Patient emergency contacts table
CREATE TABLE IF NOT EXISTS "patient_emergency_contacts" (
    "id" serial PRIMARY KEY,
    "patient_id" text NOT NULL,
    "name" text NOT NULL,
    "relationship" text NOT NULL,
    "phone_number" text NOT NULL,
    "email" text,
    "is_verified" boolean NOT NULL DEFAULT false,
    "is_primary" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Emergency consent records table (updated schema)
CREATE TABLE IF NOT EXISTS "emergency_consent_records" (
    "id" serial PRIMARY KEY,
    "patient_id" text NOT NULL,
    "emergency_type" text NOT NULL,
    "medical_justification" text NOT NULL,
    "primary_physician_id" text NOT NULL,
    "secondary_authorizer_id" text NOT NULL,
    "next_of_kin_involved" boolean DEFAULT false,
    "next_of_kin_consent" boolean DEFAULT false,
    "granted_at" timestamp DEFAULT now(),
    "expires_at" timestamp NOT NULL,
    "hospital_id" text NOT NULL,
    "limitations" jsonb,
    "audit_trail" text
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "hospital_staff_staff_id_idx" ON "hospital_staff" ("staff_id");
CREATE INDEX IF NOT EXISTS "hospital_staff_active_duty_idx" ON "hospital_staff" ("is_active", "is_on_duty");
CREATE INDEX IF NOT EXISTS "patient_emergency_contacts_patient_id_idx" ON "patient_emergency_contacts" ("patient_id");
CREATE INDEX IF NOT EXISTS "patient_emergency_contacts_verified_idx" ON "patient_emergency_contacts" ("patient_id", "is_verified");
CREATE INDEX IF NOT EXISTS "emergency_consent_records_patient_id_idx" ON "emergency_consent_records" ("patient_id");
CREATE INDEX IF NOT EXISTS "emergency_consent_records_expires_at_idx" ON "emergency_consent_records" ("expires_at");

-- Insert sample hospital staff data for testing
INSERT INTO "hospital_staff" ("staff_id", "name", "role", "license_number", "department", "is_active", "is_on_duty") VALUES
('DR001', 'Dr. Sarah Johnson', 'PHYSICIAN', 'MD123456', 'Emergency Medicine', true, true),
('DR002', 'Dr. Michael Chen', 'SURGEON', 'MD789012', 'Cardiovascular Surgery', true, true),
('DR003', 'Dr. Emily Rodriguez', 'EMERGENCY_DOCTOR', 'MD345678', 'Emergency Medicine', true, true),
('DR004', 'Dr. James Wilson', 'CHIEF_RESIDENT', 'MD901234', 'Internal Medicine', true, true),
('DR005', 'Dr. Lisa Thompson', 'PHYSICIAN', 'MD567890', 'Pediatrics', true, false);

-- Insert sample patient emergency contacts for testing
INSERT INTO "patient_emergency_contacts" ("patient_id", "name", "relationship", "phone_number", "email", "is_verified", "is_primary") VALUES
('patient_001', 'John Smith', 'Spouse', '+1234567890', 'john.smith@email.com', true, true),
('patient_001', 'Mary Smith', 'Daughter', '+1234567891', 'mary.smith@email.com', true, false),
('patient_002', 'Robert Johnson', 'Son', '+1234567892', 'robert.johnson@email.com', true, true),
('patient_003', 'Susan Davis', 'Sister', '+1234567893', 'susan.davis@email.com', false, true);

-- Add comments for documentation
COMMENT ON TABLE "hospital_staff" IS 'Hospital staff members authorized for emergency consent';
COMMENT ON TABLE "patient_emergency_contacts" IS 'Patient emergency contacts for consent verification';
COMMENT ON TABLE "emergency_consent_records" IS 'Records of emergency consent granted when patient cannot provide consent';

COMMENT ON COLUMN "hospital_staff"."role" IS 'Staff role: PHYSICIAN, SURGEON, EMERGENCY_DOCTOR, CHIEF_RESIDENT';
COMMENT ON COLUMN "hospital_staff"."is_active" IS 'Whether the staff member is currently active';
COMMENT ON COLUMN "hospital_staff"."is_on_duty" IS 'Whether the staff member is currently on duty';

COMMENT ON COLUMN "patient_emergency_contacts"."is_verified" IS 'Whether the emergency contact has been verified';
COMMENT ON COLUMN "patient_emergency_contacts"."is_primary" IS 'Whether this is the primary emergency contact';

COMMENT ON COLUMN "emergency_consent_records"."emergency_type" IS 'Type of emergency: LIFE_THREATENING, UNCONSCIOUS_PATIENT, CRITICAL_CARE, SURGERY_REQUIRED, MENTAL_HEALTH_CRISIS';
COMMENT ON COLUMN "emergency_consent_records"."limitations" IS 'JSON array of access limitations for this emergency consent'; 