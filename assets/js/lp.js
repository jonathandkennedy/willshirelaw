/* Wilshire Law Firm PPC landers — runtime (~5KB). No dependencies.
   - reads page config from #lp-config
   - captures Google Ads ValueTrack / UTM params into hidden form fields (+ first-touch)
   - ?kw={keyword} headline adaptation (whitelist only — raw query text never touches the DOM)
   - 3-step lead form: qualifier → qualifier → name/phone → POST → /thank-you/
   - dataLayer events: call_click, lead_form_error, kw_variant (lead_form_submit fires on /thank-you/) */
(function(){
  "use strict";
  var cfgEl = document.getElementById("lp-config");
  var C = cfgEl ? JSON.parse(cfgEl.textContent) : {};
  var qs = {};
  try { new URLSearchParams(location.search).forEach(function(v,k){ qs[k.toLowerCase()] = v; }); } catch(e){}
  var pushDL = function(ev, extra){
    window.dataLayer = window.dataLayer || [];
    var e = { event: ev, practice: C.practice, practice_group: C.group, geo: C.geo, city: C.city, office: C.office };
    if (extra) for (var k in extra) e[k] = extra[k];
    window.dataLayer.push(e);
  };

  /* ---------- optional runtime GTM (when not baked into the head) ---------- */
  if (C.gtm && !document.querySelector('script[src*="' + C.gtm + '"]')) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var gs = document.createElement("script"); gs.async = true;
    gs.src = "https://www.googletagmanager.com/gtm.js?id=" + C.gtm; document.head.appendChild(gs);
  }

  /* ---------- attribution capture ---------- */
  var TRACK = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","gbraid","wbraid","msclkid","fbclid","kw","matchtype","campaignid","adgroupid","creative","device","network","placement","loc_physical_ms","targetid"];
  var first = null;
  try { first = sessionStorage.getItem("wlf_first"); if (!first) { first = location.href; sessionStorage.setItem("wlf_first", first); } } catch(e){}
  function fillHidden(form){
    TRACK.forEach(function(k){ var el = form.querySelector('input[name="' + k + '"]'); if (el && qs[k]) el.value = qs[k].slice(0,200); });
    var lp = form.querySelector('input[name="landing_page"]'); if (lp) lp.value = location.pathname;
    var pu = form.querySelector('input[name="page_url"]'); if (pu) pu.value = location.href.slice(0,500);
    var ft = form.querySelector('input[name="first_touch"]'); if (ft && first) ft.value = first.slice(0,500);
    var rf = form.querySelector('input[name="referrer"]'); if (rf) rf.value = (document.referrer || "").slice(0,300);
    var dv = form.querySelector('input[name="device_type"]'); if (dv) dv.value = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
  }

  /* ---------- ?kw= headline adaptation (whitelist) ---------- */
  var kwRaw = (qs.kw || qs.utm_term || "").toLowerCase();
  var variant = "";
  if (kwRaw && C.kwNoun && C.city) {
    var pre = document.querySelector(".h1-pre"), post = document.querySelector(".h1-post"), cityEl = document.querySelector(".h1-city");
    var noun = C.kwNoun, city = C.city;
    var set = function(a, b, v){ if (pre && post) { pre.textContent = a; post.textContent = b; variant = v; } };
    var isNear = /near\s*me|nearby|close to me/.test(kwRaw);
    var isBest = /\b(best|top|top rated|top-rated|#1)\b/.test(kwRaw);
    var isFree = /free (consult|case|review|evaluation)/.test(kwRaw);
    var isAtty = /attorney|attorneys/.test(kwRaw);
    var isLaw  = /lawyer|lawyers|law firm/.test(kwRaw);
    var isEs   = /abogad|espa[nñ]ol/.test(kwRaw);
    if (isEs)         set("¿Necesita un abogado en ", "? Hablamos español — consulta gratis 24/7.", "es");
    else if (isNear)  set(noun + " Attorneys Near You in ", " — Free Case Review 24/7", "near");
    else if (isBest)  set("Looking for the Best " + noun + " Lawyer in ", "?", "best");
    else if (isFree)  set("Free " + noun + " Case Review in ", " — 24/7, No Obligation", "free");
    else if (isAtty)  set("Need a ", " " + noun + " Attorney?", "attorney");
    else if (isLaw)   set("Need a ", " " + noun + " Lawyer?", "lawyer");
    if (variant) {
      if (cityEl && variant !== "near" && variant !== "best" && variant !== "free" && variant !== "es") cityEl.textContent = city;
      document.documentElement.setAttribute("data-kw-variant", variant);
      pushDL("kw_variant", { kw_variant: variant, kw: kwRaw.replace(/[^a-z0-9 áéíóúñ]/g, "").slice(0, 80) });
    }
  }

  /* ---------- phone tracking ---------- */
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a.js-tel");
    if (a) pushDL("call_click", { phone: a.getAttribute("href").replace("tel:", ""), location: a.getAttribute("data-loc") || "" });
  });

  /* ---------- multi-step form ---------- */
  var form = document.getElementById("case-form");
  if (!form) return;
  fillHidden(form);
  var data = {};
  var dots = form.querySelectorAll(".dot");
  var cur = 1;
  function label(){ var sl = document.getElementById("step-label"); if (!sl) return; if (cur > 3) { sl.style.display = "none"; return; } sl.style.display = ""; sl.textContent = "Step " + cur + " of 3"; }
  function show(n){
    cur = n;
    form.querySelectorAll(".fstep").forEach(function(s){ s.hidden = s.getAttribute("data-step") != n; });
    dots.forEach(function(d,i){ d.classList.toggle("on", i < Math.min(n,3)); });
    label();
    if (n === 3) { var f = document.getElementById("f-name"); if (f) setTimeout(function(){ f.focus(); }, 60); }
    if (n > 1) pushDL("form_step", { step: n });
  }
  form.addEventListener("click", function(e){
    var opt = e.target.closest(".opt");
    if (opt) {
      var k = opt.getAttribute("data-k"); data[k] = opt.getAttribute("data-v");
      var hid = form.querySelector('input[name="' + k + '"]'); if (hid) hid.value = data[k];
      show(opt.closest(".fstep").getAttribute("data-step") == 1 ? 2 : 3); return;
    }
    var back = e.target.closest(".back");
    if (back) show(back.closest(".fstep").getAttribute("data-step") == 2 ? 1 : 2);
  });
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var name = document.getElementById("f-name").value.trim();
    var phoneIn = document.getElementById("f-phone");
    var phone = phoneIn.value.replace(/\D/g, "");
    if (phone.length === 11 && phone.charAt(0) === "1") phone = phone.slice(1);
    var phoneOk = /^[2-9]\d{2}[2-9]\d{6}$/.test(phone) && !/^(\d)\1{9}$/.test(phone) && !/^[2-9]11/.test(phone) && !/^\d{3}[2-9]11/.test(phone);
    var consent = document.getElementById("f-consent").checked;
    var err = document.getElementById("f-err");
    if (!name || !phoneOk || !consent) {
      err.style.display = "block";
      err.textContent = !consent ? "Please check the consent box so we can contact you." : "Please enter your name and a valid 10-digit phone number.";
      return;
    }
    err.style.display = "none";
    if (form.querySelector('[name="company_website"]').value !== "") { showSuccess(); return; }   // honeypot
    phoneIn.value = phone;
    var subj = form.querySelector('input[name="_subject"]'); if (subj) subj.value = (C.subject || "WilshirePPC") + " — " + C.practiceName + " — " + C.city + " — " + name;
    var submitBtn = form.querySelector("button.submit"), btnLabel = submitBtn.textContent;
    submitBtn.disabled = true; submitBtn.textContent = "Sending…";
    var settled = false;
    function fail(status, detail){
      if (settled) return; settled = true;
      submitBtn.disabled = false; submitBtn.textContent = btnLabel;
      try { console.error("Lead form send failed:", status, detail); } catch(e2){}
      pushDL("lead_form_error", { error_status: String(status) });
      err.style.display = "block";
      err.textContent = "We couldn't send your form. Please call " + C.phoneDisplay + " instead — free, 24/7.";
    }
    function showSuccess(){ document.getElementById("s-name").textContent = name ? ", " + name.split(" ")[0] : ""; show(4); }
    function ok(){
      if (settled) return; settled = true;
      showSuccess();
      var url = (C.thankyou || "/thank-you/") + "?ct=" + encodeURIComponent(C.practice) + "&geo=" + encodeURIComponent(C.geo) + (variant ? "&variant=kw-" + variant : "") + (qs.gclid ? "&gclid=" + encodeURIComponent(qs.gclid) : "");
      setTimeout(function(){ location.href = url; }, 500);
    }
    setTimeout(function(){ fail("timeout", "no response after 12s"); }, 12000);
    var fd = new FormData(form);
    var mode = C.endpoint ? "json" : (C.netlify ? "netlify" : "none");
    if (mode === "none") { try { console.warn("Lead form is in DEMO MODE — no backend configured (content/site.json → form). Nothing was sent."); } catch(e){} ok(); return; }
    try {
      if (mode === "json") {
        var payload = {}; fd.forEach(function(v,k){ payload[k] = v; });
        payload.submitted = new Date().toISOString();
        fetch(C.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) })
          .then(function(r){ if (r.ok) ok(); else r.text().then(function(t){ fail(r.status, t); }, function(){ fail(r.status, ""); }); }, function(e2){ fail("network", String(e2)); });
      } else {
        fetch(form.getAttribute("action") || "/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fd).toString() })
          .then(function(r){ if (r.ok) ok(); else fail(r.status, ""); }, function(e2){ fail("network", String(e2)); });
      }
    } catch(e2){ fail("exception", String(e2)); }
  });
  var yr = document.getElementById("yr"); if (yr) yr.textContent = new Date().getFullYear();
})();
