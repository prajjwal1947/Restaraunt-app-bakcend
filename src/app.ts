import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { requestId, errorHandler, notFound } from "./lib/http";
import { openapi } from "./openapi";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { prisma } from "./lib/prisma";

const allowedOrigins = [
	process.env.CLIENT_ADMIN_URL ?? "http://localhost:5173",
	process.env.CLIENT_CUSTOMER_URL ?? "http://localhost:5174",
]
	.join(",")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

export const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.get("/docs.json", (_request, response) => response.json(openapi));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production"  ? "combined" : "dev"));

app.get("/health", (_request, response) => {
	response.json({ status: "ok" });
});

app.get("/health/db", async (_request, response) => {
		try {
			await prisma.$queryRaw`SELECT 1`;
			response.json({ status: "ok", database: "connected" });
		} catch (error) {
			console.error("Database health check failed", error);
			response.status(503).json({ status: "error", database: "unavailable" });
		}
});

app.use("/api/v1/public", publicRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", adminRouter);
app.use("/api/v1", notFound);
app.use(errorHandler);
