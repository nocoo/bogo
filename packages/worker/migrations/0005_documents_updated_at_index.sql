-- 0005_documents_updated_at_index.sql
-- Covering index for the documents list query, which sorts by
-- ORDER BY updated_at DESC, id DESC after filtering by workspace_id.
-- Without this, SQLite falls back to a temporary B-tree sort on every
-- request. The trailing `id DESC` matches the tie-break the API uses so
-- the same rows come back in the same order across identical requests
-- (see routes/documents.ts). We intentionally leave the existing
-- idx_documents_event_date in place — event_date is still selected and
-- may be surfaced by future filters.

CREATE INDEX IF NOT EXISTS idx_documents_workspace_updated
  ON documents(workspace_id, updated_at DESC, id DESC);
