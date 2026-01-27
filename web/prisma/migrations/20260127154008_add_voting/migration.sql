-- CreateEnum
CREATE TYPE "VotingStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterEnum
ALTER TYPE "ThreadSourceType" ADD VALUE 'VOTING';

-- DropForeignKey
ALTER TABLE "AuditFinding" DROP CONSTRAINT "AuditFinding_createdByMemberId_fkey";

-- AlterTable
ALTER TABLE "AuditFinding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actionType" DROP DEFAULT,
ALTER COLUMN "targetType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InternalControlRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Voting" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdByMemberId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "status" "VotingStatus" NOT NULL DEFAULT 'OPEN',
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB,
    "threadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingVote" (
    "id" SERIAL NOT NULL,
    "votingId" INTEGER NOT NULL,
    "choiceId" TEXT NOT NULL,
    "voteHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingComment" (
    "id" SERIAL NOT NULL,
    "votingId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Voting_groupId_status_idx" ON "Voting"("groupId", "status");

-- CreateIndex
CREATE INDEX "VotingVote_votingId_idx" ON "VotingVote"("votingId");

-- CreateIndex
CREATE UNIQUE INDEX "VotingVote_votingId_voteHash_key" ON "VotingVote"("votingId", "voteHash");

-- CreateIndex
CREATE INDEX "VotingComment_votingId_createdAt_idx" ON "VotingComment"("votingId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingVote" ADD CONSTRAINT "VotingVote_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "Voting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingComment" ADD CONSTRAINT "VotingComment_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "Voting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
