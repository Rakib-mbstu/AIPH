-- AlterTable
ALTER TABLE "WeakArea" ADD COLUMN     "systemDesignTopicId" TEXT;

-- CreateTable
CREATE TABLE "SystemDesignTopic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prerequisiteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDesignTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDesignQuestion" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "expectedConcepts" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDesignQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDesignQuestionTopic" (
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "SystemDesignQuestionTopic_pkey" PRIMARY KEY ("questionId","topicId")
);

-- CreateTable
CREATE TABLE "SystemDesignAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDesignAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDesignAttemptResult" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "requirementsClarification" INTEGER NOT NULL,
    "componentCoverage" INTEGER NOT NULL,
    "scalabilityReasoning" INTEGER NOT NULL,
    "tradeoffAwareness" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "missingConcepts" TEXT[],
    "suggestedDeepDive" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDesignAttemptResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDesignProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemDesignProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemDesignTopic_name_key" ON "SystemDesignTopic"("name");

-- CreateIndex
CREATE INDEX "SystemDesignQuestionTopic_topicId_idx" ON "SystemDesignQuestionTopic"("topicId");

-- CreateIndex
CREATE INDEX "SystemDesignAttempt_userId_idx" ON "SystemDesignAttempt"("userId");

-- CreateIndex
CREATE INDEX "SystemDesignAttempt_questionId_idx" ON "SystemDesignAttempt"("questionId");

-- CreateIndex
CREATE INDEX "SystemDesignAttempt_userId_createdAt_idx" ON "SystemDesignAttempt"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemDesignAttemptResult_attemptId_key" ON "SystemDesignAttemptResult"("attemptId");

-- CreateIndex
CREATE INDEX "SystemDesignAttemptResult_attemptId_idx" ON "SystemDesignAttemptResult"("attemptId");

-- CreateIndex
CREATE INDEX "SystemDesignProgress_userId_idx" ON "SystemDesignProgress"("userId");

-- CreateIndex
CREATE INDEX "SystemDesignProgress_topicId_idx" ON "SystemDesignProgress"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemDesignProgress_userId_topicId_key" ON "SystemDesignProgress"("userId", "topicId");

-- CreateIndex
CREATE INDEX "WeakArea_systemDesignTopicId_idx" ON "WeakArea"("systemDesignTopicId");

-- AddForeignKey
ALTER TABLE "SystemDesignQuestionTopic" ADD CONSTRAINT "SystemDesignQuestionTopic_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SystemDesignQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDesignQuestionTopic" ADD CONSTRAINT "SystemDesignQuestionTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SystemDesignTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDesignAttempt" ADD CONSTRAINT "SystemDesignAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDesignAttempt" ADD CONSTRAINT "SystemDesignAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SystemDesignQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDesignAttemptResult" ADD CONSTRAINT "SystemDesignAttemptResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SystemDesignAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDesignProgress" ADD CONSTRAINT "SystemDesignProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDesignProgress" ADD CONSTRAINT "SystemDesignProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SystemDesignTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
