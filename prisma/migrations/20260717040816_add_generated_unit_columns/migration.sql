ALTER TABLE "participant"
  ADD COLUMN "weight_kg" numeric(9,4) GENERATED ALWAYS AS (
    CASE "weight_unit" WHEN 'kg' THEN "weight_value" ELSE "weight_value" * 0.45359237 END
  ) STORED,
  ADD COLUMN "weight_lb" numeric(9,4) GENERATED ALWAYS AS (
    CASE "weight_unit" WHEN 'lb' THEN "weight_value" ELSE "weight_value" / 0.45359237 END
  ) STORED,
  ADD COLUMN "height_cm" numeric(6,2) GENERATED ALWAYS AS (
    CASE "height_unit" WHEN 'cm' THEN "height_value" ELSE "height_value" * 2.54 END
  ) STORED,
  ADD COLUMN "height_in" numeric(6,2) GENERATED ALWAYS AS (
    CASE "height_unit" WHEN 'in' THEN "height_value" ELSE "height_value" / 2.54 END
  ) STORED;
