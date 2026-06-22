-- Migration 0004: api_tokens
--
-- Storage for bearer tokens minted by /api/auth/cli for the bogo CLI
-- (see docs/features/02-cli.md §4.1). The plaintext token is returned to
-- the user exactly once during the loopback callback and is never
-- persisted; only sha256(plaintext).hex is stored as `token_hash`. The
-- `prefix` column keeps the first 12 chars of the plaintext for display
-- in `auth show` / logs without exposing the full token. `expires_at`
-- and `revoked_at` are NULL by default; v1 revocation is a manual D1
-- UPDATE (`SET revoked_at = datetime('now')`).

PRAGMA foreign_keys = ON;

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'cli-login',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX idx_api_tokens_owner ON api_tokens(owner_email);
CREATE INDEX idx_api_tokens_hash  ON api_tokens(token_hash);
