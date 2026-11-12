-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "unit" "Unit" NOT NULL DEFAULT 'px',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");

