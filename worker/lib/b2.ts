// Self-contained env loading — same reason as lib/db.ts: ES module
// imports are hoisted, so this must load .env.local itself rather than
// assume index.ts's dotenv.config() already ran first.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

// B2's S3-compatible endpoint embeds the region, e.g.
// s3.us-west-004.backblazeb2.com -> us-west-004.
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

export function uploadPrefix(sessionId: string): string {
  return `uploads/${sessionId}/`;
}

export function downloadZipKey(sessionId: string): string {
  return `downloads/${sessionId}.zip`;
}

// The web app doesn't know the final key ahead of time on the worker
// side — it saved the raw video under uploads/<sessionId>/<filename>,
// but the worker doesn't know <filename> until it lists the prefix.
// Mirrors the old readdir(uploadDir(sessionId)) local-disk lookup.
export async function findUploadKey(sessionId: string): Promise<string> {
  const res = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: uploadPrefix(sessionId) }));
  const key = res.Contents?.[0]?.Key;
  if (!key) throw new Error(`no uploaded object found under ${uploadPrefix(sessionId)}`);
  return key;
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

// Streamed multipart upload via @aws-sdk/lib-storage's Upload — unlike
// PutObjectCommand, it doesn't need the full body size known upfront, so
// the finished zip never has to be buffered whole into worker memory
// just to compute a Content-Length.
export async function putObjectStream(key: string, body: Readable, contentType?: string): Promise<void> {
  const upload = new Upload({ client, params: { Bucket: BUCKET, Key: key, Body: body, ContentType: contentType } });
  await upload.done();
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
