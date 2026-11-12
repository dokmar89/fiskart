-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('px', 'mm', 'in');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('image', 'svg', 'font');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "unit" "Unit" NOT NULL DEFAULT 'px',
    "thumbnailPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "canvasData" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "tags" TEXT[],
    "thumbnailPath" TEXT,
    "pages" JSONB NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colors" TEXT[],
    "logoAssetIds" TEXT[],
    "fonts" JSONB NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Page_projectId_order_idx" ON "Page"("projectId", "order");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
