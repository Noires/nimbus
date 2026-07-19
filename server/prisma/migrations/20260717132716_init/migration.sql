-- CreateTable
CREATE TABLE "canvases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "z" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvases_createdAt_idx" ON "canvases"("createdAt");

-- CreateIndex
CREATE INDEX "tasks_canvasId_idx" ON "tasks"("canvasId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
