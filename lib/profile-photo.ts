import multer from "multer";
import sharp from "sharp";
import { HttpError } from "../middleware/errors.js";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_URL = "/profile/photo";

export const receivePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0, parts: 2 },
}).single("photo");

export function uploadError(error: unknown): HttpError {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return new HttpError(413, "Choose a photo no larger than 5 MB.");
  }
  return new HttpError(400, "Upload exactly one photo in the photo field.");
}

export async function processPhoto(buffer: Buffer): Promise<Buffer> {
  if (buffer.length > MAX_PHOTO_BYTES)
    throw new HttpError(413, "Choose a photo no larger than 5 MB.");
  try {
    // Inspect actual file content, not the untrusted filename or MIME header.
    const image = sharp(buffer, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new Error("Unsupported image");
    }
    // Re-encoding strips embedded metadata and trailing non-image content.
    return await image
      .rotate()
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "Choose a valid, non-animated JPEG, PNG, or WebP image (up to 20 megapixels).",
    );
  }
}
