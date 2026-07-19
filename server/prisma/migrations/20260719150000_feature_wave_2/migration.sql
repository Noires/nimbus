-- AlterTable
ALTER TABLE "canvases" ADD COLUMN     "captureToken" TEXT,
ADD COLUMN     "icsToken" TEXT,
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "viewpoints" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "actualMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "hue" INTEGER NOT NULL DEFAULT 200,
    "autoTag" TEXT,
    "z" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zones_canvasId_idx" ON "zones"("canvasId");

-- CreateIndex
CREATE UNIQUE INDEX "canvases_shareToken_key" ON "canvases"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "canvases_icsToken_key" ON "canvases"("icsToken");

-- CreateIndex
CREATE UNIQUE INDEX "canvases_captureToken_key" ON "canvases"("captureToken");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

