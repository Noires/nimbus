-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "estimateMinutes" INTEGER,
ADD COLUMN     "inbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "recurrence" TEXT,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependencies" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,

    CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bubbles" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "hue" INTEGER,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bubbles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bubble',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portals" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "targetCanvasId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "portals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_items_taskId_idx" ON "checklist_items"("taskId");

-- CreateIndex
CREATE INDEX "dependencies_blockedId_idx" ON "dependencies"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "dependencies_blockerId_blockedId_key" ON "dependencies"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "bubbles_canvasId_idx" ON "bubbles"("canvasId");

-- CreateIndex
CREATE INDEX "portals_canvasId_idx" ON "portals"("canvasId");

-- CreateIndex
CREATE INDEX "task_events_canvasId_createdAt_idx" ON "task_events"("canvasId", "createdAt");

-- CreateIndex
CREATE INDEX "task_events_taskId_idx" ON "task_events"("taskId");

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bubbles" ADD CONSTRAINT "bubbles_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portals" ADD CONSTRAINT "portals_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portals" ADD CONSTRAINT "portals_targetCanvasId_fkey" FOREIGN KEY ("targetCanvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
