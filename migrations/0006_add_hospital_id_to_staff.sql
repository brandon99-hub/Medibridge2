CREATE TABLE "filecoin_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"patient_did" text NOT NULL,
	"storage_provider" text NOT NULL,
	"deal_size" integer NOT NULL,
	"deal_cost" numeric(20, 8) NOT NULL,
	"deal_duration" integer NOT NULL,
	"deal_status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "filecoin_deals_deal_id_unique" UNIQUE("deal_id")
);
--> statement-breakpoint
CREATE TABLE "hospital_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"license_number" text NOT NULL,
	"department" text NOT NULL,
	"admin_license" text NOT NULL,
	"hospital_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_on_duty" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hospital_staff_staff_id_unique" UNIQUE("staff_id")
);
--> statement-breakpoint
CREATE TABLE "patient_emergency_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"phone_number" text NOT NULL,
	"email" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "storage_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_did" text NOT NULL,
	"storage_type" text NOT NULL,
	"cost_amount" numeric(20, 8) NOT NULL,
	"cost_currency" text DEFAULT 'FIL' NOT NULL,
	"billing_period" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "storage_health_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"storage_type" text NOT NULL,
	"health_status" text NOT NULL,
	"response_time_ms" integer,
	"availability_percentage" numeric(5, 2),
	"last_check_at" timestamp DEFAULT now(),
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "storage_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"storage_type" text NOT NULL,
	"location_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_verified" timestamp
);
--> statement-breakpoint
CREATE TABLE "zkp_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_did" text NOT NULL,
	"proof_type" text NOT NULL,
	"public_statement" text NOT NULL,
	"secret_data" text NOT NULL,
	"proof_data" jsonb NOT NULL,
	"challenge" text NOT NULL,
	"verified_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"verification_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zkp_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"proof_id" integer NOT NULL,
	"verified_by" integer NOT NULL,
	"verification_result" boolean NOT NULL,
	"verification_context" text,
	"verified_at" timestamp DEFAULT now(),
	"hospital_id" text NOT NULL,
	"emergency_access" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emergency_consent_records" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "emergency_consent_records" ALTER COLUMN "granted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_records" ADD COLUMN "consent_type" text DEFAULT 'traditional' NOT NULL;--> statement-breakpoint
ALTER TABLE "emergency_consent_records" ADD COLUMN "primary_physician_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "emergency_consent_records" ADD COLUMN "secondary_authorizer_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "emergency_consent_records" ADD COLUMN "next_of_kin_involved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "emergency_consent_records" ADD COLUMN "next_of_kin_consent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "patient_records" ADD COLUMN "filecoin_cid" text;--> statement-breakpoint
ALTER TABLE "patient_records" ADD COLUMN "storage_cost" numeric(20, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "patient_records" ADD COLUMN "storage_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "zkp_verifications" ADD CONSTRAINT "zkp_verifications_proof_id_zkp_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."zkp_proofs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zkp_verifications" ADD CONSTRAINT "zkp_verifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_consent_records" DROP COLUMN "primary_physician_details";--> statement-breakpoint
ALTER TABLE "emergency_consent_records" DROP COLUMN "secondary_authorizer_details";--> statement-breakpoint
ALTER TABLE "emergency_consent_records" DROP COLUMN "next_of_kin_consent_details";--> statement-breakpoint
ALTER TABLE "emergency_consent_records" DROP COLUMN "temporary_credential_details";--> statement-breakpoint
ALTER TABLE "emergency_consent_records" DROP COLUMN "revoked_at";