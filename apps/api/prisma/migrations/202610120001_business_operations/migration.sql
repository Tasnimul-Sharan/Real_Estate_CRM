CREATE TABLE "PaymentPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "totalPrice" DECIMAL(16,2) NOT NULL CHECK ("totalPrice" > 0),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Installment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "dueDate" DATE NOT NULL,
  "amount" DECIMAL(16,2) NOT NULL CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "Installment_planId_sequence_key" ON "Installment"("planId", "sequence");
CREATE INDEX "Installment_dueDate_idx" ON "Installment"("dueDate");
