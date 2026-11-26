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
    renderEmpty,
    renderStepSparkline,
    renderTrendsChart,
    renderForecastChart,
    renderSulawesiMap,
    updateSulawesiMapSelection,
    PROVINCE_COLOR_VARS,
    PROVINCE_SHORT,
    ARTICLES = [],
  } = window.PBS;

  const ALL_PROVINCES = [
    "Gorontalo",
    "Sulawesi Barat",
    "Sulawesi Selatan",
    "Sulawesi Tengah",
    "Sulawesi Tenggara",
    "Sulawesi Utara",
  ];

  const MAIN4_PROVINCES = ["Sulawesi Tengah", "Gorontalo", "Sulawesi Selatan", "Sulawesi Barat"];

  const DATA_ROUTES = new Set(["beranda", "tren", "bandingkan", "prakiraan", "kualitas", "unduh"]);

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

  const PAGE_META = {
    beranda: {
      title: "Pantauan Harga Beras Sulawesi",
      subtitle: "Cek harga beras terkini per kilogram, estimasi belanja, dan perbandingan 6 provinsi Sulawesi.",
    },
    tren: {
      title: "Tren Pergerakan Harga Beras",
      subtitle: "Pantau naik-turunnya harga lintas provinsi secara harian, mingguan, atau bulanan.",
    },
    bandingkan: {
      title: "Perbandingan Wilayah & Selisih Pasokan",
      subtitle: "Bandingkan peringkat harga antarprovinsi dan selisih dari produsen ke pasar eceran.",
    },
    prakiraan: {
      title: "Prediksi Harga 4 sampai 8 Minggu",
      subtitle: "Perkiraan statistik mingguan dengan rentang wajar 90% dan evaluasi tiga metode.",
    },
    kualitas: {
      title: "Kualitas Data & Catatan Anomali",
      subtitle: "Catatan transparan tanggal tanpa laporan dan lonjakan harian di atas 10%.",
    },
    unduh: {
      title: "Unduh Dataset Terverifikasi",
      subtitle: "Pilih provinsi, rentang tanggal, dan format tabel CSV sesuai kebutuhan.",
    },
    artikel: {
      title: "Artikel & Edukasi Harga Beras",
      subtitle: "Bacaan singkat berbahasa sederhana seputar pasar beras, distribusi wilayah, dan tips belanja.",
    },
    panduan: {
      title: "Panduan Pengguna & Kamus Istilah",
      subtitle: "Langkah membaca grafik, arti istilah data, dan jawaban pertanyaan umum.",
    },
    kontak: {
      title: "Kontak & Layanan Pengguna",
      subtitle: "Hubungi tim berasak.ai melalui email atau telepon resmi untuk bantuan data dan masukan.",
    },
  };

  const THEME_ICONS = {
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"></circle><path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>',
  };

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage failures in restricted browser modes
    }
  }

  function sanitizeAlertMessage(msg) {
    return String(msg || "")
      .replace(/\bLonjakan harian R5\b/g, "Lonjakan harian >10%")
      .replace(/\baturan R5\b/g, "batas >10%")
      .replace(/\bR5\b/g, ">10%");
  }

  const savedTheme = safeStorageGet("berasak_theme") || safeStorageGet("pbs_theme");
  const savedSegment = safeStorageGet("berasak_segment");
  const savedQuickProv = safeStorageGet("berasak_quick_prov");
  const savedQuickKg = Number(safeStorageGet("berasak_quick_kg"));
  const initialSegment = CHANNEL_HINTS[savedSegment] ? savedSegment : "modern";

  const state = {
    route: "beranda",
    articleSlug: null,
    segment: initialSegment,
    theme: savedTheme === "dark" ? "dark" : "light",
    meta: null,
    overviewCache: null,
    trendsCache: null,
    compareData: null,
    quickProvince: ALL_PROVINCES.includes(savedQuickProv) ? savedQuickProv : "Sulawesi Selatan",
    quickKg: [1, 5, 10, 25, 50].includes(savedQuickKg) ? savedQuickKg : 5,
    articlesFilter: {
      category: "Semua",
      query: "",
    },
    trends: {
      provinces: [...MAIN4_PROVINCES],
      agg: "monthly",
      range: "1y",
      showMa4: true,
      showAnomalies: true,
    },
    compare: {
      date: "2026-02-12",
      selectedProvince: "Sulawesi Tengah",
    },
    forecasts: {
      province: "Sulawesi Tengah",
      horizon: 4,
      model: "arima_110",
    },
    quality: {
      province: "all",
    },
    exportCfg: {
      segment: initialSegment,
      provinces: [...ALL_PROVINCES],
      from: "2022-01-01",
      to: "2026-02-12",
      shape: "long",
      includeFlags: true,
    },
  };

  const els = {
    siteHeader: document.querySelector(".site-header"),
    sidebar: document.getElementById("app-sidebar"),
    backdrop: document.getElementById("drawer-backdrop"),
    menuBtn: document.getElementById("mobile-menu-btn"),
    drawerCloseBtn: document.getElementById("drawer-close-btn"),
    themeBtn: document.getElementById("theme-toggle-btn"),
    themeIcon: document.getElementById("theme-toggle-icon"),
    themeLabel: document.getElementById("theme-toggle-label"),
    dataDropdown: document.getElementById("nav-data-dropdown"),
    dataMenuBtn: document.getElementById("data-menu-btn"),
    dataMenu: document.getElementById("data-dropdown-menu"),
    pageBreadcrumb: document.getElementById("page-breadcrumb"),
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    segToolbar: document.getElementById("segment-toolbar"),
    segChannelHint: document.getElementById("segment-channel-hint"),
    periodNote: document.getElementById("dataset-period-note"),
    backToTopBtn: document.getElementById("back-to-top-btn"),
    routeAnnouncer: document.getElementById("route-announcer"),
    mainContent: document.getElementById("main-content"),
    siteFooter: document.querySelector(".site-footer"),
    mobileBottomNav: document.querySelector(".mobile-bottom-nav"),
    viewRoot: document.getElementById("view-root"),
  };

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollWindowToTop() {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function applyTheme(theme) {
    state.theme = theme;
    safeStorageSet("berasak_theme", theme);
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    const isDark = theme === "dark";
    if (els.themeLabel) els.themeLabel.textContent = isDark ? "Mode Terang" : "Mode Gelap";
    if (els.themeIcon) els.themeIcon.innerHTML = isDark ? THEME_ICONS.sun : THEME_ICONS.moon;
    if (els.themeBtn) els.themeBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  }

  function setDataDropdownOpen(open, focusTarget = null) {
    if (!els.dataMenuBtn || !els.dataMenu) return;
    els.dataMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    els.dataMenu.hidden = !open;
    if (open && focusTarget) {
      focusTarget.focus();
    }
  }

  function setBackgroundLandmarksLocked(locked) {
    const targets = [els.siteHeader, els.mainContent, els.siteFooter, els.mobileBottomNav];
    targets.forEach((node) => {
      if (!node) return;
      if ("inert" in node) {
        node.inert = locked;
      }
      if (locked) {
        node.setAttribute("aria-hidden", "true");
      } else {
        node.removeAttribute("aria-hidden");
      }
    });
  }

  function handleDrawerKeydown(ev) {
    if (!els.sidebar || !els.sidebar.classList.contains("is-open")) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeMobileDrawer(true);
      return;
    }
    if (ev.key !== "Tab") return;
    const focusables = [...els.sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function openMobileDrawer() {
    if (!els.sidebar || !els.backdrop || !els.menuBtn) return;
    els.sidebar.classList.add("is-open");
    els.backdrop.hidden = false;
    els.menuBtn.setAttribute("aria-expanded", "true");
    setBackgroundLandmarksLocked(true);
    document.addEventListener("keydown", handleDrawerKeydown);
    if (els.drawerCloseBtn) els.drawerCloseBtn.focus();
  }

  function closeMobileDrawer(restoreFocus = true) {
    if (!els.sidebar) return;
    const wasOpen = els.sidebar.classList.contains("is-open");
    if (!wasOpen) return;
    els.sidebar.classList.remove("is-open");
    if (els.backdrop) els.backdrop.hidden = true;
    setBackgroundLandmarksLocked(false);
    document.removeEventListener("keydown", handleDrawerKeydown);
    if (els.menuBtn) {
      els.menuBtn.setAttribute("aria-expanded", "false");
      if (restoreFocus) els.menuBtn.focus();
    }
  }

  function announceRoute(titleText) {
    if (!els.routeAnnouncer || !titleText) return;
    els.routeAnnouncer.textContent = "";
    window.requestAnimationFrame(() => {
      if (els.routeAnnouncer) {
        els.routeAnnouncer.textContent = `Menampilkan ${titleText}`;
      }
    });
  }

  function parseRouteFromHash() {
    const raw = (window.location.hash || "#beranda").replace(/^#\/?/, "").trim();
    if (!raw) return { route: "beranda", articleSlug: null };
    if (raw.startsWith("artikel/")) {
      const slug = raw.slice("artikel/".length).trim();
      return { route: "artikel", articleSlug: slug || null };
    }
    return PAGE_META[raw] ? { route: raw, articleSlug: null } : { route: "beranda", articleSlug: null };
  }

  function syncNavAndSegmentUI() {
    const activeRoute = state.route;

    document.querySelectorAll(".top-nav-link[data-route], .nav-dropdown-item[data-route], .nav-item[data-route], .bottom-tab[data-route]").forEach((link) => {
      const active = link.getAttribute("data-route") === activeRoute;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (els.dataMenuBtn) {
      const groupRoutes = (els.dataMenuBtn.getAttribute("data-route-group") || "").split(",");
      els.dataMenuBtn.classList.toggle("is-active", groupRoutes.includes(activeRoute));
    }

    document.querySelectorAll('#segment-toolbar [data-segment]').forEach((btn) => {
      const active = btn.getAttribute("data-segment") === state.segment;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (els.segChannelHint) {
      els.segChannelHint.textContent = CHANNEL_HINTS[state.segment] || CHANNEL_HINTS.modern;
    }

    let meta = PAGE_META[activeRoute] || PAGE_META.beranda;
    let breadcrumbHtml = "";
    if (activeRoute === "artikel" && state.articleSlug) {
      const found = ARTICLES.find((a) => a.slug === state.articleSlug);
      if (found) {
        meta = {
          title: found.title,
          subtitle: `${found.category} · ${found.readMinutes} menit baca · Diperbarui ${found.updatedLabel}`,
        };
        breadcrumbHtml = `<a href="#artikel">Artikel</a><span aria-hidden="true">/</span><span>${escapeHtml(found.category)}</span>`;
      }
    }

    if (els.pageBreadcrumb) {
      if (breadcrumbHtml) {
        els.pageBreadcrumb.innerHTML = breadcrumbHtml;
        els.pageBreadcrumb.hidden = false;
      } else {
        els.pageBreadcrumb.innerHTML = "";
        els.pageBreadcrumb.hidden = true;
      }
    }

    els.pageTitle.textContent = meta.title;
    els.pageSubtitle.textContent = meta.subtitle;
    els.segToolbar.hidden = !DATA_ROUTES.has(activeRoute);
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

  function provinceStatusHtml(prov, compact = false) {
    if (prov.pct_30d > 1.0) {
      return badgeHtml("alert", `Naik ${formatPct(prov.pct_30d)}`, "up");
    }
    if (prov.pct_30d < -0.5) {
      return badgeHtml("success", `Turun ${formatPct(prov.pct_30d)}`, "down");
    }
    return `<span class="status-quiet">${compact ? "Stabil" : "Stabil 30 hari"}</span>`;
  }

  function provinceTrendSummary(prov) {
    if (prov.pct_30d > 1.0) {
      return `30 hari terakhir naik ${formatPct(prov.pct_30d)} di ${prov.province}.`;
    }
    if (prov.pct_30d < -0.5) {
      return `30 hari terakhir turun ${formatPct(prov.pct_30d)} di ${prov.province}.`;
    }
    return `30 hari terakhir relatif stabil (${formatPct(prov.pct_30d)}) di ${prov.province}.`;
  }

  function renderQuickResultHtml(data) {
    const selected = data.provinces.find((p) => p.province === state.quickProvince) || data.provinces[0];
    const kg = state.quickKg || 5;
    const totalEstimate = selected.price_idr * kg;

    return `
      <div class="quick-result-top">
        <div>
          <div class="field-label">Harga ${escapeHtml(selected.province)} (${escapeHtml(data.segment.label)})</div>
          <div class="kpi-lg">${escapeHtml(formatRp(selected.price_idr))} <span class="section-note">/ kg</span></div>
        </div>
        ${provinceStatusHtml(selected)}
      </div>

      <div class="quick-result-top">
        <div>
          <div class="field-label">Estimasi Belanja ${kg} kg</div>
          <div class="kpi-md text-brand">${escapeHtml(formatRp(totalEstimate))}</div>
        </div>
        <span class="section-note font-mono">Data ${escapeHtml(formatDateId(data.latest_date))}</span>
      </div>

      <p class="quick-summary-line">${escapeHtml(provinceTrendSummary(selected))}</p>

      <div class="quick-checker-actions">
        <button type="button" class="btn btn-primary" data-quick-trend="${escapeHtml(selected.province)}">Lihat Grafik Tren</button>
        <button type="button" class="btn btn-secondary" data-quick-forecast="${escapeHtml(selected.province)}">Lihat Prediksi</button>
      </div>
    `;
  }

  function syncBerandaSelection(data) {
    const provSelect = document.getElementById("quick-prov-select");
    if (provSelect && provSelect.value !== state.quickProvince) {
      provSelect.value = state.quickProvince;
    }

    document.querySelectorAll("[data-quick-kg]").forEach((btn) => {
      const isAct = Number(btn.getAttribute("data-quick-kg")) === state.quickKg;
      btn.classList.toggle("is-active", isAct);
      btn.setAttribute("aria-pressed", isAct ? "true" : "false");
    });

    const resultMount = document.getElementById("hero-quick-result-mount");
    if (resultMount) {
      resultMount.innerHTML = renderQuickResultHtml(data);
      const trendBtn = resultMount.querySelector("[data-quick-trend]");
      if (trendBtn) {
        trendBtn.addEventListener("click", () => {
          state.trends.provinces = [trendBtn.getAttribute("data-quick-trend")];
          navigateTo("tren");
        });
      }
      const fcBtn = resultMount.querySelector("[data-quick-forecast]");
      if (fcBtn) {
        fcBtn.addEventListener("click", () => {
          state.forecasts.province = fcBtn.getAttribute("data-quick-forecast");
          navigateTo("prakiraan");
        });
      }
    }

    document.querySelectorAll(".spectrum-dot[data-hero-prov]").forEach((dot) => {
      const isSel = dot.getAttribute("data-hero-prov") === state.quickProvince;
      dot.classList.toggle("is-active", isSel);
      dot.setAttribute("aria-pressed", isSel ? "true" : "false");
    });

    document.querySelectorAll(".ledger-row[data-inspect-trend]").forEach((row) => {
      const isSel = row.getAttribute("data-inspect-trend") === state.quickProvince;
      row.classList.toggle("is-active-prov", isSel);
    });
  }

  async function renderBeranda() {
    renderLoading(els.viewRoot, "Memuat ringkasan harga beras 6 provinsi...");
    try {
      const data = await apiGet(`/api/overview?segment=${encodeURIComponent(state.segment)}`);
      state.overviewCache = data;
      const d = data.disparity;
      if (els.periodNote && data.latest_date) {
        els.periodNote.textContent = `Data ${formatDateId(data.latest_date)}`;
      }

      const sortedProvinces = [...data.provinces].sort((a, b) => b.price_idr - a.price_idr);
      const minP = d.cheapest.price_idr;
      const maxP = d.most_expensive.price_idr;
      const spanP = Math.max(100, maxP - minP);

      const spectrumDotsHtml = data.provinces.map((p) => {
        const pct = ((p.price_idr - minP) / spanP) * 100;
        const clamped = Math.max(2, Math.min(98, pct)).toFixed(1);
        const col = PROVINCE_COLOR_VARS[p.province] || "var(--brand-primary)";
        const shortName = PROVINCE_SHORT[p.province] || p.province;
        const isSel = p.province === state.quickProvince;
        return `
          <button
            type="button"
            class="spectrum-dot ${isSel ? "is-active" : ""}"
            data-hero-prov="${escapeHtml(p.province)}"
            aria-pressed="${isSel ? "true" : "false"}"
            aria-label="${escapeHtml(p.province)}: ${escapeHtml(formatRp(p.price_idr))} per kg"
            title="${escapeHtml(shortName)}: ${escapeHtml(formatRp(p.price_idr))}"
            style="--dot-left: ${clamped}%; --series-color: ${col};"
          ></button>
        `;
      }).join("");

      const alertHtml = data.alerts.length
        ? `
          <div class="overview-alert-summary">
            <div class="overview-hero-head">
              <span class="field-label">Peringatan Kenaikan</span>
              ${badgeHtml("alert", `${data.alerts.length} Peringatan`, "alert")}
            </div>
            <ul class="alert-list">
              ${data.alerts.map((a) => `<li><strong>${escapeHtml(a.province)}:</strong> ${escapeHtml(sanitizeAlertMessage(a.message))}</li>`).join("")}
            </ul>
            <div>
              <button type="button" class="btn btn-secondary btn-table-link" data-go="kualitas">Periksa Kualitas Data</button>
            </div>
          </div>
        `
        : `
          <div class="overview-alert-summary">
            <div class="overview-hero-head">
              <span class="field-label">Pantauan 30 Hari Terakhir</span>
              <span class="status-quiet">Tanpa lonjakan &gt;10%</span>
            </div>
            <p class="card-desc">
              Tidak ada kenaikan harian di atas 10% pada 30 hari terakhir. Tersimpan ${formatInt(data.historical_anomalies_count)} catatan historis.
            </p>
            <div>
              <button type="button" class="btn btn-ghost btn-table-link" data-go="kualitas">Tinjau Kualitas Data</button>
            </div>
          </div>
        `;

      const ledgerRowsHtml = sortedProvinces.map((p, idx) => {
        const colVar = PROVINCE_COLOR_VARS[p.province] || "var(--brand-primary)";
        const isSel = p.province === state.quickProvince;
        return `
          <button
            type="button"
            class="ledger-row ${isSel ? "is-active-prov" : ""}"
            data-inspect-trend="${escapeHtml(p.province)}"
            aria-label="Lihat tren ${escapeHtml(p.province)}, harga ${escapeHtml(formatRp(p.price_idr))} per kg"
          >
            <span class="ledger-cell-prov">
              <span class="ledger-rank">${idx + 1}</span>
              <span class="ledger-swatch" style="--series-color: ${colVar};" aria-hidden="true"></span>
              <span class="ledger-prov-text">
                <span class="ledger-prov-name">${escapeHtml(p.province)}</span>
                ${provinceStatusHtml(p, true)}
              </span>
            </span>
            <span class="ledger-cell-price">${escapeHtml(formatRp(p.price_idr))}</span>
            <span class="ledger-cell-deltas">
              <span>30 hari ${escapeHtml(formatPct(p.pct_30d))}</span>
              <span>Bulanan ${escapeHtml(formatPct(p.mom_pct))}</span>
            </span>
            <span class="ledger-cell-spark">
              ${renderStepSparkline(p.spark_90d, colVar)}
              <svg class="ledger-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"></path>
              </svg>
            </span>
            <span class="ledger-cell-freq">${formatInt(p.change_days)}/${formatInt(p.total_days)} hari</span>
          </button>
        `;
      }).join("");

      const previewArticles = ARTICLES.slice(0, 3);
      const articlesHtml = previewArticles.map((art) => `
        <article class="article-preview-item">
          <div class="article-card-body">
            <div class="article-meta">
              <span class="article-category">${escapeHtml(art.category)}</span>
              <span>${art.readMinutes} menit baca</span>
            </div>
            <h3 class="article-title">${escapeHtml(art.title)}</h3>
            <p class="article-excerpt">${escapeHtml(art.excerpt)}</p>
          </div>
          <a class="article-preview-link" href="#artikel/${escapeHtml(art.slug)}">Baca selengkapnya &rarr;</a>
        </article>
      `).join("");

      els.viewRoot.innerHTML = `
        <section class="overview-hero" aria-label="Cek harga provinsi dan perbandingan Sulawesi">
          <div class="overview-hero-main">
            <div class="overview-hero-head">
              <h2 class="overview-hero-aside-title">Cek Cepat Harga &amp; Estimasi Belanja</h2>
            </div>

            <div class="controls-grid">
              <div class="field-group">
                <label class="field-label" for="quick-prov-select">Provinsi Anda</label>
                <select id="quick-prov-select" class="select-control">
                  ${ALL_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${p === state.quickProvince ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
                </select>
              </div>

              <div class="field-group">
                <span class="field-label">Jumlah Belanja</span>
                <div class="weight-group" role="group" aria-label="Pilih jumlah kilogram beras">
                  ${[1, 5, 10, 25, 50].map((w) => `
                    <button type="button" class="weight-btn ${state.quickKg === w ? "is-active" : ""}" aria-pressed="${state.quickKg === w ? "true" : "false"}" data-quick-kg="${w}">${w} kg</button>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="quick-result-compact" id="hero-quick-result-mount"></div>
          </div>

          <div class="overview-hero-aside">
            <div class="disparity-headline-row">
              <div>
                <div class="field-label">SELISIH ANTARPROVINSI</div>
                <div class="kpi-xl">${escapeHtml(formatRp(d.gap_idr))} <span class="section-note">/ kg</span></div>
              </div>
              <span class="status-quiet">${String(d.gap_pct).replace(".", ",")}% selisih</span>
            </div>

            <div class="overview-disparity-block">
              <div class="spectrum-wrap">
                <div class="spectrum-rail" role="group" aria-label="Pilih provinsi pada garis rentang harga">
                  <div class="spectrum-track" aria-hidden="true"></div>
                  ${spectrumDotsHtml}
                </div>
                <div class="spectrum-endpoints">
                  <div class="spectrum-end">
                    <span class="spectrum-end-label">TERMURAH · ${escapeHtml(d.cheapest.province.toUpperCase())}</span>
                    <span class="spectrum-end-price is-cheapest">${escapeHtml(formatRp(d.cheapest.price_idr))}</span>
                  </div>
                  <div class="spectrum-end is-right">
                    <span class="spectrum-end-label">TERMAHAL · ${escapeHtml(d.most_expensive.province.toUpperCase())}</span>
                    <span class="spectrum-end-price is-expensive">${escapeHtml(formatRp(d.most_expensive.price_idr))}</span>
                  </div>
                </div>
              </div>
              <span class="section-note">Klik titik provinsi pada garis rentang untuk mengecek estimasi harganya.</span>
            </div>

            ${alertHtml}
          </div>
        </section>

        <section class="editorial-section" aria-label="Papan peringkat harga provinsi">
          <div class="section-bar">
            <h2 class="section-heading">Peringkat Harga 6 Provinsi (${escapeHtml(data.segment.label)})</h2>
            <span class="section-note">Klik baris provinsi untuk membuka grafik tren lengkap</span>
          </div>

          <div class="ledger-shell">
            <div class="ledger-head" aria-hidden="true">
              <span>Provinsi &amp; Arah 30 Hari</span>
              <span class="ledger-head-num">Harga / kg</span>
              <span>Perubahan</span>
              <span>Tren 90 Hari</span>
              <span class="ledger-head-num">Hari Berubah</span>
            </div>
            <div>${ledgerRowsHtml}</div>
          </div>
        </section>

        <section class="editorial-section" aria-label="Artikel edukasi pilihan">
          <div class="section-bar">
            <h2 class="section-heading">Artikel Pilihan</h2>
            <a class="btn btn-ghost" href="#artikel">Lihat Semua Artikel</a>
          </div>
          <div class="article-preview-list">${articlesHtml}</div>
        </section>
      `;

      syncBerandaSelection(data);

      const quickSelect = document.getElementById("quick-prov-select");
      if (quickSelect) {
        quickSelect.addEventListener("change", (ev) => {
          state.quickProvince = ev.target.value;
          safeStorageSet("berasak_quick_prov", state.quickProvince);
          syncBerandaSelection(data);
        });
      }

      els.viewRoot.querySelectorAll("[data-quick-kg]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.quickKg = Number(btn.getAttribute("data-quick-kg"));
          safeStorageSet("berasak_quick_kg", String(state.quickKg));
          syncBerandaSelection(data);
        });
      });

      els.viewRoot.querySelectorAll(".spectrum-dot[data-hero-prov]").forEach((dot) => {
        dot.addEventListener("click", () => {
          state.quickProvince = dot.getAttribute("data-hero-prov");
          safeStorageSet("berasak_quick_prov", state.quickProvince);
          syncBerandaSelection(data);
        });
      });

      els.viewRoot.querySelectorAll("[data-go]").forEach((btn) => {
        btn.addEventListener("click", () => navigateTo(btn.getAttribute("data-go")));
      });

      els.viewRoot.querySelectorAll("[data-inspect-trend]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.trends.provinces = [btn.getAttribute("data-inspect-trend")];
          navigateTo("tren");
        });
      });
    } catch (err) {
      renderError(els.viewRoot, err.message, renderBeranda);
    }
  }

  function syncTrenControlsUI() {
    const t = state.trends;
    const isAll = t.provinces.length === ALL_PROVINCES.length;
    const isMain4 = t.provinces.length === MAIN4_PROVINCES.length && MAIN4_PROVINCES.every((p) => t.provinces.includes(p));

    const presetAllBtn = document.querySelector('[data-trend-preset="all"]');
    const presetMain4Btn = document.querySelector('[data-trend-preset="main4"]');
    if (presetAllBtn) {
      presetAllBtn.classList.toggle("is-active", isAll);
      presetAllBtn.setAttribute("aria-pressed", isAll ? "true" : "false");
    }
    if (presetMain4Btn) {
      presetMain4Btn.classList.toggle("is-active", isMain4);
      presetMain4Btn.setAttribute("aria-pressed", isMain4 ? "true" : "false");
    }

    els.viewRoot.querySelectorAll("[data-trend-prov]").forEach((btn) => {
      const act = t.provinces.includes(btn.getAttribute("data-trend-prov"));
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-pressed", act ? "true" : "false");
    });

    els.viewRoot.querySelectorAll("[data-trend-range]").forEach((btn) => {
      const act = t.range === btn.getAttribute("data-trend-range");
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-pressed", act ? "true" : "false");
    });

    els.viewRoot.querySelectorAll("[data-trend-agg]").forEach((btn) => {
      const act = t.agg === btn.getAttribute("data-trend-agg");
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-pressed", act ? "true" : "false");
    });

    const ma4El = document.getElementById("toggle-ma4");
    const anomEl = document.getElementById("toggle-anom");
    if (ma4El) ma4El.checked = t.showMa4;
    if (anomEl) anomEl.checked = t.showAnomalies;
  }

  function renderTrenResultsContent(resultsMount, data) {
    const t = state.trends;
    const sortedSummary = [...data.summary].sort((a, b) => b.latest_idr - a.latest_idr);
    const topProv = sortedSummary[0];
    const botProv = sortedSummary[sortedSummary.length - 1];
    const chartHeadline = sortedSummary.length > 1
      ? `${PROVINCE_SHORT[topProv.province] || topProv.province} tertinggi (${formatRp(topProv.latest_idr)}), terpaut ${formatRp(topProv.latest_idr - botProv.latest_idr)} dari ${PROVINCE_SHORT[botProv.province] || botProv.province}`
      : `${topProv.province}: ${formatRp(topProv.latest_idr)} / kg`;

    const summaryRowsHtml = sortedSummary.map((s) => {
      const col = PROVINCE_COLOR_VARS[s.province] || "var(--brand-primary)";
      return `
        <tr>
          <td>
            <span class="series-label" style="--series-color: ${col};"><strong>${escapeHtml(s.province)}</strong></span>
          </td>
          <td class="num-cell"><strong>${escapeHtml(formatRp(s.latest_idr))}</strong></td>
          <td class="num-cell">${escapeHtml(formatRp(s.min_idr))}</td>
          <td class="num-cell">${escapeHtml(formatRp(s.max_idr))}</td>
          <td class="num-cell">${formatInt(s.change_days)}/${formatInt(s.total_days)} hari</td>
        </tr>
      `;
    }).join("");

    resultsMount.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">${escapeHtml(chartHeadline)}</h2>
            <p class="card-desc">${escapeHtml(data.segment.label)} · ${escapeHtml(formatDateId(data.start_date))} s/d ${escapeHtml(formatDateId(data.end_date))}</p>
          </div>
        </div>
        <div id="trend-chart-mount"></div>
        <div class="chart-legend-strip">
          <span>Garis penuh: harga tercatat</span>
          <span>Garis putus-putus: rata-rata bergerak</span>
          <span>Ketupat merah: lonjakan harian &gt;10%</span>
          <span>Lingkaran biru: hari tanpa laporan (diisi otomatis)</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Ringkasan Rentang Terpilih</h2>
            <p class="card-desc">Perbandingan angka terkini, minimum, maksimum, dan frekuensi perubahan per provinsi.</p>
          </div>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Provinsi</th>
                <th class="num-head">Terkini</th>
                <th class="num-head">Terendah</th>
                <th class="num-head">Tertinggi</th>
                <th class="num-head">Hari Berubah</th>
              </tr>
            </thead>
            <tbody>${summaryRowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    renderTrendsChart(document.getElementById("trend-chart-mount"), data, {
      showMa4: t.showMa4,
      showAnomalies: t.showAnomalies,
      onReset: () => {
        state.trends.provinces = [...MAIN4_PROVINCES];
        state.trends.range = "1y";
        state.trends.agg = "monthly";
        syncTrenControlsUI();
        loadAndRenderTrends(false);
      },
    });
  }

  async function loadAndRenderTrends(chartOnly = false) {
    const resultsMount = document.getElementById("tren-results-mount");
    if (!resultsMount) return;
    const t = state.trends;
    const cacheKey = `${state.segment}|${t.provinces.join(",")}|${t.agg}|${t.range}`;

    if (chartOnly && state.trendsCache && state.trendsCache.key === cacheKey) {
      const chartMount = document.getElementById("trend-chart-mount");
      if (chartMount) {
        renderTrendsChart(chartMount, state.trendsCache.data, {
          showMa4: t.showMa4,
          showAnomalies: t.showAnomalies,
          onReset: () => {
            state.trends.provinces = [...MAIN4_PROVINCES];
            state.trends.range = "1y";
            state.trends.agg = "monthly";
            syncTrenControlsUI();
            loadAndRenderTrends(false);
          },
        });
        return;
      }
    }

    const hadResults = resultsMount.children.length > 0 && !resultsMount.querySelector(".feedback-card");
    if (hadResults) {
      resultsMount.classList.add("panel-loading");
    } else {
      renderLoading(resultsMount, "Memuat grafik tren dan rata-rata bergerak...");
    }

    try {
      const data = await apiGet(
        `/api/trends?segment=${encodeURIComponent(state.segment)}&provinces=${encodeURIComponent(t.provinces.join(","))}&agg=${encodeURIComponent(t.agg)}&range=${encodeURIComponent(t.range)}`
      );
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
    if (!document.getElementById("tren-page-shell")) {
      const chipsHtml = ALL_PROVINCES.map((p) => {
        const col = PROVINCE_COLOR_VARS[p] || "var(--brand-primary)";
        return `
          <button type="button" class="chip-btn" aria-pressed="false" data-trend-prov="${escapeHtml(p)}">
            <span class="color-dot" style="--series-color: ${col};" aria-hidden="true"></span>
            <span>${escapeHtml(p)}</span>
          </button>
        `;
      }).join("");

      els.viewRoot.innerHTML = `
        <div class="view-stack" id="tren-page-shell">
          <div class="filter-strip">
            <div class="field-group">
              <div class="overview-hero-head">
                <span class="field-label">Pilih Provinsi (1 sampai 6)</span>
                <div class="preset-chips" role="group" aria-label="Preset pilihan provinsi">
                  <button type="button" class="preset-chip" data-trend-preset="all" aria-pressed="false">Semua (6)</button>
                  <button type="button" class="preset-chip" data-trend-preset="main4" aria-pressed="false">4 Utama</button>
                </div>
              </div>
              <div class="chip-list">${chipsHtml}</div>
            </div>

            <div class="controls-grid">
              <div class="field-group">
                <span class="field-label">Rentang Waktu</span>
                <div class="segment-group" role="group" aria-label="Rentang waktu grafik">
                  ${[["3m", "3 Bulan"], ["1y", "1 Tahun"], ["all", "2022-2026"]].map(([id, lbl]) => `
                    <button type="button" class="seg-btn" aria-pressed="false" data-trend-range="${id}">${lbl}</button>
                  `).join("")}
                </div>
              </div>

              <div class="field-group">
                <span class="field-label">Tampilan Data</span>
                <div class="segment-group" role="group" aria-label="Mode tampilan data">
                  ${[["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"]].map(([id, lbl]) => `
                    <button type="button" class="seg-btn" aria-pressed="false" data-trend-agg="${id}">${lbl}</button>
                  `).join("")}
                </div>
              </div>

              <div class="field-group">
                <span class="field-label">Garis Bantu</span>
                <div class="chip-list">
                  <label class="check-label" for="toggle-ma4">
                    <input type="checkbox" id="toggle-ma4" ${t.showMa4 ? "checked" : ""}>
                    <span>Rata-rata 4 Minggu</span>
                  </label>
                  <label class="check-label" for="toggle-anom">
                    <input type="checkbox" id="toggle-anom" ${t.showAnomalies ? "checked" : ""}>
                    <span>Tandai Lonjakan &amp; Data Diisi</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="view-stack" id="tren-results-mount"></div>
        </div>
      `;

      els.viewRoot.querySelectorAll("[data-trend-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.getAttribute("data-trend-preset");
          state.trends.provinces = mode === "all" ? [...ALL_PROVINCES] : [...MAIN4_PROVINCES];
          syncTrenControlsUI();
          loadAndRenderTrends(false);
        });
      });

      els.viewRoot.querySelectorAll("[data-trend-prov]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const prov = btn.getAttribute("data-trend-prov");
          const exists = state.trends.provinces.includes(prov);
          if (exists && state.trends.provinces.length > 1) {
            state.trends.provinces = state.trends.provinces.filter((p) => p !== prov);
          } else if (!exists) {
            state.trends.provinces = ALL_PROVINCES.filter((p) => state.trends.provinces.includes(p) || p === prov);
          } else {
            return;
          }
          syncTrenControlsUI();
          loadAndRenderTrends(false);
        });
      });

      els.viewRoot.querySelectorAll("[data-trend-range]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.trends.range = btn.getAttribute("data-trend-range");
          syncTrenControlsUI();
          loadAndRenderTrends(false);
        });
      });

      els.viewRoot.querySelectorAll("[data-trend-agg]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.trends.agg = btn.getAttribute("data-trend-agg");
          syncTrenControlsUI();
          loadAndRenderTrends(false);
        });
      });

      document.getElementById("toggle-ma4").addEventListener("change", (ev) => {
        state.trends.showMa4 = ev.target.checked;
        loadAndRenderTrends(true);
      });
      document.getElementById("toggle-anom").addEventListener("change", (ev) => {
        state.trends.showAnomalies = ev.target.checked;
        loadAndRenderTrends(true);
      });
    }

    syncTrenControlsUI();
    await loadAndRenderTrends(false);
  }

  function applyCompareProvinceSelection(prov) {
    state.compare.selectedProvince = prov;
    const resultsMount = document.getElementById("compare-results-mount");
    if (!resultsMount || !state.compareData) return;

    resultsMount.querySelectorAll("[data-bar-prov]").forEach((btn) => {
      const isSel = btn.getAttribute("data-bar-prov") === prov;
      btn.classList.toggle("is-selected", isSel);
      btn.setAttribute("aria-pressed", isSel ? "true" : "false");
    });

    const mapMount = document.getElementById("sulawesi-map-mount");
    if (mapMount) {
      updateSulawesiMapSelection(mapMount, state.compareData.rankings, prov);
    }

    resultsMount.querySelectorAll("[data-compare-row]").forEach((tr) => {
      const isSel = tr.getAttribute("data-compare-row") === prov;
      tr.classList.toggle("is-highlighted", isSel);
    });

    resultsMount.querySelectorAll("[data-compare-prov]").forEach((btn) => {
      const isSel = btn.getAttribute("data-compare-prov") === prov;
      btn.setAttribute("aria-pressed", isSel ? "true" : "false");
    });
  }

  async function loadAndRenderCompare() {
    const resultsMount = document.getElementById("compare-results-mount");
    if (!resultsMount) return;
    const cmp = state.compare;
    const hadResults = resultsMount.children.length > 0 && !resultsMount.querySelector(".feedback-card");
    if (hadResults) {
      resultsMount.classList.add("panel-loading");
    } else {
      renderLoading(resultsMount, "Memuat peta, peringkat wilayah, dan selisih pasokan...");
    }

    try {
      const data = await apiGet(
        `/api/compare?segment=${encodeURIComponent(state.segment)}&date=${encodeURIComponent(cmp.date)}`
      );
      state.compareData = data;
      resultsMount.classList.remove("panel-loading");

      const dateLabel = document.getElementById("compare-date-label");
      const dateInput = document.getElementById("compare-date-input");
      const statusMount = document.getElementById("compare-date-status");
      const disparityReadout = document.getElementById("compare-disparity-readout");
      if (dateLabel) dateLabel.textContent = `Tanggal Pantauan (${formatDateId(data.date)})`;
      if (dateInput) {
        dateInput.value = data.date;
        dateInput.min = data.min_date;
        dateInput.max = data.max_date;
      }
      if (statusMount) {
        statusMount.innerHTML = data.is_imputed_date
          ? badgeHtml("info", "Diisi otomatis dari hari sebelumnya", "dot")
          : badgeHtml("success", "Data teramati", "check");
      }
      if (disparityReadout) {
        disparityReadout.textContent = `${formatRp(data.disparity_idr)} / kg (${String(data.disparity_pct).replace(".", ",")}%)`;
      }

      const vals = data.rankings.map((r) => r.price_idr);
      const rawMin = Math.min(...vals);
      const rawMax = Math.max(...vals);
      const axisMin = Math.max(0, Math.floor((rawMin - 1500) / 2000) * 2000);
      const axisMax = Math.ceil((rawMax + 500) / 2000) * 2000;
      const axisSpan = Math.max(2000, axisMax - axisMin);
      const midAxis = Math.round((axisMin + axisMax) / 2);

      const barsHtml = data.rankings.map((r) => {
        const col = PROVINCE_COLOR_VARS[r.province] || "var(--brand-primary)";
        const pct = Math.max(4, Math.min(100, ((r.price_idr - axisMin) / axisSpan) * 100));
        const isSel = cmp.selectedProvince === r.province;
        return `
          <button
            type="button"
            class="bar-row ${isSel ? "is-selected" : ""}"
            data-bar-prov="${escapeHtml(r.province)}"
            aria-pressed="${isSel ? "true" : "false"}"
          >
            <span class="bar-prov">${r.rank}. ${escapeHtml(r.province)}</span>
            <span class="bar-track" aria-hidden="true">
              <span class="bar-fill" style="--bar-pct: ${pct.toFixed(1)}%; --series-color: ${col};"></span>
            </span>
            <span class="bar-val">${escapeHtml(formatRp(r.price_idr))}</span>
          </button>
        `;
      }).join("");

      const marginRowsHtml = data.supply_chain_margins.map((m) => {
        const isSel = cmp.selectedProvince === m.province;
        return `
          <tr class="table-row-interactive ${isSel ? "is-highlighted" : ""}" data-compare-row="${escapeHtml(m.province)}">
            <td>
              <button type="button" class="table-row-btn" data-compare-prov="${escapeHtml(m.province)}" aria-pressed="${isSel ? "true" : "false"}">
                <strong>${escapeHtml(m.province)}</strong>
              </button>
            </td>
            <td class="num-cell">${escapeHtml(formatRp(m.produsen_idr))}</td>
            <td class="num-cell">${escapeHtml(formatRp(m.tradisional_idr))}</td>
            <td class="num-cell"><strong>${escapeHtml(formatRp(m.modern_idr))}</strong></td>
            <td class="num-cell text-brand">+${escapeHtml(formatRp(m.spread_idr))} (${String(m.spread_pct).replace(".", ",")}%)</td>
          </tr>
        `;
      }).join("");

      resultsMount.innerHTML = `
        <div class="grid-compare-split">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Peringkat Harga (${escapeHtml(formatDateId(data.date))})</h2>
                <p class="card-desc">Pilih provinsi untuk menyorot posisi pada peta dan tabel selisih pasokan. Rentang sumbu ${escapeHtml(formatRp(axisMin))} s/d ${escapeHtml(formatRp(axisMax))}.</p>
              </div>
            </div>
            <div>
              ${barsHtml}
              <div class="bar-axis">
                <span class="bar-axis-spacer"></span>
                <div class="bar-axis-ticks">
                  <span>${escapeHtml(formatRp(axisMin))}</span>
                  <span>${escapeHtml(formatRp(midAxis))}</span>
                  <span>${escapeHtml(formatRp(axisMax))}</span>
                </div>
                <span class="bar-axis-end"></span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Peta Sebaran Sulawesi</h2>
            </div>
            <div id="sulawesi-map-mount"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Selisih Harga Produsen ke Pasar (${escapeHtml(formatDateId(data.date))})</h2>
              <p class="card-desc">Klik baris provinsi untuk menyorotnya pada peringkat dan peta. Membandingkan produsen, pasar tradisional, dan pasar modern.</p>
            </div>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Provinsi</th>
                  <th class="num-head">Produsen</th>
                  <th class="num-head">Tradisional</th>
                  <th class="num-head">Modern</th>
                  <th class="num-head">Selisih Produsen ke Modern</th>
                </tr>
              </thead>
              <tbody>${marginRowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;

      const mapMount = document.getElementById("sulawesi-map-mount");
      renderSulawesiMap(mapMount, data.rankings, state.compare.selectedProvince, applyCompareProvinceSelection);

      resultsMount.querySelectorAll("[data-bar-prov]").forEach((btn) => {
        btn.addEventListener("click", () => applyCompareProvinceSelection(btn.getAttribute("data-bar-prov")));
      });
      resultsMount.querySelectorAll("[data-compare-prov]").forEach((btn) => {
        btn.addEventListener("click", () => applyCompareProvinceSelection(btn.getAttribute("data-compare-prov")));
      });
      resultsMount.querySelectorAll("[data-compare-row]").forEach((tr) => {
        tr.addEventListener("click", (ev) => {
          if (ev.target.closest("button")) return;
          applyCompareProvinceSelection(tr.getAttribute("data-compare-row"));
        });
      });
    } catch (err) {
      resultsMount.classList.remove("panel-loading");
      renderError(resultsMount, err.message, loadAndRenderCompare);
    }
  }

  async function renderBandingkan() {
    if (!document.getElementById("compare-page-shell")) {
      els.viewRoot.innerHTML = `
        <div class="view-stack" id="compare-page-shell">
          <div class="filter-strip">
            <div class="controls-grid controls-row-between">
              <div class="controls-grid controls-row-center">
                <div class="field-group">
                  <label class="field-label" for="compare-date-input" id="compare-date-label">Tanggal Pantauan (${escapeHtml(formatDateId(state.compare.date))})</label>
                  <input
                    type="date"
                    id="compare-date-input"
                    class="input-control font-mono"
                    value="${escapeHtml(state.compare.date)}"
                    min="2022-01-01"
                    max="2026-02-12"
                  >
                </div>
                <div class="field-group">
                  <span class="field-label">Status Laporan</span>
                  <div id="compare-date-status"></div>
                </div>
              </div>
              <div>
                <div class="field-label">Selisih Harga Antarprovinsi</div>
                <div class="kpi-md text-alert" id="compare-disparity-readout">-</div>
              </div>
            </div>
          </div>

          <div class="view-stack" id="compare-results-mount"></div>
        </div>
      `;

      document.getElementById("compare-date-input").addEventListener("change", (ev) => {
        if (ev.target.value) {
          state.compare.date = ev.target.value;
          loadAndRenderCompare();
        }
      });
    }

    await loadAndRenderCompare();
  }

  function syncForecastControlsUI() {
    const f = state.forecasts;
    const provSel = document.getElementById("fc-prov-select");
    if (provSel && provSel.value !== f.province) provSel.value = f.province;

    els.viewRoot.querySelectorAll("[data-fc-horizon]").forEach((btn) => {
      const act = Number(btn.getAttribute("data-fc-horizon")) === f.horizon;
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-pressed", act ? "true" : "false");
    });

    els.viewRoot.querySelectorAll("[data-fc-model]").forEach((btn) => {
      const act = btn.getAttribute("data-fc-model") === f.model;
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-pressed", act ? "true" : "false");
    });
  }

  async function loadAndRenderPrakiraan() {
    const resultsMount = document.getElementById("fc-results-mount");
    if (!resultsMount) return;
    const f = state.forecasts;
    const hadResults = resultsMount.children.length > 0 && !resultsMount.querySelector(".feedback-card");
    if (hadResults) {
      resultsMount.classList.add("panel-loading");
    } else {
      renderLoading(resultsMount, "Memuat prediksi harga dan perbandingan akurasi...");
    }

    try {
      const data = await apiGet(
        `/api/forecasts?segment=${encodeURIComponent(state.segment)}&province=${encodeURIComponent(f.province)}&horizon=${f.horizon}&model=${encodeURIComponent(f.model)}`
      );
      resultsMount.classList.remove("panel-loading");

      const selEval = data.model_comparison.find((m) => m.model_name === f.model) || data.model_comparison[0];
      const finalPt = data.forecast_points[data.forecast_points.length - 1];

      const evalRowsHtml = data.model_comparison.map((m) => `
        <tr class="table-row-interactive ${m.is_selected ? "is-highlighted" : ""}" data-fc-row="${escapeHtml(m.model_name)}">
          <td>
            <button type="button" class="table-row-btn" data-select-fc-model="${escapeHtml(m.model_name)}" aria-pressed="${m.is_selected ? "true" : "false"}">
              <strong>${escapeHtml(m.model_label)}</strong>
              ${m.is_best_mae ? badgeHtml("success", "Selisih Terkecil", "check") : ""}
            </button>
          </td>
          <td class="num-cell">${escapeHtml(formatRpDecimal(m.eval_mae, 2))}</td>
          <td class="num-cell">${String(m.eval_mape.toFixed(2)).replace(".", ",")}%</td>
          <td class="num-cell"><strong>${escapeHtml(formatRp(m.final_pred_idr))}</strong></td>
          <td class="num-cell">${escapeHtml(formatRp(m.final_lower_idr))} - ${escapeHtml(formatRp(m.final_upper_idr))}</td>
        </tr>
      `).join("");

      resultsMount.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">${escapeHtml(data.province)}: Perkiraan +${f.horizon} Minggu di ${escapeHtml(formatRp(finalPt.predicted_idr))}</h2>
              <p class="card-desc">
                Target ${escapeHtml(formatDateId(finalPt.target_date))} · Rentang wajar 90%: ${escapeHtml(formatRp(finalPt.lower_idr))} s/d ${escapeHtml(formatRp(finalPt.upper_idr))}.
              </p>
            </div>
            ${badgeHtml("success", `${data.selected_model_label} · Galat ${String(selEval.eval_mape.toFixed(2)).replace(".", ",")}%`, "dot")}
          </div>
          <div id="fc-chart-mount"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Perbandingan Akurasi Metode (Jan 2025 - Feb 2026)</h2>
              <p class="card-desc">Klik baris metode untuk mengganti proyeksi di grafik. MAE menunjukkan rata-rata selisih dalam Rp/kg.</p>
            </div>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Metode</th>
                  <th class="num-head">MAE (Rp/kg)</th>
                  <th class="num-head">MAPE</th>
                  <th class="num-head">Prediksi +${f.horizon}M</th>
                  <th class="num-head">Rentang Wajar 90%</th>
                </tr>
              </thead>
              <tbody>${evalRowsHtml}</tbody>
            </table>
          </div>
        </div>

        <details class="methodology-details">
          <summary class="methodology-summary">
            <span>Cara Membaca Prediksi &amp; Karakter Harga (${formatInt(data.change_days)} hari berubah dari ${formatInt(data.total_days)} hari)</span>
            <svg class="faq-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"></path>
            </svg>
          </summary>
          <div class="methodology-body">
            <p class="card-desc">
              Pada saluran ini, harga ${escapeHtml(data.province)} tercatat berubah pada <strong>${formatInt(data.change_days)}</strong> dari ${formatInt(data.total_days)} hari kalender sehingga riwayat mingguannya sering membentuk pola bertangga datar.
            </p>
            <p class="card-desc">
              Angka prediksi adalah estimasi statistik untuk membantu perencanaan belanja atau stok usaha, bukan jaminan harga jual di lapangan.
            </p>
            <div>
              <a class="btn btn-secondary" href="#artikel/cara-membaca-prediksi-harga-beras-untuk-belanja-dan-usaha">Baca Panduan Lengkap Prediksi</a>
            </div>
          </div>
        </details>
      `;

      renderForecastChart(document.getElementById("fc-chart-mount"), data);

      const selectModelFromTable = (modelKey) => {
        if (!modelKey || state.forecasts.model === modelKey) return;
        state.forecasts.model = modelKey;
        syncForecastControlsUI();
        loadAndRenderPrakiraan();
      };

      resultsMount.querySelectorAll("[data-select-fc-model]").forEach((btn) => {
        btn.addEventListener("click", () => selectModelFromTable(btn.getAttribute("data-select-fc-model")));
      });
      resultsMount.querySelectorAll("[data-fc-row]").forEach((tr) => {
        tr.addEventListener("click", (ev) => {
          if (ev.target.closest("button")) return;
          selectModelFromTable(tr.getAttribute("data-fc-row"));
        });
      });
    } catch (err) {
      resultsMount.classList.remove("panel-loading");
      renderError(resultsMount, err.message, loadAndRenderPrakiraan);
    }
  }

  async function renderPrakiraan() {
    const f = state.forecasts;
    if (!document.getElementById("fc-page-shell")) {
      els.viewRoot.innerHTML = `
        <div class="view-stack" id="fc-page-shell">
          <div class="filter-strip">
            <div class="controls-grid">
              <div class="field-group">
                <label class="field-label" for="fc-prov-select">Provinsi</label>
                <select id="fc-prov-select" class="select-control">
                  ${ALL_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${p === f.province ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
                </select>
              </div>

              <div class="field-group">
                <span class="field-label">Jangka Prediksi</span>
                <div class="segment-group" role="group" aria-label="Jangka waktu prediksi mingguan">
                  ${[4, 8].map((hVal) => `
                    <button type="button" class="seg-btn" aria-pressed="false" data-fc-horizon="${hVal}">${hVal} Minggu</button>
                  `).join("")}
                </div>
              </div>

              <div class="field-group">
                <span class="field-label">Metode Perhitungan</span>
                <div class="segment-group" role="group" aria-label="Pilih metode prediksi">
                  ${[
                    ["arima_110", "ARIMA(1,1,0)"],
                    ["seasonal_naive", "Seasonal Naive"],
                    ["moving_average_4w", "Moving Avg 4W"],
                  ].map(([mKey, mLbl]) => `
                    <button type="button" class="seg-btn" aria-pressed="false" data-fc-model="${mKey}">${mLbl}</button>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>

          <div class="view-stack" id="fc-results-mount"></div>
        </div>
      `;

      document.getElementById("fc-prov-select").addEventListener("change", (ev) => {
        state.forecasts.province = ev.target.value;
        loadAndRenderPrakiraan();
      });
      els.viewRoot.querySelectorAll("[data-fc-horizon]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.forecasts.horizon = Number(btn.getAttribute("data-fc-horizon"));
          syncForecastControlsUI();
          loadAndRenderPrakiraan();
        });
      });
      els.viewRoot.querySelectorAll("[data-fc-model]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.forecasts.model = btn.getAttribute("data-fc-model");
          syncForecastControlsUI();
          loadAndRenderPrakiraan();
        });
      });
    }

    syncForecastControlsUI();
    await loadAndRenderPrakiraan();
  }

  function formatImputedSpreadCell(row, pickMax) {
    const entries = [
      ["gorontalo_idr", "Gorontalo"],
      ["sulbar_idr", "Sulawesi Barat"],
      ["sulsel_idr", "Sulawesi Selatan"],
      ["sulteng_idr", "Sulawesi Tengah"],
      ["sultra_idr", "Sulawesi Tenggara"],
      ["sulut_idr", "Sulawesi Utara"],
    ]
      .map(([key, prov]) => ({ val: Number(row[key]), prov }))
      .filter((x) => Number.isFinite(x.val) && x.val > 0);
    if (!entries.length) return "-";
    entries.sort((a, b) => (pickMax ? b.val - a.val : a.val - b.val));
    const chosen = entries[0];
    const shortName = PROVINCE_SHORT[chosen.prov] || chosen.prov;
    return `${formatRp(chosen.val)} (${shortName})`;
  }

  async function loadAndRenderKualitas() {
    const resultsMount = document.getElementById("quality-results-mount");
    if (!resultsMount) return;
    const q = state.quality;
    const hadResults = resultsMount.children.length > 0 && !resultsMount.querySelector(".feedback-card");
    if (hadResults) {
      resultsMount.classList.add("panel-loading");
    } else {
      renderLoading(resultsMount, "Memuat catatan kelengkapan tanggal dan anomali...");
    }

    try {
      const data = await apiGet(
        `/api/quality?segment=${encodeURIComponent(state.segment)}&province=${encodeURIComponent(q.province)}`
      );
      resultsMount.classList.remove("panel-loading");
      const etl = data.etl;

      const etlNoteEl = document.getElementById("quality-etl-note");
      if (etlNoteEl) {
        etlNoteEl.textContent = `${etl.label} · ${formatDateId(etl.min_date)} s/d ${formatDateId(etl.max_date)}`;
      }
      const provSel = document.getElementById("quality-prov-select");
      if (provSel && provSel.value !== q.province) provSel.value = q.province;

      const imputedTableHtml = q.province === "all"
        ? `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th class="num-head">Termurah (6 Prov)</th>
                  <th class="num-head">Termahal (6 Prov)</th>
                  <th>Cakupan</th>
                  <th>Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>
                ${data.imputed_rows.map((r) => `
                  <tr>
                    <td class="num-cell">${escapeHtml(formatDateId(r.price_date))}</td>
                    <td class="num-cell">${escapeHtml(formatImputedSpreadCell(r, false))}</td>
                    <td class="num-cell">${escapeHtml(formatImputedSpreadCell(r, true))}</td>
                    <td>${badgeHtml("info", `${r.province_rows} prov`, "dot")}</td>
                    <td><button type="button" class="btn btn-secondary btn-table-link" data-jump-date="${escapeHtml(r.price_date)}">Bandingkan</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Provinsi</th>
                  <th class="num-head">Harga Diisi</th>
                  <th>Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>
                ${data.imputed_rows.map((r) => `
                  <tr>
                    <td class="num-cell">${escapeHtml(formatDateId(r.price_date))}</td>
                    <td>${escapeHtml(r.province)}</td>
                    <td class="num-cell">${escapeHtml(formatRp(r.price_idr))}</td>
                    <td><button type="button" class="btn btn-secondary btn-table-link" data-jump-date="${escapeHtml(r.price_date)}">Bandingkan</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;

      resultsMount.innerHTML = `
        <div class="grid-3col">
          <div class="card">
            <span class="field-label">TOTAL CATATAN HARIAN</span>
            <span class="kpi-lg">${formatInt(etl.rows_long)} baris</span>
            <span class="section-note">6 provinsi x ${formatInt(etl.calendar_days)} hari kalender</span>
          </div>
          <div class="card">
            <span class="field-label">HARI TANPA LAPORAN</span>
            <span class="kpi-lg">${formatInt(etl.rows_imputed)} baris</span>
            ${badgeHtml("info", `${formatInt(data.imputed_dates_count)} tanggal diisi otomatis`, "dot")}
          </div>
          <div class="card">
            <span class="field-label">LONJAKAN HARIAN &gt; 10%</span>
            <span class="kpi-lg">${formatInt(data.anomalies_count)} kejadian</span>
            ${badgeHtml(data.anomalies_count > 0 ? "alert" : "success", data.anomalies_count > 0 ? "Perlu Verifikasi" : "Nihil", data.anomalies_count > 0 ? "alert" : "check")}
          </div>
        </div>

        <div class="grid-2col">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Hari Tanpa Pelaporan (${formatInt(data.imputed_dates_count)} Tanggal)</h2>
                <p class="card-desc">Kekosongan tanggal libur diisi memakai harga hari sebelumnya agar grafik kalender tidak terputus.</p>
              </div>
            </div>
            ${imputedTableHtml}
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Perubahan Harian di Atas 10%</h2>
                <p class="card-desc">Kenaikan atau penurunan tajam tetap ditampilkan apa adanya dengan status perlu verifikasi.</p>
              </div>
            </div>
            <div id="anomaly-list-mount"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Catatan Temuan Data</h2>
          <ul class="alert-list">
            ${data.investigation_notes.map((n) => `<li>${escapeHtml(sanitizeAlertMessage(n))}</li>`).join("")}
          </ul>
          <p class="scope-footnote">
            Cakupan sumber: PIHPS Bank Indonesia (1 Jan 2022 s/d 12 Feb 2026) untuk komoditas beras rata-rata tingkat provinsi tanpa rincian merek/varietas.
          </p>
        </div>
      `;

      const anomalyMount = document.getElementById("anomaly-list-mount");
      if (!data.anomalies.length) {
        renderEmpty(
          anomalyMount,
          "Tidak ada lonjakan > 10% pada filter ini",
          `Saluran ${etl.label} untuk ${q.province === "all" ? "Sulawesi" : q.province} tidak mencatat perubahan harian di atas 10%.`,
          q.province === "all" ? null : "Reset Filter",
          q.province === "all" ? null : () => {
            state.quality.province = "all";
            loadAndRenderKualitas();
          }
        );
      } else {
        anomalyMount.innerHTML = `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Provinsi</th>
                  <th class="num-head">Sebelum</th>
                  <th class="num-head">Sesudah</th>
                  <th class="num-head">&Delta; Harian</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.anomalies.map((a) => `
                  <tr>
                    <td class="num-cell">${escapeHtml(formatDateId(a.price_date))}</td>
                    <td>${escapeHtml(PROVINCE_SHORT[a.province] || a.province)}</td>
                    <td class="num-cell">${escapeHtml(formatRp(a.prev_price_idr))}</td>
                    <td class="num-cell"><strong>${escapeHtml(formatRp(a.price_idr))}</strong></td>
                    <td class="num-cell text-alert">${escapeHtml(formatPct(a.pct_change_daily))}</td>
                    <td>${badgeHtml("alert", "Perlu Verifikasi", "alert")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }

      resultsMount.querySelectorAll("[data-jump-date]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.compare.date = btn.getAttribute("data-jump-date");
          navigateTo("bandingkan");
        });
      });
    } catch (err) {
      resultsMount.classList.remove("panel-loading");
      renderError(resultsMount, err.message, loadAndRenderKualitas);
    }
  }

  async function renderKualitas() {
    const q = state.quality;
    if (!document.getElementById("quality-page-shell")) {
      els.viewRoot.innerHTML = `
        <div class="view-stack" id="quality-page-shell">
          <div class="filter-strip">
            <div class="controls-grid controls-row-between">
              <div class="field-group">
                <label class="field-label" for="quality-prov-select">Saring Provinsi</label>
                <select id="quality-prov-select" class="select-control">
                  <option value="all" ${q.province === "all" ? "selected" : ""}>Semua 6 Provinsi Sulawesi</option>
                  ${ALL_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${q.province === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
                </select>
              </div>
              <div class="section-note font-mono" id="quality-etl-note">-</div>
            </div>
          </div>

          <div class="view-stack" id="quality-results-mount"></div>
        </div>
      `;

      document.getElementById("quality-prov-select").addEventListener("change", (ev) => {
        state.quality.province = ev.target.value;
        loadAndRenderKualitas();
      });
    }

    await loadAndRenderKualitas();
  }

  window.PBS.app = {
    state,
    els,
    ALL_PROVINCES,
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
    if (state.route === "beranda") {
      await renderBeranda();
    } else if (state.route === "tren") {
      await renderTren();
    } else if (state.route === "bandingkan") {
      await renderBandingkan();
    } else if (state.route === "prakiraan") {
      await renderPrakiraan();
    } else if (state.route === "kualitas") {
      await renderKualitas();
    } else if (state.route === "unduh" && pv.renderUnduh) {
      await pv.renderUnduh();
    } else if (state.route === "artikel" && pv.renderArtikel) {
      pv.renderArtikel(state.articleSlug);
    } else if (state.route === "panduan" && pv.renderPanduan) {
      pv.renderPanduan();
    } else if (state.route === "kontak" && pv.renderKontak) {
      pv.renderKontak();
    } else {
      await renderBeranda();
    }
    return titleText;
  }

  async function bootstrap() {
    applyTheme(state.theme);

    if (els.themeBtn) els.themeBtn.addEventListener("click", toggleTheme);
    if (els.menuBtn) els.menuBtn.addEventListener("click", openMobileDrawer);
    if (els.drawerCloseBtn) els.drawerCloseBtn.addEventListener("click", () => closeMobileDrawer(true));
    if (els.backdrop) els.backdrop.addEventListener("click", () => closeMobileDrawer(true));

    if (els.dataMenuBtn && els.dataMenu) {
      const getMenuItems = () => [...els.dataMenu.querySelectorAll('[role="menuitem"]')];

      els.dataMenuBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const isExpanded = els.dataMenuBtn.getAttribute("aria-expanded") === "true";
        setDataDropdownOpen(!isExpanded);
      });

      els.dataMenuBtn.addEventListener("keydown", (ev) => {
        const items = getMenuItems();
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          setDataDropdownOpen(true, items[0]);
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          setDataDropdownOpen(true, items[items.length - 1]);
        } else if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          const isExpanded = els.dataMenuBtn.getAttribute("aria-expanded") === "true";
          setDataDropdownOpen(!isExpanded, !isExpanded ? items[0] : null);
        } else if (ev.key === "Escape") {
          setDataDropdownOpen(false);
        }
      });

      els.dataMenu.addEventListener("keydown", (ev) => {
        const items = getMenuItems();
        const curr = items.indexOf(document.activeElement);
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          items[(curr + 1) % items.length].focus();
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          items[(curr - 1 + items.length) % items.length].focus();
        } else if (ev.key === "Home") {
          ev.preventDefault();
          items[0].focus();
        } else if (ev.key === "End") {
          ev.preventDefault();
          items[items.length - 1].focus();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          setDataDropdownOpen(false);
          els.dataMenuBtn.focus();
        } else if (ev.key === "Tab") {
          setDataDropdownOpen(false);
        }
      });

      if (els.dataDropdown) {
        els.dataDropdown.addEventListener("focusout", (ev) => {
          if (!els.dataDropdown.contains(ev.relatedTarget)) {
            setDataDropdownOpen(false);
          }
        });
      }
    }

    document.addEventListener("click", (ev) => {
      if (els.dataDropdown && !els.dataDropdown.contains(ev.target)) {
        setDataDropdownOpen(false);
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        if (els.dataMenuBtn && els.dataMenuBtn.getAttribute("aria-expanded") === "true") {
          const focusInside = els.dataDropdown && els.dataDropdown.contains(document.activeElement);
          setDataDropdownOpen(false);
          if (focusInside) els.dataMenuBtn.focus();
        }
        closeMobileDrawer(true);
      }
    });

    if (els.backToTopBtn) {
      els.backToTopBtn.addEventListener("click", () => {
        scrollWindowToTop();
        if (els.mainContent) els.mainContent.focus({ preventScroll: true });
      });
    }

    document.querySelectorAll('#segment-toolbar [data-segment]').forEach((btn) => {
      btn.addEventListener("click", () => {
        state.segment = btn.getAttribute("data-segment");
        state.exportCfg.segment = state.segment;
        safeStorageSet("berasak_segment", state.segment);
        renderCurrentRoute();
      });
    });

    window.addEventListener("hashchange", async () => {
      const parsed = parseRouteFromHash();
      state.route = parsed.route;
      state.articleSlug = parsed.articleSlug;
      const titleText = await renderCurrentRoute();
      scrollWindowToTop();
      announceRoute(titleText);
      if (els.mainContent) {
        els.mainContent.focus({ preventScroll: true });
      }
    });

    try {
      state.meta = await apiGet("/api/meta");
      const firstSeg = state.meta.segments[0];
      if (firstSeg && els.periodNote) {
        els.periodNote.textContent = `Data ${formatDateId(firstSeg.max_date)}`;
      }
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
