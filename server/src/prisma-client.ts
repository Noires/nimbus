import { PrismaClient } from "@prisma/client";

// Single shared client — tsx watch restarts the process, so no hot-reload
// connection leak to guard against beyond module-level reuse.
const prisma = new PrismaClient();

export default prisma;
