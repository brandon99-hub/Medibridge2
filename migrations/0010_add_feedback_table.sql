-- Add feedback table for ZK-MedPass airtime rewards
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  airtime_sent BOOLEAN DEFAULT FALSE,
  airtime_amount INTEGER DEFAULT 0
);

-- Add index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_feedback_phone_number ON feedback(phone_number);

-- Add index for airtime tracking
CREATE INDEX IF NOT EXISTS idx_feedback_airtime_sent ON feedback(airtime_sent); 