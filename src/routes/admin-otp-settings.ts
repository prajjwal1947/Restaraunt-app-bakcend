import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  asyncRoute,
  HttpError,
  requireBody,
} from "../lib/http";
import { authenticate } from "../lib/auth";
import { encryptWhatsAppToken } from "../lib/whatsappCredentials";

export const adminOtpSettingsRouter = Router();

// All routes require authentication
adminOtpSettingsRouter.use(authenticate);

// Get OTP settings
adminOtpSettingsRouter.get(
  "/settings/otp",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;

    let otpSettings = await prisma.restaurantOTPSettings.findUnique({
      where: { restaurantId },
    });

    // Create default settings if not exist
    if (!otpSettings) {
      otpSettings = await prisma.restaurantOTPSettings.create({
        data: {
          restaurantId,
          isEnabled: false,
        },
      });
    }

    response.json({ data: otpSettings });
  })
);

// Update OTP settings (enable/disable)
adminOtpSettingsRouter.patch(
  "/settings/otp",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;
    const body = requireBody(request.body);
    const isEnabled = body.isEnabled === true;

    let otpSettings = await prisma.restaurantOTPSettings.findUnique({
      where: { restaurantId },
    });

    if (!otpSettings) {
      otpSettings = await prisma.restaurantOTPSettings.create({
        data: {
          restaurantId,
          isEnabled,
        },
      });
    } else {
      otpSettings = await prisma.restaurantOTPSettings.update({
        where: { restaurantId },
        data: { isEnabled },
      });
    }

    response.json({ data: otpSettings });
  })
);

adminOtpSettingsRouter.get(
  "/settings/whatsapp",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;
    const connection = await prisma.restaurantWhatsAppConnection.findUnique({
      where: { restaurantId },
      select: { phoneNumberId: true, displayPhoneNumber: true, updatedAt: true },
    });

    response.json({
      data: connection
        ? { connected: true, ...connection }
        : { connected: false, phoneNumberId: null, displayPhoneNumber: null },
    });
  })
);

adminOtpSettingsRouter.patch(
  "/settings/whatsapp",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;
    const body = requireBody(request.body);
    const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

    if (!phoneNumberId || !accessToken) {
      throw new HttpError(422, "VALIDATION_ERROR", "Phone number ID and access token are required.");
    }

    let providerResponse: Response;
    try {
      const graphVersion = process.env.META_GRAPH_API_VERSION || "v22.0";
      providerResponse = await fetch(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      throw new HttpError(502, "WHATSAPP_CONNECTION_FAILED", "Could not reach Meta to verify the WhatsApp credentials.");
    }

    if (!providerResponse.ok) {
      throw new HttpError(422, "WHATSAPP_CREDENTIALS_INVALID", "Meta could not verify this phone number ID and access token.");
    }

    const providerData = await providerResponse.json() as {
      display_phone_number?: string;
    };
    const connection = await prisma.restaurantWhatsAppConnection.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        phoneNumberId,
        displayPhoneNumber: providerData.display_phone_number || null,
        accessTokenEncrypted: encryptWhatsAppToken(accessToken),
      },
      update: {
        phoneNumberId,
        displayPhoneNumber: providerData.display_phone_number || null,
        accessTokenEncrypted: encryptWhatsAppToken(accessToken),
      },
      select: { phoneNumberId: true, displayPhoneNumber: true, updatedAt: true },
    });

    response.json({ data: { connected: true, ...connection } });
  })
);

adminOtpSettingsRouter.delete(
  "/settings/whatsapp",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;
    await prisma.restaurantWhatsAppConnection.deleteMany({ where: { restaurantId } });
    response.json({ data: { connected: false } });
  })
);

// List all staff (for OTP assignment)
adminOtpSettingsRouter.get(
  "/staff",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;

    const staff = await prisma.user.findMany({
      where: {
        restaurantId,
        role: { in: ["STAFF", "MANAGER"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    response.json({ data: staff });
  })
);

// Add/Update staff phone for OTP
adminOtpSettingsRouter.patch(
  "/staff/:staffId/phone",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;
    const staffId = String(request.params.staffId);
    const body = requireBody(request.body);
    const phone = typeof body.phone === "string" ? body.phone : String(body.phone);

    if (!phone || !phone.trim()) {
      throw new HttpError(422, "VALIDATION_ERROR", "Phone number is required.");
    }

    // Validate phone format
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      throw new HttpError(422, "INVALID_PHONE", "Invalid phone number format.");
    }

    const staff = await prisma.user.update({
      where: {
        id: staffId,
        restaurantId,
      },
      data: { phone: phone.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      } as const,
    });

    response.json({ data: staff as any });
  })
);

// Get OTP attempts (staff login history)
adminOtpSettingsRouter.get(
  "/otp-history",
  asyncRoute(async (request, response) => {
    const restaurantId = request.auth!.restaurantId;

    const otpHistory = await prisma.staffOTP.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        phone: true,
        attempts: true,
        maxAttempts: true,
        verifiedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    response.json({ data: otpHistory });
  })
);
