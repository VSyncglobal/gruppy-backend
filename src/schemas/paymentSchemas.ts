import { z } from "zod";

export const initiatePaymentSchema = z.object({
  body: z.object({
    poolMemberId: z.string().cuid({ message: "A valid poolMemberId is required" }),
    method: z.string().min(3, { message: "Payment method is required" }),
  }),
});