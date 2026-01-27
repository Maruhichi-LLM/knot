-- AddForeignKey: link ApprovalAssignment.stepId to ApprovalStep
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
