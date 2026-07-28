-- CreateTable
CREATE TABLE "workstreams" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstreams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_workstreams" (
    "taskId" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workstreams_pkey" PRIMARY KEY ("taskId", "workstreamId")
);

-- CreateIndex
CREATE INDEX "workstreams_canvasId_createdAt_idx" ON "workstreams"("canvasId", "createdAt");

-- CreateIndex
CREATE INDEX "task_workstreams_workstreamId_idx" ON "task_workstreams"("workstreamId");

-- AddForeignKey
ALTER TABLE "workstreams" ADD CONSTRAINT "workstreams_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_workstreams" ADD CONSTRAINT "task_workstreams_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_workstreams" ADD CONSTRAINT "task_workstreams_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "workstreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
