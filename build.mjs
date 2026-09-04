#!/usr/bin/env node
/**
 * Wilshire Law Firm — PPC landing page generator (zero dependencies, Node 18+).
 *   node build.mjs            → renders everything into public/
 * Inputs:  content/site.json · content/offices.json · content/practices/*.json · assets/
 * Outputs: public/<practice>/<city>/index.html  (one page per practice × city)
 *          public/<practice>/index.html          (California-wide master)
 *          public/<practice>/nevada/index.html   (Nevada master, injury only)
 *          public/index.html (hub) · public/thank-you/ · public/404.html · public/assets/
 *          campaign-urls.csv · CAMPAIGN-URLS.md
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "public");
const site = JSON.parse(readFileSync(join(ROOT, "content/site.json"), "utf8"));
const officesData = JSON.parse(readFileSync(join(ROOT, "content/offices.json"), "utf8"));
const practices = readdirSync(join(ROOT, "content/practices")).filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(readFileSync(join(ROOT, "content/practices", f), "utf8")));
const ORDER = ["employment-lawyer","wrongful-termination-lawyer","unpaid-wages-lawyer","sexual-harassment-lawyer","workplace-discrimination-lawyer",
               "personal-injury-lawyer","car-accident-lawyer","truck-accident-lawyer","motorcycle-accident-lawyer","pedestrian-accident-lawyer","slip-and-fall-lawyer","wrongful-death-lawyer"];
practices.sort((a,b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

const e = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const slugify = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const STATE_NAME = { CA: "California", NV: "Nevada" };

/* ---------------- geo list ---------------- */
const GEOS = [];
const seen = new Set();
for (const region of officesData.regions) {
  for (const o of region.offices) {
    const base = { region: region.name, office: o, state: o.state, county: o.county, practices: o.practices || ["employment","injury"] };
    const officeGeo = { ...base, slug: o.slug, city: o.city, isOffice: true };
    if (seen.has(o.slug)) throw new Error("duplicate slug " + o.slug); seen.add(o.slug);
    GEOS.push(officeGeo);
    for (const c of o.serves || []) {
      const slug = slugify(c);
      if (seen.has(slug)) throw new Error("duplicate city slug " + slug + " (" + c + ")"); seen.add(slug);
      GEOS.push({ ...base, slug, city: c, isOffice: false });
    }
  }
}
const OFFICE_COUNT = officesData.regions.reduce((n, r) => n + r.offices.length, 0);
const CA_OFFICES = officesData.regions.reduce((n, r) => n + r.offices.filter(o => o.state === "CA").length, 0);

function phoneFor(geo) {
  if (site.campaign_phone_display) return { display: site.campaign_phone_display, tel: site.campaign_phone_tel };
  if (!geo.office) return { display: site.main_phone_display, tel: site.main_phone_tel };
  return { display: geo.office.phone, tel: geo.office.phone_tel };
}
function serveLine(geo) {
  if (geo.isState) return geo.state === "CA"
    ? `Serving all of California — ${site.stats.offices} offices from San Diego to Sacramento. Intake open 24/7.`
    : `Serving Las Vegas, Henderson, and all of Nevada. Intake open 24/7.`;
  if (geo.isOffice) return `Serving ${geo.city} and all of ${geo.county} · ${site.stats.offices} offices across California & Nevada.`;
  return `Serving ${geo.city} and all of ${geo.county} from our ${geo.office.city} office · ${site.stats.offices} offices across California & Nevada.`;
}
function officeLine(geo, ph) {
  if (geo.isState) return `${site.firm_legal} · Headquarters: 660 S. Figueroa St., Sky Lobby, Los Angeles, CA 90017 · ${site.stats.offices} offices · Intake open 24/7: ${ph.display}`;
  const o = geo.office;
  return `${site.firm_legal} · ${o.address}, ${o.city}, ${o.state} ${o.zip} · Intake open 24/7: ${ph.display}`;
}

/* ---------------- svg icons ---------------- */
const I = {
  phone: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.4-7 9.5C8 19.4 5 15.4 5 11V6l7-3z"/><path d="M9 11.5l2 2 4-4"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 13l1.7 1.7L15 11.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8M8 12h5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.6-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.4-9 9-9 9z"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l5-5 4 3 7-8"/><path d="M16 7h4v4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.5l6.3-.9L12 3z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="7.5" r="3"/><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="8.5" r="2.5"/><path d="M16 15.2c2.6.3 4.5 2.1 4.5 4.8"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M9 21h6M10 17h4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h3.5a1.75 1.75 0 0 1 0 3.5h-2a1.75 1.75 0 0 0 0 3.5H15"/></svg>'
};
const benefitIcon = t => /confidential/i.test(t) ? I.lock : /compassion/i.test(t) ? I.heart : /espa/i.test(t) ? I.chat : /free/i.test(t) ? I.doc : I.shield;

