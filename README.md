# Twin Sync — "Two Is Better" PWA prototype

Two customers in the same store sync their phones and both unlock **2 Big Johns for R59.90**. The deal can only be used **within 10 minutes**, and only **at the store where they synced**.

This is a mobile-first Next.js PWA. It uses placeholder branding only, so swap in real artwork later.

- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma + SQLite · SSE · `qrcode` / `html5-qrcode`
- **Primary sync:** a QR handshake. Phone A shows a 60-second code and Phone B scans it.
- **Optional sync:** a Web NFC counter tag (Chrome on Android), plus a 6-character code.
- **Staff:** a `/staff` till page, protected by a PIN, to verify and redeem vouchers.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

`npm run dev` first runs `scripts/setup.mjs`, which:
1. creates `.env` from `.env.example` if it's missing
2. creates or updates `prisma/dev.db`
3. seeds 3 fictional Johannesburg demo stores

```bash
npm test     # Vitest: rules (unit) + services against a throwaway SQLite DB
npm run lint
```

Requires Node 20+ (built with Node 22).

### Config (`.env`)

| Var | Default | Meaning |
|---|---|---|
| `DEAL_TITLE` / `DEAL_ITEMS` | `Two Is Better` / `2 Big Johns` | Copy shown on voucher and till |
| `DEAL_PRICE_CENTS` | `5990` | **R59.90**. Each voucher stores the price at issue time |
| `SYNC_TOKEN_TTL_SECONDS` | `60` | How long Phone A's QR or code is valid |
| `VOUCHER_TTL_SECONDS` | `600` | How long the deal stays redeemable |
| `MAX_DEALS_PER_DEVICE_PER_DAY` | `1` | Rate limit per device |
| `DAY_TIMEZONE` | `Africa/Johannesburg` | Where "today" starts and ends for the limit |
| `STAFF_PIN` | `1234` | Till PIN. **Change it** |
| `COOKIE_SECRET` | — | Signs the device and staff cookies. **Change it** |
| `DEV_MODE` | `true` | Shows the dev panel and allows bypassing location. **Set `false` in prod** |

### Demo stores (fictional, approximate coordinates, 100 m radius)

| id | Name | lat, lng | NFC tag secret |
|---|---|---|---|
| `demo-braamfontein` | Demo Store · Braamfontein | -26.1929, 28.0305 | `braam-tag-secret` |
| `demo-rosebank` | Demo Store · Rosebank | -26.1458, 28.0416 | `rosebank-tag-secret` |
| `demo-sandton` | Demo Store · Sandton | -26.1076, 28.0567 | `sandton-tag-secret` |

Edit `prisma/seed.ts` to add or move stores.

---

## Testing the two-phone flow

### At your desk (one computer)

The device ID lives in a cookie. Two normal tabs in the same browser therefore count as **one device**, and the server correctly rejects that with "can't sync with yourself". Use two isolated browser contexts instead:

- **Phone A:** a normal Chrome window
- **Phone B:** an Incognito window, or a different browser (Safari or Firefox)

In **each** window:
1. Open <http://localhost:3000>, scroll down to **🛠 Dev mode**, and choose the **same store** under "Pretend I'm at". This bypasses GPS.
2. Tap **Twin Sync**.

Then:
3. **Window A:** tap **Show my code**. You get a QR, a 6-character code and a 60-second countdown.
4. **Window B:** tap **Type your twin's code instead**, enter the 6 characters, and tap **Sync!** (a laptop webcam can scan the QR too, with **Scan twin's code**).
5. Both windows show the unlock animation, then a 10:00 voucher. Window A updates on its own via Server-Sent Events.
6. Open <http://localhost:3000/staff>, enter PIN `1234`, choose the store, and type the voucher code. Try a different store to see **WRONG STORE**, redeem it, then check it again to see **ALREADY REDEEMED**.

**Hitting the daily limit while testing?** Use **Dev mode → Reset this device** to get a new device ID.

Things to try:
- Choose different stores in A and B to see **Different stores**.
- Wait more than 60 seconds before joining to see **Too slow, twin!**
- Enter a used code to see **Already synced**.

### On real phones

Browsers only allow camera and GPS on **HTTPS** pages (or `localhost`). A phone opening `http://192.168.x.x:3000` gets the "Needs a secure link" screen. The easiest fix is an HTTPS tunnel:

```bash
npm run dev
```

