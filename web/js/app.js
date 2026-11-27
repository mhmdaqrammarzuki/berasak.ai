(function () {
  const {
    apiGet,
    formatInt,
    formatRp,
    formatRpDecimal,
    formatPct,
    formatDateId,
    badgeHtml,
    escapeHtml,
    renderLoading,
    renderError,
    renderTrendsChart,
    renderForecastChart,
    renderJsbLossChart,
    renderSulawesiMap,
    updateSulawesiMapSelection,
    PROVINCE_COLOR_VARS,
    PROVINCE_SHORT,
    ARTICLES = [],
  } = window.PBS;

  const illus = window.BerasakIllustrations || {};
  const E = escapeHtml;
  const R = formatRp;
  const P = formatPct;
  const D = formatDateId;
  const byId = (id) => document.getElementById(id);
  const qAll = (root, sel) => [...(root || document).querySelectorAll(sel)];
  const setText = (id, val) => { const el = byId(id); if (el) el.textContent = val; };
  const setPressed = (el, act) => {
    el.classList.toggle("is-active", act);
    el.setAttribute("aria-pressed", act ? "true" : "false");
  };
  const onClick = (id, fn) => { const el = byId(id); if (el) el.addEventListener("click", fn); };
  const onChange = (id, fn) => { const el = byId(id); if (el) el.addEventListener("change", (ev) => fn(ev.target.value, ev)); };
  const onClickAll = (root, sel, fn) => qAll(root, sel).forEach((el) => el.addEventListener("click", () => fn(el)));
  const chipBtn = (cls, attr, val, lbl, act) =>
    `<button type="button" class="${cls}${act ? " is-active" : ""}" ${attr}="${E(val)}" aria-pressed="${act ? "true" : "false"}">${E(lbl)}</button>`;
  const segGroup = (aria, btns) => `<div class="segment-group" role="group" aria-label="${aria}">${btns}</div>`;
  const fieldGrp = (lbl, body) => `<div class="field-group"><span class="field-label">${lbl}</span>${body}</div>`;
  const tableBox = (heads, rows) => `<div class="table-scroll"><table class="data-table"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const cardBox = (title, desc, body, extra = "") =>
    `<div class="card"><div class="card-header"><div><h2 class="card-title">${title}</h2>${desc ? `<p class="card-desc">${desc}</p>` : ""}</div>${extra}</div>${body}</div>`;
  const setPanelBusy = (el, msg) => {
    if (el.children.length > 0 && !el.querySelector(".feedback-card")) el.classList.add("panel-loading");
    else renderLoading(el, msg);
  };
  const bindRowPick = (root, btnAttr, rowAttr, fn) => {
    onClickAll(root, `[${btnAttr}]`, (b) => fn(b.getAttribute(btnAttr)));
    if (rowAttr) qAll(root, `[${rowAttr}]`).forEach((tr) => tr.addEventListener("click", (ev) => { if (!ev.target.closest("button")) fn(tr.getAttribute(rowAttr)); }));
  };
  const iconSvg = (name) => (typeof illus.featureIconSvg === "function" ? illus.featureIconSvg(name) : "");

  const ALL_PROVINCES = [
    "Gorontalo",
    "Sulawesi Barat",
    "Sulawesi Selatan",
    "Sulawesi Tengah",
    "Sulawesi Tenggara",
    "Sulawesi Utara",
  ];
  const MAIN4_PROVINCES = ["Sulawesi Tengah", "Gorontalo", "Sulawesi Selatan", "Sulawesi Barat"];
  const DATA_ROUTES = new Set(["tren", "bandingkan", "prakiraan", "kualitas", "unduh"]);

  const SEGMENT_LABELS = {
    modern: "Pasar Modern",
    tradisional: "Pasar Tradisional",
    produsen: "Tingkat Produsen",
  };
  const CHANNEL_HINTS = {
    modern: "Pasar Modern: eceran ritel modern · Rp/kg",
    tradisional: "Pasar Tradisional: pasar rakyat harian · Rp/kg",
    produsen: "Tingkat Produsen: penggilingan & grosir · Rp/kg",
  };
  const CONTACT_INFO = {
    email: "customer.service@berasak.ai.com",
    phoneDisplay: "(6767) 6996697",
    phoneHref: "tel:67676996697",
  };

  const PREDICT_MIN = "2022-01-01";
  const PREDICT_MAX = "2028-12-31";
  const CHANNEL_PILLS = [["modern", "Modern"], ["tradisional", "Tradisional"], ["produsen", "Produsen"]];

  const FEATURED_ARTICLES_FALLBACK = [
    {
      slug: "penyebab-kenaikan-harga-beras-global-dan-nasional",
      category: "Pasar Global",
      readMinutes: 5,
      title: "Mengapa Harga Beras Global dan Nasional Sering Naik Bersamaan?",
      excerpt: "Memahami kaitan cuaca ekstrem, biaya logistik pangan dunia, dan stok panen terhadap harga beras di daerah.",
    },
    {
      slug: "langkah-pemerintah-menjaga-stabilitas-harga-beras",
      category: "Kebijakan Pangan",
      readMinutes: 4,
      title: "Langkah Pemerintah Menjaga Stabilitas Harga dan Pasokan Beras",
      excerpt: "Peran cadangan beras pemerintah, operasi pasar murah, dan koordinasi distribusi dalam menahan gejolak harga.",
    },
    {
      slug: "tips-trik-belanja-dan-menyimpan-beras-hemat-anti-kutu",
      category: "Tips Hemat",
      readMinutes: 4,
      title: "Tips dan Trik Belanja serta Menyimpan Beras agar Hemat dan Anti Kutu",
      excerpt: "Panduan praktis memilih waktu beli, membandingkan kemasan, serta menyimpan beras dengan bahan alami agar awet.",
    },
  ];

  const PAGE_META = {
    beranda: { title: "Pantau & Prediksi Harga Beras Sulawesi", subtitle: "Pantau harga beras harian di seluruh Sulawesi beserta estimasi AI berbasis data resmi PIHPS Bank Indonesia." },
    tren: { title: "Tren Pergerakan Harga Beras", subtitle: "Pantau naik-turunnya harga beras lintas provinsi secara harian, mingguan, atau bulanan." },
    bandingkan: { title: "Perbandingan Wilayah & Selisih Pasokan", subtitle: "Bandingkan peringkat harga antarprovinsi dan selisih dari produsen ke pasar eceran." },
    prakiraan: { title: "Prediksi Harga Beras AI", subtitle: "Cek estimasi harga beras untuk tanggal pilihan dan proyeksi 4 hingga 8 minggu ke depan." },
    kualitas: { title: "Ringkasan Data", subtitle: "Ringkasan harga terbaru, rentang historis, dan kondisi pasar dari data resmi PIHPS Bank Indonesia." },
    unduh: { title: "Unduh Data Terstruktur", subtitle: "Pilih provinsi, rentang tanggal, dan format tabel CSV sesuai kebutuhan." },
    artikel: { title: "Artikel & Edukasi Harga Beras", subtitle: "Bacaan singkat berbahasa sederhana seputar pasar beras, kebijakan pangan, dan tips belanja." },
    panduan: { title: "Panduan Pengguna & Kamus Istilah", subtitle: "Langkah membaca grafik, arti istilah data, dan jawaban pertanyaan umum." },
    kontak: { title: "Kontak & Layanan Pengguna", subtitle: "Hubungi tim berasak.ai melalui email atau telepon resmi untuk bantuan data dan masukan." },
  };

  function toLocalIsoDate(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function clampPredictDate(iso) {
    if (!iso || typeof iso !== "string") return PREDICT_MIN;
    if (iso < PREDICT_MIN) return PREDICT_MIN;
    if (iso > PREDICT_MAX) return PREDICT_MAX;
    return iso;
  }

  const getTodayIso = () => clampPredictDate(toLocalIsoDate(new Date()));

  function addDaysIso(baseIso, days) {
    const [y, m, d] = String(baseIso || getTodayIso()).split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + days);
    return clampPredictDate(toLocalIsoDate(dt));
  }

  function safeStorageGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function safeStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* restricted mode */ } }

  function mapPublicStatus(tier, pctDelta = 0) {
    if (tier === "Tinggi" || Math.abs(Number(pctDelta) || 0) >= 5.0) {
      return { label: "Fluktuatif", pillClass: "is-danger", badgeVariant: "alert", icon: "up" };
    }
    if (tier === "Waspada" || Math.abs(Number(pctDelta) || 0) >= 1.5) {
      return { label: "Waspada", pillClass: "is-warning", badgeVariant: "warning", icon: "dot" };
    }
    return { label: "Stabil", pillClass: "is-positive", badgeVariant: "success", icon: "check" };
  }

  function formatPublicAlertText(item) {
    if (!item) return "";
    return item.kind === "mom_threshold"
      ? `Perubahan rata-rata bulanan tercatat ${P(item.value_pct)}.`
      : `Perubahan harga ${P(item.value_pct)} tercatat pada ${D(item.date)}.`;
  }

  function fetchPredictDate(seg, prov, dt, model = "jsb_mlp") {
    return apiGet(`/api/predict-date?segment=${encodeURIComponent(seg)}&province=${encodeURIComponent(prov)}&date=${encodeURIComponent(dt)}&model=${encodeURIComponent(model)}`);
  }

  function setActiveSegment(seg) {
    if (!CHANNEL_HINTS[seg]) return;
    state.segment = seg;
    state.exportCfg.segment = seg;
    safeStorageSet("berasak_segment", seg);
  }

  const savedTheme = safeStorageGet("berasak_theme") || safeStorageGet("pbs_theme");
  const savedSeg = safeStorageGet("berasak_segment");
  const savedProv = safeStorageGet("berasak_quick_prov");
  const initSeg = CHANNEL_HINTS[savedSeg] ? savedSeg : "modern";
  const initDate = getTodayIso();
  const initProv = ALL_PROVINCES.includes(savedProv) ? savedProv : "Sulawesi Selatan";

  const state = {
    route: "beranda",
    articleSlug: null,
    segment: initSeg,
    theme: savedTheme === "dark" ? "dark" : "light",
    meta: null,
    trendsCache: null,
    compareData: null,
    forecastChartCache: null,
    landing: {
      bentoProv: initProv,
      bentoDate: initDate,
      platformDate: initDate,
      platformSearch: "",
      platformRows: [],
      popoverProv: null,
      wfSegment: initSeg,
      wfOffsetDays: 0,
    },
    predict: { province: initProv, date: initDate, model: "jsb_mlp" },
    articlesFilter: { category: "Semua", query: "" },
    trends: { provinces: [...MAIN4_PROVINCES], agg: "monthly", range: "1y", showMa4: true },
    compare: { date: "2026-02-12", selectedProvince: "Sulawesi Tengah" },
    forecasts: { province: initProv, horizon: 4, model: "jsb_mlp" },
    quality: { selectedProvince: initProv },
    exportCfg: {
      segment: initSeg,
      provinces: [...ALL_PROVINCES],
      from: "2022-01-01",
      to: "2026-02-12",
      shape: "long",
      includeFlags: true,
    },
  };

  const els = {
    siteHeader: byId("site-header") || document.querySelector(".site-header"),
    headerBrandIcon: byId("header-brand-icon"),
    sidebar: byId("app-sidebar"),
    drawerBrandIcon: document.querySelector("#app-sidebar .brand-icon-wrap"),
    backdrop: byId("drawer-backdrop"),
    menuBtn: byId("nav-toggle") || byId("mobile-menu-btn"),
    drawerCloseBtn: byId("drawer-close-btn"),
    themeBtn: byId("theme-toggle") || byId("theme-toggle-btn"),
    themeIcon: byId("theme-toggle-icon"),
    themeLabel: byId("theme-toggle-label"),
    dataDropdown: byId("nav-data-dropdown"),
    dataMenuBtn: byId("data-menu-btn"),
    dataMenu: byId("data-dropdown-menu"),
    pageHeader: byId("page-header"),
    pageBreadcrumb: byId("page-breadcrumb"),
    pageTitle: byId("page-title"),
    pageSubtitle: byId("page-subtitle"),
    segToolbar: byId("segment-toolbar"),
    segChannelHint: byId("segment-channel-hint"),
    periodNote: byId("dataset-period-note"),
    backToTopBtn: byId("back-to-top-btn"),
    routeAnnouncer: byId("route-announcer"),
    mainContent: byId("main-content"),
    siteFooter: byId("global-footer") || document.querySelector(".site-footer"),
    mobileBottomNav: document.querySelector(".mobile-bottom-nav"),
    viewRoot: byId("view-root"),
  };

  let bentoSeq = 0;
  let platformSeq = 0;
  let workflowSeq = 0;
  let aiPredictSeq = 0;
  let lastPopoverTrigger = null;

  const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollWindowToTop = () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });

  function applyTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    safeStorageSet("berasak_theme", state.theme);
    document.documentElement.setAttribute("data-theme", state.theme);
    const isDark = state.theme === "dark";
    const lbl = isDark ? "Mode Terang" : "Mode Gelap";
    if (els.themeLabel) els.themeLabel.textContent = lbl;
    if (els.themeIcon) els.themeIcon.innerHTML = iconSvg(isDark ? "sun" : "moon");
    if (els.themeBtn) {
      els.themeBtn.setAttribute("aria-label", lbl);
      els.themeBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
    }
  }

  function reRenderActiveCharts() {
    if (state.route === "tren" && state.trendsCache && state.trendsCache.data) {
      const m = byId("trend-chart-mount");
      if (m) renderTrendsChart(m, state.trendsCache.data, { showMa4: state.trends.showMa4, onReset: resetTrendsFilter });
    } else if (state.route === "prakiraan" && state.forecastChartCache) {
      const m = byId("fc-chart-mount");
      if (m) renderForecastChart(m, state.forecastChartCache);
      const lm = byId("fc-loss-chart-mount");
      const lossHistory = state.forecastChartCache.jsb_info && state.forecastChartCache.jsb_info.loss_history;
      if (lm && lossHistory) renderJsbLossChart(lm, lossHistory);
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    reRenderActiveCharts();
  }

  function setDataDropdownOpen(open, focusTarget = null) {
    if (!els.dataMenuBtn || !els.dataMenu) return;
    els.dataMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    els.dataMenu.hidden = !open;
    if (open && focusTarget) focusTarget.focus();
  }

  function setBackgroundLandmarksLocked(locked) {
    [els.siteHeader, els.mainContent, els.siteFooter, els.mobileBottomNav].forEach((node) => {
      if (!node) return;
      if ("inert" in node) node.inert = locked;
      if (locked) node.setAttribute("aria-hidden", "true");
      else node.removeAttribute("aria-hidden");
    });
  }

  function handleDrawerKeydown(ev) {
    if (!els.sidebar || !els.sidebar.classList.contains("is-open")) return;
    if (ev.key === "Escape") { ev.preventDefault(); closeMobileDrawer(true); return; }
    if (ev.key !== "Tab") return;
    const focusables = qAll(els.sidebar, 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }

  function openMobileDrawer() {
    if (!els.sidebar || !els.backdrop || !els.menuBtn) return;
    setDataDropdownOpen(false);
    els.sidebar.classList.add("is-open");
    els.backdrop.hidden = false;
    els.menuBtn.setAttribute("aria-expanded", "true");
    setBackgroundLandmarksLocked(true);
    document.addEventListener("keydown", handleDrawerKeydown);
    if (els.drawerCloseBtn) els.drawerCloseBtn.focus();
  }

  function closeMobileDrawer(restoreFocus = true) {
    if (!els.sidebar || !els.sidebar.classList.contains("is-open")) return false;
    els.sidebar.classList.remove("is-open");
    if (els.backdrop) els.backdrop.hidden = true;
    setBackgroundLandmarksLocked(false);
    document.removeEventListener("keydown", handleDrawerKeydown);
    if (els.menuBtn) {
      els.menuBtn.setAttribute("aria-expanded", "false");
      if (restoreFocus) els.menuBtn.focus();
    }
    return true;
  }

  function closePlatformPopover(restoreFocus = false) {
    const pop = byId("platform-popover");
    if (!pop || pop.hidden) return false;
    pop.hidden = true;
    state.landing.popoverProv = null;
    qAll(document, ".platform-row").forEach((tr) => tr.classList.remove("is-selected"));
    if (restoreFocus && lastPopoverTrigger && typeof lastPopoverTrigger.focus === "function") lastPopoverTrigger.focus();
    return true;
  }

  function announceRoute(titleText) {
    if (!els.routeAnnouncer || !titleText) return;
    els.routeAnnouncer.textContent = "";
    window.requestAnimationFrame(() => { if (els.routeAnnouncer) els.routeAnnouncer.textContent = `Menampilkan ${titleText}`; });
  }

  function parseRouteFromHash() {
    const raw = (window.location.hash || "#beranda").replace(/^#\/?/, "").trim();
    if (!raw) return { route: "beranda", articleSlug: null };
    if (raw.startsWith("artikel/")) return { route: "artikel", articleSlug: raw.slice(8).trim() || null };
    return PAGE_META[raw] ? { route: raw, articleSlug: null } : { route: "beranda", articleSlug: null };
  }

  function syncNavAndSegmentUI() {
    const activeRoute = state.route;
    const isLanding = activeRoute === "beranda";
    document.body.classList.toggle("is-landing", isLanding);
    if (els.mainContent) els.mainContent.classList.toggle("is-landing", isLanding);
    if (els.pageHeader) els.pageHeader.hidden = isLanding;

    qAll(document, ".top-nav-link[data-route], .nav-dropdown-item[data-route], .nav-item[data-route], .bottom-tab[data-route]").forEach((link) => {
      const act = link.getAttribute("data-route") === activeRoute;
      link.classList.toggle("is-active", act);
      if (act) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (els.dataMenuBtn) {
      const grp = (els.dataMenuBtn.getAttribute("data-route-group") || "").split(",");
      els.dataMenuBtn.classList.toggle("is-active", grp.includes(activeRoute));
    }
    qAll(document, "#segment-toolbar [data-segment]").forEach((b) => setPressed(b, b.getAttribute("data-segment") === state.segment));
    if (els.segChannelHint) els.segChannelHint.textContent = CHANNEL_HINTS[state.segment] || CHANNEL_HINTS.modern;

    let meta = PAGE_META[activeRoute] || PAGE_META.beranda;
    let breadcrumbHtml = "";
    if (activeRoute === "artikel" && state.articleSlug) {
      const found = ARTICLES.find((a) => a.slug === state.articleSlug);
      if (found) {
        meta = { title: found.title, subtitle: `${found.category} · ${found.readMinutes} menit baca · Diperbarui ${found.updatedLabel}` };
        breadcrumbHtml = `<a href="#artikel">Artikel</a><span aria-hidden="true">/</span><span>${E(found.category)}</span>`;
      }
    }
    if (els.pageBreadcrumb) {
      els.pageBreadcrumb.innerHTML = breadcrumbHtml;
      els.pageBreadcrumb.hidden = !breadcrumbHtml;
    }
    if (els.pageTitle) els.pageTitle.textContent = meta.title;
    if (els.pageSubtitle) els.pageSubtitle.textContent = meta.subtitle;
    if (els.segToolbar) els.segToolbar.hidden = isLanding || !DATA_ROUTES.has(activeRoute);
    document.title = `${meta.title} | berasak.ai`;
    return meta.title;
  }

  function navigateTo(hashTarget) {
    const normalized = hashTarget.startsWith("#") ? hashTarget : `#${hashTarget}`;
    if (window.location.hash !== normalized) {
      window.location.hash = normalized;
    } else {
      const parsed = parseRouteFromHash();
      state.route = parsed.route;
      state.articleSlug = parsed.articleSlug;
      renderCurrentRoute();
    }
  }

  function buildLandingMarkup() {
    const l = state.landing;
    const brandSvg = typeof illus.brandMarkSvg === "function" ? illus.brandMarkSvg("brand-mark-svg") : "";
    const heroSvg = typeof illus.heroMintSvg === "function" ? illus.heroMintSvg() : "";
    const band = (cls, aria, body) => `<section class="landing-band ${cls}" aria-label="${aria}"><div class="landing-inner">${body}</div></section>`;
    const intro = (eyCls, ey, h2, sub) => `<div class="section-intro-center"><span class="${eyCls}">${ey}</span><h2 class="landing-h2">${h2}</h2><p class="landing-subhead">${sub}</p></div>`;
    const insight = (meta, t, d, href, link) => `<article class="landing-insight-card"><div><div class="landing-insight-meta">${meta}</div><h3 class="landing-insight-title">${t}</h3><p class="landing-insight-desc">${d}</p></div><a class="landing-insight-link" href="${href}">${link} &rarr;</a></article>`;

    const dilemmas = [
      ["fragmented", "Data Saluran Masih Terpisah", "Harga di penggilingan, pasar rakyat, dan ritel modern tersebar terpisah sehingga sulit dibandingkan sekaligus."],
      ["volatility", "Fluktuasi Musiman Mendadak", "Pergeseran musim panen dan biaya pengiriman antarprovinsi memicu perubahan harga yang sulit ditebak."],
      ["delayed", "Sulit Mengatur Waktu Belanja", "Tanpa proyeksi tanggal ke depan yang jelas, rumah tangga dan pelaku usaha sulit menentukan waktu beli paling hemat."],
    ];
    const features = [
      ["check", "Dibangun untuk Publik", "Bahasa sederhana dan harga per kilogram yang langsung membantu perencanaan belanja harian."],
      ["region", "Terukur per Wilayah", "Membandingkan seluruh Sulawesi sekaligus agar selisih harga antarwilayah terlihat jelas."],
      ["download", "Ekspor Data Terstruktur", "Unduh tabel CSV terfilter dalam bentuk memanjang atau melebar untuk analisis lanjutan."],
      ["sparkle", "Prediksi Tanggal AI", "Pilih tanggal kapan saja hingga akhir 2028 untuk melihat estimasi harga dan Rentang Wajar 90%."],
    ];
    const featured = FEATURED_ARTICLES_FALLBACK.map((fb) => ARTICLES.find((a) => a.slug === fb.slug) || fb);
    const totalArticles = ARTICLES.length >= 9 ? ARTICLES.length : 9;

    const heroBody = `<div class="hero-grid">
<div class="hero-copy">
<span class="eyebrow-mint">PANTAU &amp; PREDIKSI BERAS</span>
<h1 class="hero-title">Pantau dan prediksi harga beras dengan presisi AI.</h1>
<p class="hero-lead">Cek harga beras di enam provinsi Sulawesi lintas pasar modern, pasar tradisional, dan tingkat produsen lengkap dengan proyeksi AI harian berbasis data resmi PIHPS Bank Indonesia.</p>
<div class="hero-actions"><a class="btn btn-primary" href="#prakiraan" id="hero-cta-predict">Prediksi Harga AI</a><a class="btn btn-secondary" href="#tren" id="hero-cta-trend">Lihat Tren</a></div>
</div>
<div class="hero-bento">
<div class="bento-checker" aria-label="Cek cepat prediksi harga beras AI">
<div class="bento-checker-head"><h2 class="bento-checker-title">Cek Harga &amp; Prediksi AI</h2><span class="eyebrow-mint" id="bento-mode-badge">Estimasi JSB</span></div>
<div class="bento-form-fields">
<div class="field-group"><label class="field-label" for="bento-prov-select">Provinsi</label><select id="bento-prov-select" class="select-control">${ALL_PROVINCES.map((p) => `<option value="${E(p)}" ${p === l.bentoProv ? "selected" : ""}>${E(p)}</option>`).join("")}</select></div>
<div class="field-group"><label class="field-label" for="bento-date-input" id="bento-date-label">Tanggal Target (${E(D(l.bentoDate))})</label><input type="date" id="bento-date-input" class="input-control font-mono" value="${E(l.bentoDate)}" min="${PREDICT_MIN}" max="${PREDICT_MAX}"></div>
<div class="bento-channel-row" role="group" aria-label="Pilih saluran pasar">${CHANNEL_PILLS.map(([s, lbl]) => chipBtn("bento-channel-pill", "data-bento-seg", s, lbl, state.segment === s)).join("")}</div>
</div>
<div class="bento-result-card" aria-live="polite">
<div class="bento-price-val" id="bento-price-val">Memuat...</div>
<div class="bento-range-note" id="bento-range-note">Menyiapkan Rentang Wajar 90%</div>
<div class="bento-compare-list" id="bento-compare-list"><div class="bento-compare-item"><span>Pasar Modern</span><strong>-</strong></div><div class="bento-compare-item"><span>Pasar Tradisional</span><strong>-</strong></div><div class="bento-compare-item"><span>Tingkat Produsen</span><strong>-</strong></div></div>
</div>
<button type="button" class="btn btn-primary" id="bento-detail-btn">Lihat Detail &rarr;</button>
</div>
<div class="bento-right-stack">
<div class="bento-illus"><div class="bento-illus-svg">${heroSvg}</div><div class="bento-micro-stats" id="bento-quick-switch"><button type="button" class="bento-micro-stat" data-bento-seg="tradisional"><span class="bento-micro-label">Pasar Rakyat</span><span class="bento-micro-val" id="bento-micro-trad">-</span></button><button type="button" class="bento-micro-stat" data-bento-seg="produsen"><span class="bento-micro-label">Produsen</span><span class="bento-micro-val" id="bento-micro-prod">-</span></button></div></div>
<div class="bento-kpi"><span class="eyebrow-on-emerald" id="bento-kpi-badge">ESTIMASI JSB</span><div class="bento-kpi-value" id="bento-kpi-value">...</div><p class="bento-kpi-caption" id="bento-kpi-caption">Memuat perbandingan terhadap harga terbaru.</p></div>
<div class="bento-utility-row"><a class="bento-utility-tile" href="#unduh">${iconSvg("download")}<span>Unduh CSV</span></a><a class="bento-utility-tile" href="#artikel">${iconSvg("article")}<span>Artikel</span></a></div>
</div>
</div>
</div>`;

    const platformBody = intro("eyebrow-mint", "SATU PLATFORM", "Visibilitas harga penuh di setiap provinsi.", "Bandingkan Harga Terbaru, Estimasi AI pada tanggal pilihan, dan Kondisi Pasar di seluruh Sulawesi dalam satu tampilan.") +
      `<div class="platform-window" id="platform-window">
<aside class="platform-sidebar" aria-label="Navigasi pratinjau platform">
<div class="platform-sidebar-brand">${brandSvg}<span>berasak.ai</span></div>
<div class="platform-sidebar-nav">
${[["modern", "layers", "Pasar Modern"], ["tradisional", "region", "Pasar Tradisional"], ["produsen", "clock", "Harga Produsen"]].map(([s, ico, lbl]) => `<button type="button" class="platform-nav-btn ${state.segment === s ? "is-active" : ""}" data-platform-seg="${s}">${iconSvg(ico)}<span>${lbl}</span></button>`).join("")}
${[["#prakiraan", "sparkle", "Prediksi AI"], ["#tren", "trend", "Tren Harga"], ["#artikel", "article", "Artikel"]].map(([h, ico, lbl]) => `<a class="platform-nav-btn" href="${h}">${iconSvg(ico)}<span>${lbl}</span></a>`).join("")}
</div>
</aside>
<div class="platform-main">
<div class="platform-toolbar"><div class="platform-toolbar-controls"><input type="search" id="platform-search" class="input-control platform-search-input" placeholder="Cari provinsi..." aria-label="Cari provinsi" value="${E(l.platformSearch)}"><input type="date" id="platform-date-input" class="input-control platform-date-pill" aria-label="Pilih tanggal prediksi platform" value="${E(l.platformDate)}" min="${PREDICT_MIN}" max="${PREDICT_MAX}"></div><a class="btn btn-primary" href="#prakiraan" id="platform-cta-btn">+ Cek Prediksi</a></div>
<div class="platform-table-wrap"><table class="platform-table"><thead><tr><th>Provinsi</th><th class="num-head">Harga Terbaru</th><th class="num-head" id="platform-pred-col-head">Prediksi ${E(D(l.platformDate))}</th><th class="num-head">Perubahan</th><th>Kondisi</th></tr></thead><tbody id="platform-table-body"><tr><td colspan="5">Memuat tabel provinsi...</td></tr></tbody></table></div>
<div class="platform-popover" id="platform-popover" role="dialog" aria-label="Detail estimasi AI provinsi" hidden>
<div class="platform-popover-head"><span class="platform-popover-tier" id="popover-tier">Stabil</span><button type="button" class="platform-popover-close" id="popover-close-btn" aria-label="Tutup ringkasan">Tutup</button></div>
<h3 class="platform-popover-title" id="popover-title">Sulawesi Selatan</h3><p class="platform-popover-body" id="popover-body"></p>
<button type="button" class="btn btn-primary platform-popover-cta" id="popover-open-predict">Buka Prediksi &rarr;</button>
</div>
</div>
</div>
<div class="feature-cards-grid">${features.map(([ico, t, d]) => `<article class="feature-card"><div class="feature-card-icon">${iconSvg(ico)}</div><h3 class="feature-card-title">${E(t)}</h3><p class="feature-card-desc">${E(d)}</p></article>`).join("")}</div>`;

    const workflowBody = `<div class="workflow-split">
<div class="workflow-intro"><span class="eyebrow-mint">CARA KERJA</span><h2 class="landing-h2">Lihat bagaimana berasak.ai membantu keputusan belanja Anda.</h2><p class="landing-subhead">Pilih saluran pembelian dan target waktu, lalu lihat estimasi harga per kilogram lengkap dengan Rentang Wajar 90% secara langsung.</p><a class="btn btn-primary" href="#prakiraan">Mulai Sekarang &rarr;</a></div>
<div class="workflow-steps-grid">
<div class="workflow-step-card"><span class="workflow-step-num">01</span><h3 class="workflow-step-title">Pilih Saluran &amp; Waktu</h3><p class="workflow-step-desc">Tentukan tempat belanja dan rentang hari yang ingin diperkirakan.</p><div class="workflow-step-preview"><span class="field-label">Saluran Pasar</span><div class="workflow-step-pills" role="group" aria-label="Pilih saluran alur kerja">${CHANNEL_PILLS.map(([s, lbl]) => chipBtn("workflow-step-pill", "data-wf-seg", s, lbl, l.wfSegment === s)).join("")}</div><span class="field-label">Target Waktu</span><div class="workflow-step-pills" role="group" aria-label="Pilih jarak hari alur kerja">${[[0, "Hari Ini"], [1, "Besok"], [30, "+30 Hari"]].map(([o, lbl]) => chipBtn("workflow-step-pill", "data-wf-offset", o, lbl, l.wfOffsetDays === o)).join("")}</div></div></div>
<div class="workflow-step-card"><span class="workflow-step-num">02</span><h3 class="workflow-step-title">Lihat Estimasi &amp; Rentang Wajar</h3><p class="workflow-step-desc">Hasil Estimasi JSB dan Rentang Wajar 90% langsung diperbarui otomatis.</p><div class="workflow-step-preview"><div class="workflow-result-box" id="wf-result-box" aria-live="polite"><span class="field-label" id="wf-result-label">Sulawesi Selatan</span><div class="workflow-result-val" id="wf-result-val">Memuat...</div><div class="bento-range-note" id="wf-result-range">Rentang Wajar 90%: -</div></div><button type="button" class="btn btn-secondary" id="wf-open-predict-btn">Buka di Prediksi AI &rarr;</button></div></div>
</div>
</div>`;

    const articlesBody = intro("eyebrow-mint", "WAWASAN &amp; TRANSPARANSI", "Pahami dinamika harga dan langkah menjaga ketahanan beras.", "Data resmi yang terbuka dipadukan dengan artikel edukasi untuk membantu rumah tangga dan pelaku usaha.") +
      `<div class="landing-trust-row">
${insight('<span class="eyebrow-mint">SUMBER RESMI</span><span>2022 - 2026</span>', "Data Resmi PIHPS", "Seluruh catatan harga bersumber dari Pusat Informasi Harga Pangan Strategis Bank Indonesia untuk Seluruh Provinsi Sulawesi.", "#kualitas", "Ringkasan Data")}
${insight('<span class="eyebrow-mint">METODOLOGI</span><span>Estimasi 90%</span>', "Estimasi Transparan", "Setiap proyeksi menampilkan batas atas dan batas bawah Rentang Wajar 90% agar pengguna memahami ruang gerak harga.", "#panduan", "Baca Panduan")}
</div>
<div class="landing-articles-row">
${featured.map((a) => insight(`<span class="article-category">${E(a.category)}</span><span>${a.readMinutes} menit baca</span>`, E(a.title), E(a.excerpt), `#artikel/${E(a.slug)}`, "Baca Artikel")).join("")}
</div>
<div class="landing-articles-cta">
<a class="btn btn-secondary" href="#artikel">Jelajahi ${totalArticles} Artikel Lengkap &rarr;</a>
</div>`;

    const ctaBody = `<div class="cta-electric-banner">
<div><span class="eyebrow-on-emerald">MULAI SEKARANG</span><h2 class="cta-headline">Siap memantau harga beras lebih cerdas setiap hari?</h2></div>
<div class="cta-visual-col"><div class="cta-tablet-wrap">${typeof illus.ctaTabletSvg === "function" ? illus.ctaTabletSvg() : ""}</div><p class="cta-copy">Buka proyeksi harga AI untuk tanggal pilihan atau hubungi layanan pengguna kami untuk bantuan pembacaan data.</p><div class="cta-actions"><a class="btn cta-btn-dark" href="#prakiraan">Prediksi Harga AI</a><a class="btn cta-btn-white" href="#kontak">Hubungi Kami</a></div></div>
</div>`;

    return `<div class="landing-shell" id="landing-shell">
${band("landing-band--white landing-hero-band", "Beranda utama berasak.ai", heroBody)}
${band("landing-band--subtle", "Tantangan memantau harga beras", intro("eyebrow-rose", "TANTANGAN PASAR", "Mengapa harga beras sulit diprediksi tanpa data terpadu?", "Harga beras antarwilayah dan antarsaluran sering berubah dengan pola berbeda, sehingga masyarakat kesulitan menyusun patokan belanja.") + `<div class="dilemma-grid">${dilemmas.map(([k, t, d]) => `<div class="dilemma-item"><div class="dilemma-illus">${typeof illus.dilemmaSvg === "function" ? illus.dilemmaSvg(k) : ""}</div><h3 class="dilemma-title">${E(t)}</h3><p class="dilemma-desc">${E(d)}</p></div>`).join("")}</div>`)}
${band("landing-band--white", "Satu platform pantauan harga beras", platformBody)}
${band("landing-band--subtle", "Cara kerja prediksi AI", workflowBody)}
${band("landing-band--white", "Transparansi data dan artikel pilihan", articlesBody)}
${band("landing-band--white landing-cta-band", "Mulai pantau harga beras", ctaBody)}
</div>`;
  }

  async function updateBentoChecker() {
    const seq = ++bentoSeq;
    const l = state.landing;
    const provSel = byId("bento-prov-select");
    if (provSel && provSel.value !== l.bentoProv) provSel.value = l.bentoProv;
    const dateEl = byId("bento-date-input");
    if (dateEl && dateEl.value !== l.bentoDate) dateEl.value = l.bentoDate;
    setText("bento-date-label", `Tanggal Target (${D(l.bentoDate)})`);
    qAll(document, "[data-bento-seg]").forEach((b) => {
      const act = b.getAttribute("data-bento-seg") === state.segment;
      b.classList.toggle("is-active", act);
      if (b.classList.contains("bento-channel-pill")) b.setAttribute("aria-pressed", act ? "true" : "false");
    });

    try {
      const [mod, trad, prod] = await Promise.all([
        fetchPredictDate("modern", l.bentoProv, l.bentoDate, "jsb_mlp"),
        fetchPredictDate("tradisional", l.bentoProv, l.bentoDate, "jsb_mlp"),
        fetchPredictDate("produsen", l.bentoProv, l.bentoDate, "jsb_mlp"),
      ]);
      if (seq !== bentoSeq || state.route !== "beranda") return;
      const active = { modern: mod, tradisional: trad, produsen: prod }[state.segment] || mod;
      setText("bento-mode-badge", active.mode === "historical" ? "Harga Terbaru" : "Estimasi JSB");
      const pv = byId("bento-price-val");
      if (pv) pv.innerHTML = `${E(R(active.predicted_idr))} <span class="section-note">/ kg</span>`;
      setText("bento-range-note", active.mode === "historical" ? `Data tercatat pada ${D(active.target_date)}` : `Rentang Wajar 90%: ${R(active.lower_idr)} - ${R(active.upper_idr)}`);
      const cl = byId("bento-compare-list");
      if (cl) {
        cl.innerHTML = [["Pasar Modern", mod.predicted_idr], ["Pasar Tradisional", trad.predicted_idr], ["Tingkat Produsen", prod.predicted_idr]]
          .map(([lbl, val]) => `<div class="bento-compare-item"><span>${lbl}</span><strong>${E(R(val))}</strong></div>`).join("");
      }
      setText("bento-micro-trad", R(trad.predicted_idr));
      setText("bento-micro-prod", R(prod.predicted_idr));
      setText("bento-kpi-badge", active.mode === "historical" ? "HARGA TERBARU" : "ESTIMASI JSB");
      setText("bento-kpi-value", P(active.delta_pct));
      setText("bento-kpi-caption", `${active.province} (${SEGMENT_LABELS[state.segment]}) pada ${D(active.target_date)}: ${R(active.predicted_idr)}/kg.`);
    } catch (_) {
      setText("bento-price-val", "Data belum tersedia");
    }
  }

  function openPlatformPopover(prov, triggerEl) {
    const pop = byId("platform-popover");
    const row = (state.landing.platformRows || []).find((r) => r.province === prov);
    if (!pop || !row) return;
    state.landing.popoverProv = prov;
    lastPopoverTrigger = triggerEl || null;
    qAll(document, ".platform-row").forEach((tr) => {
      const act = tr.getAttribute("data-platform-prov") === prov;
      tr.classList.toggle("is-selected", act);
      const b = tr.querySelector("button");
      if (b) b.setAttribute("aria-expanded", act ? "true" : "false");
    });
    const st = mapPublicStatus(row.status_tier, row.delta_pct);
    const tierEl = byId("popover-tier");
    if (tierEl) {
      tierEl.className = `platform-popover-tier ${st.pillClass === "is-warning" ? "is-warning" : st.pillClass === "is-danger" ? "is-danger" : ""}`;
      tierEl.textContent = st.label;
    }
    setText("popover-title", row.province);
    setText("popover-body", `Estimasi JSB ${SEGMENT_LABELS[state.segment] || "Pasar Modern"} pada ${D(state.landing.platformDate)} sebesar ${R(row.predicted_idr)}/kg (${P(row.delta_pct)} dibanding Harga Terbaru ${R(row.last_observed_idr)}/kg) dengan Kondisi Pasar ${st.label.toLowerCase()}.`);
    pop.hidden = false;
  }

  function renderPlatformTableRows() {
    const tbody = byId("platform-table-body");
    if (!tbody) return;
    const l = state.landing;
    setText("platform-pred-col-head", `Prediksi ${D(l.platformDate)}`);
    const q = l.platformSearch.trim().toLowerCase();
    const rows = (l.platformRows || []).filter((r) => !q || r.province.toLowerCase().includes(q));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">Provinsi tidak ditemukan pada pencarian ini.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const st = mapPublicStatus(r.status_tier, r.delta_pct);
      const isSel = l.popoverProv === r.province;
      return `<tr class="platform-row ${isSel ? "is-selected" : ""}" data-platform-prov="${E(r.province)}"><td><button type="button" class="platform-row-btn" data-platform-prov-btn="${E(r.province)}" aria-expanded="${isSel}"><span class="color-dot" style="--series-color:${PROVINCE_COLOR_VARS[r.province] || "var(--brand-primary)"}" aria-hidden="true"></span><span>${E(r.province)}</span></button></td><td class="num-cell">${E(R(r.last_observed_idr))}</td><td class="num-cell"><strong>${E(R(r.predicted_idr))}</strong></td><td class="num-cell">${E(P(r.delta_pct))}</td><td><span class="platform-status-pill ${st.pillClass}">${E(st.label)}</span></td></tr>`;
    }).join("");
    qAll(tbody, ".platform-row").forEach((tr) => tr.addEventListener("click", (ev) => openPlatformPopover(tr.getAttribute("data-platform-prov"), ev.target.closest("button") || tr.querySelector("button"))));
  }

  async function updatePlatformShowcase() {
    const seq = ++platformSeq;
    const l = state.landing;
    qAll(document, "[data-platform-seg]").forEach((b) => setPressed(b, b.getAttribute("data-platform-seg") === state.segment));
    try {
      const data = await fetchPredictDate(state.segment, "all", l.platformDate, "jsb_mlp");
      if (seq !== platformSeq || state.route !== "beranda") return;
      l.platformRows = data.province_comparison || [];
      renderPlatformTableRows();
      if (l.popoverProv) {
        if (l.platformRows.some((r) => r.province === l.popoverProv)) openPlatformPopover(l.popoverProv, lastPopoverTrigger);
        else closePlatformPopover(false);
      }
    } catch (_) {
      const tbody = byId("platform-table-body");
      if (tbody) tbody.innerHTML = '<tr><td colspan="5">Gagal memuat ringkasan wilayah.</td></tr>';
    }
  }

  async function updateWorkflowPreview() {
    const seq = ++workflowSeq;
    const l = state.landing;
    const wfDate = addDaysIso(getTodayIso(), l.wfOffsetDays);
    qAll(document, "[data-wf-seg]").forEach((b) => setPressed(b, b.getAttribute("data-wf-seg") === l.wfSegment));
    qAll(document, "[data-wf-offset]").forEach((b) => setPressed(b, Number(b.getAttribute("data-wf-offset")) === l.wfOffsetDays));
    try {
      const res = await fetchPredictDate(l.wfSegment, l.bentoProv, wfDate, "jsb_mlp");
      if (seq !== workflowSeq || state.route !== "beranda") return;
      setText("wf-result-label", `${l.bentoProv} · ${SEGMENT_LABELS[l.wfSegment]} · ${D(wfDate)}`);
      setText("wf-result-val", `${R(res.predicted_idr)} / kg`);
      setText("wf-result-range", res.mode === "historical" ? `Data tercatat (${P(res.delta_pct)} 30 hari)` : `Rentang Wajar 90%: ${R(res.lower_idr)} - ${R(res.upper_idr)}`);
    } catch (_) {
      setText("wf-result-val", "Data belum tersedia");
    }
  }

  async function renderBeranda() {
    els.viewRoot.innerHTML = buildLandingMarkup();
    onChange("bento-prov-select", (val) => {
      state.landing.bentoProv = val;
      safeStorageSet("berasak_quick_prov", val);
      updateBentoChecker();
      updateWorkflowPreview();
    });
    onChange("bento-date-input", (val) => {
      if (!val) return;
      state.landing.bentoDate = clampPredictDate(val);
      updateBentoChecker();
    });
    onClickAll(els.viewRoot, "[data-bento-seg], [data-platform-seg]", (btn) => {
      const seg = btn.getAttribute("data-bento-seg") || btn.getAttribute("data-platform-seg");
      if (!CHANNEL_HINTS[seg]) return;
      setActiveSegment(seg);
      syncNavAndSegmentUI();
      updateBentoChecker();
      updatePlatformShowcase();
    });
    onClick("bento-detail-btn", () => {
      state.predict.province = state.landing.bentoProv;
      state.predict.date = state.landing.bentoDate;
      state.forecasts.province = state.landing.bentoProv;
      navigateTo("prakiraan");
    });
    const ps = byId("platform-search");
    if (ps) ps.addEventListener("input", (ev) => { state.landing.platformSearch = ev.target.value; renderPlatformTableRows(); });
    onChange("platform-date-input", (val) => {
      if (!val) return;
      state.landing.platformDate = clampPredictDate(val);
      updatePlatformShowcase();
    });
    onClick("platform-cta-btn", () => { state.predict.date = state.landing.platformDate; });
    onClick("popover-close-btn", () => closePlatformPopover(true));
    onClick("popover-open-predict", () => {
      if (state.landing.popoverProv) {
        state.predict.province = state.landing.popoverProv;
        state.forecasts.province = state.landing.popoverProv;
      }
      state.predict.date = state.landing.platformDate;
      navigateTo("prakiraan");
    });
    onClickAll(els.viewRoot, "[data-wf-seg]", (b) => { state.landing.wfSegment = b.getAttribute("data-wf-seg"); updateWorkflowPreview(); });
    onClickAll(els.viewRoot, "[data-wf-offset]", (b) => { state.landing.wfOffsetDays = Number(b.getAttribute("data-wf-offset")); updateWorkflowPreview(); });
    onClick("wf-open-predict-btn", () => {
      setActiveSegment(state.landing.wfSegment);
      state.predict.province = state.landing.bentoProv;
      state.predict.date = addDaysIso(getTodayIso(), state.landing.wfOffsetDays);
      state.forecasts.province = state.landing.bentoProv;
      navigateTo("prakiraan");
    });
    await Promise.all([updateBentoChecker(), updatePlatformShowcase(), updateWorkflowPreview()]);
  }

  function resetTrendsFilter() {
    state.trends.provinces = [...MAIN4_PROVINCES];
    state.trends.range = "1y";
    state.trends.agg = "monthly";
    syncTrenControlsUI();
    loadAndRenderTrends(false);
  }

  function syncTrenControlsUI() {
    const t = state.trends;
    const isAll = t.provinces.length === ALL_PROVINCES.length;
    const isMain4 = t.provinces.length === MAIN4_PROVINCES.length && MAIN4_PROVINCES.every((p) => t.provinces.includes(p));
    const pAll = document.querySelector('[data-trend-preset="all"]');
    const pMain = document.querySelector('[data-trend-preset="main4"]');
    if (pAll) setPressed(pAll, isAll);
    if (pMain) setPressed(pMain, isMain4);
    qAll(els.viewRoot, "[data-trend-prov]").forEach((b) => setPressed(b, t.provinces.includes(b.getAttribute("data-trend-prov"))));
    qAll(els.viewRoot, "[data-trend-range]").forEach((b) => setPressed(b, t.range === b.getAttribute("data-trend-range")));
    qAll(els.viewRoot, "[data-trend-agg]").forEach((b) => setPressed(b, t.agg === b.getAttribute("data-trend-agg")));
    const ma4 = byId("toggle-ma4");
    if (ma4) ma4.checked = t.showMa4;
  }

  function renderTrenResultsContent(resultsMount, data) {
    const sorted = [...data.summary].sort((a, b) => b.latest_idr - a.latest_idr);
    const top = sorted[0];
    const bot = sorted[sorted.length - 1];
    const headline = sorted.length > 1
      ? `${PROVINCE_SHORT[top.province] || top.province} tertinggi (${R(top.latest_idr)}), terpaut ${R(top.latest_idr - bot.latest_idr)} dari ${PROVINCE_SHORT[bot.province] || bot.province}`
      : `${top.province}: ${R(top.latest_idr)} / kg`;
    const rowsHtml = sorted.map((s) => `<tr><td><span class="series-label" style="--series-color:${PROVINCE_COLOR_VARS[s.province] || "var(--brand-primary)"}"><strong>${E(s.province)}</strong></span></td><td class="num-cell"><strong>${E(R(s.latest_idr))}</strong></td><td class="num-cell">${E(R(s.min_idr))}</td><td class="num-cell">${E(R(s.max_idr))}</td><td class="num-cell">${E(R(s.mean_idr))}</td></tr>`).join("");
    resultsMount.innerHTML =
      cardBox(E(headline), `${E(data.segment.label)} · ${E(D(data.start_date))} s/d ${E(D(data.end_date))}`, '<div id="trend-chart-mount"></div>') +
      cardBox("Ringkasan Rentang Terpilih", "Perbandingan Harga Terbaru, harga terendah, harga tertinggi, dan rata-rata pada periode terpilih.", tableBox('<th>Provinsi</th><th class="num-head">Harga Terbaru</th><th class="num-head">Terendah</th><th class="num-head">Tertinggi</th><th class="num-head">Rata-rata</th>', rowsHtml));
    renderTrendsChart(byId("trend-chart-mount"), data, { showMa4: state.trends.showMa4, onReset: resetTrendsFilter });
  }

  async function loadAndRenderTrends(chartOnly = false) {
    const resultsMount = byId("tren-results-mount");
    if (!resultsMount) return;
    const t = state.trends;
    const cacheKey = `${state.segment}|${t.provinces.join(",")}|${t.agg}|${t.range}`;
    if (chartOnly && state.trendsCache && state.trendsCache.key === cacheKey) {
      const m = byId("trend-chart-mount");
      if (m) { renderTrendsChart(m, state.trendsCache.data, { showMa4: t.showMa4, onReset: resetTrendsFilter }); return; }
    }
    setPanelBusy(resultsMount, "Memuat grafik tren harga beras...");
    try {
      const data = await apiGet(`/api/trends?segment=${encodeURIComponent(state.segment)}&provinces=${encodeURIComponent(t.provinces.join(","))}&agg=${encodeURIComponent(t.agg)}&range=${encodeURIComponent(t.range)}`);
      state.trendsCache = { key: cacheKey, data };
      resultsMount.classList.remove("panel-loading");
      renderTrenResultsContent(resultsMount, data);
    } catch (err) {
      resultsMount.classList.remove("panel-loading");
      renderError(resultsMount, err.message, () => loadAndRenderTrends(false));
    }
  }

  async function renderTren() {
    const t = state.trends;
    if (!byId("tren-page-shell")) {
      const chipsHtml = ALL_PROVINCES.map((p) => `<button type="button" class="chip-btn" aria-pressed="false" data-trend-prov="${E(p)}"><span class="color-dot" style="--series-color:${PROVINCE_COLOR_VARS[p] || "var(--brand-primary)"}" aria-hidden="true"></span><span>${E(p)}</span></button>`).join("");
      els.viewRoot.innerHTML = `<div class="view-stack" id="tren-page-shell"><div class="filter-strip">
<div class="field-group"><div class="overview-hero-head"><span class="field-label">Pilih Provinsi (1 sampai 6)</span><div class="preset-chips" role="group" aria-label="Preset pilihan provinsi"><button type="button" class="preset-chip" data-trend-preset="all" aria-pressed="false">Seluruh Provinsi</button><button type="button" class="preset-chip" data-trend-preset="main4" aria-pressed="false">4 Utama</button></div></div><div class="chip-list">${chipsHtml}</div></div>
<div class="controls-grid">
${fieldGrp("Rentang Waktu", segGroup("Rentang waktu grafik", [["3m", "3 Bulan"], ["1y", "1 Tahun"], ["all", "2022-2026"]].map(([id, lbl]) => chipBtn("seg-btn", "data-trend-range", id, lbl, false)).join("")))}
${fieldGrp("Tampilan Data", segGroup("Mode tampilan data", [["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"]].map(([id, lbl]) => chipBtn("seg-btn", "data-trend-agg", id, lbl, false)).join("")))}
${fieldGrp("Garis Bantu", `<div class="chip-list"><label class="check-label" for="toggle-ma4"><input type="checkbox" id="toggle-ma4" ${t.showMa4 ? "checked" : ""}><span>Garis Bantu 4 Minggu</span></label></div>`)}
</div>
</div><div class="view-stack" id="tren-results-mount"></div></div>`;

      onClickAll(els.viewRoot, "[data-trend-preset]", (b) => {
        state.trends.provinces = b.getAttribute("data-trend-preset") === "all" ? [...ALL_PROVINCES] : [...MAIN4_PROVINCES];
        syncTrenControlsUI();
        loadAndRenderTrends(false);
      });
      onClickAll(els.viewRoot, "[data-trend-prov]", (b) => {
        const prov = b.getAttribute("data-trend-prov");
        const exists = state.trends.provinces.includes(prov);
        if (exists && state.trends.provinces.length > 1) state.trends.provinces = state.trends.provinces.filter((p) => p !== prov);
        else if (!exists) state.trends.provinces = ALL_PROVINCES.filter((p) => state.trends.provinces.includes(p) || p === prov);
        else return;
        syncTrenControlsUI();
        loadAndRenderTrends(false);
      });
      onClickAll(els.viewRoot, "[data-trend-range]", (b) => { state.trends.range = b.getAttribute("data-trend-range"); syncTrenControlsUI(); loadAndRenderTrends(false); });
      onClickAll(els.viewRoot, "[data-trend-agg]", (b) => { state.trends.agg = b.getAttribute("data-trend-agg"); syncTrenControlsUI(); loadAndRenderTrends(false); });
      onChange("toggle-ma4", (_, ev) => { state.trends.showMa4 = ev.target.checked; loadAndRenderTrends(true); });
    }
    syncTrenControlsUI();
    await loadAndRenderTrends(false);
  }

  function applyCompareProvinceSelection(prov) {
    state.compare.selectedProvince = prov;
    const mount = byId("compare-results-mount");
    if (!mount || !state.compareData) return;
    qAll(mount, "[data-bar-prov]").forEach((b) => {
      const isSel = b.getAttribute("data-bar-prov") === prov;
      b.classList.toggle("is-selected", isSel);
      setPressed(b, isSel);
    });
    const mapMount = byId("sulawesi-map-mount");
    if (mapMount) updateSulawesiMapSelection(mapMount, state.compareData.rankings, prov);
    qAll(mount, "[data-compare-row]").forEach((tr) => tr.classList.toggle("is-highlighted", tr.getAttribute("data-compare-row") === prov));
    qAll(mount, "[data-compare-prov]").forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-compare-prov") === prov ? "true" : "false"));
  }

  async function loadAndRenderCompare() {
    const resultsMount = byId("compare-results-mount");
    if (!resultsMount) return;
    const cmp = state.compare;
    setPanelBusy(resultsMount, "Memuat peta, peringkat wilayah, dan selisih pasokan...");

    try {
      const data = await apiGet(`/api/compare?segment=${encodeURIComponent(state.segment)}&date=${encodeURIComponent(cmp.date)}`);
      state.compareData = data;
      resultsMount.classList.remove("panel-loading");
      const rankings = data.rankings || [];
      if (rankings.length && !rankings.some((r) => r.province === cmp.selectedProvince)) {
        cmp.selectedProvince = rankings[0].province;
      }
      setText("compare-date-label", `Tanggal Pantauan (${D(data.date)})`);
      const di = byId("compare-date-input");
      if (di) { di.value = data.date; di.min = data.min_date; di.max = data.max_date; }
      const sm = byId("compare-date-status");
      if (sm) sm.innerHTML = badgeHtml("success", "Data Lengkap", "check");
      setText("compare-disparity-readout", `${R(data.disparity_idr)} / kg (${String(data.disparity_pct).replace(".", ",")}%)`);

      const vals = rankings.map((r) => r.price_idr);
      const axisMin = Math.max(0, Math.floor((Math.min(...vals) - 1500) / 2000) * 2000);
      const axisMax = Math.ceil((Math.max(...vals) + 500) / 2000) * 2000;
      const axisSpan = Math.max(2000, axisMax - axisMin);
      const midAxis = Math.round((axisMin + axisMax) / 2);

      const barsHtml = rankings.map((r) => {
        const pct = Math.max(4, Math.min(100, ((r.price_idr - axisMin) / axisSpan) * 100));
        const isSel = cmp.selectedProvince === r.province;
        return `<button type="button" class="bar-row ${isSel ? "is-selected is-active" : ""}" data-bar-prov="${E(r.province)}" aria-pressed="${isSel}"><span class="bar-prov">${r.rank}. ${E(r.province)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="--bar-pct:${pct.toFixed(1)}%;--series-color:${PROVINCE_COLOR_VARS[r.province] || "var(--brand-primary)"}"></span></span><span class="bar-val">${E(R(r.price_idr))}</span></button>`;
      }).join("");

      const marginRowsHtml = data.supply_chain_margins.map((m) => {
        const isSel = cmp.selectedProvince === m.province;
        return `<tr class="table-row-interactive ${isSel ? "is-highlighted" : ""}" data-compare-row="${E(m.province)}"><td><button type="button" class="table-row-btn" data-compare-prov="${E(m.province)}" aria-pressed="${isSel}"><strong>${E(m.province)}</strong></button></td><td class="num-cell">${E(R(m.produsen_idr))}</td><td class="num-cell">${E(R(m.tradisional_idr))}</td><td class="num-cell"><strong>${E(R(m.modern_idr))}</strong></td><td class="num-cell text-brand">+${E(R(m.spread_idr))} (${String(m.spread_pct).replace(".", ",")}%)</td></tr>`;
      }).join("");

      resultsMount.innerHTML = `<div class="grid-compare-split">
${cardBox(`Peringkat Harga (${E(D(data.date))})`, `Pilih provinsi untuk menyorot posisi pada peta dan tabel selisih pasokan. Rentang sumbu ${E(R(axisMin))} s/d ${E(R(axisMax))}.`, `<div>${barsHtml}<div class="bar-axis"><span class="bar-axis-spacer"></span><div class="bar-axis-ticks"><span>${E(R(axisMin))}</span><span>${E(R(midAxis))}</span><span>${E(R(axisMax))}</span></div><span class="bar-axis-end"></span></div></div>`)}
${cardBox("Peta Sebaran Sulawesi", "", '<div id="sulawesi-map-mount"></div>')}
</div>` + cardBox(`Selisih Harga Produsen ke Pasar (${E(D(data.date))})`, "Klik baris provinsi untuk menyorotnya pada peringkat dan peta. Membandingkan produsen, pasar tradisional, dan pasar modern.", tableBox('<th>Provinsi</th><th class="num-head">Produsen</th><th class="num-head">Tradisional</th><th class="num-head">Modern</th><th class="num-head">Selisih Produsen ke Modern</th>', marginRowsHtml));

      renderSulawesiMap(byId("sulawesi-map-mount"), rankings, cmp.selectedProvince, applyCompareProvinceSelection);
      onClickAll(resultsMount, "[data-bar-prov]", (b) => applyCompareProvinceSelection(b.getAttribute("data-bar-prov")));
      bindRowPick(resultsMount, "data-compare-prov", "data-compare-row", applyCompareProvinceSelection);
      applyCompareProvinceSelection(cmp.selectedProvince);
    } catch (err) {
      resultsMount.classList.remove("panel-loading");
      renderError(resultsMount, err.message, loadAndRenderCompare);
    }
  }

  async function renderBandingkan() {
    if (!byId("compare-page-shell")) {
      els.viewRoot.innerHTML = `<div class="view-stack" id="compare-page-shell"><div class="filter-strip"><div class="controls-grid controls-row-between">
<div class="controls-grid controls-row-center">
<div class="field-group"><label class="field-label" for="compare-date-input" id="compare-date-label">Tanggal Pantauan (${E(D(state.compare.date))})</label><input type="date" id="compare-date-input" class="input-control font-mono" value="${E(state.compare.date)}" min="2022-01-01" max="2026-02-12"></div>
<div class="field-group"><span class="field-label">Kelengkapan</span><div id="compare-date-status"></div></div>
</div>
<div><div class="field-label">Selisih Harga Antarprovinsi</div><div class="kpi-md text-alert" id="compare-disparity-readout">-</div></div>
</div></div><div class="view-stack" id="compare-results-mount"></div></div>`;
      onChange("compare-date-input", (val) => { if (val) { state.compare.date = val; loadAndRenderCompare(); } });
    }
    await loadAndRenderCompare();
  }

  function syncAiDateControlsUI() {
    const p = state.predict;
    const todayIso = getTodayIso();
    const ps = byId("ai-prov-select");
    if (ps && ps.value !== p.province) ps.value = p.province;
    const di = byId("ai-target-date");
    if (di && di.value !== p.date) di.value = p.date;
    setText("ai-target-date-label", `Tanggal Target (${D(p.date)})`);
    qAll(els.viewRoot, "[data-ai-offset]").forEach((b) => setPressed(b, addDaysIso(todayIso, Number(b.getAttribute("data-ai-offset"))) === p.date));
  }

  function computeRangeBarVars(lower, predicted, upper) {
    if (upper <= lower) return { startPct: "44%", widthPct: "12%", pointPct: "50%" };
    const span = Math.max(200, upper - lower);
    const vMin = lower - span * 0.2;
    const total = Math.max(100, upper + span * 0.2 - vMin);
    const start = Math.max(2, Math.min(86, ((lower - vMin) / total) * 100));
    const end = Math.max(start + 8, Math.min(98, ((upper - vMin) / total) * 100));
    const pt = Math.max(start, Math.min(end, ((predicted - vMin) / total) * 100));
    return { startPct: `${start.toFixed(1)}%`, widthPct: `${(end - start).toFixed(1)}%`, pointPct: `${pt.toFixed(1)}%` };
  }

  async function loadAndRenderAiDate() {
    const mount = byId("ai-date-results-mount");
    if (!mount) return;
    const seq = ++aiPredictSeq;
    const p = state.predict;
    setPanelBusy(mount, "Menghitung Estimasi JSB untuk tanggal pilihan...");

    try {
      const data = await fetchPredictDate(state.segment, p.province, p.date, "jsb_mlp");
      if (seq !== aiPredictSeq || state.route !== "prakiraan") return;
      mount.classList.remove("panel-loading");

      const st = mapPublicStatus(data.status_tier, data.delta_pct);
      const scopeLabel = data.province === "all" ? "Seluruh Provinsi" : data.province;
      const bar = computeRangeBarVars(data.lower_idr, data.predicted_idr, data.upper_idr);

      const outlookHtml = (data.daily_outlook || []).map((d) => `<button type="button" class="ai-outlook-card ${d.is_target ? "is-highlight" : ""}" data-ai-jump-date="${E(d.date)}" aria-pressed="${d.is_target}"><span class="field-label">${E(d.day_label)}</span><span class="kpi-md">${E(R(d.predicted_idr))}</span><span class="section-note">${E(formatInt(d.lower_idr))} - ${E(formatInt(d.upper_idr))}</span></button>`).join("");
      const provChipsHtml = (data.province_comparison || []).map((pc) => {
        const isSel = p.province === pc.province;
        const pSt = mapPublicStatus(pc.status_tier, pc.delta_pct);
        return `<button type="button" class="ai-province-chip ${isSel ? "is-active" : ""}" data-ai-jump-prov="${E(pc.province)}" aria-pressed="${isSel}"><span class="field-label">${E(PROVINCE_SHORT[pc.province] || pc.province)}</span><strong class="font-mono">${E(R(pc.predicted_idr))}</strong><span class="section-note">${E(P(pc.delta_pct))} · ${E(pSt.label)}</span></button>`;
      }).join("");

      mount.innerHTML = `<div class="ai-outlook-grid">
<div class="ai-outlook-card is-highlight"><span class="field-label">${E(scopeLabel)} · ${E(D(data.target_date))}</span><div class="kpi-lg kpi-price-inline"><span>${E(R(data.predicted_idr))}</span><span class="kpi-unit">/ kg</span></div><span class="section-note">${E(P(data.delta_pct))} (${E(R(data.delta_idr))}) · Kondisi: ${E(st.label)}</span></div>
<div class="ai-outlook-card"><span class="field-label">Rentang Wajar 90%</span><div class="ai-range-val">${E(R(data.lower_idr))} - ${E(R(data.upper_idr))}</div><div class="ai-range-bar" aria-label="Rentang Wajar 90%"><div class="ai-range-track"><span class="ai-range-fill" style="--range-start:${bar.startPct};--range-width:${bar.widthPct}"></span><span class="ai-range-marker" style="--range-point:${bar.pointPct}"></span></div><div class="ai-range-labels"><span>Min ${E(R(data.lower_idr))}</span><span>Maks ${E(R(data.upper_idr))}</span></div></div></div>
<div class="ai-outlook-card"><span class="field-label">Harga Terbaru (Acuan)</span><div class="kpi-md">${E(R(data.last_observed_idr))}</div><span class="section-note">Tercatat ${E(D(data.last_observed_date))}</span></div>
<div class="ai-outlook-card"><span class="field-label">Model &amp; Kondisi Pasar</span><div class="kpi-model-name">JSB MLP (Keras)</div><span class="section-note">${data.mode === "historical" ? "Data Aktual PIHPS" : "Jaringan Syaraf Buatan"} · ${E(st.label)}</span></div>
</div>
<p class="quick-summary-line">${E(data.explanation)}</p>
<div class="field-group"><span class="field-label">Prakiraan Harian 7 Hari (Klik kartu untuk berpindah tanggal)</span><div class="ai-daily-grid">${outlookHtml}</div></div>
<div class="field-group"><span class="field-label">Perbandingan Seluruh Provinsi pada ${E(D(data.target_date))}</span><div class="ai-province-strip">${provChipsHtml}</div></div>`;

      onClickAll(mount, "[data-ai-jump-date]", (b) => {
        state.predict.date = clampPredictDate(b.getAttribute("data-ai-jump-date"));
        syncAiDateControlsUI();
        loadAndRenderAiDate();
      });
      onClickAll(mount, "[data-ai-jump-prov]", (b) => {
        const prov = b.getAttribute("data-ai-jump-prov");
        state.predict.province = prov;
        state.forecasts.province = prov;
        syncAiDateControlsUI();
        syncForecastControlsUI();
        loadAndRenderAiDate();
        loadAndRenderPrakiraan();
      });
    } catch (err) {
      mount.classList.remove("panel-loading");
      renderError(mount, err.message, loadAndRenderAiDate);
    }
  }

  function syncForecastControlsUI() {
    const f = state.forecasts;
    setText("fc-weekly-prov-note", `Model aktif: JSB MLP (TensorFlow/Keras) · Provinsi: ${f.province}`);
    qAll(els.viewRoot, "[data-fc-horizon]").forEach((b) => setPressed(b, Number(b.getAttribute("data-fc-horizon")) === f.horizon));
  }

  function formatRangePeriodId(periodStr) {
    if (!periodStr || typeof periodStr !== "string") return "-";
    const parts = periodStr.split("..");
    if (parts.length === 2) return `${D(parts[0])} s/d ${D(parts[1])}`;
    return D(periodStr);
  }

  function formatDecId(num, decimals = 2) {
    if (num === null || num === undefined || Number.isNaN(Number(num))) return "-";
    return Number(num).toFixed(decimals).replace(".", ",");
  }

  function formatSignedRp(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return "-";
    if (n > 0) return `+${R(n)}`;
    if (n < 0) return `-Rp ${formatInt(Math.abs(n))}`;
    return R(0);
  }

  async function loadAndRenderPrakiraan() {
    const resultsMount = byId("fc-results-mount");
    if (!resultsMount) return;
    const f = state.forecasts;
    setPanelBusy(resultsMount, "Memuat grafik proyeksi mingguan dan evaluasi JSB...");

    try {
      const data = await apiGet(`/api/forecasts?segment=${encodeURIComponent(state.segment)}&province=${encodeURIComponent(f.province)}&horizon=${f.horizon}&model=jsb_mlp`);
      state.forecastChartCache = data;
      resultsMount.classList.remove("panel-loading");
      const jsb = data.jsb_info || {};
      const arch = jsb.architecture || {};
      const split = jsb.split || {};
      const selEval = (data.model_comparison && data.model_comparison[0]) || {
        eval_mape: jsb.series_eval ? jsb.series_eval.mape_4w : 0,
      };
      const finalPt = data.forecast_points[data.forecast_points.length - 1];

      const archDims = (arch.layers || []).map((ly) => ly.units).join(" -> ") || "17 -> 32 -> 16 -> 1";
      const provSubtitle = `Split kronologis ${formatRangePeriodId(split.train_period)} (${formatDecId(split.train_ratio_pct, 1)}% latih) / ${formatRangePeriodId(split.test_period)} (${formatDecId(split.test_ratio_pct, 1)}% uji) · Arsitektur ${archDims} (${formatInt(arch.total_params)} parameter). Klik baris provinsi untuk mengganti wilayah grafik.`;

      const provMetrics = jsb.province_metrics || [];
      const provRowsHtml = provMetrics.length
        ? provMetrics.map((pm) => {
            const isSel = pm.province === data.province;
            return `<tr class="table-row-interactive ${isSel ? "is-highlighted" : ""}" data-fc-prov-row="${E(pm.province)}">
              <td><button type="button" class="table-row-btn" data-select-fc-prov="${E(pm.province)}" aria-pressed="${isSel ? "true" : "false"}"><span class="color-dot" style="--series-color:${PROVINCE_COLOR_VARS[pm.province] || "var(--brand-primary)"}" aria-hidden="true"></span><strong>${E(pm.province)}</strong>${isSel ? badgeHtml("success", "Aktif", "check") : ""}</button></td>
              <td class="num-cell">${E(formatRpDecimal(pm.mae_4w, 2))}</td>
              <td class="num-cell">${E(formatDecId(pm.mape_4w, 2))}%</td>
              <td class="num-cell">${E(formatRpDecimal(pm.rmse_4w, 2))}</td>
              <td class="num-cell">${E(formatRpDecimal(pm.mae_8w, 2))}</td>
              <td class="num-cell">${E(formatDecId(pm.mape_8w, 2))}%</td>
            </tr>`;
          }).join("")
        : '<tr><td colspan="6">Metrik evaluasi JSB per provinsi belum tersedia.</td></tr>';

      const fiList = jsb.feature_importance || [];
      const fiHtml = fiList.length
        ? fiList.map((fi) => {
            const pct = Math.max(0, Math.min(100, Number(fi.importance_pct) || 0));
            return `<div class="jsb-fi-item">
              <div class="jsb-fi-head"><span class="jsb-fi-name">${E(fi.group)}</span><span class="jsb-fi-pct font-mono">${E(formatDecId(pct, 1))}%</span></div>
              <div class="jsb-fi-track" aria-hidden="true"><span class="jsb-fi-fill${pct <= 0 ? " is-zero" : ""}" style="width:${pct.toFixed(1)}%;--fi-pct:${pct.toFixed(1)}%"></span></div>
              <p class="jsb-fi-desc">${E(fi.description)}</p>
            </div>`;
          }).join("")
        : '<p class="card-desc">Ringkasan kontribusi fitur belum tersedia.</p>';

      const trainPanelsHtml = `<div class="jsb-split-grid">
        <div class="jsb-panel">
          <h3 class="jsb-panel-title">Kurva Penurunan Error Pelatihan &amp; Validasi (MSE)</h3>
          <div id="fc-loss-chart-mount"></div>
        </div>
        <div class="jsb-panel">
          <h3 class="jsb-panel-title">Kontribusi Kelompok Fitur Input (Permutation)</h3>
          <div class="jsb-fi-list">${fiHtml}</div>
        </div>
      </div>`;

      const archCardsHtml = (arch.layers || []).map((ly, idx) => `
        <div class="jsb-arch-card">
          <span class="field-label">Lapisan ${idx + 1} · ${E(ly.type)}</span>
          <strong class="jsb-arch-name">${E(ly.name)}</strong>
          <span class="jsb-arch-meta font-mono">${E(String(ly.units))} unit · ${E(ly.activation || "linear")} · ${E(formatInt(ly.params))} param</span>
          <span class="section-note">${E(ly.role)}</span>
        </div>
      `).join("");

      const holdoutSamples = jsb.holdout_samples || [];
      const holdoutRowsHtml = holdoutSamples.length
        ? holdoutSamples.map((hs) => `<tr>
            <td class="font-mono">${E(D(hs.week_date))}</td>
            <td class="num-cell">${E(R(hs.actual_idr))}</td>
            <td class="num-cell"><strong>${E(R(hs.predicted_idr))}</strong></td>
            <td class="num-cell">${E(formatSignedRp(hs.error_idr))}</td>
            <td class="num-cell">${E(formatDecId(hs.error_pct, 2))}%</td>
          </tr>`).join("")
        : '<tr><td colspan="5">Sampel pengujian holdout belum tersedia.</td></tr>';

      const detailsHtml = `<details class="methodology-details" id="ai-jsb-details">
        <summary class="methodology-summary"><span>Detail Lapisan Arsitektur JSB, Sampel Uji Holdout &amp; Cara Membaca Estimasi</span><svg class="faq-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"></path></svg></summary>
        <div class="methodology-body">
          <h3 class="jsb-sub-heading">Lapisan Jaringan Syaraf Buatan (TensorFlow/Keras Sequential)</h3>
          <div class="jsb-arch-grid">${archCardsHtml}</div>
          <h3 class="jsb-sub-heading">Sampel Pengujian Holdout (${E(data.province)})</h3>
          ${tableBox('<th>Tanggal Uji</th><th class="num-head">Aktual PIHPS</th><th class="num-head">Prediksi JSB</th><th class="num-head">Selisih</th><th class="num-head">Galat</th>', holdoutRowsHtml)}
          <p class="card-desc">Model JSB MLP mempelajari perubahan harga mingguan dari 17 fitur terstandarisasi meliputi riwayat harga 1 hingga 4 minggu sebelumnya, laju perubahan mingguan, siklus bulan kalender, saluran pasar, dan identitas provinsi di Sulawesi.</p>
          <p class="card-desc">Seluruh bobot dilatih secara kronologis pada data Januari 2022 hingga Desember 2024 dan diuji pada data holdout Januari 2025 hingga Februari 2026 agar hasil evaluasi mencerminkan kondisi masa depan yang belum pernah dilihat model.</p>
          <p class="card-desc">Angka estimasi adalah acuan perencanaan belanja dan stok usaha dengan Rentang Wajar 90%, bukan jaminan harga jual di lapangan.</p>
          <div><a class="btn btn-secondary" href="#artikel/cara-memanfaatkan-prediksi-harga-ai-untuk-belanja">Baca Panduan Lengkap Prediksi</a></div>
        </div>
      </details>`;

      resultsMount.innerHTML =
        cardBox(`${E(data.province)}: Proyeksi +${f.horizon} Minggu di ${E(R(finalPt.predicted_idr))}`, `Target ${E(D(finalPt.target_date))} · Rentang Wajar 90%: ${E(R(finalPt.lower_idr))} s/d ${E(R(finalPt.upper_idr))}.`, '<div id="fc-chart-mount"></div>', badgeHtml("success", `JSB MLP · Galat ${formatDecId(selEval.eval_mape, 2)}%`, "dot")) +
        cardBox("Evaluasi Akurasi JSB per Provinsi (Holdout 2025 s/d Feb 2026)", E(provSubtitle), tableBox('<th>Provinsi</th><th class="num-head">MAE (+4M)</th><th class="num-head">MAPE (+4M)</th><th class="num-head">RMSE (+4M)</th><th class="num-head">MAE (+8M)</th><th class="num-head">MAPE (+8M)</th>', provRowsHtml)) +
        cardBox("Proses Pelatihan &amp; Kontribusi Fitur JSB", `${E(jsb.framework || "TensorFlow / Keras (Sequential MLP)")} · Pengoptimal ${E(arch.optimizer || "Adam")} · Fungsi kerugian ${E(arch.loss || "Mean Squared Error (MSE)")}.`, trainPanelsHtml) +
        detailsHtml;

      renderForecastChart(byId("fc-chart-mount"), data);
      renderJsbLossChart(byId("fc-loss-chart-mount"), jsb.loss_history || []);
      bindRowPick(resultsMount, "data-select-fc-prov", "data-fc-prov-row", (prov) => {
        if (!prov || (state.forecasts.province === prov && state.predict.province === prov)) return;
        state.forecasts.province = prov;
        state.predict.province = prov;
        syncAiDateControlsUI();
        syncForecastControlsUI();
        loadAndRenderAiDate();
        loadAndRenderPrakiraan();
      });
    } catch (err) {
      resultsMount.classList.remove("panel-loading");
      renderError(resultsMount, err.message, loadAndRenderPrakiraan);
    }
  }

  async function renderPrakiraan() {
    const p = state.predict;
    const f = state.forecasts;
    const todayIso = getTodayIso();
    if (!byId("fc-page-shell")) {
      els.viewRoot.innerHTML = `<div class="view-stack" id="fc-page-shell">
<section class="ai-date-panel" aria-label="Prediksi Harga AI per Tanggal">
<div class="ai-date-panel-head"><div><h2 class="card-title">Prediksi Harga Beras AI per Tanggal</h2><p class="card-desc">Pilih provinsi dan tanggal target (2022 s/d 2028) untuk estimasi Jaringan Syaraf Buatan (JSB MLP).</p></div><span class="eyebrow-mint">JSB · TensorFlow/Keras</span></div>
<div class="ai-date-controls">
<div class="field-group"><label class="field-label" for="ai-prov-select">Wilayah Provinsi</label><select id="ai-prov-select" class="select-control"><option value="all" ${p.province === "all" ? "selected" : ""}>Seluruh Provinsi</option>${ALL_PROVINCES.map((prov) => `<option value="${E(prov)}" ${prov === p.province ? "selected" : ""}>${E(prov)}</option>`).join("")}</select></div>
<div class="field-group"><label class="field-label" for="ai-target-date" id="ai-target-date-label">Tanggal Target (${E(D(p.date))})</label><input type="date" id="ai-target-date" class="ai-date-input" value="${E(p.date)}" min="${PREDICT_MIN}" max="${PREDICT_MAX}"></div>
${fieldGrp("Pilih Cepat", `<div class="ai-quick-chips" role="group" aria-label="Pilihan cepat tanggal target">${[[0, "Hari Ini"], [1, "Besok"], [7, "+7 Hari"], [30, "+30 Hari"], [90, "+3 Bulan"]].map(([off, lbl]) => chipBtn("ai-chip", "data-ai-offset", off, lbl, addDaysIso(todayIso, off) === p.date)).join("")}</div>`)}
</div>
<div class="view-stack" id="ai-date-results-mount"></div>
</section>
<div class="filter-strip"><div class="jsb-controls-row">
${fieldGrp("Jangka Grafik Mingguan", segGroup("Jangka waktu prediksi mingguan", [4, 8].map((hv) => chipBtn("seg-btn", "data-fc-horizon", hv, `${hv} Minggu`, false)).join("")))}
<span class="jsb-controls-meta" id="fc-weekly-prov-note">Model aktif: JSB MLP (TensorFlow/Keras) · Provinsi: ${E(f.province)}</span>
</div></div>
<div class="view-stack" id="fc-results-mount"></div>
</div>`;

      onChange("ai-prov-select", (val) => {
        state.predict.province = val;
        if (val !== "all") { state.forecasts.province = val; syncForecastControlsUI(); loadAndRenderPrakiraan(); }
        loadAndRenderAiDate();
      });
      onChange("ai-target-date", (val) => { if (!val) return; state.predict.date = clampPredictDate(val); syncAiDateControlsUI(); loadAndRenderAiDate(); });
      onClickAll(els.viewRoot, "[data-ai-offset]", (b) => { state.predict.date = addDaysIso(getTodayIso(), Number(b.getAttribute("data-ai-offset"))); syncAiDateControlsUI(); loadAndRenderAiDate(); });
      onClickAll(els.viewRoot, "[data-fc-horizon]", (b) => { state.forecasts.horizon = Number(b.getAttribute("data-fc-horizon")); syncForecastControlsUI(); loadAndRenderPrakiraan(); });
    }
    syncAiDateControlsUI();
    syncForecastControlsUI();
    await Promise.all([loadAndRenderAiDate(), loadAndRenderPrakiraan()]);
  }

  function applyQualityProvinceSelection(prov, rankings) {
    state.quality.selectedProvince = prov;
    const mapMount = byId("quality-map-mount");
    if (mapMount && rankings) updateSulawesiMapSelection(mapMount, rankings, prov);
    qAll(els.viewRoot, "[data-quality-row]").forEach((tr) => tr.classList.toggle("is-highlighted", tr.getAttribute("data-quality-row") === prov));
    qAll(els.viewRoot, "[data-quality-prov]").forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-quality-prov") === prov ? "true" : "false"));
  }

  async function renderKualitas() {
    renderLoading(els.viewRoot, "Memuat ringkasan data resmi dan kondisi pasar...");
    try {
      const [overview, trends, compare] = await Promise.all([
        apiGet(`/api/overview?segment=${encodeURIComponent(state.segment)}`),
        apiGet(`/api/trends?segment=${encodeURIComponent(state.segment)}&provinces=all&agg=monthly&range=all`),
        apiGet(`/api/compare?segment=${encodeURIComponent(state.segment)}`),
      ]);
      const statsByProv = {};
      (trends.summary || []).forEach((s) => { statsByProv[s.province] = s; });
      const sortedProvs = [...(overview.provinces || [])].sort((a, b) => b.price_idr - a.price_idr);
      const alertSummaryHtml = (overview.alerts || []).length
        ? `<ul class="alert-list">${overview.alerts.map((a) => `<li><strong>${E(a.province)}:</strong> ${E(formatPublicAlertText(a))}</li>`).join("")}</ul>`
        : '<p class="card-desc">Kondisi pasar seluruh wilayah terpantau stabil pada periode terbaru tanpa gejolak mendadak.</p>';

      const rowsHtml = sortedProvs.map((p) => {
        const st = mapPublicStatus(null, p.pct_30d);
        const hist = statsByProv[p.province] || {};
        const isSel = state.quality.selectedProvince === p.province;
        return `<tr class="table-row-interactive ${isSel ? "is-highlighted" : ""}" data-quality-row="${E(p.province)}"><td><button type="button" class="table-row-btn" data-quality-prov="${E(p.province)}" aria-pressed="${isSel ? "true" : "false"}"><span class="color-dot" style="--series-color:${PROVINCE_COLOR_VARS[p.province] || "var(--brand-primary)"}" aria-hidden="true"></span><strong>${E(p.province)}</strong></button></td><td class="num-cell"><strong>${E(R(p.price_idr))}</strong></td><td class="num-cell">${E(R(hist.min_idr))} - ${E(R(hist.max_idr))}</td><td class="num-cell">${E(P(p.pct_30d))}</td><td>${badgeHtml(st.badgeVariant, st.label, st.icon)}</td></tr>`;
      }).join("");

      els.viewRoot.innerHTML = `<div class="view-stack" id="quality-page-shell">
<div class="grid-3col">
<div class="card"><span class="field-label">SUMBER DATA RESMI</span><span class="kpi-text-val">PIHPS Bank Indonesia</span><span class="section-note">Harga rata-rata beras tingkat provinsi (${E(overview.segment.label)})</span></div>
<div class="card"><span class="field-label">PERIODE DATA</span><span class="kpi-text-val">1 Jan 2022 s/d 12 Feb 2026</span><span class="section-note">${formatInt(overview.calendar_days)} hari kalender · Seluruh Provinsi</span></div>
<div class="card"><span class="field-label">KELENGKAPAN WILAYAH</span><span class="kpi-text-val">Data Lengkap</span>${badgeHtml("success", "Seluruh Provinsi Tersedia", "check")}</div>
</div>
<div class="grid-compare-split">
${cardBox(`Ringkasan Wilayah Sulawesi (${E(overview.segment.label)})`, "Klik baris provinsi untuk menyorot wilayah pada peta Sulawesi di sebelah kanan.", tableBox('<th>Provinsi</th><th class="num-head">Harga Terakhir</th><th class="num-head">Rentang Historis</th><th class="num-head">30 Hari</th><th>Status Pasar</th>', rowsHtml))}
${cardBox("Peta Wilayah Sulawesi", `Harga Terbaru: ${E(D(overview.latest_date))} · Selisih ${E(R(overview.disparity.gap_idr))}/kg`, '<div id="quality-map-mount"></div>')}
</div>
${cardBox("Catatan Kondisi Pasar", "Ringkasan pergerakan terbaru di seluruh wilayah dan catatan keterbukaan data.", `${alertSummaryHtml}<p class="scope-footnote">Seluruh seri data pada berasak.ai menggunakan arsip resmi PIHPS Bank Indonesia (1 Jan 2022 s/d 12 Feb 2026) untuk enam provinsi Pulau Sulawesi dan 3 saluran pasar.</p>`, '<a class="btn btn-secondary" href="#unduh">Unduh Data CSV</a>')}
</div>`;

      renderSulawesiMap(byId("quality-map-mount"), compare.rankings, state.quality.selectedProvince, (prov) => applyQualityProvinceSelection(prov, compare.rankings));
      bindRowPick(els.viewRoot, "data-quality-prov", "data-quality-row", (prov) => applyQualityProvinceSelection(prov, compare.rankings));
    } catch (err) {
      renderError(els.viewRoot, err.message, renderKualitas);
    }
  }

  window.PBS.app = {
    state,
    els,
    ALL_PROVINCES,
    SEGMENT_LABELS,
    CONTACT_INFO,
    safeStorageSet,
    syncNavAndSegmentUI,
    navigateTo,
  };

  async function renderCurrentRoute() {
    const titleText = syncNavAndSegmentUI();
    closeMobileDrawer(false);
    setDataDropdownOpen(false);
    const pv = window.PBS.publicViews || {};
    if (state.route === "beranda") await renderBeranda();
    else if (state.route === "tren") await renderTren();
    else if (state.route === "bandingkan") await renderBandingkan();
    else if (state.route === "prakiraan") await renderPrakiraan();
    else if (state.route === "kualitas") await renderKualitas();
    else if (state.route === "unduh" && pv.renderUnduh) await pv.renderUnduh();
    else if (state.route === "artikel" && pv.renderArtikel) pv.renderArtikel(state.articleSlug);
    else if (state.route === "panduan" && pv.renderPanduan) pv.renderPanduan();
    else if (state.route === "kontak" && pv.renderKontak) pv.renderKontak();
    else await renderBeranda();
    return titleText;
  }

  async function bootstrap() {
    if (typeof illus.brandMarkSvg === "function") {
      const mark = illus.brandMarkSvg();
      if (els.headerBrandIcon) els.headerBrandIcon.innerHTML = mark;
      if (els.drawerBrandIcon) els.drawerBrandIcon.innerHTML = mark;
    }

    applyTheme(state.theme);
    if (els.themeBtn) els.themeBtn.addEventListener("click", toggleTheme);
    if (els.menuBtn) els.menuBtn.addEventListener("click", openMobileDrawer);
    if (els.drawerCloseBtn) els.drawerCloseBtn.addEventListener("click", () => closeMobileDrawer(true));
    if (els.backdrop) els.backdrop.addEventListener("click", () => closeMobileDrawer(true));

    if (els.dataMenuBtn && els.dataMenu) {
      const getItems = () => qAll(els.dataMenu, '[role="menuitem"]');
      els.dataMenuBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setDataDropdownOpen(els.dataMenuBtn.getAttribute("aria-expanded") !== "true");
      });
      els.dataMenuBtn.addEventListener("keydown", (ev) => {
        const items = getItems();
        if (ev.key === "ArrowDown") { ev.preventDefault(); setDataDropdownOpen(true, items[0]); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); setDataDropdownOpen(true, items[items.length - 1]); }
        else if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          const exp = els.dataMenuBtn.getAttribute("aria-expanded") === "true";
          setDataDropdownOpen(!exp, !exp ? items[0] : null);
        } else if (ev.key === "Escape") setDataDropdownOpen(false);
      });
      els.dataMenu.addEventListener("keydown", (ev) => {
        const items = getItems();
        const curr = items.indexOf(document.activeElement);
        if (ev.key === "ArrowDown") { ev.preventDefault(); items[(curr + 1) % items.length].focus(); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); items[(curr - 1 + items.length) % items.length].focus(); }
        else if (ev.key === "Home") { ev.preventDefault(); items[0].focus(); }
        else if (ev.key === "End") { ev.preventDefault(); items[items.length - 1].focus(); }
        else if (ev.key === "Escape") { ev.preventDefault(); setDataDropdownOpen(false); els.dataMenuBtn.focus(); }
        else if (ev.key === "Tab") setDataDropdownOpen(false);
      });
      if (els.dataDropdown) {
        els.dataDropdown.addEventListener("focusout", (ev) => {
          if (!els.dataDropdown.contains(ev.relatedTarget)) setDataDropdownOpen(false);
        });
      }
    }

    document.addEventListener("click", (ev) => {
      if (els.dataDropdown && !els.dataDropdown.contains(ev.target)) setDataDropdownOpen(false);
      const pop = byId("platform-popover");
      if (pop && !pop.hidden && !pop.contains(ev.target) && !ev.target.closest(".platform-row")) closePlatformPopover(false);
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (closePlatformPopover(true)) { ev.preventDefault(); return; }
      if (els.dataMenuBtn && els.dataMenuBtn.getAttribute("aria-expanded") === "true") {
        const inside = els.dataDropdown && els.dataDropdown.contains(document.activeElement);
        setDataDropdownOpen(false);
        if (inside) els.dataMenuBtn.focus();
        ev.preventDefault();
        return;
      }
      if (els.sidebar && els.sidebar.classList.contains("is-open")) { ev.preventDefault(); closeMobileDrawer(true); }
    });

    if (els.backToTopBtn) {
      els.backToTopBtn.addEventListener("click", () => {
        scrollWindowToTop();
        if (els.mainContent) els.mainContent.focus({ preventScroll: true });
      });
    }

    onClickAll(document, "#segment-toolbar [data-segment]", (b) => {
      setActiveSegment(b.getAttribute("data-segment"));
      renderCurrentRoute();
    });

    window.addEventListener("hashchange", async () => {
      const parsed = parseRouteFromHash();
      state.route = parsed.route;
      state.articleSlug = parsed.articleSlug;
      const titleText = await renderCurrentRoute();
      scrollWindowToTop();
      announceRoute(titleText);
      if (els.mainContent) els.mainContent.focus({ preventScroll: true });
    });

    try {
      state.meta = await apiGet("/api/meta");
      const firstSeg = state.meta.segments[0];
      if (firstSeg && els.periodNote) els.periodNote.textContent = `Data ${D(firstSeg.max_date)}`;
    } catch (_) {
      // View loaders surface server errors explicitly
    }

    const initial = parseRouteFromHash();
    state.route = initial.route;
    state.articleSlug = initial.articleSlug;
    await renderCurrentRoute();
  }

  bootstrap();
})();
