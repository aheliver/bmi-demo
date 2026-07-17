-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('kg', 'lb');

-- CreateEnum
CREATE TYPE "HeightUnit" AS ENUM ('cm', 'in');

-- CreateTable
CREATE TABLE "participant" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "weight_value" DECIMAL(7,3) NOT NULL,
    "weight_unit" "WeightUnit" NOT NULL,
    "height_value" DECIMAL(6,2) NOT NULL,
    "height_unit" "HeightUnit" NOT NULL,
    "bmi" DECIMAL(4,1) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" SERIAL NOT NULL,
    "participant_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "participant_bmi_idx" ON "participant"("bmi");

-- CreateIndex
CREATE INDEX "participant_created_at_idx" ON "participant"("created_at");

-- CreateIndex
CREATE INDEX "participant_deleted_at_idx" ON "participant"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "contact_participant_id_key" ON "contact"("participant_id");

-- CreateIndex
CREATE INDEX "contact_participant_id_idx" ON "contact"("participant_id");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
