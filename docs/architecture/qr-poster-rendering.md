# Branded Image Generation (QR Registration Posters)

> On-demand reference. Loaded when working on server-rendered images / posters,
> not auto-injected. Governing rule indexed in `.claude/rules/architecture.md`:
- **§2.16 Server-side branded image generation** — Render branded documents/
  images (the member self-registration QR poster) server-side with `next/og`
  (Satori), one PNG shared by both print and download, per gym.

---

## What & why

The member self-registration QR is distributed as a print/PNG **poster** — the
"QR Stand 2b" design (full electric-blue `#1B17FF`, A5): gym logo + name in a
white pill, locality tag, hero copy, the QR on a white card, and a fixed
"Powered by Metric Gym OS" footer with the brand domain.

The poster is generated **server-side** as a single PNG so that the printed
sheet and the downloaded file are pixel-identical, and so cross-origin gym
logos (served from R2) never taint a browser canvas. The old client-canvas
`printQrPosters()` HTML flow was replaced by this in favour of a single source
of truth.

## Renderer

`src/features/registration/services/qr-poster.tsx` — `renderQrPosterPng(input)`:

- Renders JSX through `new ImageResponse(...)` from **`next/og`** (Satori +
  resvg) at **2× the authored 600×851** (`transform: scale(2)`) for print
  crispness (~206dpi at A5).
- The QR is generated server-side with the **`qrcode`** package
  (`toDataURL`), embedded as a data URL. The gym profile logo is passed as a
  remote URL — Satori fetches it server-side (no canvas taint).
- Fonts (**Geist** 400/600/700, **Geist Mono** 400/500) are bundled in
  `src/features/registration/assets/fonts/*.woff` and read from disk at
  runtime. The Metric logo is read from `public/logo.svg` and inlined as a
  data URL.

### Non-obvious constraints (gotchas)

- **Node.js runtime required** — the renderer reads fonts + the logo via `fs`;
  routes must `export const runtime = 'nodejs'`.
- **Bundle the assets** — Vercel's serverless bundle does not include
  arbitrary `fs`-read files or `public/` in the function. `next.config.js`
  `outputFileTracingIncludes` force-includes the fonts glob + `public/logo.svg`
  for both poster routes. Add any new poster route there too.
- **Fonts must be `woff`/`ttf`/`otf`, not `woff2`** — Satori cannot decode
  woff2. The Geist `.woff` files come from the `@fontsource/*` packages.
- **Satori rejects `width: 'fit-content'`** (a hard error inside `next/og`,
  unlike standalone Satori which only warns). To size a flex child to its
  content, use `alignSelf: 'flex-start'`.
- Every element with **multiple children needs `display: 'flex'`** (Satori
  requirement); the design sets it throughout.

## Routes (thin, §2.4 compliant)

- `GET /api/settings/qr-poster` — session auth (`getApiGymProfile`), the
  current gym's poster.
- `GET /api/admin/qr-poster?gymId=<uuid>` — SaaS-operator auth
  (`ADMIN_ALLOWED_EMAIL`, checked before any query), any gym's poster.

Both resolve gym name, profile logo, derived locality and the join URL through
`registration-link.service.ts` (`getGymPosterInput` /
`getOrCreateRegistrationLink` + `derivePosterLocation`) — no inline queries —
then call `renderQrPosterPng`.

## Responses go through ResponseBuilder (§2.3)

These routes still build every response through `ResponseBuilder` — no
exception to §2.3. Binary payloads cannot use the JSON success envelope, so the
PNG is returned via **`ResponseBuilder.binary(png, 'image/png', { cacheControl })`**
(a raw `Response` with the right `Content-Type`). Error paths use the JSON error
builders (`ResponseBuilder.forbidden()` / `.badRequest()` / `.notFound()`) with
`getHttpStatusFromErrorCode` for the status, keeping machine-readable codes.

## Client

`src/features/registration/utils/print-qr.ts` moves the server PNG into the
print dialog (`printPosterImages`, one A5 page per image) or a file
(`downloadPosterImage` + `posterFilename`). The settings card and the admin QR
dashboard keep a compact on-screen `QRCodeCanvas` preview but print/download
via the routes. `Print All` on the admin dashboard opens one page per gym,
each hitting the route.