function logoHtml(){
  const svg = readFileSync(join(ROOT, "assets/img/logo.svg"), "utf8").replace(/<\?xml[^>]*>/, "");
  return `<a class="logo" href="#top" aria-label="${e(site.firm_name)}">${svg}<span class="logo-txt"><b>Wilshire Law Firm</b><span>${e(site.firm_tagline)}</span></span></a>`;
}
const LOGO = logoHtml();

function headSnippets(){
  let s = "";
  if (site.gtm_id) s += `\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${site.gtm_id}');</script>`;
  if (site.clarity_id) s += `\n<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${site.clarity_id}");</script>`;
  return s;
}
const gtmNoscript = () => site.gtm_id ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${site.gtm_id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : "";
const callrail = () => site.callrail_swap_url ? `<script src="${e(site.callrail_swap_url)}"></script>` : "";

/* ---------------- page renderer ---------------- */
function tokens(str, geo) {
  return String(str).replace(/\{City\}/g, geo.city).replace(/\{Office\}/g, geo.office ? geo.office.city : "Los Angeles")
    .replace(/\{County\}/g, geo.county || STATE_NAME[geo.state]).replace(/\{State\}/g, STATE_NAME[geo.state]);
}
function attorneyCard(key){
  const a = site.attorneys[key]; if (!a) return "";
  const photo = join(ROOT, "assets/img/attorneys", key + ".jpg");
  const av = existsSync(photo) ? `<img src="/assets/img/attorneys/${key}.jpg" alt="${e(a.name)}" width="96" height="96" loading="lazy">` : e(a.initials);
  return `<div class="att"><div class="av">${av}</div><div><b>${e(a.name)}</b><span>${e(a.title)}</span></div></div>`;
}
function telLink(ph, cls, loc, inner){ return `<a class="${cls} js-tel" href="tel:${ph.tel}" data-loc="${loc}">${inner}</a>`; }

function renderPage(p, geo) {
  const ph = phoneFor(geo);
  const T = s => tokens(s, geo);
  const h1 = geo.isState ? p.h1_state : p.h1;
  const path = geo.isState ? (geo.state === "CA" ? `/${p.slug}/` : `/${p.slug}/nevada/`) : `/${p.slug}/${geo.slug}/`;
  const url = site.base_url + path;
  const sol = site.sol[geo.state][p.group];
  const badges = p.group === "employment" ? site.trust_badges_employment : site.trust_badges;
  const endpoint = site.form.endpoint || (site.form.formspree_id ? `https://formspree.io/f/${site.form.formspree_id}` : "");
  const netlifyAttrs = site.form.netlify && !endpoint ? ' data-netlify="true" netlify-honeypot="company_website"' : "";
  const formAction = endpoint || "/thank-you/";
  const cfg = { practice: p.slug, practiceName: p.name, group: p.group, kwNoun: p.kw_noun, geo: geo.isState ? STATE_NAME[geo.state].toLowerCase() : geo.slug, city: geo.city, office: geo.office ? geo.office.slug : "hq",
    phoneDisplay: ph.display, endpoint, netlify: !!(site.form.netlify && !endpoint), subject: site.form.subject_prefix, thankyou: "/thank-you/", gtm: "" };
  const hidden = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","gbraid","wbraid","msclkid","fbclid","kw","matchtype","campaignid","adgroupid","creative","device","network","placement","loc_physical_ms","targetid","landing_page","page_url","first_touch","referrer","device_type"]
    .map(n => `<input type="hidden" name="${n}" value="">`).join("");
  const stats = site.stats;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "LegalService", name: site.firm_name, url, telephone: ph.tel, priceRange: "No fee unless we win",
      areaServed: geo.city, address: geo.office ? { "@type": "PostalAddress", streetAddress: geo.office.address, addressLocality: geo.office.city, addressRegion: geo.office.state, postalCode: geo.office.zip, addressCountry: "US" } : undefined,
      aggregateRating: { "@type": "AggregateRating", ratingValue: stats.rating, reviewCount: stats.reviews_exact.replace(/,/g, "") } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(f => ({ "@type": "Question", name: T(f.q), acceptedAnswer: { "@type": "Answer", text: T(f.a).replace(/\{SOL\}/g, sol).replace(/<[^>]+>/g, "") } })) }
  ];
  const title = T(p.meta_title);
  const desc = T(p.meta_description);

  return `<!doctype html>
<html lang="en" data-practice="${p.slug}" data-geo="${cfg.geo}">
<head>
<meta charset="utf-8">${headSnippets()}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="website"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(url)}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/css/lp.css" as="style"><link rel="stylesheet" href="/assets/css/lp.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/json" id="lp-config">${JSON.stringify(cfg)}</script>
</head>
<body id="top">
${gtmNoscript()}
<header class="hd"><div class="hd-in">
  ${LOGO}
  <div class="hd-right">
    ${telLink(ph, "hd-phone", "header", `<strong class="js-tel-text">${e(ph.display)}</strong><span>Open 24/7 · Free Consult</span>`)}
    <a class="btn btn-cta hd-cta" href="#case-form">Free Case Review</a>
  </div>
</div></header>

<main>
<section class="hero" style="padding:0"><div class="hero-in">
  <div class="hero-top">
    <p class="eyebrow">${e(T(p.eyebrow))}</p>
    <h1><span class="h1-pre">${e(h1.pre)}</span><em class="h1-city">${e(geo.city)}</em><span class="h1-post">${e(h1.post)}</span></h1>
    <p class="hero-sub">${e(T(p.hero_sub))}</p>
    <div class="hero-ctas">
      ${telLink(ph, "btn btn-cta cta-call", "hero", `${I.phone}<span>Call <span class="js-tel-text">${e(ph.display)}</span> Now — Free 24/7</span>`)}
      <a class="btn btn-ghost cta-form-link" href="#case-form">Check My Case Online — 60 Seconds</a>
    </div>
    <div class="benefits">${p.benefits.map(b => `<div class="benefit">${benefitIcon(b)}<span class="b-txt">${e(b)}</span></div>`).join("")}</div>
    <p class="serve">${e(serveLine(geo))}</p>
  </div>

  <form class="card" id="case-form" name="lead" method="POST" action="${e(formAction)}"${netlifyAttrs} novalidate>
    <input type="hidden" name="form-name" value="lead">
    <input type="hidden" name="_subject" value="${e(site.form.subject_prefix)} — ${e(p.name)} — ${e(geo.city)}">
    <input type="hidden" name="practice" value="${e(p.slug)}"><input type="hidden" name="practice_name" value="${e(p.name)}"><input type="hidden" name="city" value="${e(geo.city)}"><input type="hidden" name="office" value="${e(cfg.office)}"><input type="hidden" name="geo" value="${e(cfg.geo)}">
    <input type="hidden" name="${e(p.form.q1.key)}" value=""><input type="hidden" name="${e(p.form.q2.key)}" value="">
    ${hidden}
    <h2>${e(T(p.form.title))}</h2>
    <p class="card-sub">${e(p.form.sub)}</p>
    <a class="card-review" href="${e(site.google_reviews_url)}" target="_blank" rel="noopener"><i>★★★★★</i> ${e(stats.rating)} · ${e(stats.reviews)} Google reviews</a>
    <div class="step-label" id="step-label">Step 1 of 3</div>
    <div class="dots" aria-hidden="true"><span class="dot on"></span><span class="dot"></span><span class="dot"></span></div>
    <div class="fstep" data-step="1">
      <p class="q">${e(p.form.q1.label)}</p>
      <div class="opts">${p.form.q1.options.map(o => `<button type="button" class="opt" data-k="${e(p.form.q1.key)}" data-v="${e(o)}">${e(o)}</button>`).join("")}</div>
    </div>
    <div class="fstep" data-step="2" hidden>
      <button type="button" class="back">&larr; Back</button>
      <p class="q">${e(p.form.q2.label)}</p>
      <div class="opts">${p.form.q2.options.map(o => `<button type="button" class="opt" data-k="${e(p.form.q2.key)}" data-v="${e(o)}">${e(o)}</button>`).join("")}</div>
    </div>
    <div class="fstep" data-step="3" hidden>
      <button type="button" class="back">&larr; Back</button>
      <p class="q">Where should we send your free case review?</p>
      <div class="fld"><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required></div>
      <div class="fld"><label for="f-phone">Mobile phone</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(555) 123-4567" required></div>
      <p class="err" id="f-err">Please enter your name and a valid 10-digit phone number.</p>
      <div class="hp" aria-hidden="true"><label>Website<input name="company_website" tabindex="-1" autocomplete="off"></label></div>
      <label class="consent"><input type="checkbox" id="f-consent" name="tcpa_consent" value="yes" required><span>${e(site.consent_text)} <a href="${e(site.privacy_url)}" target="_blank" rel="noopener">Privacy Policy</a></span></label>
      <button type="submit" class="btn btn-cta submit">Get My Free Case Review &rarr;</button>
      <p class="form-note">${e(site.response_promise)}</p>
    </div>
    <div class="fstep success" data-step="4" hidden>
      <div class="tick" aria-hidden="true">✓</div>
      <h3>Got it<span id="s-name"></span>.</h3>
      <p>Keep your phone close — our team is on it. Want answers even faster?</p>
      ${telLink(ph, "btn btn-navy", "form-success", `<span>Call <span class="js-tel-text">${e(ph.display)}</span> Now</span>`)}
    </div>
    <p class="or-call">Prefer to talk? ${telLink(ph, "", "form-footer", `<span class="js-tel-text">${e(ph.display)}</span>`)} — free, 24/7</p>
    <div class="quote"><div class="qstars" aria-label="5 out of 5 stars">★★★★★</div><p>"${e(p.form_quote.text)}"</p><div class="qby">${e(p.form_quote.by)}</div></div>
  </form>

  <div class="hero-proof"><div class="stats" role="list">
    <div class="stat" role="listitem">${I.trend}<b>${e(stats.recovered)}</b><span>${e(stats.recovered_label)}</span></div>
    <div class="stat" role="listitem">${I.star}<b>${e(stats.rating)}★ · ${e(stats.reviews)}</b><span>${e(stats.reviews_label)}</span></div>
    <div class="stat" role="listitem">${I.people}<b>${e(stats.attorneys)}</b><span>${e(stats.attorneys_label)}</span></div>
    <div class="stat" role="listitem">${I.trophy}<b>${p.group === "employment" ? "Tier 1" : e(stats.top100)}</b><span>${p.group === "employment" ? "Labor & Employment Litigation · Best Law Firms 2026" : e(stats.top100_label)}</span></div>
  </div></div>
</div></section>

<div class="trustline" aria-label="Ratings and recognitions"><div class="wrap">${badges.map(b => `<span>${e(b)}</span>`).join("")}</div></div>

<section class="urgency"><div class="wrap">
  <p class="eyebrow">${e(p.urgency.eyebrow)}</p>
  <h2 class="sec-h">${e(T(p.urgency.h))}</h2>
  <p class="sec-sub">${e(T(p.urgency.sub))}</p>
  <div class="ugrid">${p.urgency.cards.map(c => `<div class="ucard"><b>${e(c.t)}</b><p>${e(T(c.p))}</p></div>`).join("")}</div>
</div></section>

<section class="results"><div class="wrap">
  <p class="eyebrow">Case Results</p>
  <h2 class="sec-h">Real Results. Not Promises.</h2>
  <p class="sec-sub">The other side already knows these numbers. Now you do too.</p>
  <div class="rgrid">${p.results.map(r => `<div class="rcard"><b>${e(r.amount)}</b><span>${e(r.label)}</span><em>${e(r.tag)}</em></div>`).join("")}</div>
  <div class="rhigh">${T(p.result_highlight)}</div>
  <p class="fine">${e(site.results_fine)}</p>
</div></section>

<section class="value"><div class="wrap">
  <p class="eyebrow">${e(p.value.eyebrow)}</p>
  <h2 class="sec-h">${e(T(p.value.h))}</h2>
  <p class="sec-sub">${e(T(p.value.sub))}</p>
  <div class="vgrid">${p.value.items.map(v => `<div class="vitem">${I.coin}<div><b>${e(v.t)}</b><p>${e(T(v.p))}</p></div></div>`).join("")}</div>
</div></section>

<section class="offer"><div class="wrap">
  <p class="eyebrow">The Offer</p>
  <h2 class="sec-h">${e(T(p.offer.h))}</h2>
  <div class="ogrid">
    <div class="obox"><h3>Your free case review includes:</h3><ul>${p.offer.includes.map(i => `<li>${I.check}<span>${e(T(i))}</span></li>`).join("")}</ul></div>
    <div class="gbox"><span class="g-k">Our Guarantee</span><h3>No Fee Unless We Win.</h3><p>${T(p.offer.guarantee)}</p>${telLink(ph, "btn btn-cta", "offer", `${I.phone}<span>Call <span class="js-tel-text">${e(ph.display)}</span></span>`)}</div>
  </div>
</div></section>

<section class="how"><div class="wrap">
  <p class="eyebrow">What Happens When You Call</p>
  <h2 class="sec-h">Free, Fast, and on Your Side Today</h2>
  <div class="steps">${p.how.map((s,i) => `<div class="step"><b><i>${i+1}</i>${e(s.t)}</b><p>${e(T(s.p))}</p></div>`).join("")}</div>
</div></section>

<section class="insider"><div class="wrap">
  <p class="eyebrow">${e(p.why.eyebrow)}</p>
  <h2 class="sec-h">${e(T(p.why.h))}</h2>
  <div class="grid">
    <div class="atts">${p.why.attorneys.map(attorneyCard).join("")}</div>
    <div>
      ${p.why.paras.map(x => `<p>${T(x)}</p>`).join("")}
      <p class="local-line">${e(officeLine(geo, ph))}</p>
      <div class="mult"><b>${e(p.why.mult.big)}</b><span>${T(p.why.mult.text)}</span></div>
      <div class="ticks">${p.why.chips.map(c => `<span class="tick-chip">${e(c)}</span>`).join("")}</div>
    </div>
  </div>
</div></section>

<section class="reviews"><div class="wrap">
  <p class="eyebrow">Client Reviews</p>
  <h2 class="sec-h">What Clients Say — ${e(stats.rating)}★ on Google</h2>
  <div class="tgrid">${p.testimonials.map(t => `<div class="tcard"><div class="tstars" aria-label="5 out of 5 stars">★★★★★</div><p>"${e(t.text)}"</p><div class="tby"><span class="gdot">G</span>${e(t.by)}</div></div>`).join("")}</div>
  <p class="t-link">Verbatim Google reviews · <a href="${e(site.google_reviews_url)}" target="_blank" rel="noopener">Read all ${e(stats.reviews)} reviews</a></p>
</div></section>

<section class="faq"><div class="wrap">
  <p class="eyebrow">Straight Answers</p>
  <h2 class="sec-h">Questions Everyone Asks</h2>
  ${p.faq.map(f => `<details><summary>${e(T(f.q))}</summary><p>${T(f.a).replace(/\{SOL\}/g, sol)}</p></details>`).join("\n  ")}
</div></section>

<section class="final"><div class="wrap">
  <h2 class="sec-h">${e(T(p.final.h))}</h2>
  <p>${e(T(p.final.p))}</p>
  <div class="final-ctas">
    ${telLink(ph, "btn btn-cta cta-call", "final", `${I.phone}<span>Call <span class="js-tel-text">${e(ph.display)}</span> Now — Free 24/7</span>`)}
    <a class="btn btn-ghost" href="#case-form">Check My Case Online Instead</a>
  </div>
</div></section>
</main>

<footer><div class="wrap">
  ${LOGO}
  <p class="f-office">${e(officeLine(geo, ph))}</p>
  <p class="f-lang">${e(site.languages_line)}</p>
  <p>${e(site.disclaimer_footer)}</p>
  <p><a href="${e(site.privacy_url)}" target="_blank" rel="noopener">Privacy Policy</a> · <a href="${e(site.privacy_url)}" target="_blank" rel="noopener">Do Not Sell or Share My Personal Information</a> · <a href="${e(site.main_site_url)}" target="_blank" rel="noopener">wilshirelawfirm.com</a> · © <span id="yr">${new Date().getFullYear()}</span> ${e(site.firm_legal)}. All rights reserved.</p>
</div></footer>

<div class="bar" role="navigation" aria-label="Quick contact">
  ${telLink(ph, "btn btn-cta", "sticky", `${I.phone}<span>Call Now — Free</span>`)}
  <a class="btn btn-navy" href="#case-form">Free Case Review</a>
</div>
<script src="/assets/js/lp.js" defer></script>
${callrail()}
</body>
</html>
`;
}

