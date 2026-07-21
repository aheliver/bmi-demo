-- Case-insensitive, stored generated column for name sorting (indexed).
ALTER TABLE "participant"
  ADD COLUMN "full_name" text NOT NULL
  GENERATED ALWAYS AS (lower((first_name || ' '::text) || last_name)) STORED;

CREATE INDEX "participant_full_name_idx" ON "participant"("full_name");
