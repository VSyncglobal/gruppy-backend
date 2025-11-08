// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// A list of some towns and their counties in Kenya
const kenyanTowns = [
  { name: "Nairobi", county: "Nairobi" },
  { name: "Mombasa", county: "Mombasa" },
  { name: "Kisumu", county: "Kisumu" },
  { name: "Nakuru", county: "Nakuru" },
  { name: "Eldoret", county: "Uasin Gishu" },
  { name: "Thika", county: "Kiambu" },
  { name: "Ruiru", county: "Kiambu" },
  { name: "Kiambu", county: "Kiambu" },
  { name: "Juja", county: "Kiambu" },
  { name: "Nyeri", county: "Nyeri" },
  { name: "Karatina", county: "Nyeri" },
  { name: "Othaya", county: "Nyeri" },
  { name: "Machakos", county: "Machakos" },
  { name: "Athi River", county: "Machakos" },
  { name: "Kitui", county: "Kitui" },
  { name: "Garissa", county: "Garissa" },
  { name: "Malindi", county: "Kilifi" },
  { name: "Kilifi", county: "Kilifi" },
  { name: "Meru", county: "Meru" },
  { name: "Nanyuki", county: "Laikipia" },
  { name: "Kakamega", county: "Kakamega" },
  { name: "Bungoma", county: "Bungoma" },
  { name: "Kisii", county: "Kisii" },
  { name: "Naivasha", county: "Nakuru" },
  { name: "Kericho", county: "Kericho" },
  { name: "Voi", county: "Taita-Taveta" },
  // ... feel free to add many more towns
];

async function main() {
  console.log("Start seeding Kenyan towns...");

  // Use upsert to avoid creating duplicates on subsequent seeds
  // It checks for a unique combination of name and county
  for (const town of kenyanTowns) {
    await prisma.kenyanTown.upsert({
      where: { name_county: { name: town.name, county: town.county } },
      update: {},
      create: town,
    });
  }

  console.log(`Seeding finished. ${kenyanTowns.length} towns processed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });