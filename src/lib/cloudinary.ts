import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

// Server-side only: this module reads the Cloudinary API secret.
// Never import it from a Client Component.

export type UploadedImage = {
  /** HTTPS URL to store on ItemPhoto.url */
  url: string;
  /** Cloudinary public_id, stored on ItemPhoto.publicId */
  publicId: string;
  width: number;
  height: number;
};

/** Every upload lands under this Cloudinary folder; callers cannot escape it. */
export const ROOT_FOLDER = "borrowloop";

/** Allowed subfolders of ROOT_FOLDER. Add new ones here deliberately. */
export const UPLOAD_FOLDERS = ["items", "test"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const DEFAULT_FOLDER = `${ROOT_FOLDER}/items`;

function resolveFolder(folder: UploadFolder = "items"): string {
  // Runtime check too, in case an untyped value slips through.
  if (!UPLOAD_FOLDERS.includes(folder)) {
    throw new Error(`Unknown upload folder "${folder}". Allowed: ${UPLOAD_FOLDERS.join(", ")}`);
  }
  return `${ROOT_FOLDER}/${folder}`;
}

const REQUIRED_ENV = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;

function configureCloudinary() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Cloudinary is not configured. Missing: ${missing.join(", ")}`);
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Uploads raw image bytes to Cloudinary and returns what we persist on ItemPhoto.
 * File type and size checks belong to the caller (see US-2); this only uploads.
 */
export async function uploadImage(
  data: Buffer,
  options: { folder?: UploadFolder } = {},
): Promise<UploadedImage> {
  const folder = resolveFolder(options.folder);
  configureCloudinary();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, response) => {
        if (error) return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        if (!response) return reject(new Error("Cloudinary upload failed: empty response"));
        resolve(response);
      },
    );
    stream.end(data);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}