```bash
npx cloudflared tunnel --url http://localhost:3000
```

You can use `ngrok http 3000` instead. Open the `https://….trycloudflare.com` URL on both phones. `next.config.ts` already allows these tunnel hosts in dev.

For a real GPS test, set the coordinates of one demo store in `prisma/seed.ts` to where you're standing, then rerun `npm run setup`.

---

## Deploying (Vercel + Neon Postgres)

Hosts like Vercel don't keep files between requests, so production uses Postgres. You don't change any code: `npm run build` (`scripts/build.mjs`) checks `DATABASE_URL`. If it's a Postgres URL, the build:
1. derives `prisma/schema.postgres.prisma` from the SQLite schema
2. generates the client from it
3. pushes the tables
4. seeds the demo stores

Local dev stays on SQLite.

1. **Create the project.** On [vercel.com](https://vercel.com), sign in with GitHub, then **Add New → Project**, import `lebom-collab/twinsync`, and leave the build settings at their defaults.
2. **Add a database.** Before the first deploy (or straight after, if it fails), open the project's **Storage** tab and choose **Create Database → Neon (Postgres)**. Connect it to the project. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
3. **Set environment variables** under **Settings → Environment Variables**:

   | Var | Value |
   |---|---|
   | `STAFF_PIN` | a new PIN (not `1234`) |
   | `COOKIE_SECRET` | a long random string, e.g. from `openssl rand -base64 32` |
   | `DEV_MODE` | `true` for desk and phone demos (store picker), `false` for a real in-store pilot |
   | `DEAL_PRICE_CENTS`, `DEAL_TITLE`, `DEAL_ITEMS` | optional, the defaults are R59.90 / Two Is Better / 2 Big Johns |

4. **Redeploy.** Go to **Deployments → ⋯ → Redeploy**. You get a permanent `https://<project>.vercel.app` link with HTTPS, so the camera and GPS work on phones.

Every push to `main` redeploys. To move the demo stores, edit `prisma/seed.ts` and push; the seed upserts on each deploy.

**Serverless caveats:**
- The staff PIN lockout counter lives in memory, so it resets per instance.
- The SSE stream polls the database every second per waiting phone. That's fine for a pilot; use Postgres LISTEN/NOTIFY or Redis at scale.

---

## How it works

```
Phone A                       Server                              Phone B
───────                       ──────                              ───────
GPS / dev store ─POST /api/sync──▶ resolve store (≤100 m)
                                  check daily limit
                                  SyncSession{token, shortCode,
◀── QR(https://…/sync?t=token) ─── expiresAt=now+60s}
    + 6-char code
SSE /api/sync/:id/events ◀────┐
                              │                    scan QR / type code
                              │   POST /api/sync/join ◀──────────── + GPS / NFC tag
                              │   resolve joiner's store
                              │   rules: not used, not expired,
                              │          not same device, same store
                              │   TX: atomic claim PENDING→PAIRED
                              │       re-check both daily limits
                              │       create 2 Vouchers (now+10 min)
◀── PAIRED, voucherId ────────┘   ─────────────────────────────────▶ voucherId
/voucher/:id                                                     /voucher/:id
```

The QR encodes a URL, so Phone B can also scan it with the phone's own camera app. That opens `/sync?t=…`, which joins automatically.

### Code map

| Path | What |
|---|---|
| `src/lib/rules.ts` | **Pure** validation rules (expiry, single use, same device, store match, daily window, redemption status). Unit-tested. |
| `src/lib/services/*` | Database logic: `syncService` (create/join/status), `voucherService` (view/verify/redeem), `storeService` (presence → store) |
| `src/app/api/**` | Thin route handlers |
| `src/sync/SyncProvider.ts` | **The sync abstraction**. See below |
| `src/sync/QrSyncProvider.ts`, `NfcTagSyncProvider.ts` | Web channels |
| `src/app/{page,sync,voucher/[id],staff}` | Screens |
| `prisma/schema.prisma`, `prisma/seed.ts` | Data model and demo stores |
| `tests/` | `rules.test.ts` (unit), `services.test.ts` (integration incl. race conditions) |

### Anti-abuse: what's enforced on the server

| Rule | Where |
|---|---|
| Sync token is valid for 60 s and is single-use | `checkJoin` + an atomic `updateMany … WHERE status='PENDING' AND expiresAt>now`. Two simultaneous scans can't both win (tested). |
| A device can't sync with itself | Anonymous device ID in an **HMAC-signed httpOnly cookie** (`src/lib/device.ts`) |
| Both phones are at the same store | The server resolves each phone's store from its own presence proof |
| One deal per device per day (configurable) | Checked at create **and** inside the join transaction for both devices. The day follows `DAY_TIMEZONE`. |
| Voucher lasts 10 minutes, works at one store, single use | `expiresAt` and `storeId` are stored on the voucher. Redeem is one conditional `UPDATE` (double-submit is safe, tested). The client countdown is display-only. |
| Location checked at sync time | `storeService.resolveStore`. GPS **can be spoofed** (comments say so). The staff redemption check is the real safeguard. |
| Dev bypass can't be abused | The server ignores `devStoreId` unless `DEV_MODE=true` |
| Staff PIN | Constant-time compare, signed 12-hour cookie, 1-minute lockout after 5 bad tries |

Known prototype limits:
- Clearing cookies or opening incognito creates a new "device". A native app would use Play Integrity / App Attest.
- The NFC tag secret can be copied off a sticker. Rotating it per day, or signing tags with NTAG 424 SUN messages, would fix that.

---

## The sync abstraction and NFC

Every channel implements one interface:

```ts
interface SyncProvider {
  id: "qr" | "nfc-tag" | "native-nfc" | "ble";
  isAvailable(): Promise<boolean>;                         // feature-detect, hide if false
  acquire(opts): Promise<{ token?, shortCode?, nfc? }>;    // Phone B gets a credential
}
```

Whichever channel delivered the credential, it goes to the same `POST /api/sync/join`, and all the checks above live there. Phone A's side is the same for every channel: `createHostSession` followed by `watchPairing` (SSE, with a polling fallback).

### Web NFC counter tags (optional)

1. **Program a tag.** On an Android phone in Chrome, open `/staff`, pick the store, then **Program counter NFC tag** and hold a blank NTAG sticker to the phone. It writes a URL: `https://<host>/sync?store=<id>&k=<secret>`.
2. **Customer.** The **Tap counter NFC tag** option appears only when `'NDEFReader' in window`. Phone B taps the tag (that proves the store) and types Phone A's 6-character code.
3. **Bonus.** Because the tag holds a URL, iPhones (and Android without the app open) can also tap it. The OS opens `/sync?store=…&k=…`, which goes straight to code entry.

Web NFC can read and write tags only. It can't do phone-to-phone, which is why the short code is still needed.

### What a native NFC/BLE version would need

A React Native / Expo app (dev client, not Expo Go) would add providers against the same interface and server:

- **`NativeNfcSyncProvider`**
  - Android: Phone A runs Host Card Emulation (HCE) and Phone B reads the token directly. Uses `react-native-nfc-manager` plus a small native HCE module.
  - iOS: Core NFC can read but can't emulate a card for third-party apps. iPhone-as-host isn't possible, so iPhones would only act as the reader (Phone B), or use BLE.
- **`BleSyncProvider`**
  - Phone A advertises a GATT service carrying a short-lived token; Phone B scans, connects and reads it. Uses `react-native-ble-plx`, plus a native peripheral module for advertising.
  - RSSI gives rough proximity, a better "same place" signal than GPS.
  - Needs Bluetooth permissions on both platforms; iOS background advertising is restricted, so keep the app in the foreground.
- **Trust**
  - Replace the cookie device ID with Play Integrity / App Attest tokens, verified server-side.
  - Optionally sign the token exchange so a relayed token can be detected.
- **Server**
  - The API is unchanged.
  - Move SQLite to Postgres: change `provider` in `schema.prisma` and `DATABASE_URL`, and swap SSE polling for LISTEN/NOTIFY or Redis pub/sub.
  - Add per-staff accounts in place of the shared PIN.

---

## Swapping in brand assets

- **Colours:** the `@theme` tokens in `src/app/globals.css`.
- **Logo:** `public/brand/logo.png`. It's used by `BrandLogo`/`Wordmark` in `src/components/ui.tsx`, the unlock screen, the favicon (`src/app/icon.png`, `apple-icon.png`) and the PWA icon route. A larger PNG or an SVG would sharpen the 512 px icon.
- **Meal photo:** `public/brand/meal.png`, shown on the home and voucher cards. Leave it out and the cards simply skip the photo.
- **Unlock-screen product shapes:** `Half` in `src/app/voucher/[id]/page.tsx`.
