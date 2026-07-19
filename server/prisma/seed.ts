import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  // Create a demo canvas
  const canvas = await prisma.canvas.upsert({
    where: { id: "clvl0demo0000" },
    update: {},
    create: {
      id: "clvl0demo0000",
      name: "My Tasks",
      tasks: {
        create: [
          {
            title: "Build the backend API",
            description: "Express CRUD routes with Prisma and PostgreSQL",
            x: 200, y: 150, z: 1, priority: "high", color: "#6366f1", tags: ["backend", "api"], done: false,
          },
          {
            title: "Design the infinite canvas",
            description: "Pan + zoom with mouse and touchscreen support",
            x: 280, y: 170, z: 1, priority: "high", color: "#8b5cf6", tags: ["frontend", "canvas"], done: false,
          },
          {
            title: "Implement clustering proximity detector",
            description: "rAF loop with Union-Find for bubble grouping",
            x: 250, y: 200, z: 1, priority: "high", color: "#a855f7", tags: ["frontend", "engine"], done: false,
          },
          {
            title: "Add drag-and-drop task cards",
            description: "Framer Motion drag with position persistence",
            x: 230, y: 190, z: 1, priority: "medium", color: "#ec4899", tags: ["frontend", "ui"], done: false,
          },
          {
            title: "Create bubble overlay layer",
            description: "SVG-based glow animations per cluster with Framer Motion layoutId",
            x: 260, y: 185, z: 2, priority: "medium", color: "#f43f5e", tags: ["frontend", "ui", "animation"], done: false,
          },
          {
            title: "Add undo/redo stack support",
            description: "Last 20 actions stored in Zustand for Ctrl+Z/Y",
            x: 350, y: 220, z: 1, priority: "medium", color: "#f97316", tags: ["frontend", "ux"], done: false,
          },
          {
            title: "Set up Docker PostgreSQL container",
            description: "Postgres 16 with proper database and user setup",
            x: 500, y: 100, z: 1, priority: "high", color: "#14b8a6", tags: ["devops", "database"], done: false,
          },
          {
            title: "Write seed.ts with colorful tasks",
            description: "Randomly colored demo data scattered across the canvas",
            x: 520, y: 130, z: 1, priority: "low", color: "#22c55e", tags: ["backend", "seed"], done: false,
          },
          {
            title: "Polish neon glow effects",
            description: "CSS box-shadow animations, rounded card shadows, spring physics",
            x: 600, y: 80, z: 2, priority: "low", color: "#06b6d4", tags: ["frontend", "polish"], done: false,
          },
        ],
      },
    },
    include: { tasks: true },
  });

  console.log(`✅ Seeded: "${canvas.name}" with ${canvas.tasks.length} demo tasks`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
