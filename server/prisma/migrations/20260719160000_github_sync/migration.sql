-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "externalKey" TEXT,
ADD COLUMN     "externalMeta" JSONB,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "pollMinutes" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "statusMessage" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "etag" TEXT,
    "columnsCache" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connections_canvasId_idx" ON "connections"("canvasId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_externalKey_key" ON "tasks"("externalKey");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

