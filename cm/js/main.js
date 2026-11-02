// ---------------------------------------------------------
// Config — paste the couple's RSVP system link here.
// ---------------------------------------------------------
const RSVP_URL = "#"; // e.g. "https://their-rsvp-system.com/chelsea-max"
const WEDDING_DATE = new Date("2026-12-05T14:00:00-06:00"); // Monterrey (CST) — Misa a las 2pm

// RSVP link
document.getElementById("rsvpLink").href = RSVP_URL;

// Nav: solid on scroll + mobile menu
const nav = document.getElementById("nav");
const toggle = document.getElementById("navToggle");
const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 60);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
});
document.querySelectorAll("#navLinks a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  })
);

// Countdown
const units = {
  days: document.querySelector('[data-unit="days"]'),
  hours: document.querySelector('[data-unit="hours"]'),
  minutes: document.querySelector('[data-unit="minutes"]'),
  seconds: document.querySelector('[data-unit="seconds"]'),
};
const pad = (n) => String(n).padStart(2, "0");
const tick = () => {
  const diff = Math.max(0, WEDDING_DATE - Date.now());
  const s = Math.floor(diff / 1000);
  units.days.textContent = Math.floor(s / 86400);
  units.hours.textContent = pad(Math.floor((s % 86400) / 3600));
  units.minutes.textContent = pad(Math.floor((s % 3600) / 60));
  units.seconds.textContent = pad(s % 60);
};
tick();
setInterval(tick, 1000);

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// ---------------------------------------------------------
// Scroll animations
//   data-anim="up|pop|zoom|wipe-up|wipe-left|draw"  → plays once when seen
//   data-stagger                                     → children play one after another
//   data-parallax="0.3"                              → moves slower than the page
//   data-progress                                    → sets --p (0→1) while scrolled through
//   data-hero-fade                                   → drifts up and fades as you leave the hero
// ---------------------------------------------------------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-stagger]").forEach((group) =>
  [...group.children].forEach((child, i) => {
    if (!child.dataset.anim) child.dataset.anim = "up";
    child.style.setProperty("--i", i);
  })
);

const animated = document.querySelectorAll("[data-anim]");
let startScrollAnims = () => {}; // called once the loader has finished
if (reduceMotion) {
  animated.forEach((el) => el.classList.add("is-in"));
  document.querySelectorAll("[data-progress]").forEach((el) => el.style.setProperty("--p", 1));
} else {
  const animIO = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          animIO.unobserve(e.target);
        }
      }),
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  startScrollAnims = () => animated.forEach((el) => animIO.observe(el));

  const parallax = [...document.querySelectorAll("[data-parallax]")];
  const progress = [...document.querySelectorAll("[data-progress]")];
  const heroFade = document.querySelector("[data-hero-fade]");
  const scrollFx = () => {
    const y = window.scrollY, vh = window.innerHeight;
    parallax.forEach((el) => {
      if (y < vh * 1.5) el.style.translate = `0 ${(y * Number(el.dataset.parallax)).toFixed(1)}px`;
    });
    progress.forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / r.height));
      el.style.setProperty("--p", p.toFixed(3));
    });
    if (heroFade && y < vh) {
      heroFade.style.translate = `0 ${(y * 0.35).toFixed(1)}px`;
      heroFade.style.opacity = Math.max(0, 1 - y / (vh * 0.7)).toFixed(3);
    }
  };
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        scrollFx();
        ticking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener("load", scrollFx);
  window.addEventListener("resize", scrollFx);
  scrollFx();
}

// ---------------------------------------------------------
// Loader: always shown for 3 s (counted from navigation start, so it also
// plays on every refresh), then lifts away and the hero animates in.
// ---------------------------------------------------------
const LOADER_MS = 3000;
const root = document.documentElement;
const loaderBar = document.getElementById("loaderBar");
const loaderPct = document.getElementById("loaderPct");

// Always start at the top so the entrance is seen after a refresh
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

// Split the names into letters for the entrance (keeps words together)
document.querySelectorAll("[data-split]").forEach((el) => {
  let n = 0;
  const wrap = (text) =>
    text
      .split(/(\s+)/)
      .map((w) =>
        /^\s+$/.test(w) || !w
          ? w
          : `<span class="word">${[...w].map((ch) => `<span class="ch" style="--c:${n++}">${ch}</span>`).join("")}</span>`
      )
      .join("");
  el.innerHTML = [...el.childNodes]
    .map((node) =>
      node.nodeType === Node.TEXT_NODE
        ? wrap(node.textContent)
        : `<span class="word"><span class="ch" style="--c:${n++}">${node.outerHTML}</span></span>`
    )
    .join("");
});

