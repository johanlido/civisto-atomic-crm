-- ============================================================================
-- REPORTS TICKETING TABLE
-- Purpose: Civisto indoor/outdoor reports as tickets in atomic-crm Kanban
-- This table mirrors key fields from the Civisto reports schema so that
-- the CRM can act as a ticketing system for report triage and management.
-- For the demo/pilot phase, data is seeded directly. In production,
-- reports will be synced from the Civisto Supabase instance or both apps
-- will share the same database.
-- ============================================================================

-- Create the reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core report fields
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(100),
  report_type VARCHAR(20) DEFAULT 'indoor' CHECK (report_type IN ('indoor', 'outdoor')),

  -- Workflow / Kanban status
  workflow_status VARCHAR(30) DEFAULT 'new'
    CHECK (workflow_status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  index INTEGER DEFAULT 0,

  -- Location context
  entity_name TEXT,           -- Room name, asset name, or outdoor location
  location_description TEXT,  -- Address or detailed location

  -- Customer / tenant context
  customer_id UUID,           -- FK to companies table (optional, for linking to CRM company)
  customer_name TEXT,         -- Denormalized for display

  -- Reporter info
  reporter_name TEXT,
  reporter_email TEXT,

  -- AI classification (from Civisto AI triage)
  ai_suggested_category TEXT,
  ai_category_confidence DECIMAL(3,2),

  -- Images (stored as JSON array of URLs)
  images JSONB DEFAULT '[]'::jsonb,

  -- Civisto cross-reference
  civisto_report_id UUID,     -- Original report ID in Civisto database
  civisto_sync_status VARCHAR(20) DEFAULT 'local'
    CHECK (civisto_sync_status IN ('local', 'synced', 'pending')),

  -- Archival support (consistent with deals pattern)
  archived_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional FK to companies table
  CONSTRAINT fk_reports_company
    FOREIGN KEY (customer_id) REFERENCES companies(id)
    ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_workflow_status ON reports(workflow_status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_customer_id ON reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_civisto_report_id ON reports(civisto_report_id);
CREATE INDEX IF NOT EXISTS idx_reports_archived_at ON reports(archived_at) WHERE archived_at IS NULL;

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: For the CRM, all authenticated users can manage reports
-- (In production, this would be scoped to customer_id or sales team)
CREATE POLICY "Authenticated users can view reports"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete reports"
  ON reports FOR DELETE
  TO authenticated
  USING (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at_trigger
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- ============================================================================
-- DEMO / SEED DATA
-- Realistic indoor hotel reports for demonstration purposes
-- ============================================================================

INSERT INTO reports (title, description, category, report_type, workflow_status, priority, entity_name, location_description, customer_name, reporter_name, ai_suggested_category, ai_category_confidence, index) VALUES
  -- New tickets
  ('Broken AC unit in Room 205', 'The air conditioning unit is making a loud rattling noise and not cooling properly. Temperature in the room is 28°C despite being set to 21°C.', 'HVAC', 'indoor', 'new', 'high', 'Room 205', 'Grand Hotel Stockholm, Floor 2', 'Grand Hotel Stockholm', 'Maria Andersson', 'HVAC', 0.95, 0),
  ('Water leak under bathroom sink', 'Slow drip from the pipe connection under the bathroom sink in Room 412. Small puddle forming on the floor.', 'Plumbing', 'indoor', 'new', 'medium', 'Room 412 - Bathroom', 'Grand Hotel Stockholm, Floor 4', 'Grand Hotel Stockholm', 'Erik Johansson', 'Plumbing', 0.92, 1),
  ('WiFi not working in Conference Room B', 'No internet connectivity in Conference Room B. Multiple guests have reported the issue. Access point may need restart.', 'IT / Network', 'indoor', 'new', 'high', 'Conference Room B', 'Grand Hotel Stockholm, Floor 1', 'Grand Hotel Stockholm', 'Lars Svensson', 'IT / Network', 0.88, 2),
  ('Pothole on Storgatan entrance', 'Large pothole approximately 30cm wide near the main entrance on Storgatan. Risk of tripping for pedestrians.', 'Outdoor', 'outdoor', 'new', 'critical', NULL, 'Storgatan 15, Stockholm', 'Stockholms Stad', 'Anonymous', 'Road Issues', 0.91, 3),

  -- Acknowledged tickets
  ('Flickering lights in lobby chandelier', 'The main chandelier in the hotel lobby has 3 bulbs flickering intermittently. Creates an unpleasant atmosphere for guests.', 'Electrical', 'indoor', 'acknowledged', 'medium', 'Main Lobby', 'Grand Hotel Stockholm, Ground Floor', 'Grand Hotel Stockholm', 'Anna Lindqvist', 'Electrical', 0.97, 0),
  ('Elevator button not responding on Floor 3', 'The call button for the main elevator on Floor 3 does not light up when pressed. Elevator still stops but button gives no feedback.', 'Elevator', 'indoor', 'acknowledged', 'medium', 'Main Elevator - Floor 3', 'Grand Hotel Stockholm, Floor 3', 'Grand Hotel Stockholm', 'Johan Bergström', 'Mechanical', 0.78, 1),

  -- In Progress tickets
  ('Clogged drain in Room 301 shower', 'Shower drain in Room 301 is severely clogged. Water backs up within 2 minutes of running. Guest has been moved to Room 305.', 'Plumbing', 'indoor', 'in_progress', 'high', 'Room 301 - Shower', 'Grand Hotel Stockholm, Floor 3', 'Grand Hotel Stockholm', 'Karin Nilsson', 'Plumbing', 0.96, 0),
  ('Broken window latch in Room 508', 'The window latch mechanism is broken, window cannot be securely closed. Security concern as room is on ground-accessible floor.', 'Structural', 'indoor', 'in_progress', 'critical', 'Room 508', 'Grand Hotel Stockholm, Floor 5', 'Grand Hotel Stockholm', 'Per Olsson', 'Structural', 0.85, 1),
  ('Graffiti on building facade', 'Large graffiti tag sprayed on the south-facing wall of the building. Approximately 2m x 1m in size.', 'Outdoor', 'outdoor', 'in_progress', 'low', NULL, 'Kungsgatan 22, Stockholm', 'Stockholms Stad', 'Sofia Ek', 'Graffiti & Vandalism', 0.94, 2),

  -- Resolved tickets
  ('Smoke detector beeping in Room 102', 'Smoke detector in Room 102 emitting intermittent beeping sound, likely low battery. Guest reported at 23:00.', 'Safety', 'indoor', 'resolved', 'critical', 'Room 102', 'Grand Hotel Stockholm, Floor 1', 'Grand Hotel Stockholm', 'Gustav Holm', 'Safety', 0.99, 0),
  ('Parking garage gate malfunction', 'The automatic gate in the underground parking garage is not opening with the key card. Manual override needed.', 'Parking', 'indoor', 'resolved', 'medium', 'Underground Parking - Gate A', 'Grand Hotel Stockholm, Basement', 'Grand Hotel Stockholm', 'Ingrid Dahl', 'Mechanical', 0.82, 1),

  -- Closed tickets
  ('Broken street light on Vasagatan', 'Street light #47 on Vasagatan has been out for 3 days. Dark stretch of sidewalk creates safety concern.', 'Outdoor', 'outdoor', 'closed', 'medium', NULL, 'Vasagatan 47, Stockholm', 'Stockholms Stad', 'Anonymous', 'Street Lighting', 0.93, 0);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE reports IS 'Civisto reports displayed as tickets in the CRM Kanban board. Supports both indoor (QR-code) and outdoor (GPS) reports.';
COMMENT ON COLUMN reports.workflow_status IS 'Kanban column: new | acknowledged | in_progress | resolved | closed';
COMMENT ON COLUMN reports.civisto_report_id IS 'Cross-reference to the original report in the Civisto database';
COMMENT ON COLUMN reports.civisto_sync_status IS 'Sync status: local (created in CRM), synced (from Civisto), pending (awaiting sync)';
COMMENT ON COLUMN reports.entity_name IS 'For indoor: room/asset name. For outdoor: NULL (location in location_description)';
COMMENT ON COLUMN reports.customer_id IS 'Optional FK to companies table for linking reports to CRM customers';
