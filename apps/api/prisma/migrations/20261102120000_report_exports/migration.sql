-- CreateEnum
CREATE TYPE "ReportExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "ReportExportStatus" NOT NULL DEFAULT 'QUEUED',
    "format" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "file_key" TEXT,
    "file_name" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_exports_status_created_at_idx" ON "report_exports"("status", "created_at");

-- CreateIndex
CREATE INDEX "report_exports_requested_by_id_created_at_idx" ON "report_exports"("requested_by_id", "created_at");

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
