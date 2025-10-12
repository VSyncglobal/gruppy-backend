import { PrismaClient, OrderStatus, PaymentStatus } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // 1️⃣ Affiliates
  await prisma.affiliate.createMany({
    data: Array.from({ length: 5 }).map((_, i) => ({
      userId: `user-aff-${i + 1}`,
      code: `AFF${1000 + i}`,
      commissionRate: 0.05 + i * 0.01,
    })),
    skipDuplicates: true,
  });

  // 2️⃣ Products
  await prisma.product.createMany({
    data: [
      { name: "Smartphone X", hsCode: "8517.12", basePrice: 250 },
      { name: "Laptop Pro", hsCode: "8471.30", basePrice: 1000 },
      { name: "Wireless Earbuds", hsCode: "8518.30", basePrice: 60 },
      { name: "4K TV", hsCode: "8528.72", basePrice: 750 },
      { name: "Smartwatch", hsCode: "9102.11", basePrice: 150 },
    ],
  });

  // 3️⃣ Pricing Logs (Legacy simple logs)
  await prisma.pricingLog.createMany({
    data: Array.from({ length: 5 }).map((_, i) => ({
      basePrice: 100 + i * 20,
      distanceKm: 200 + i * 50,
      weightKg: 10 + i,
      finalPrice: 300 + i * 40,
    })),
  });

  // 4️⃣ Pools
  const poolEntries = [];
  for (let i = 0; i < 5; i++) {
    const product = await prisma.product.findFirst({ skip: i });
    poolEntries.push({
      title: `Pool ${i + 1} - ${product?.name || "Generic"}`,
      description: `Group purchase for ${product?.name || "product"}`,
      productId: product?.id || "",
      pricePerUnit: (product?.basePrice || 100) * 0.95,
      targetQuantity: 20 + i * 5,
      currentQuantity: i * 2,
      deadline: new Date(Date.now() + (i + 7) * 86400000),
      createdById: `user-pool-${i + 1}`,
    });
  }
  await prisma.pool.createMany({ data: poolEntries });

  // 5️⃣ Pool Members
  const pools = await prisma.pool.findMany();
  const poolMembers = [];
  for (let i = 0; i < pools.length; i++) {
    poolMembers.push({
      poolId: pools[i].id,
      userId: `user-member-${i + 1}`,
      quantity: 1 + i,
    });
  }
  await prisma.poolMember.createMany({ data: poolMembers });

  // 6️⃣ Orders
  const productsList = await prisma.product.findMany();
  const orders = [];
  for (let i = 0; i < 5; i++) {
    orders.push({
      order_number: `ORD-${1000 + i}`,
      userId: `user-order-${i + 1}`,
      productId: productsList[i % productsList.length].id,
      final_price_ksh: 1000 + i * 100,
      status: OrderStatus.PENDING_PAYMENT,
    });
  }
  await prisma.order.createMany({ data: orders });

  // 7️⃣ Order Status History
  const allOrders = await prisma.order.findMany();
  const statusLogs = [];
  for (let order of allOrders) {
    statusLogs.push({
      orderId: order.id,
      fromStatus: OrderStatus.PENDING_PAYMENT,
      toStatus: OrderStatus.PAYMENT_CONFIRMED,
      note: "Payment received successfully",
    });
  }
  await prisma.orderStatusHistory.createMany({ data: statusLogs });

  // 8️⃣ Payments
  const allOrdersNow = await prisma.order.findMany();
  const payments = [];
  for (let i = 0; i < 5; i++) {
    payments.push({
      orderId: allOrdersNow[i % allOrdersNow.length].id,
      amount: 500 + i * 100,
      status: PaymentStatus.SUCCESS,
      method: "M-PESA",
      mpesa_receipt_number: `MP${Math.floor(Math.random() * 1000000)}`,
      transaction_date: new Date(),
    });
  }
  await prisma.payment.createMany({ data: payments });

  // 9️⃣ Pricing Requests
  await prisma.pricingRequest.createMany({
    data: Array.from({ length: 5 }).map((_, i) => ({
      payload: { test: true, id: i },
      result: { total: 200 + i * 10 },
    })),
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
