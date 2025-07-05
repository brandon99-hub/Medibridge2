-- Add hospital_id to audit_events and security_violations for multi-tenancy
ALTER TABLE audit_events ADD COLUMN hospital_id INTEGER;
ALTER TABLE security_violations ADD COLUMN hospital_id INTEGER;
-- Optionally, backfill hospital_id for existing rows if possible (not done here) 