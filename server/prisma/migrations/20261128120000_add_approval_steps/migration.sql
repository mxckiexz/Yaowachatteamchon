CREATE TYPE "ApprovalStepStatus" AS ENUM ('PLANNED', 'WAITING', 'CURRENT', 'APPROVED', 'REJECTED');
ALTER TYPE "HistoryAction" ADD VALUE 'STEP_APPROVED';
CREATE TABLE "ApprovalStep" (
  "id" SERIAL NOT NULL,
  "requestId" INTEGER NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "approverId" INTEGER NOT NULL,
  "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PLANNED',
  "decidedAt" TIMESTAMP(3),
  "decisionComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApprovalStep_requestId_stepNumber_key" ON "ApprovalStep"("requestId", "stepNumber");
CREATE UNIQUE INDEX "ApprovalStep_requestId_approverId_key" ON "ApprovalStep"("requestId", "approverId");
CREATE INDEX "ApprovalStep_approverId_status_idx" ON "ApprovalStep"("approverId", "status");
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
