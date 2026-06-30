# Taco — Setup for this iteration

This iteration adds the Travelpayouts integration. Three changes from your perspective:

1. New folder `api/` at the project root (Vercel Edge Function — keeps the API token server-side).
2. Updated `vercel.json` so `/api/*` routes work alongside the React app.
3. New utility files under `src/utils/travelpayouts.js`.

The booking button now opens **`https://flights.fly-taco.com/searches/...?marker=744341`** in a new tab. The marker `744341` is hardcoded as your affiliate ID; the secret API token is read from a Vercel Environment Variable (instructions below).

---

## Upload to GitHub

Same flow as before — upload the contents of this folder via GitHub UI to `yehudasnow-alt/taco`. Files that need to land in the right place:

- `api/prices.js` ← new, must be at the repo root (not inside `src/`)
- `vercel.json` ← overwrite
- `src/utils/travelpayouts.js` ← new
- `src/utils/routeFinder.js` ← updated
- `src/components/Globe.jsx` ← updated
- `src/components/SearchPanel.jsx` ← updated
- `src/components/SearchPanel.module.css` ← updated

---

## Add the API token to Vercel (critical — once)

The Edge Function reads `TRAVELPAYOUTS_API_TOKEN` from environment. Without it the `/api/prices` endpoint returns 500 and routes will fall back to estimated prices.

1. Go to Vercel → your `taco` project → **Settings** → **Environment Variables**
2. Click **Add New**
3. Fill in:
   - **Key**: `TRAVELPAYOUTS_API_TOKEN`
   - **Value**: `e4ba0e15ab1d0473ec98ece7b1a9743b` (the token you generated)
   - **Environments**: tick all three (Production, Preview, Development)
4. **Save**
5. Trigger a redeploy: Deployments tab → … menu on the latest deployment → **Redeploy**. Or push any commit.

The token is never sent to the browser. It lives only in the Edge Function runtime.

---

## What to test after deploy

1. Open `https://fly-taco.com`. The globe should load with 235 country-primary airports visible.
2. Pick origin TLV → destination NRT → press **Direct / 1 stop**.
3. Within 1-2 seconds, route prices on the panel should update — direct, via-X, via-Y. Routes that got real prices from Aviasales will show a small green **`live`** badge under the price.
4. Click **Book this route**. A new tab opens to `https://flights.fly-taco.com/searches/...?marker=744341`.
   - Right now this tab will still show the SSL error because Travelpayouts hasn't issued the certificate yet. Once their support resolves it, the same button starts opening a working search page automatically — no further code change needed.
5. (Optional) Open `https://fly-taco.com/api/prices?origin=TLV&destination=NRT` directly in a browser. You should see a JSON response with `direct`, `oneStop`, `twoStop` prices.

---

## What I will know if things break

- **Routes always show `~$xxx` (tilde, no "live" badge)** → the Edge Function isn't returning prices. Most likely cause: env var wasn't added or deploy hasn't picked it up.
- **Booking button opens but page still shows SSL error** → expected until Travelpayouts SSL issuance completes. Not a code problem.
- **`/api/prices` returns 500 in browser** → check Vercel function logs for the exact error.

---

## In-memory cache behavior

The Edge Function caches each `origin→destination` price lookup for 1 hour. This means:

- First user to search TLV→NRT triggers one Aviasales API call (~300ms).
- Next 100 users searching TLV→NRT within that hour get the cached response (~5ms).
- After 1 hour the cache entry expires and we refetch.

If you ever need to invalidate the cache manually, redeploy the function — caches reset on cold start.
