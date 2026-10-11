CREATE TABLE "ProductComment" (
    "id" TEXT NOT NULL,
    "text" VARCHAR(600) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ProductComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductComment_productId_createdAt_idx" ON "ProductComment"("productId", "createdAt");
CREATE INDEX "ProductComment_userId_createdAt_idx" ON "ProductComment"("userId", "createdAt");

ALTER TABLE "ProductComment"
ADD CONSTRAINT "ProductComment_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductComment"
ADD CONSTRAINT "ProductComment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
