-- Migration: Add Filecoin Integration Tables
-- This migration adds tables to track Filecoin storage deals, costs, and metadata

-- Filecoin deals table to track storage deals
CREATE TABLE filecoin_deals (
  id SERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  patient_did TEXT NOT NULL,
  storage_provider TEXT NOT NULL,
  deal_size BIGINT NOT NULL,
  deal_cost DECIMAL(20,8) NOT NULL,
  deal_duration INTEGER NOT NULL, -- in epochs
  deal_status TEXT NOT NULL CHECK (deal_status IN ('active', 'expired', 'terminated')),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Enhanced storage tracking table
CREATE TABLE storage_locations (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('ipfs', 'filecoin', 'local')),
  location_id TEXT NOT NULL, -- CID, Deal ID, or local path
  status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  last_verified TIMESTAMP
);

-- Storage costs tracking table
CREATE TABLE storage_costs (
  id SERIAL PRIMARY KEY,
  patient_did TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  cost_amount DECIMAL(20,8) NOT NULL,
  cost_currency TEXT NOT NULL DEFAULT 'FIL',
  billing_period TEXT NOT NULL, -- 'monthly', 'yearly', 'one_time'
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Storage health metrics table
CREATE TABLE storage_health_metrics (
  id SERIAL PRIMARY KEY,
  storage_type TEXT NOT NULL,
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'degraded', 'critical')),
  response_time_ms INTEGER,
  availability_percentage DECIMAL(5,2),
  last_check_at TIMESTAMP DEFAULT NOW(),
  details JSONB
);

-- Indexes for performance
CREATE INDEX idx_filecoin_deals_patient_did ON filecoin_deals(patient_did);
CREATE INDEX idx_filecoin_deals_status ON filecoin_deals(deal_status);
CREATE INDEX idx_filecoin_deals_expires_at ON filecoin_deals(expires_at);
CREATE INDEX idx_storage_locations_content_hash ON storage_locations(content_hash);
CREATE INDEX idx_storage_locations_storage_type ON storage_locations(storage_type);
CREATE INDEX idx_storage_costs_patient_did ON storage_costs(patient_did);
CREATE INDEX idx_storage_health_metrics_storage_type ON storage_health_metrics(storage_type);

-- Add filecoin_cid column to existing patient_records table
ALTER TABLE patient_records ADD COLUMN filecoin_cid TEXT;
CREATE INDEX idx_patient_records_filecoin_cid ON patient_records(filecoin_cid);

-- Add storage_cost column to existing patient_records table
ALTER TABLE patient_records ADD COLUMN storage_cost DECIMAL(20,8) DEFAULT 0;

-- Add storage_metadata column to existing patient_records table
ALTER TABLE patient_records ADD COLUMN storage_metadata JSONB; 