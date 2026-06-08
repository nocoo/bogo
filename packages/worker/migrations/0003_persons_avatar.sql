-- Migration 0003: persons.avatar_url
--
-- Promotes avatar to a first-class column on the persons table. Optional
-- string holding either a remote URL or (in future) a relative R2 path.
-- Until a value is set, UI renders a deterministic letter avatar based on
-- the person's name.

PRAGMA foreign_keys = ON;

ALTER TABLE persons ADD COLUMN avatar_url TEXT;
