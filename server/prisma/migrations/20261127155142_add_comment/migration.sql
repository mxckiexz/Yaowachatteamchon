-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_requestId_idx" ON "Comment"("requestId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BR-24: 1 to 1000 characters. Prisma cannot express CHECK constraints, so it is added by hand.
-- char_length counts code points, never more than the JavaScript length the API checks.
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_text_check" CHECK (char_length("text") BETWEEN 1 AND 1000);
