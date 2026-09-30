import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { HttpError } from "./http";

export const uploadToSupabase = async (file: Express.Multer.File, path: string) => {
  const baseUrl = process.env.SUPABASE_URL;
  const endpoint = process.env.SUPABASE_S3_ENDPOINT;
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "restaurant-images";
  if (!baseUrl || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new HttpError(503, "STORAGE_NOT_CONFIGURED", "Supabase S3 storage is not configured.");
  }

  const client = new S3Client({
    forcePathStyle: true,
    region: process.env.SUPABASE_S3_REGION ?? "us-east-1",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  } catch (error) {
    console.error("Supabase Storage S3 upload failed", error);
    throw new HttpError(502, "STORAGE_ERROR", "Image upload failed.");
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
};