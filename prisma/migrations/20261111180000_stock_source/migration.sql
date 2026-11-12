-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_sourceKey_key" ON "Asset"("sourceKey");
