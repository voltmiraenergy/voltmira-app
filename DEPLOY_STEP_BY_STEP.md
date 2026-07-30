# VoltMira — Deploy to voltmira.com (dashboard-clicks version)

This gets **one Vercel project** live where:
- `voltmira.com` → your landing page
- `voltmira.com/login` → sign in / sign up
- `voltmira.com/dashboard` → the real app (behind auth)
- `voltmira.com/p/CODE` → public tracked proposal links

You need three accounts, all free to start: **GitHub**, **Supabase**, **Vercel**.
Total time: ~30–45 minutes. No terminal required.

---

## STAGE 1 — Put the code on GitHub (5 min)

Vercel deploys from a Git repo. The app now lives at the **repository root** — no
subfolders to configure, so a plain import just works.

1. Go to **github.com** → sign in → click **+** (top right) → **New repository**.
2. Name it `voltmira`, keep it **Private**, click **Create repository**.
3. On the new repo page, click **uploading an existing file** (the link in "Quick setup").
4. On your computer, unzip `voltmira-site.zip`. **Drag the *contents* of the unzipped folder** into the browser upload area — after committing, the repo root must directly contain `package.json`, `app/`, `engine/`, `middleware.js`, etc.
   - **The test:** open your repo on GitHub — if you see `package.json` on the front page of the repo, it's right. If you instead see a single folder wrapping everything, move the contents up one level (this wrapper folder is exactly what causes the 404).
5. Click **Commit changes**.

