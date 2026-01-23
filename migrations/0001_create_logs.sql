-- Create logs table for Project Echo
-- This replaces the JSONL file storage

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  is_private INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Index for faster ordering by date
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
