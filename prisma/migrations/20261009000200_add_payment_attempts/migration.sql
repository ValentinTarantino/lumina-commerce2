CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "subtotalUsd" DECIMAL(12,2) NOT NULL,
    "totalUsd" DECIMAL(12,2) NOT NULL,
    "totalArs" DECIMAL(14,2),
    "exchangeRate" DECIMAL(12,4),
    "quoteId" TEXT,
    "items" JSONB NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "paymentAttemptId" TEXT;
ALTER TABLE "Order" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");
CREATE UNIQUE INDEX "PaymentAttempt_providerPaymentId_key" ON "PaymentAttempt"("providerPaymentId");
CREATE INDEX "PaymentAttempt_userId_createdAt_idx" ON "PaymentAttempt"("userId", "createdAt");
CREATE INDEX "PaymentAttempt_provider_status_idx" ON "PaymentAttempt"("provider", "status");
CREATE UNIQUE INDEX "Order_paymentAttemptId_key" ON "Order"("paymentAttemptId");

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentAttemptId_fkey"
FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
