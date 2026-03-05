import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a test user (for development only)
  const user = await prisma.user.upsert({
    where: { auth0Id: "auth0|dev-test-user" },
    update: {},
    create: {
      auth0Id: "auth0|dev-test-user",
      email: "dev@standup-ai.local",
      name: "Dev User",
      githubUsername: "dev-user",
      preferredModel: "claude-sonnet-4-20250514",
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      activityWindow: "24h",
      repos: [],
      excludeRepos: [],
      standupFormat: "standard",
    },
  });

  console.log(`Created test user: ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
