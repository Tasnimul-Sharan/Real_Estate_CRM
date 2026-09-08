const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
  if (!email || !password || password.length < 16 || password === "Admin@12345")
    throw new Error(
      "Supply ADMIN_EMAIL and a new ADMIN_PASSWORD of at least 16 characters",
    );
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && process.env.ROTATE_ADMIN_PASSWORD !== "true")
    throw new Error(
      "Account already exists; explicit ROTATE_ADMIN_PASSWORD=true is required to rotate it",
    );
  if (user && user.role !== "SUPER_ADMIN")
    throw new Error("Refusing to elevate an existing non-super-admin account");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      name: "CRM Administrator",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  console.log(
    "Administrator credentials initialized. No sample business records were added.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
