-- Fonts were never written by the app before this migration, so the JSON column is replaced.
ALTER TABLE "BrandKit" DROP COLUMN "fonts",
ADD COLUMN     "fonts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "colors" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "logoAssetIds" SET DEFAULT ARRAY[]::TEXT[];
