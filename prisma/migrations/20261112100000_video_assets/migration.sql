-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'video';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "posterPath" TEXT;