/* ---------------- thank-you & 404 ---------------- */
function shell(title, body, extraHead = "") {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">${headSnippets()}<meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/lp.css">${extraHead}</head>
<body id="top">${gtmNoscript()}
<header class="hd"><div class="hd-in">${LOGO}<div class="hd-right"><a class="hd-phone js-tel" href="tel:${site.main_phone_tel}" data-loc="header"><strong class="js-tel-text">${e(site.main_phone_display)}</strong><span>Open 24/7 · Free Consult</span></a></div></div></header>
<main>${body}</main>
<footer><div class="wrap">${LOGO}<p>${e(site.disclaimer_footer)}</p><p><a href="${e(site.privacy_url)}" target="_blank" rel="noopener">Privacy Policy</a> · © <span id="yr">${new Date().getFullYear()}</span> ${e(site.firm_legal)}.</p></div></footer>
<script src="/assets/js/lp.js" defer></script>${callrail()}
</body></html>`;
}
function thankYou() {
  const phones = {};
  for (const g of GEOS) { const ph = phoneFor(g); phones[g.slug] = { d: ph.display, t: ph.tel, city: g.city }; }
  phones.california = { d: site.campaign_phone_display || site.main_phone_display, t: site.campaign_phone_tel || site.main_phone_tel, city: "California" };
  phones.nevada = { d: site.campaign_phone_display || site.main_phone_display, t: site.campaign_phone_tel || site.main_phone_tel, city: "Nevada" };
  const body = `
<section class="hero" style="padding:0"><div class="hero-in" style="grid-template-columns:1fr;max-width:820px">
  <div class="hero-top">
    <p class="eyebrow">Request received</p>
    <h1><span class="h1-pre">You Did the Hard Part. </span><em class="h1-city">We've Got It From Here.</em></h1>
    <p class="hero-sub">Your free case review is in the queue with our intake team. Keep your phone nearby — they'll call from a <span class="js-tel-text">${e(site.main_phone_display)}</span> or local number.</p>
    <div class="hero-ctas">
      <a class="btn btn-cta cta-call js-tel" id="ty-tel" href="tel:${site.main_phone_tel}" data-loc="thankyou">${I.phone}<span>Want answers right now? Call <span class="js-tel-text">${e(site.main_phone_display)}</span></span></a>
    </div>
    <div class="steps" style="margin-top:34px">
      <div class="step"><b><i>1</i>Expect a call</b><p>A real intake specialist — not a bot — will reach out fast. If you miss it, call us back any time, 24/7.</p></div>
      <div class="step"><b><i>2</i>Gather what you have</b><p>Photos, texts, emails, pay stubs, medical or police reports, names of witnesses. Don't worry if you have nothing yet.</p></div>
      <div class="step"><b><i>3</i>Don't sign anything</b><p>Not a severance, not a release, not a recorded statement. Talk to us first — it's free.</p></div>
    </div>
  </div>
</div></section>
<script type="application/json" id="ty-phones">${JSON.stringify(phones)}</script>
<script>
(function(){ try {
  var q = new URLSearchParams(location.search); var geo = (q.get("geo")||"").toLowerCase();
  var P = JSON.parse(document.getElementById("ty-phones").textContent); var p = P[geo];
  if (p) { document.querySelectorAll(".js-tel-text").forEach(function(s){ s.textContent = p.d; }); document.querySelectorAll("a.js-tel").forEach(function(a){ a.href = "tel:" + p.t; }); }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "lead_form_submit", practice: q.get("ct") || "", geo: geo, variant: q.get("variant") || "control" });
} catch(e){} })();
</script>`;
  return shell("Thank You | Wilshire Law Firm", body);
}
function notFound() {
  const body = `<section class="final"><div class="wrap"><p class="eyebrow" style="color:var(--gold)">Page not found</p><h2 class="sec-h">That page moved — but we're still here, 24/7.</h2><p>Call for a free case review, or pick your situation below.</p>
  <div class="final-ctas"><a class="btn btn-cta cta-call js-tel" href="tel:${site.main_phone_tel}" data-loc="404">${I.phone}<span>Call ${e(site.main_phone_display)} — Free 24/7</span></a></div>
  <div class="ticks" style="justify-content:center;margin-top:24px">${practices.map(p => `<a class="tick-chip" href="/${p.slug}/" style="text-decoration:none">${e(p.name)}</a>`).join("")}</div></div></section>`;
  return shell("Page Not Found | Wilshire Law Firm", body);
}

/* ---------------- hub ---------------- */
function hub(rows) {
  const groups = [["employment", "Employment Law"], ["injury", "Personal Injury"]];
  const suffix = "kw={keyword}&matchtype={matchtype}&campaignid={campaignid}&adgroupid={adgroupid}&creative={creative}&device={device}&network={network}&loc_physical_ms={loc_physical_ms}&utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}";
  let body = "";
  for (const [g, gname] of groups) {
    body += `<section data-group="${g}"><h2>${gname}</h2>`;
    for (const p of practices.filter(p => p.group === g)) {
      body += `<div class="prac" data-practice="${p.slug}"><h3>${e(p.name)} <code>/${p.slug}/</code></h3>
      <div class="links"><a class="master" href="/${p.slug}/" data-url="${site.base_url}/${p.slug}/">California (statewide)</a>${(officesData.regions.some(r => r.offices.some(o => o.state === "NV")) ) ? `<a class="master nv" href="/${p.slug}/nevada/" data-url="${site.base_url}/${p.slug}/nevada/">Nevada (statewide)</a>` : ""}</div>`;
      for (const region of officesData.regions) {
        const geos = GEOS.filter(x => x.region === region.name && x.practices.includes(g));
        if (!geos.length) continue;
        body += `<div class="reg"><h4>${e(region.name)}</h4><div class="links">${geos.map(x => `<a class="${x.isOffice ? "off" : ""}" href="/${p.slug}/${x.slug}/" data-url="${site.base_url}/${p.slug}/${x.slug}/" data-city="${e(x.city)}" title="${x.isOffice ? "Office city" : "Served from " + e(x.office.city)}">${e(x.city)}${x.isOffice ? " ★" : ""}</a>`).join("")}</div></div>`;
      }
      body += `</div>`;
    }
    body += `</section>`;
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Wilshire Law Firm — PPC Landing Page Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#f7f5f0;color:#131a2a;padding:36px 20px 80px}
.wrap{max-width:1100px;margin:0 auto}.kick{font-size:.68rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#8a6a1f}
h1{font-size:1.8rem;font-weight:900;color:#0b1e3f;margin:6px 0 6px}.note{color:#566173;font-size:.86rem;margin-bottom:18px;line-height:1.6;max-width:80em}
.tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 22px;position:sticky;top:0;background:#f7f5f0;padding:10px 0;z-index:5;border-bottom:1px solid #dbe2ec}
.tools input,.tools select{font:inherit;padding:10px 12px;border:2px solid #dbe2ec;border-radius:10px;background:#fff;min-width:200px}.tools label{font-size:.78rem;font-weight:700;color:#566173;display:flex;align-items:center;gap:6px}
.tools .cnt{margin-left:auto;font-size:.8rem;font-weight:800;color:#0b1e3f}
section{background:#fff;border:1px solid #dbe2ec;border-radius:14px;padding:22px;margin-bottom:16px}
h2{font-size:1.2rem;font-weight:900;color:#0b1e3f;margin-bottom:6px}.prac{border-top:1px solid #eef2f8;padding:16px 0 6px}.prac h3{font-size:1rem;font-weight:800;color:#0b1e3f;margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
h4{font-size:.66rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#566173;margin:12px 0 8px}
.links{display:flex;flex-wrap:wrap;gap:7px}.links a{font-size:.78rem;font-weight:700;color:#0b1e3f;text-decoration:none;border:1px solid #dbe2ec;border-radius:8px;padding:7px 11px;background:#f7f5f0;display:inline-flex;align-items:center;gap:6px}
.links a:hover{border-color:#c9a24a;background:#fff}.links a.off{border-color:#c9a24a;background:#fff8e6}.master{background:#0b1e3f!important;border-color:#0b1e3f!important;color:#fff!important}.master.nv{background:#12305f!important}
.links a.hide,.prac.hide,.reg.hide,section.hide{display:none}
code{background:#eef2f8;border-radius:4px;padding:1px 6px;font-size:.74rem}
.box{background:#fff;border:1px solid #dbe2ec;border-left:5px solid #c9a24a;border-radius:12px;padding:16px 18px;margin:0 0 16px;font-size:.84rem;line-height:1.6}
.box b{color:#0b1e3f}.box code{display:inline-block;word-break:break-all}
.copy{font:inherit;font-size:.72rem;font-weight:800;border:1px solid #dbe2ec;background:#fff;border-radius:6px;padding:4px 8px;cursor:pointer;color:#0b1e3f}.copy:hover{border-color:#c9a24a}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0b1e3f;color:#fff;padding:10px 16px;border-radius:10px;font-size:.82rem;font-weight:700;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
.tip{font-size:.78rem;color:#566173;margin-top:16px;line-height:1.6}
</style></head>
<body><div class="wrap">
<p class="kick">Retainer Reach · Internal Review Hub</p>
<h1>Wilshire Law Firm — PPC Landers</h1>
<p class="note"><b>${rows.length} campaign pages</b> · ${practices.length} page types × ${GEOS.length} cities (${OFFICE_COUNT} office cities ★ + ${GEOS.length - OFFICE_COUNT} surrounding cities) + statewide masters. Every page is self-contained, noindexed, and converts on two actions only: <b>call</b> or the <b>3-step form</b>. Forms redirect to <code>/thank-you/</code> (fires <code>lead_form_submit</code>). Phone taps fire <code>call_click</code>.</p>

<div class="box"><b>How to launch a campaign from this hub</b><br>
1. Pick the practice → region → city below. Each chip is the page; click to preview, or use <b>Copy URL</b> for the final URL.<br>
2. Set the ad group's <b>Final URL</b> to that page. Add this <b>Final URL suffix</b> at the campaign or account level so keyword, match type, device and campaign IDs land in every lead:<br>
<code id="suffix">${suffix}</code> <button class="copy" data-copy="${suffix}">Copy suffix</button><br>
3. <b>Dynamic keyword headlines</b>: with <code>kw={keyword}</code> in the suffix, the H1 adapts to the searched keyword (whitelist only — "attorney", "lawyer", "near me", "best/top", "free consultation", "abogado" → matching headline; anything else shows the control headline). Leads carry the keyword and a <code>kw_variant</code> event fires for GA4 segmentation.<br>
4. Full list with phones and office: <a href="/campaign-urls.csv">campaign-urls.csv</a> (import into Google Ads Editor) · <a href="/CAMPAIGN-URLS.md">CAMPAIGN-URLS.md</a>.</div>

<div class="tools">
  <label>Practice <select id="f-practice"><option value="">All</option>${practices.map(p => `<option value="${p.slug}">${e(p.name)} (${p.group === "employment" ? "Employment" : "Injury"})</option>`).join("")}</select></label>
  <label>Region <select id="f-region"><option value="">All</option>${officesData.regions.map(r => `<option value="${e(r.name)}">${e(r.name)}</option>`).join("")}</select></label>
  <label>City <input id="f-city" placeholder="Type a city…"></label>
  <label><input type="checkbox" id="f-office"> Office cities only</label>
  <span class="cnt" id="cnt"></span>
</div>
${body}
<p class="tip">★ = a city with a Wilshire office (page shows that office's street address). Other cities show "Serving {City} from our {Office} office". This hub is for review only — never send ad traffic here; campaign final URLs go directly to a page. Right-click any chip → Copy link, or use the copy button that appears on hover.</p>
</div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){
  var toast = document.getElementById("toast"); function say(t){ toast.textContent = t; toast.classList.add("on"); setTimeout(function(){ toast.classList.remove("on"); }, 1400); }
  function copy(t){ try { navigator.clipboard.writeText(t).then(function(){ say("Copied: " + t); }); } catch(e){ prompt("Copy:", t); } }
  document.querySelectorAll(".copy").forEach(function(b){ b.addEventListener("click", function(){ copy(b.getAttribute("data-copy")); }); });
  document.querySelectorAll(".links a[data-url]").forEach(function(a){
    var b = document.createElement("button"); b.className = "copy"; b.textContent = "⧉"; b.title = "Copy final URL"; b.style.padding = "0 5px";
    b.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); copy(a.getAttribute("data-url")); }); a.appendChild(b);
  });
  var fp = document.getElementById("f-practice"), fr = document.getElementById("f-region"), fc = document.getElementById("f-city"), fo = document.getElementById("f-office"), cnt = document.getElementById("cnt");
  function apply(){
    var p = fp.value, r = fr.value, c = fc.value.trim().toLowerCase(), o = fo.checked, n = 0;
    document.querySelectorAll(".prac").forEach(function(pr){ pr.classList.toggle("hide", !!p && pr.getAttribute("data-practice") !== p); });
    document.querySelectorAll(".reg").forEach(function(rg){
      var name = rg.querySelector("h4").textContent; var hideR = !!r && name !== r; var any = false;
      rg.querySelectorAll("a").forEach(function(a){
        var city = (a.getAttribute("data-city")||"").toLowerCase(); var hide = hideR || (c && city.indexOf(c) < 0) || (o && !a.classList.contains("off"));
        a.classList.toggle("hide", hide); if (!hide) any = true;
      });
      rg.classList.toggle("hide", !any);
    });
    document.querySelectorAll(".prac:not(.hide) .reg:not(.hide) a:not(.hide)").forEach(function(){ n++; });
    document.querySelectorAll("section").forEach(function(s){ s.classList.toggle("hide", !s.querySelector(".prac:not(.hide)")); });
    cnt.textContent = n + " city pages shown";
  }
  [fp, fr, fc, fo].forEach(function(el){ el.addEventListener("input", apply); el.addEventListener("change", apply); }); apply();
})();
</script></body></html>`;
}

