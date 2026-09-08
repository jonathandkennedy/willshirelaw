# Wilshire Law Firm Landers — Deploy & Operate

## What's here
- 12 page types (5 employment, 7 injury) × 100 cities + California/Nevada statewide masters = **1,199 pages**, all in `public/`.
- `public/index.html` — internal review hub (noindex; never send ad traffic here). Filters by practice, region, city; copy-URL button on every chip; the recommended ValueTrack final-URL suffix with a copy button.
- `public/thank-you/` — conversion page. Fires `lead_form_submit` (with `practice`, `geo`, `variant`) and shows the same office phone the visitor saw. `public/404.html` — branded not-found with call CTA (Vercel and Netlify serve it automatically).
- `campaign-urls.csv` / `CAMPAIGN-URLS.md` — every final URL with region, office, phone shown, and a `?kw={keyword}` test URL.

## 🚨 Launch checklist — do not send paid traffic until every box is checked
**Blockers**
- [ ] **Form backend.** `content/site.json → form`. Right now the form is in **demo mode**: it validates, shows the success card and redirects to `/thank-you/`, but sends nothing (safe for client review on Vercel). Before ads: set `formspree_id` (or a CRM/Zapier `endpoint`) and rebuild; on Netlify you can instead set `form.netlify: true` and Netlify Forms captures submissions with zero config. Test with a real phone: the lead must arrive with subject `WilshirePPC — <practice> — <city> — <name>`.
- [ ] **Phones.** Pages show each office's local number. Six offices had no verified local line in public listings (Long Beach, Ontario, Bakersfield, Fresno, Modesto, Las Vegas) and currently show the firm's main line (800) 522-7274 — see `phone_note` in `content/offices.json`. Get the real office lines from the firm, or set `site.campaign_phone_display/tel` to force one tracking number everywhere. If using CallRail, set `callrail_swap_url` and make sure the swap pool includes every displayed number.
- [ ] **GTM.** Set `site.gtm_id`, rebuild. Inside the container: GA4 tag + Google Ads conversion tags on `call_click` (phone taps) and `lead_form_submit` (thank-you page). **Count calls as conversions** — the majority of legal PPC conversions are calls. Don't also add a page-path trigger for `/thank-you/` on the same conversion action or it double-counts.
- [ ] **Claims to verify with the firm** (all sourced in `research/firm-dossier.md`, but the firm's own site was unreachable from the build environment): "$3B+ recovered"; "59 of the top 100 personal injury settlements in California in 2024"; the case results ($36M Fresno, $35M truck verdict, $28.7M pedestrian, $18.5M motorcycle, $17.12M bus); "Partner Arrash Fattahi: $75M+ in employment settlements since 2023 / $45M+ in 2025"; the 2025 class/PAGA verdict; Tier 1 L&E (Best Law Firms 2026); Chargers partnership still current. Edit any claim in `content/practices/*.json` or `content/site.json` and rebuild.
- [ ] **Testimonials** are verbatim Google reviews from the firm's Los Angeles profile (pulled 2026-09-04, reviewer names as displayed on Google). Confirm the firm is comfortable quoting them (client permission per bar rules); swap any in the practice JSON files.
- [ ] **Privacy policy URL** (`site.privacy_url`) must resolve — it's linked from the TCPA consent line on every form.
- [ ] **Attorney headshots + official logo.** The Claude Code cloud sandbox cannot reach wilshirelawfirm.com (every non-GitHub/npm host is blocked by the environment's network policy), so pull them from a normal machine:
  ```bash
  node fetch-assets.mjs        # scrapes /legal-team/ for Saadian, Yslas, Fattahi, Marquez headshots + the site logo
  node build.mjs               # attorney cards switch from initials to photos; header uses the real wordmark
  git add assets public && git commit -m "Add firm assets" && git push
  ```
  Or drop files by hand: `assets/img/attorneys/<saadian|yslas|fattahi|marquez>.<jpg|png|webp>` (square, ≥200px) and `assets/img/logo.<png|svg|webp>` (a wide wordmark replaces the placeholder "W" monogram automatically). Alternatively give this session an environment whose network policy allows wilshirelawfirm.com (see https://code.claude.com/docs/en/claude-code-on-the-web) and ask it to run the script.
- [ ] **Domain.** Deploy to a subdomain of the firm's domain (e.g. `results.wilshirelawfirm.com`, CNAME → host) and set `site.base_url` to match, then rebuild so canonical URLs and the CSV are right. Never run ads to `*.vercel.app` / `*.netlify.app` — display URL must match the final URL domain.

**Recommended**
- [ ] Microsoft Clarity (`site.clarity_id`) for recordings/heatmaps.
- [ ] Ask intake for a real response-time promise and put it in `site.response_promise` ("A real person calls back within 5 minutes" beats the current generic line). Speed-to-lead is the whole game.
- [ ] Spanish pages. Every page carries "Se Habla Español" and the `?kw=abogado…` variant swaps the H1 to Spanish, but there is no full Spanish page set yet. LA/IE/Central Valley Spanish search volume justifies a phase-2 `?lang=es` set like Goldberg & Loren's.

## Deploy
**Vercel (recommended, static):** `npx vercel --prod` from the repo root — `vercel.json` sets `public/` as output, clean URLs, noindex headers. Then add the custom domain. Forms need `formspree_id` or `endpoint`.

**Netlify:** new site from this repo; `netlify.toml` builds with `node build.mjs` and publishes `public/`. Forms work immediately.

## How the PPC admin uses the hub
1. Open `/` (the hub). Filter to the practice and region. Each chip is a page — click to preview, hover → ⧉ copies the final URL.
2. Set the ad group's **Final URL** to that page. Use one page type per ad group (e.g. `wrongful-termination-lawyer/santa-ana/` for the "wrongful termination" ad group targeting Santa Ana), and the statewide master for broad/state campaigns.
3. Add the **Final URL suffix** (copy button in the hub) at the account or campaign level:
   `kw={keyword}&matchtype={matchtype}&campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&device={device}&network={network}&loc_physical_ms={loc_physical_ms}&utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}`
   Every one of those lands in the lead as hidden fields (plus `landing_page`, `first_touch`, `referrer`, `device_type`, `gclid`/`gbraid`/`wbraid`).
4. **Dynamic keyword headlines.** With `kw={keyword}` present, the H1 adapts (whitelist only — raw query text never touches the DOM):
   - contains "near me" → "{Practice} Attorneys Near You in {City} — Free Case Review 24/7"
   - "best"/"top" → "Looking for the Best {Practice} Lawyer in {City}?"
   - "free consultation/case review" → "Free {Practice} Case Review in {City} — 24/7, No Obligation"
   - "attorney" → "Need a {City} {Practice} Attorney?" · "lawyer/law firm" → "Need a {City} {Practice} Lawyer?"
   - "abogado"/"español" → Spanish H1
   - anything else / no `kw` → the control headline, unchanged.
   A `kw_variant` dataLayer event fires and `/thank-you/?variant=kw-<variant>` lets GA4 compare variants vs control. Evaluate after 2–3 weeks; tighten the whitelist if a variant underperforms.
5. Google Ads ad copy should mirror the page: "No Fee Unless We Win", "Free 24/7 Case Review", "$3B+ Recovered", "4.9★ · 2,500+ Google Reviews", city name in headline 1.

## Keyword data (research/keywords-us.tsv, DataForSEO US, Sept 2026)
Highest-intent seeds and CPCs: "personal injury lawyer near me" 301K/mo · $152; "car accident lawyer near me" 135K · $202; "car accident attorney" 49.5K · $218; "employment lawyer" 135K · $34; "employment lawyer near me" 49.5K · $25; "wrongful termination lawyer" 60.5K · $33; "wrongful termination lawyer near me" 2.4K · $22; "employment lawyer los angeles" 4.4K · $58; "personal injury lawyer los angeles" 18.1K · $82; "car accident lawyer los angeles" 9.9K · $77; "personal injury lawyer las vegas" 12.1K · $159; "san diego employment lawyers" 1.6K · $45; "contingency lawyers near me" 1.9K · $89. Employment CPCs are a fraction of injury CPCs — the employment set is the cheaper lead source and the pages lean on the firm's Tier 1 L&E ranking for that reason.

## Tracking events (dataLayer)
| Event | Where | Payload |
|---|---|---|
| `call_click` | any phone tap | `phone`, `location` (header/hero/offer/final/sticky/form-success), practice, geo |
| `form_step` | reaching step 2 / 3 | `step` |
| `lead_form_submit` | `/thank-you/` pageview | `practice`, `geo`, `variant` |
| `lead_form_error` | send failure | `error_status` |
| `kw_variant` | `?kw=` matched a whitelist rule | `kw_variant`, sanitized `kw` |

## Form behaviour
3 steps: practice-specific qualifier → second qualifier → name + mobile + TCPA consent. Phone validation requires a real 10-digit US number (no 0/1 area codes, no repeated digits, no N11). Honeypot (`company_website`) swallows bots. The page waits for the backend's response: 2xx → success card → redirect to `/thank-you/`; failure/timeout → the visitor stays on the form with "call (office number) instead" and `lead_form_error` fires. Submit button disables while sending (no double leads).

## Compliance guardrails baked in
"No fee unless we win" always paired with the court-costs disclaimer; "Prior results do not guarantee a similar outcome" under every results block; attorney-advertising footer with the responsible attorney and HQ address; TCPA consent checkbox; "Do Not Sell or Share" link; statutes quoted with code sections (CCP §335.1, FEHA 3-year CRD deadline, Labor Code penalties) — legal-review the statute text in `site.sol` before launch. Reviews are verbatim. No invented results.

## Cookies / privacy
No cookie banner (US-only traffic, no EU-style opt-in required, and a banner costs conversion). `sessionStorage` holds first-touch URL only.
