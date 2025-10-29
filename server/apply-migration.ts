import { db } from "./db";

async function applyMigration() {
  try {
    console.log("Applying database migration...");
    
    // Create patient_profiles table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "patient_profiles" (
        "id" serial PRIMARY KEY NOT NULL,
        "patient_did" text NOT NULL,
        "national_id" text NOT NULL,
        "national_id_hash" text,
        "phone_number" text NOT NULL,
        "phone_number_hash" text,
        "email" text,
        "full_name" text NOT NULL,
        "is_profile_complete" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "patient_profiles_patient_did_unique" UNIQUE("patient_did"),
        CONSTRAINT "patient_profiles_national_id_unique" UNIQUE("national_id"),
        CONSTRAINT "patient_profiles_phone_number_unique" UNIQUE("phone_number")
      );
    `);
    
    // Add record_type column to patient_records if it doesn't exist
    await db.execute(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'patient_records' 
          AND column_name = 'record_type'
        ) THEN
          ALTER TABLE "patient_records" ADD COLUMN "record_type" text DEFAULT 'traditional';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'patient_records' 
          AND column_name = 'national_id_hash'
        ) THEN
          ALTER TABLE "patient_records" ADD COLUMN "national_id_hash" text;
        END IF;
      END $$;
    `);
    
    // Make patient_did nullable in patient_records if it's not already
    await db.execute(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'patient_records' 
          AND column_name = 'patient_did'
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE "patient_records" ALTER COLUMN "patient_did" DROP NOT NULL;
        END IF;
      END $$;
    `);
    
    // Add hash columns to existing patient_profiles if missing
    await db.execute(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'patient_profiles'
          AND column_name = 'national_id_hash'
        ) THEN
          ALTER TABLE "patient_profiles" ADD COLUMN "national_id_hash" text;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'patient_profiles'
          AND column_name = 'phone_number_hash'
        ) THEN
          ALTER TABLE "patient_profiles" ADD COLUMN "phone_number_hash" text;
        END IF;
      END $$;
    `);
    
    console.log("Migration applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

applyMigration(); 