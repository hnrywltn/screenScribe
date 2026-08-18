import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

// B2's S3-compatible endpoint embeds the region, e.g.
// s3.us-west-004.backblazeb2.com -> us-west-004. Falling back to a
// placeholder if the pattern doesn't match rather than throwing — same
// permissive style as lib/db.ts not throwing on a missing DATABASE_URL,
// real errors surface from the actual API call instead.
const endpoint = process.env.B2_ENDPOINT ?? "";
const regionMatch = endpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/);
const region = regionMatch ? regionMatch[1] : "us-east-1";

const client = new S3Client({
  endpoint: endpoint ? `https://${endpoint}` : undefined,
  region,
  forcePathStyle: true, // B2 needs path-style addressing, not virtual-hosted
  credentials: {
    accessKeyId: process.env.B2_APPLICATION_KEY_ID ?? "",
    secretAccessKey: process.env.B2_APPLICATION_KEY ?? "",
  },
});

const BUCKET = process.env.B2_BUCKET_NAME ?? "";

export function uploadKey(sessionId: string, filename: string): string {
  return `uploads/${sessionId}/${filename}`;
}

export function downloadZipKey(sessionId: string): string {
  return `downloads/${sessionId}.zip`;
}

export async function putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentLength: body.length, ContentType: contentType })
  );
}

// Streamed multipart upload via @aws-sdk/lib-storage's Upload — unlike
// PutObjectCommand, it doesn't need the full body size known upfront,
// so a large upload never has to be buffered whole into memory just to
// compute a Content-Length. Mirrors worker/lib/b2.ts's putObjectStream
// (deliberately duplicated, not shared — separate packages).
export async function putObjectStream(key: string, body: Readable, contentType?: string): Promise<void> {
  const upload = new Upload({ client, params: { Bucket: BUCKET, Key: key, Body: body, ContentType: contentType } });
  await upload.done();
}

export async function headObject(key: string): Promise<{ contentLength: number }> {
  const res = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return { contentLength: res.ContentLength ?? 0 };
}

export async function getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`B2 returned no body for ${key}`);
  return res.Body as NodeJS.ReadableStream;
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
