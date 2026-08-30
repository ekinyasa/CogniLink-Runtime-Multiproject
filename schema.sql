CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  slug TEXT,
  campaign TEXT,
  source TEXT,
  product TEXT,
  intent TEXT,
  situation TEXT,
  contact_preference TEXT,
  phone TEXT,
  email TEXT,
  landing_version TEXT,
  original_payload_json TEXT NOT NULL,
  working_payload_json TEXT NOT NULL,
  visitor_id TEXT
);
