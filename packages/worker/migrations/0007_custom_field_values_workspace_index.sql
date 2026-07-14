-- 0007_custom_field_values_workspace_index.sql
-- Covering index for the workspace-wide bulk read used by the org
-- chart: GET /api/w/:wid/fields/values. Without this, the query
-- `SELECT ... WHERE workspace_id = ?` falls back to a full-table SCAN
-- and touches every workspace's rows. Ordering by person_id inside the
-- workspace also helps the UI's group-by-person aggregation stay hot.
-- The pre-existing idx_cfv_person still serves the single-person read
-- path (GET /values/:personId), which keys on person_id first.

CREATE INDEX IF NOT EXISTS idx_cfv_workspace_person
  ON custom_field_values(workspace_id, person_id);
