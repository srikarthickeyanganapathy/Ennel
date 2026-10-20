-- AlterTable
ALTER TABLE "college_roster" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "published_items" JSONB;