> If drag-and-drop of folders misbehaves (GitHub's web uploader is finicky with nested folders), install **GitHub Desktop** (desktop app, no terminal): *File → Add local repository → select the unzipped folder → Publish*. This is the reliable route.

---

## STAGE 2 — Supabase: database + auth (10 min)

1. Go to **supabase.com** → **New project**.
   - Name: `voltmira`. Region: **Frankfurt (eu-central-1)** (closest to RO/MD, and keeps data in the EU for GDPR).
   - Set a strong database password (save it somewhere).
   - Click **Create new project**, wait ~2 min for it to provision.

2. **Load the schema.** Left sidebar → **SQL Editor** → **New query**.
   - Open `supabase/schema.sql` from your files, copy ALL of it, paste into the editor.
   - Click **Run**. You should see "Success. No rows returned." This creates all tables, security rules (RLS), and the `bootstrap_company()` function.

3. **Grab your API keys.** Left sidebar → **Project Settings** (gear) → **API**.
   - Copy these three values — you'll paste them into Vercel in Stage 3:
     - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
     - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role** key (click "reveal") → `SUPABASE_SERVICE_ROLE_KEY` (server-only secret — never share)

4. **Turn on email auth.** Left sidebar → **Authentication** → **Providers** → **Email** → make sure it's **enabled**. For fastest pilot onboarding, scroll to **"Confirm email"** and turn it **OFF** for now (so pilots can sign in immediately without clicking a confirmation link). You can re-enable it later.

> Google sign-in is optional. The login page has a Google button, but it only works after you configure the Google provider in Supabase. Skip it for launch — email/password is enough.

---

## STAGE 3 — Vercel: deploy the app (10 min)

1. Go to **vercel.com** → **Add New… → Project**.
2. **Import** your `voltmira` GitHub repo. (Authorize Vercel to see your GitHub if asked.)
3. **Leave Root Directory alone** — the app is at the repo root, and Framework Preset should auto-detect **Next.js**. (If it says "Other" instead of Next.js, your repo has a wrapper folder — see Stage 1, step 4.) Leave build settings default.
   - *Redeploying after the 404?* Vercel → your project → **Settings → Build & Development** → make sure **Root Directory is empty**, then **Deployments → ⋯ → Redeploy**.
4. **Add Environment Variables.** Expand **Environment Variables** and add these (name → value). Paste the Supabase values from Stage 2:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | *(your Project URL)* |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(anon key)* |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(service_role key)* |
   | `NEXT_PUBLIC_APP_URL` | `https://voltmira.com` |
   | `GEOCODER_EMAIL` | `voltmiraenergy@gmail.com` |

   **Stripe is NOT required to launch.** Leave the four `STRIPE_*` variables out for now — billing is a later step. The app runs fine without them; only the checkout button is inactive.

5. Click **Deploy**. Wait ~2 minutes. You'll get a URL like `voltmira-xxx.vercel.app`.
6. **Test it** at that temporary URL:
   - The homepage should show your landing page.
   - Click **Sign in** → **Sign Up** → create an account with a company name → you should land in the dashboard.
   - If that works, the backend is fully wired. 🎉

---

## STAGE 4 — Connect voltmira.com (10 min)

You said the domain is already on Vercel. To attach it to this project:

1. In your project → **Settings → Domains**.
2. Type `voltmira.com` → **Add**. Also add `www.voltmira.com` (Vercel will offer to redirect www → root; accept).
3. Vercel shows DNS records to set:
   - If the domain is **registered/managed at Vercel**, it wires automatically — nothing to do.
   - If DNS is **elsewhere** (e.g. your registrar), add the records Vercel shows: usually an **A record** `@ → 76.76.21.21` and a **CNAME** `www → cname.vercel-dns.com`. Save at your registrar; propagation is minutes to a couple hours.
4. Once it shows **Valid Configuration**, visit **https://voltmira.com** — SSL is automatic.

5. **Point Supabase auth at the real domain.** Back in Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://voltmira.com`
   - **Redirect URLs**: add `https://voltmira.com/**`
   - Save. (This makes password reset / confirmation links point to your domain, not the vercel.app URL.)

**You're live.**

---

## STAGE 5 — First real test (5 min) — the moment that matters

This is the single test that proves the whole thing works end-to-end:

1. On voltmira.com, sign in → create a project → fill in a quote.
2. Generate a **proposal link**.
3. Open that link **on your phone** (not your computer).
4. Back on your computer dashboard, you should see the **open event / tracking** register.

If the proposal opens on your phone and the dashboard knows — your backend, auth, database, and tracking are all working. That's your green light for installer conversations.

---

## What to do later (not needed for launch)

- **Stripe billing**: create Products/Prices (€49 Pro, €99 Team) in Stripe, add the four `STRIPE_*` env vars in Vercel, redeploy. Guide in `docs/DEPLOYMENT.md`.
- **Email confirmation ON**: re-enable in Supabase once you're past hand-holding pilots.
- **Privacy/Terms pages**: live at `/privacy` and `/terms` — the landing footer links to them.
- **Social sharing / SEO domain**: the landing `<head>` hardcodes `https://voltmira.com` in the canonical link, hreflang alternates, and `og:image`/`og:url` tags, and the share image lives at `public/og.png`. If you launch on a different domain, search-and-replace `voltmira.com` inside `app/_landing/landing.html` (head section only).

---

## Bot protection on signup — Cloudflare Turnstile (10 min, free)

The signup form already supports Turnstile; you only add two keys.

1. Cloudflare dashboard → **Turnstile** → *Add site* → domain `voltmira.com` → widget mode *Managed*. You get a **Site key** and a **Secret key**.
2. Vercel → your project → *Environment Variables* → add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the **Site key** → redeploy. The widget now appears on the login/signup form.
3. Supabase dashboard → **Authentication → Attack Protection → Enable CAPTCHA** → provider **Turnstile** → paste the **Secret key**. Supabase now rejects any signup or sign-in without a valid human token — the check happens server-side, so it can't be bypassed by calling the API directly.

Until you do this, the form works with no widget (nice for local dev). Login error messages are already generic ("Email or password is incorrect" / "We couldn't create an account with these details"), so responses never reveal whether an email is registered.

---

## Proposal-opened email alerts — Resend (10 min, free tier 100/day)

Built in: when a client opens a proposal link, the company owner gets a branded email with open count, total viewing time, and a link to the activity feed — at most **one email per proposal every 4 hours**, and installers can switch it off in Settings.

1. Create an account at **resend.com** → *Domains* → add and verify `voltmira.com` (two DNS records). To test before DNS, you can skip this and use their onboarding sender.
2. *API Keys* → create key.
3. Vercel env vars → add `RESEND_API_KEY` and `RESEND_FROM` (e.g. `VoltMira <notify@voltmira.com>`; must match the verified domain) → redeploy.

Without `RESEND_API_KEY` the app runs normally and simply doesn't send — no errors, tracking unaffected.

---

## Troubleshooting

- **Build fails on Vercel**: 99% of the time it's the Root Directory — it must be `web`. Re-check Stage 3, step 3.
- **Homepage shows login instead of landing**: the middleware update that makes `/` public didn't deploy — make sure you uploaded the latest `middleware.js` (this version has `path === "/"` in the public list).
- **"Invalid API key" on sign-in**: an env var is wrong or missing. Project → Settings → Environment Variables, verify all three Supabase values, then **redeploy** (Deployments → ⋯ → Redeploy).
- **Proposal link shows nothing on phone**: check that the schema ran fully in Supabase (Stage 2, step 2) — the `proposals` and `proposal_events` tables must exist.
