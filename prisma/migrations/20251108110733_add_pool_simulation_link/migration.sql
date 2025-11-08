-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "pricingRequestId" TEXT;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_pricingRequestId_fkey" FOREIGN KEY ("pricingRequestId") REFERENCES "PricingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
