-- Page JSON version 2 (phase 16) adds optional animation and timing fields; version 1 content is
-- already valid version 2 content, so only the number changes.
UPDATE "Page" SET "schemaVersion" = 2 WHERE "schemaVersion" = 1;
