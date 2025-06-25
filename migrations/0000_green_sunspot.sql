CREATE TABLE "consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"accessed_by" integer NOT NULL,
	"record_id" integer NOT NULL,
	"consent_granted_by" text NOT NULL,
	"accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_did" text,
	"patient_name" text NOT NULL,
	"national_id" text NOT NULL,
	"visit_date" text NOT NULL,
	"visit_type" text,
	"diagnosis" text NOT NULL,
	"prescription" text,
	"physician" text,
	"department" text,
	"submitted_by" integer NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"consent_given" boolean DEFAULT false,
	"ipfs_hash" text,
	"encryption_key" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"hospital_name" text NOT NULL,
	"hospital_type" text NOT NULL,
	"wallet_address" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_accessed_by_users_id_fk" FOREIGN KEY ("accessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_record_id_patient_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."patient_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;