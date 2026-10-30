import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const configuredConnectionString = process.env.DATABASE_URL;
if (!configuredConnectionString) {
	throw new Error("DATABASE_URL is required. Create a private .env file before starting the API.");
}

const connectionString = configuredConnectionString
	.replace(/[?&]sslmode=[^&]+/, "");
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const adapter = new PrismaPg({
	connectionString,
	ssl: isLocalDb ? false : { rejectUnauthorized: false },
	connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
	max: Number(process.env.DB_POOL_MAX ?? 5),
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
});

export const prisma = new PrismaClient({ adapter });