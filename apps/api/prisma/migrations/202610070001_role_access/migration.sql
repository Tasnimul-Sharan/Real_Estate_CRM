CREATE TABLE "RolePolicy" (
  "role" "Role" NOT NULL,
  "permissions" TEXT[] NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "RolePolicy_pkey" PRIMARY KEY ("role")
);
CREATE TABLE "AccessAudit" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "actorId" TEXT NOT NULL,
  "before" TEXT[] NOT NULL,
  "after" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccessAudit_createdAt_idx" ON "AccessAudit"("createdAt");
