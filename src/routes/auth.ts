import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncRoute, HttpError, requireBody, stringValue } from "../lib/http";
import { authenticate, comparePassword, hashPassword, issueAccessToken, issueRefreshToken, publicUser, revokeRefreshToken, rotateRefreshToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

export const authRouter = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

const emailValue = (value: unknown) => {
  const email = stringValue(value, "email")!.toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(422, "VALIDATION_ERROR", "One or more fields are invalid.", { email: "Enter a valid email address." });
  return email;
};

authRouter.post("/register", asyncRoute(async (request, response) => {
  const body = requireBody(request.body);
  const restaurantName = stringValue(body.restaurantName, "restaurantName")!;
  const restaurantEmail = emailValue(body.restaurantEmail);
  const ownerName = stringValue(body.ownerName, "ownerName")!;
  const ownerEmail = emailValue(body.ownerEmail);
  const password = stringValue(body.ownerPassword, "ownerPassword")!;
  if (password.length < 8) throw new HttpError(422, "VALIDATION_ERROR", "One or more fields are invalid.", { ownerPassword: "Use at least 8 characters." });

  const existing = await prisma.restaurant.findUnique({ where: { email: restaurantEmail } });
  if (existing) throw new HttpError(409, "CONFLICT", "A restaurant with this email already exists.");

  const result = await prisma.$transaction(async (transaction) => {
    const restaurant = await transaction.restaurant.create({ data: {
      name: restaurantName,
      email: restaurantEmail,
      phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
      address: typeof body.address === "string" ? body.address.trim() : undefined,
      city: typeof body.city === "string" ? body.city.trim() : undefined,
    } });
    const user = await transaction.user.create({ data: {
      restaurantId: restaurant.id,
      name: ownerName,
      email: ownerEmail,
      passwordHash: await hashPassword(password),
      role: "OWNER",
    } });
    return { restaurant, user };
  });

  response.status(201).json({ data: { restaurant: result.restaurant, user: publicUser(result.user) } });
}));

authRouter.post("/login", loginLimit, asyncRoute(async (request, response) => {
  const body = requireBody(request.body);
  const email = emailValue(body.email);
  const password = stringValue(body.password, "password")!;
  const user = await prisma.user.findFirst({ where: { email, isActive: true } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  response.json({ data: { accessToken: issueAccessToken(user), refreshToken: await issueRefreshToken(user), user: publicUser(user) } });
}));

authRouter.post("/refresh", asyncRoute(async (request, response) => {
  const body = requireBody(request.body);
  const token = stringValue(body.refreshToken, "refreshToken")!;
  const result = await rotateRefreshToken(token);
  response.json({ data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: publicUser(result.user) } });
}));

authRouter.post("/logout", asyncRoute(async (request, response) => {
  const body = requireBody(request.body);
  const token = stringValue(body.refreshToken, "refreshToken")!;
  await revokeRefreshToken(token);
  response.status(204).send();
}));

authRouter.get("/me", authenticate, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.auth!.userId } });
  if (!user || !user.isActive || user.restaurantId !== request.auth!.restaurantId) throw new HttpError(401, "UNAUTHORIZED", "Authentication is required.");
  response.json({ data: publicUser(user) });
}));