/* ---------------- build ---------------- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
const rows = [];
let count = 0;
for (const p of practices) {
  const stateGeos = [{ isState: true, state: "CA", city: "California", slug: "california", county: null, office: null, region: "Statewide", practices: ["employment","injury"] }];
  if (officesData.regions.some(r => r.offices.some(o => o.state === "NV" && (o.practices || ["employment","injury"]).includes(p.group))))
    stateGeos.push({ isState: true, state: "NV", city: "Nevada", slug: "nevada", county: null, office: null, region: "Statewide", practices: ["injury"] });
  for (const g of stateGeos) {
    const dir = g.state === "CA" ? join(OUT, p.slug) : join(OUT, p.slug, "nevada");
    mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "index.html"), renderPage(p, g)); count++;
    rows.push({ group: p.group, practice: p.name, slug: p.slug, region: "Statewide", office: "—", city: g.city, state: g.state, url: site.base_url + (g.state === "CA" ? `/${p.slug}/` : `/${p.slug}/nevada/`), phone: phoneFor(g).display });
  }
  for (const g of GEOS) {
    if (!g.practices.includes(p.group)) continue;
    const dir = join(OUT, p.slug, g.slug); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), renderPage(p, g)); count++;
    rows.push({ group: p.group, practice: p.name, slug: p.slug, region: g.region, office: g.office.city + (g.isOffice ? " (office)" : ""), city: g.city, state: g.state, url: site.base_url + `/${p.slug}/${g.slug}/`, phone: phoneFor(g).display });
  }
}
mkdirSync(join(OUT, "thank-you"), { recursive: true });
writeFileSync(join(OUT, "thank-you/index.html"), thankYou());
writeFileSync(join(OUT, "404.html"), notFound());
writeFileSync(join(OUT, "index.html"), hub(rows));
writeFileSync(join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");
const csv = ["practice_group,practice,region,office,city,state,final_url,displayed_phone,kw_test_url"]
  .concat(rows.map(r => [r.group, r.practice, r.region, r.office, r.city, r.state, r.url, r.phone, r.url + "?kw={keyword}"].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n");
writeFileSync(join(OUT, "campaign-urls.csv"), csv); writeFileSync(join(ROOT, "campaign-urls.csv"), csv);
let md = `# Wilshire Law Firm — campaign final URLs\n\nGenerated by \`node build.mjs\` · ${rows.length} pages · base ${site.base_url}\n\nAdd \`?kw={keyword}\` (or the full ValueTrack suffix from the hub) to any final URL to enable dynamic keyword headlines.\n\n`;
for (const p of practices) {
  md += `## ${p.name} (${p.group === "employment" ? "Employment" : "Personal Injury"}) — \`/${p.slug}/\`\n\n| Region | Office | City | Final URL | Phone shown |\n|---|---|---|---|---|\n`;
  for (const r of rows.filter(r => r.slug === p.slug)) md += `| ${r.region} | ${r.office} | ${r.city}, ${r.state} | ${r.url} | ${r.phone} |\n`;
  md += "\n";
}
writeFileSync(join(ROOT, "CAMPAIGN-URLS.md"), md); writeFileSync(join(OUT, "CAMPAIGN-URLS.md"), md);
console.log(`built ${count} landing pages (${practices.length} page types × ${GEOS.length} cities + statewide) → public/`);
