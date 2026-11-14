import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  asyncRoute,
  HttpError,
  stringValue,
  requireBody,
} from "../lib/http";
import { issueAccessToken, issueRefreshToken } from "../lib/auth";
import { decryptWhatsAppToken } from "../lib/whatsappCredentials";

export const staffOtpRouter = Router();

const sendWhatsAppOTP = async (
  phone: string,
  otp: string,
  phoneNumberId: string,
  accessToken: string
): Promise<void> => {
  const graphVersion = process.env.META_GRAPH_API_VERSION || "v22.0";
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "otp_login",
          language: { code: "en_US" },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: otp }],
          }],
        },
      }),
    }
  );

  if (!response.ok) {
    console.error("WhatsApp OTP delivery failed with status:", response.status);
    throw new HttpError(502, "WHATSAPP_ERROR", "Failed to send OTP via this restaurant's WhatsApp account.");
  }
};

// Generate and send OTP
staffOtpRouter.post(
  "/otp/send",
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const restaurantId = stringValue(body.restaurantId, "restaurantId")!;
    const phone = stringValue(body.phone, "phone")!;

    // Check if OTP feature is enabled for this restaurant
    const otpSettings = await prisma.restaurantOTPSettings.findUnique({
      where: { restaurantId },
    });

    if (!otpSettings?.isEnabled) {
      throw new HttpError(400, "OTP_DISABLED", "OTP login is not enabled for this restaurant.");
    }

    const whatsappConnection = await prisma.restaurantWhatsAppConnection.findUnique({
      where: { restaurantId },
    });
    if (!whatsappConnection) {
      throw new HttpError(503, "WHATSAPP_NOT_CONFIGURED", "This restaurant has not connected a WhatsApp Business account.");
    }

    // Validate phone number (basic validation)
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      throw new HttpError(422, "INVALID_PHONE", "Invalid phone number format.");
    }

    // Check if staff exists with this phone
    const staff = await prisma.user.findFirst({
      where: {
        restaurantId,
        phone,
        isActive: true,
      },
    });

    if (!staff) {
      throw new HttpError(404, "STAFF_NOT_FOUND", "Staff member not found with this phone number.");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP
    await prisma.staffOTP.create({
      data: {
        restaurantId,
        phone,
        otp,
        expiresAt,
      },
    });

    // Send WhatsApp message
    await sendWhatsAppOTP(
      phone,
      otp,
      whatsappConnection.phoneNumberId,
      decryptWhatsAppToken(whatsappConnection.accessTokenEncrypted)
    );

    response.status(201).json({
      data: {
        message: "OTP sent successfully",
        phone: phone.slice(-2).padStart(phone.length, "*"),
      },
    });
  })
);

// Verify OTP and login
staffOtpRouter.post(
  "/otp/verify",
  asyncRoute(async (request, response) => {
    const body = requireBody(request.body);
    const restaurantId = stringValue(body.restaurantId, "restaurantId")!;
    const phone = stringValue(body.phone, "phone")!;
    const otpCode = stringValue(body.otp, "otp")!;

    // Find the most recent OTP
    const staffOtp = await prisma.staffOTP.findFirst({
      where: {
        restaurantId,
        phone,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!staffOtp) {
      throw new HttpError(400, "OTP_EXPIRED", "OTP has expired or not found.");
    }

    if (staffOtp.attempts >= staffOtp.maxAttempts) {
      throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Too many OTP attempts. Please try again later.");
    }

    if (staffOtp.otp !== otpCode) {
      // Increment attempts
      await prisma.staffOTP.update({
        where: { id: staffOtp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new HttpError(401, "INVALID_OTP", "Invalid OTP code.");
    }

    // Mark OTP as verified
    await prisma.staffOTP.update({
      where: { id: staffOtp.id },
      data: { verifiedAt: new Date() },
    });

    // Get staff user
    const staff = await prisma.user.findFirst({
      where: {
        restaurantId,
        phone,
        isActive: true,
      },
    });

    if (!staff) {
      throw new HttpError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    }

    // Generate JWT tokens
    const accessToken = issueAccessToken(staff);
    const refreshToken = await issueRefreshToken(staff);

    response.json({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          role: staff.role,
          restaurantId: staff.restaurantId,
        },
      },
    });
  })
);
