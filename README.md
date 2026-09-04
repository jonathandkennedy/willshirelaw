# Wilshire Law Firm — PPC Landing Page Hub

Conversion-focused landing pages for paid traffic (Google Ads / LSA / Meta) for
**wilshirelawfirm.com**'s two practice groups — Employment Law and Personal Injury —
baked out for every Wilshire office city and its surrounding cities, following the
`results.goldbergloren.com` / `results.faragallalaw.com` pattern: one focused,
noindexed page per campaign, no site navigation, two actions only (call or 3-step form).

- **1,199 pages** = 12 page types × 100 cities (19 office cities + 81 surrounding) + statewide masters
- **Hub:** `public/index.html` — internal directory with practice/region/city filters and copy-URL buttons
- **Campaign URL list:** [`CAMPAIGN-URLS.md`](CAMPAIGN-URLS.md) · [`campaign-urls.csv`](campaign-urls.csv) (Google Ads Editor-friendly)
- **Operations guide, launch checklist, tracking wiring:** [`HANDOFF.md`](HANDOFF.md)
- **Research (firm facts, sources, reviews, keyword volumes):** `research/firm-dossier.md`, `research/keywords-us.tsv`

## Page types

| Group | Slug | H1 pattern |
|---|---|---|
| Employment | `employment-lawyer` | Fired, Harassed, or Cheated Out of Pay in {City}? |
| Employment | `wrongful-termination-lawyer` | Fired Illegally in {City}? Make Them Pay for It. |
| Employment | `unpaid-wages-lawyer` | Is Your {City} Employer Skimming Your Paycheck? |
| Employment | `sexual-harassment-lawyer` | Harassed at Work in {City}? You Don't Have to Take It. |
| Employment | `workplace-discrimination-lawyer` | Treated Differently at Work in {City}? That's Illegal. |
| Injury | `personal-injury-lawyer` | Injured in {City}? Don't Let the Insurance Company Decide What You're Worth. |
| Injury | `car-accident-lawyer` | Hurt in a {City} Car Accident? |
| Injury | `truck-accident-lawyer` | Hit by a Truck in {City}? |
| Injury | `motorcycle-accident-lawyer` | Hurt in a {City} Motorcycle Crash? |
| Injury | `pedestrian-accident-lawyer` | Hit by a Car in {City}? (pedestrian + bicycle) |
| Injury | `slip-and-fall-lawyer` | Injured in a Fall in {City}? |
| Injury | `wrongful-death-lawyer` | Lost Someone in {City}? |

URL shape: `/<page-type>/<city-slug>/` · statewide: `/<page-type>/` (California), `/<page-type>/nevada/`.
Nevada (Las Vegas office) gets injury pages only — the firm's employment practice is CA/OR/WA.

## Build & preview

Zero dependencies — Node 18+:

```bash
node build.mjs                       # renders everything into public/ (~2s)
npx serve public -l 8000             # or: python3 -m http.server 8000 --directory public
```

`public/` is committed, so the site is deploy-ready without running anything.

## Structure

```
build.mjs                 generator: page template, hub, thank-you, 404, CSV/MD exports
fetch-assets.mjs          pulls attorney headshots + logo from wilshirelawfirm.com into assets/img/ (run from a machine with internet)
content/site.json         firm-wide config: phones, stats, awards, attorneys, form backend, GTM, disclaimers, statutes
content/offices.json      regions → offices (address, phone) → surrounding cities each office serves
content/practices/*.json  one file per page type: all copy, form qualifiers, results, FAQs
assets/css/lp.css         design system (mobile-first, system fonts, navy/gold brand)
assets/js/lp.js           ~5KB runtime: ValueTrack/UTM capture, ?kw= headline swap, 3-step form, dataLayer events
assets/img/               logo.svg (placeholder), favicon.svg, attorneys/ (headshots: <key>.jpg|png|webp)
public/                   generated output — the deployable site
```

## Editing

- **Copy for a page type:** edit `content/practices/<slug>.json`, run `node build.mjs`, commit both.
- **Add a city:** add it to the right office's `serves` array in `content/offices.json`, rebuild.
- **Add an office:** add an object to a region in `content/offices.json` (slug, city, address, phone), rebuild.
- **Phones, stats, GTM, form backend:** `content/site.json` (every key has a `_note` explaining it).
- **New page type:** copy a practice JSON, change slug/copy, rebuild — geo data carries over unchanged.
