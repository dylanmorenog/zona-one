import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makePrisma() {
  return new PrismaClient({
    log: ["error"],
    // Railway cierra conexiones inactivas; esto permite que Prisma reconecte
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
