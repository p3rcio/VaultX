// MinIO/S3 client, bucket setup, and presigned URL helpers
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";

const { minio } = config;

// MinIO speaks the S3 API so the AWS SDK works fine — just point it at localhost
export const s3 = new S3Client({
  endpoint: `${minio.useSSL ? "https" : "http"}://${minio.endpoint}:${minio.port}`,
  region: "us-east-1", // MinIO doesn't care about region but the SDK requires a value
  credentials: {
    accessKeyId: minio.accessKey,
    secretAccessKey: minio.secretKey,
  },
  forcePathStyle: true, // MinIO needs path-style URLs (host/bucket/key), not subdomain-style
  // MinIO doesn't support some newer AWS checksum features — these prevent errors
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// creates the bucket on first run and configures CORS so the browser can upload/download directly
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: minio.bucket }));
    console.log(`[s3] bucket "${minio.bucket}" exists`);
  } catch (headErr: unknown) {
    // bucket doesn't exist yet, try to create it
    try {
      await s3.send(new CreateBucketCommand({ Bucket: minio.bucket }));
      console.log(`[s3] bucket "${minio.bucket}" created`);
    } catch (createErr: unknown) {
      console.warn(`[s3] could not create bucket: ${(createErr as Error).message}`);
      console.warn("[s3] please create bucket 'vaultx-files' manually in MinIO console at http://localhost:9001");
    }
  }

  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: minio.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
              AllowedOrigins: [config.corsOrigin],
              ExposeHeaders: ["ETag", "Content-Length"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log("[s3] CORS configured");
  } catch (corsErr: unknown) {
    console.warn(`[s3] could not set CORS: ${(corsErr as Error).message}`);
    console.warn("[s3] CORS can be configured manually in MinIO console");
  }
}

// presigned PUT URL lets the browser upload directly to MinIO — the API never touches the bytes
// valid for 1 hour
export async function presignedPut(
  objectKey: string,
  expiresIn = 3600
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: minio.bucket,
    Key: objectKey,
    ContentType: "application/octet-stream",
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

// same idea but for downloads
export async function presignedGet(
  objectKey: string,
  expiresIn = 3600
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: minio.bucket,
    Key: objectKey,
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: minio.bucket, Key: objectKey })
    );
    return true;
  } catch {
    return false;
  }
}

export async function listObjects(prefix: string): Promise<string[]> {
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: minio.bucket, Prefix: prefix })
  );
  return (res.Contents ?? []).map((o) => o.Key!);
}

// chunks are stored as "fileId/chunk_00000" — zero-padded so they sort in the right order
export function chunkKey(fileId: string, index: number): string {
  return `${fileId}/chunk_${String(index).padStart(5, "0")}`;
}

export async function deleteObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: minio.bucket, Key: objectKey }));
}