const loaderTick = () => {
  const p = Math.min(1, performance.now() / LOADER_MS);
  loaderBar.style.transform = `scaleX(${p})`;
  loaderPct.textContent = Math.round(p * 100);
  if (p < 1) requestAnimationFrame(loaderTick);
};
requestAnimationFrame(loaderTick);

setTimeout(() => {
  // a link to a section (e.g. …#rsvp) still lands there once the loader is done
  const target = location.hash && document.querySelector(location.hash);
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  root.classList.add("is-ready");
  startScrollAnims();
}, Math.max(0, LOADER_MS - performance.now()));

// ---------------------------------------------------------
// Lightbox
// ---------------------------------------------------------
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lbImg");
const lbCounter = document.getElementById("lbCounter");
const galleryFigs = [...document.querySelectorAll(".gallery figure")];
let lbIndex = 0;

const lbOpen = (i) => {
  lbIndex = i;
  lbImg.src = galleryFigs[i].querySelector("img").src;
  lbCounter.textContent = `${i + 1} / ${galleryFigs.length}`;
  lb.classList.add("is-open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};
const lbCloseHandler = () => {
  lb.classList.remove("is-open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};
const lbNav = (dir) => {
  lbIndex = (lbIndex + dir + galleryFigs.length) % galleryFigs.length;
  lbImg.src = galleryFigs[lbIndex].querySelector("img").src;
  lbCounter.textContent = `${lbIndex + 1} / ${galleryFigs.length}`;
};

galleryFigs.forEach((fig, i) => fig.addEventListener("click", () => lbOpen(i)));
document.getElementById("lbClose").addEventListener("click", lbCloseHandler);
document.getElementById("lbPrev").addEventListener("click", () => lbNav(-1));
document.getElementById("lbNext").addEventListener("click", () => lbNav(1));
lb.addEventListener("click", (e) => { if (e.target === lb) lbCloseHandler(); });
document.addEventListener("keydown", (e) => {
  if (!lb.classList.contains("is-open")) return;
  if (e.key === "Escape") lbCloseHandler();
  if (e.key === "ArrowLeft") lbNav(-1);
  if (e.key === "ArrowRight") lbNav(1);
});

// ---------------------------------------------------------
// Config Panel
// ---------------------------------------------------------
const DEFAULTS = {
  fonts: { script: "Waterfall", serif: "Cormorant Garamond", sans: "Jost" },
};

const FONT_WEIGHTS = {
  // Script
  "Waterfall": "400", "Tangerine": "400,700", "Great Vibes": "400",
  "Dancing Script": "400;700", "Parisienne": "400", "Alex Brush": "400",
  "Sacramento": "400", "Allura": "400", "Pinyon Script": "400",
  "Petit Formal Script": "400", "Italianno": "400", "Satisfy": "400",
  "Carattere": "400", "Fleur De Leah": "400", "Birthstone": "400", "Lavishly Yours": "400",
  "Marck Script": "400", "Rouge Script": "400", "Niconne": "400",
  "Euphoria Script": "400", "Mrs Saint Delafield": "400", "Monsieur La Doulaise": "400",
  "Style Script": "400", "Berkshire Swash": "400", "Yesteryear": "400", "Lovers Quarrel": "400",
  // Serif
  "Cormorant Garamond": "300;400;500", "Playfair Display": "400;700",
  "Libre Baskerville": "400;700", "EB Garamond": "400;500;700", "Crimson Text": "400;700",
  "Lora": "400;500;700", "Merriweather": "300;400;700", "Spectral": "300;400;500;700",
  "Cardo": "400;700", "Sorts Mill Goudy": "400", "Cormorant": "300;400;500;700",
  "Noto Serif": "400;700", "Source Serif 4": "300;400;500;700",
  "DM Serif Display": "400", "Bodoni Moda": "400;500;700",
  "Petrona": "400;500;700", "Bitter": "400;500;700", "Domine": "400;700",
  "Gentium Book Plus": "400;700", "Arapey": "400", "Gilda Display": "400",
  "Vollkorn": "400;500;700", "Old Standard TT": "400;700", "Bellefair": "400", "Forum": "400",
  // Sans
  "Jost": "200;300;400;500", "Montserrat": "300;400;500;700",
  "Raleway": "200;300;400;500", "Lato": "300;400;700", "Poppins": "300;400;500;700",
  "Inter": "300;400;500;700", "DM Sans": "400;500;700", "Nunito": "300;400;500;700",
  "Outfit": "300;400;500;700", "Work Sans": "300;400;500;700", "Quicksand": "300;400;500;700",
  "Karla": "300;400;500;700", "Josefin Sans": "300;400;500;700",
  "Cabin": "400;500;700", "Mulish": "300;400;500;700",
  "Manrope": "300;400;500;700", "Figtree": "300;400;500;700",
  "Plus Jakarta Sans": "300;400;500;700", "Albert Sans": "300;400;500;700",
  "Urbanist": "300;400;500;700", "Geologica": "300;400;500;700",
  "Lexend": "300;400;500;700", "Onest": "400;500;700",
  "Red Hat Display": "400;500;700", "Rubik": "300;400;500;700",
};

const cfgPanel = document.getElementById("configPanel");
const cfgBtn = document.getElementById("configBtn");

// Toggle panel
cfgBtn.addEventListener("click", () => cfgPanel.classList.toggle("is-open"));
document.getElementById("configClose").addEventListener("click", () => cfgPanel.classList.remove("is-open"));

// Load saved config
const loadConfig = () => {
  try {
    const cfg = JSON.parse(localStorage.getItem("weddingConfig")) || {};
    // Clean up old keys no longer used
    delete cfg.colors; delete cfg.sizes;
    return cfg;
  } catch { return {}; }
};
const saveConfig = (cfg) => localStorage.setItem("weddingConfig", JSON.stringify(cfg));

// Load Google Font dynamically
const loadedFonts = new Set();
const loadFont = (family) => {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const weights = FONT_WEIGHTS[family] || "400";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
};

// Apply a config object
const applyConfig = (cfg) => {
  const r = document.documentElement.style;
  if (cfg.fonts) {
    if (cfg.fonts.script) { loadFont(cfg.fonts.script); r.setProperty("--script", `"${cfg.fonts.script}", cursive`); }
    if (cfg.fonts.serif) { loadFont(cfg.fonts.serif); r.setProperty("--serif", `"${cfg.fonts.serif}", Georgia, serif`); }
    if (cfg.fonts.sans) { loadFont(cfg.fonts.sans); r.setProperty("--sans", `"${cfg.fonts.sans}", system-ui, sans-serif`); }
  }
};

// Font pickers — prev/next buttons
const pickers = document.querySelectorAll(".cfg-picker");
pickers.forEach((picker) => {
  const options = picker.dataset.options.split(",");
  const valEl = picker.querySelector(".cfg-picker__val");
  let idx = 0;

  const setIdx = (i) => {
    idx = (i + options.length) % options.length;
    valEl.textContent = options[idx];
    onConfigChange();
  };

  picker._getVal = () => options[idx];
  picker._setVal = (v) => {
    const i = options.indexOf(v);
    if (i >= 0) { idx = i; valEl.textContent = options[idx]; }
  };

  picker.querySelector(".cfg-picker__prev").addEventListener("click", () => setIdx(idx - 1));
  picker.querySelector(".cfg-picker__next").addEventListener("click", () => setIdx(idx + 1));
});

// Helper to get picker value by data-cfg
const getPickerVal = (key) => {
  const p = document.querySelector(`.cfg-picker[data-cfg="${key}"]`);
  return p ? p._getVal() : null;
};
const setPickerVal = (key, val) => {
  const p = document.querySelector(`.cfg-picker[data-cfg="${key}"]`);
  if (p) p._setVal(val);
};

// Sync UI controls to match saved config
const syncUI = (cfg) => {
  if (cfg.fonts) {
    Object.entries(cfg.fonts).forEach(([k, v]) => setPickerVal(`font-${k}`, v));
  }
};

// Build current config from UI
const buildConfig = () => {
  const cfg = { fonts: {} };
  cfg.fonts.script = getPickerVal("font-script");
  cfg.fonts.serif = getPickerVal("font-serif");
  cfg.fonts.sans = getPickerVal("font-sans");
  return cfg;
};

// Central change handler
const onConfigChange = () => {
  const cfg = buildConfig();
  applyConfig(cfg);
  saveConfig(cfg);
};

// Init: apply saved config on load
const savedCfg = loadConfig();
if (Object.keys(savedCfg).length) { applyConfig(savedCfg); syncUI(savedCfg); }

// Section resets
document.querySelectorAll("[data-reset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const r = document.documentElement.style;
    localStorage.removeItem("weddingConfig");
    Object.entries(DEFAULTS.fonts).forEach(([k, v]) => setPickerVal(`font-${k}`, v));
    r.removeProperty("--script"); r.removeProperty("--serif"); r.removeProperty("--sans");
  });
});

// Reset all
document.getElementById("configResetAll").addEventListener("click", () => {
  localStorage.removeItem("weddingConfig");
  const r = document.documentElement.style;
  ["--script", "--serif", "--sans"].forEach((p) => r.removeProperty(p));
  syncUI(DEFAULTS);
});

// Export
document.getElementById("configExport").addEventListener("click", () => {
  const cfg = buildConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wedding-config.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
