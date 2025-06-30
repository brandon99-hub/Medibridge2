-- Create audit_events table
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" serial PRIMARY KEY,
  "event_type" text NOT NULL,
  "actor_type" text NOT NULL,
  "actor_id" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "action" text NOT NULL,
  "outcome" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "metadata" jsonb,
  "severity" text NOT NULL DEFAULT 'info',
  "created_at" timestamp DEFAULT now()
);

-- Create security_violations table
CREATE TABLE IF NOT EXISTS "security_violations" (
  "id" serial PRIMARY KEY,
  "violation_type" text NOT NULL,
  "severity" text NOT NULL,
  "actor_id" text,
  "target_resource" text,
  "details" jsonb,
  "ip_address" text,
  "user_agent" text,
  "resolved" boolean DEFAULT false,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now()
); 