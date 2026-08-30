# Object Storage & Presigned Uploads (Cloudflare R2)

> Reference for pattern **2.14** in `.claude/rules/architecture.md`.
> Read this before touching member photos, `src/lib/storage/*`, the
> `generate-upload-url` route, or the public registration upload flow.

## The port

Storage is an `IStorageProvider` port in `src/lib/storage/`, with two
implementations selected at runtime by `createStorageProvider()`:

- `R2StorageProvider` — Cloudflare R2 via the S3-compatible API
  (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`). Used **only** when
  all four `R2_*` server vars are present.
- `MockStorageProvider` — in-memory, deterministic, for dev/tests. Used as a
  **silent fallback** whenever any `R2_*` var is missing, so a missing config
  degrades to broken photos rather than a crash.

```ts
// src/lib/storage/factory.ts
export function createStorageProvider(): IStorageProvider {
  const r2Configured =
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!process.env.R2_BUCKET_NAME
  return r2Configured ? new R2StorageProvider() : new MockStorageProvider()
}
```

Business code depends on the port, never on R2 directly.

## The presigned-upload flow

Image bytes **never touch our servers**. The server only signs; the browser
uploads straight to R2.

1. Browser compresses the image (WebP; JPEG fallback for iOS Safari).
2. Browser asks the server for a short-lived (5 min) presigned PUT URL.
3. Browser `PUT`s the blob directly to R2 at a **deterministic key**.
4. Browser calls a confirm endpoint; the server persists the object key on the
   member row (`photo_path` / `photo_updated_at`).

Two entry points share the same `IStorageProvider` client:

| Flow                        | Route                                                                    | Auth                                         |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Dashboard add/replace photo | `POST /api/members/generate-upload-url` → `POST /api/members/[id]/photo` | gym **session** (tenant-checked)             |
| Public QR self-registration | `POST /api/public/registrations` (returns `uploadUrl`)                   | **token** (see pattern 2.14 / auth taxonomy) |

- **Deterministic keys**: `profiles/{memberId}.{webp|jpg}` via
  `memberPhotoPath()`. The confirm route validates the path with
  `isPhotoPathForMember()` so a caller can't overwrite an arbitrary object.
- **Public read**: composed as `${NEXT_PUBLIC_R2_PUBLIC_URL}/${photoPath}` with
  a `?v={photo_updated_at}` cache-buster (replacements reuse the same key).
  `NEXT_PUBLIC_R2_PUBLIC_URL` must be a **dedicated subdomain** bound to the
  bucket (e.g. `media.example.com`), never the app's apex.

## Post-mortem: presigned PUT 403 `SignatureDoesNotMatch` (SDK checksum)

**Symptom:** every browser PUT to R2 returns 403 (or surfaces as "Failed to
fetch" when R2's 403 lacks CORS headers).

**Cause:** AWS SDK v3 (≈ ≥ 3.729) defaults to injecting a CRC32 checksum on
`PutObject`. When presigning there is no body, so the SDK bakes
`CRC32("") = AAAAAA==` into the URL as signed query params
(`x-amz-checksum-crc32`, `x-amz-sdk-checksum-algorithm`). The browser then PUTs
the real bytes; R2 recomputes the checksum, it doesn't match the zero baked in,
and rejects the request.

**Fix (mandatory for any S3-compatible store — R2, MinIO, Backblaze, Supabase):**

```ts
new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: 'WHEN_REQUIRED', // don't inject CRC32 into presigns
  responseChecksumValidation: 'WHEN_REQUIRED',
})
```

**Diagnose:** inspect the presigned URL's query params. Clean =
`X-Amz-Algorithm, …, X-Amz-Signature, X-Amz-SignedHeaders, x-id`. Broken = the
same plus `x-amz-checksum-crc32` / `x-amz-sdk-checksum-algorithm`.

## Ops checklist (deploy-time gotchas, all seen in production)

A 403/`Failed to fetch` on upload is almost always one of these — not app code:

- **All four `R2_*` vars set?** A missing one silently selects
  `MockStorageProvider`, which hands out an unreachable `mock-r2.local` URL →
  "Failed to fetch" (DNS). Confirm the active provider before anything else.
- **Token permission = Object Read & Write?** A read-only token authenticates
  fine but returns 403 **`AccessDenied`** on PUT (server-side too — that
  isolates it from CORS).
- **Bucket CORS** allows `PUT` from the app origin(s)? Preflight failure shows
  as "Failed to fetch"; a real 403 status means CORS already passed.
- **`NEXT_PUBLIC_R2_PUBLIC_URL` has no trailing whitespace/newline?** A stray
  `\n` breaks rendered URLs; code trims defensively but keep the value clean.
- **R2 read domain is a subdomain**, and the app apex points at the app host
  (Vercel) — connecting the apex to the R2 bucket hijacks the whole app to
  R2's object 404s.

`SignatureDoesNotMatch` (vs `AccessDenied`) points at wrong secret / account id
/ bucket name, or the checksum issue above.
