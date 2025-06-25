CREATE TABLE "patient_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_did" text NOT NULL,
	"national_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"email" text,
	"full_name" text NOT NULL,
	"is_profile_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "patient_profiles_patient_did_unique" UNIQUE("patient_did"),
	CONSTRAINT "patient_profiles_national_id_unique" UNIQUE("national_id"),
	CONSTRAINT "patient_profiles_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
ALTER TABLE "patient_records" ADD COLUMN "record_type" text DEFAULT 'traditional';