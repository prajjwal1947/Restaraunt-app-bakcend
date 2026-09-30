import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";

const accessSecret = () => process.env.JWT_ACCESS_SECRET ?? "development-access-secret";
const refreshSecret = () => process.env.JWT_REFRESH_SECRET ?? "development-refresh-secret";

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const issueAccessToken = (user: { id: string; restaurantId: string; role: UserRole }) =>
  jwt.sign({ restaurantId: user.restaurantId, role: user.role, type: "access" }, accessSecret(), {
    subject: user.id,
    expiresIn: (process.env.ACCESS_TOKEN_TTL ?? "15m") as jwt.SignOptions["expiresIn"],
  });

const hashRefreshToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const issueRefreshToken = async (user: { id: string; restaurantId: string }) => {
  const token = crypto.randomBytes(48).toString("base64url");
  const days = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? "30", 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { tokenHash: hashRefreshToken(token), userId: user.id, restaurantId: user.restaurantId, expiresAt } });
  return token;
};

export const revokeRefreshToken = async (token: string) => {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
};

export const rotateRefreshToken = async (token: string) => {
  const saved = await prisma.refreshToken.findFirst({ where: { tokenHash: hashRefreshToken(token), revokedAt: null, expiresAt: { gt: new Date() } } });
  if (!saved) throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");
  await prisma.refreshToken.update({ where: { id: saved.id }, data: { revokedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { id: saved.userId } });
  if (!user || !user.isActive) throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");
  return { user, refreshToken: await issueRefreshToken(user), accessToken: issueAccessToken(user) };
};

export const authenticate: RequestHandler = (request, _response, next) => {
  try {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new HttpError(401, "UNAUTHORIZED", "Authentication is required.");
    const payload = jwt.verify(header.slice(7), accessSecret()) as jwt.JwtPayload & { restaurantId?: string; role?: UserRole; type?: string };
    if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.restaurantId !== "string" || !payload.role) {
      throw new HttpError(401, "UNAUTHORIZED", "Authentication is required.");
    }
    request.auth = { userId: payload.sub, restaurantId: payload.restaurantId, role: payload.role };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "UNAUTHORIZED", "Authentication is required."));
  }
};

export const requireRole = (...roles: UserRole[]): RequestHandler => (request, _response, next) => {
  if (!request.auth || !roles.includes(request.auth.role)) {
    next(new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    return;
  }
  next();
};

export const publicUser = (user: { id: string; name: string; email: string; role: UserRole; restaurantId: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  restaurantId: user.restaurantId,
});