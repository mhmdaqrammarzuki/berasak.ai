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

  const DATA_ROUTES = new Set(["beranda", "tren", "bandingkan", "prakiraan", "kualitas", "unduh"]);

  const CHANNEL_HINTS = {
    modern: "Pasar Modern: harga eceran supermarket & minimarket · Rp/kg",
    tradisional: "Pasar Tradisional: harga harian pedagang pasar rakyat · Rp/kg",
    produsen: "Tingkat Produsen: harga di penggilingan & pedagang besar · Rp/kg",
  };

  const CONTACT_INFO = {
    email: "customer.service@berasak.ai.com",
    phoneDisplay: "(6767) 6996697",
    phoneHref: "tel:67676996697",
  };

  const PAGE_META = {
    beranda: {
      title: "Pantauan Harga Beras Sulawesi",
      subtitle: "Cek harga beras terkini per kilogram, hitung estimasi belanja keluarga, dan bandingkan 6 provinsi Sulawesi.",
    },
    tren: {
      title: "Tren Pergerakan Harga Beras",
      subtitle: "Lihat naik-turunnya harga lintas provinsi secara harian, mingguan, atau bulanan.",
    },
    bandingkan: {
      title: "Perbandingan Wilayah & Selisih Pasokan",
      subtitle: "Bandingkan peringkat harga antarprovinsi dan selisih dari tingkat produsen ke pasar eceran.",
    },
    prakiraan: {
      title: "Prediksi Harga 4 sampai 8 Minggu",
      subtitle: "Perkiraan statistik mingguan beserta rentang wajar dan perbandingan akurasi tiga metode.",
    },
    kualitas: {
      title: "Kualitas Data & Catatan Anomali",
      subtitle: "Daftar transparan hari tanpa laporan dan perubahan harian di atas 10% yang tetap dipertahankan.",
    },
    unduh: {
      title: "Unduh Dataset Terverifikasi",
      subtitle: "Pilih provinsi, rentang tanggal, dan bentuk tabel CSV untuk diolah atau dibagikan.",
    },
    artikel: {
      title: "Artikel & Edukasi Harga Beras",
      subtitle: "Bacaan singkat berbahasa sederhana untuk memahami pasar beras, distribusi wilayah, dan tips belanja.",
    },
    panduan: {
      title: "Panduan Pengguna & Kamus Istilah",
      subtitle: "Langkah cepat membaca grafik, arti istilah data, dan jawaban pertanyaan yang sering diajukan.",
    },
    kontak: {
      title: "Kontak & Layanan Pengguna",
      subtitle: "Hubungi tim berasak.ai melalui email atau telepon resmi untuk pertanyaan data dan masukan layanan.",
    },
  };

  const THEME_ICONS = {
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"></circle><path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>',
  };

  const savedTheme = localStorage.getItem("berasak_theme") || localStorage.getItem("pbs_theme");

  const state = {
    route: "beranda",
    articleSlug: null,
    segment: "modern",
    theme: savedTheme === "dark" ? "dark" : "light",
    meta: null,
    overviewCache: null,
    quickProvince: "Sulawesi Selatan",
    quickKg: 5,
    articlesFilter: {
      category: "Semua",
      query: "",
    },
    trends: {
      provinces: ["Sulawesi Tengah", "Gorontalo", "Sulawesi Selatan", "Sulawesi Barat"],
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
      segment: "modern",
      provinces: [...ALL_PROVINCES],
      from: "2022-01-01",
      to: "2026-02-12",
      shape: "long",
      includeFlags: true,
    },
  };

  const els = {
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
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    segToolbar: document.getElementById("segment-toolbar"),
    segChannelHint: document.getElementById("segment-channel-hint"),
    periodNote: document.getElementById("dataset-period-note"),
    backToTopBtn: document.getElementById("back-to-top-btn"),
    mainContent: document.getElementById("main-content"),
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
    localStorage.setItem("berasak_theme", theme);
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

  function setDataDropdownOpen(open) {
    if (!els.dataMenuBtn || !els.dataMenu) return;
    els.dataMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    els.dataMenu.hidden = !open;
  }

  function openMobileDrawer() {
    if (!els.sidebar || !els.backdrop || !els.menuBtn) return;
    els.sidebar.classList.add("is-open");
    els.backdrop.hidden = false;
    els.menuBtn.setAttribute("aria-expanded", "true");
    if (els.drawerCloseBtn) els.drawerCloseBtn.focus();
  }

  function closeMobileDrawer(restoreFocus = true) {
    if (!els.sidebar || !els.sidebar.classList.contains("is-open")) return;
    els.sidebar.classList.remove("is-open");
    if (els.backdrop) els.backdrop.hidden = true;
    if (els.menuBtn) {
      els.menuBtn.setAttribute("aria-expanded", "false");
      if (restoreFocus) els.menuBtn.focus();
    }
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
    if (activeRoute === "artikel" && state.articleSlug) {
      const found = ARTICLES.find((a) => a.slug === state.articleSlug);
      if (found) {
        meta = {
          title: found.title,
          subtitle: `${found.category} · ${found.readMinutes} menit baca · Diperbarui ${found.updatedLabel}`,
        };
      }
    }

    els.pageTitle.textContent = meta.title;
    els.pageSubtitle.textContent = meta.subtitle;
    els.segToolbar.hidden = !DATA_ROUTES.has(activeRoute);
    document.title = `${meta.title} | berasak.ai`;
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

  function provinceStatusBadge(prov) {
    if (prov.pct_30d > 1.0) {
      return badgeHtml("alert", `Naik ${formatPct(prov.pct_30d)}`, "up");
    }
    if (prov.pct_30d < -0.5) {
      return badgeHtml("success", `Turun ${formatPct(prov.pct_30d)}`, "down");
    }
    return badgeHtml("neutral", "Stabil 30 hari", "dot");
  }

  function provinceTrendSummary(prov) {
    if (prov.pct_30d > 1.0) {
      return `Dalam 30 hari terakhir, harga di ${prov.province} naik ${formatPct(prov.pct_30d)}.`;
    }
    if (prov.pct_30d < -0.5) {
      return `Dalam 30 hari terakhir, harga di ${prov.province} turun ${formatPct(prov.pct_30d)}.`;
    }
    return `Selama 30 hari terakhir, harga di ${prov.province} cenderung stabil (${formatPct(prov.pct_30d)}).`;
  }

  function renderQuickCheckerHtml(data) {
    const selected = data.provinces.find((p) => p.province === state.quickProvince) || data.provinces[0];
    const kg = state.quickKg || 5;
    const totalEstimate = selected.price_idr * kg;

    return `
      <div class="quick-checker-grid">
        <div class="quick-checker-form">
          <div class="card-header">
            <div>
              <h2 class="card-title">Cek Cepat Harga &amp; Estimasi Belanja Beras</h2>
              <p class="card-desc">Pilih provinsi dan ukuran kemasan untuk menghitung perkiraan biaya belanja pada saluran ${escapeHtml(data.segment.label)}.</p>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="quick-prov-select">Provinsi Anda</label>
            <select id="quick-prov-select" class="select-control">
              ${ALL_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${p === selected.province ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
            </select>
          </div>

          <div class="field-group">
            <span class="field-label">Perkiraan Jumlah Beli</span>
            <div class="weight-group" role="group" aria-label="Pilih jumlah kilogram beras">
              ${[1, 5, 10, 25, 50].map((w) => `
                <button type="button" class="weight-btn ${kg === w ? "is-active" : ""}" aria-pressed="${kg === w ? "true" : "false"}" data-quick-kg="${w}">${w} kg</button>
              `).join("")}
            </div>
          </div>
        </div>

        <div class="quick-checker-result">
          <div class="quick-result-top">
            <div>
              <div class="field-label">Harga ${escapeHtml(selected.province)} (${escapeHtml(data.segment.label)})</div>
              <div class="kpi-lg">${escapeHtml(formatRp(selected.price_idr))} <span class="section-note">/ kg</span></div>
            </div>
            ${provinceStatusBadge(selected)}
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
        </div>
      </div>
    `;
  }

  function bindQuickCheckerEvents(mountEl, data) {
    const selectEl = mountEl.querySelector("#quick-prov-select");
    if (selectEl) {
      selectEl.addEventListener("change", (ev) => {
        state.quickProvince = ev.target.value;
        mountEl.innerHTML = renderQuickCheckerHtml(data);
        bindQuickCheckerEvents(mountEl, data);
      });
    }
    mountEl.querySelectorAll("[data-quick-kg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.quickKg = Number(btn.getAttribute("data-quick-kg"));
        mountEl.innerHTML = renderQuickCheckerHtml(data);
        bindQuickCheckerEvents(mountEl, data);
      });
    });
    const trendBtn = mountEl.querySelector("[data-quick-trend]");
    if (trendBtn) {
      trendBtn.addEventListener("click", () => {
        state.trends.provinces = [trendBtn.getAttribute("data-quick-trend")];
        navigateTo("tren");
      });
    }
    const fcBtn = mountEl.querySelector("[data-quick-forecast]");
    if (fcBtn) {
      fcBtn.addEventListener("click", () => {
        state.forecasts.province = fcBtn.getAttribute("data-quick-forecast");
        navigateTo("prakiraan");
      });
    }
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
        return `<span class="spectrum-dot" style="--dot-left: ${clamped}%; --series-color: ${col};" title="${escapeHtml(shortName)}: ${escapeHtml(formatRp(p.price_idr))}"></span>`;
      }).join("");

      const alertHtml = data.alerts.length
        ? `
          <div class="alert-rail">
            <div>
              <div class="card-header">
                <h2 class="card-title">Peringatan Kenaikan</h2>
                ${badgeHtml("alert", `${data.alerts.length} Peringatan`, "alert")}
              </div>
              <ul class="alert-list alert-list-spaced">
                ${data.alerts.map((a) => `<li><strong>${escapeHtml(a.province)}:</strong> ${escapeHtml(a.message)}</li>`).join("")}
              </ul>
            </div>
            <button type="button" class="btn btn-secondary" data-go="kualitas">Periksa Kualitas Data</button>
          </div>
        `
        : `
          <div class="alert-rail">
            <div>
              <div class="card-header">
                <h2 class="card-title">Pantauan 30 Hari Terakhir</h2>
                ${badgeHtml("success", "Tanpa Lonjakan >10%", "check")}
              </div>
              <p class="card-desc">
                Keenam provinsi tidak mencatat lonjakan harian ekstrem di atas 10% dalam 30 hari terakhir.
                Tersimpan ${formatInt(data.historical_anomalies_count)} catatan historis pada saluran ini.
              </p>
            </div>
            <button type="button" class="btn btn-secondary" data-go="kualitas">Tinjau ${formatInt(data.historical_anomalies_count)} Catatan Historis</button>
          </div>
        `;

      const ledgerRowsHtml = sortedProvinces.map((p, idx) => {
        const colVar = PROVINCE_COLOR_VARS[p.province] || "var(--brand-primary)";
        return `
          <button
            type="button"
            class="ledger-row"
            data-inspect-trend="${escapeHtml(p.province)}"
            aria-label="Lihat tren ${escapeHtml(p.province)}, harga ${escapeHtml(formatRp(p.price_idr))} per kg"
          >
            <span class="ledger-cell-prov">
              <span class="ledger-rank">${idx + 1}</span>
              <span class="ledger-swatch" style="--series-color: ${colVar};" aria-hidden="true"></span>
              <span class="ledger-prov-text">
                <span class="ledger-prov-name">${escapeHtml(p.province)}</span>
                ${provinceStatusBadge(p)}
              </span>
            </span>
            <span class="ledger-cell-price">${escapeHtml(formatRp(p.price_idr))}</span>
            <span class="ledger-cell-deltas">
              <span>30 hari ${escapeHtml(formatPct(p.pct_30d))}</span>
              <span>Bulanan ${escapeHtml(formatPct(p.mom_pct))}</span>
            </span>
            <span class="ledger-cell-spark">${renderStepSparkline(p.spark_90d, colVar)}</span>
            <span class="ledger-cell-freq">${formatInt(p.change_days)}/${formatInt(p.total_days)} hari</span>
          </button>
        `;
      }).join("");

      const previewArticles = ARTICLES.slice(0, 3);
      const articlesHtml = previewArticles.map((art) => `
        <article class="article-card">
          <div class="article-card-body">
            <div class="article-meta">
              <span class="article-category">${escapeHtml(art.category)}</span>
              <span>${art.readMinutes} menit baca</span>
            </div>
            <h3 class="article-title">${escapeHtml(art.title)}</h3>
            <p class="article-excerpt">${escapeHtml(art.excerpt)}</p>
          </div>
          <a class="btn btn-secondary" href="#artikel/${escapeHtml(art.slug)}">Baca Artikel</a>
        </article>
      `).join("");

      els.viewRoot.innerHTML = `
        <section class="quick-checker" id="quick-checker-mount" aria-label="Pencari harga provinsi dan estimasi belanja"></section>

        <section class="disparity-hero" aria-label="Ringkasan selisih harga antarprovinsi">
          <div class="disparity-lead">
            <div class="disparity-headline-row">
              <div>
                <div class="field-label">SELISIH HARGA ANTARPROVINSI</div>
                <div class="kpi-xl">${escapeHtml(formatRp(d.gap_idr))} <span class="section-note">/ kg</span></div>
              </div>
              ${badgeHtml("neutral", `${String(d.gap_pct).replace(".", ",")}% selisih`, "dot")}
            </div>

            <div class="spectrum-wrap">
              <div class="spectrum-rail" aria-hidden="true">
                <div class="spectrum-track"></div>
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
          </div>

          ${alertHtml}
        </section>

        <section class="editorial-section" aria-label="Papan peringkat harga provinsi">
          <div class="section-bar">
            <h2 class="section-heading">Peringkat Harga 6 Provinsi (${escapeHtml(data.segment.label)})</h2>
            <span class="section-note">Klik baris provinsi untuk melihat grafik tren lengkap</span>
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
            <h2 class="section-heading">Artikel &amp; Panduan Pilihan</h2>
            <a class="btn btn-ghost" href="#artikel">Lihat Semua Artikel</a>
          </div>
          <div class="grid-3col">${articlesHtml}</div>
        </section>

        <section class="support-strip" aria-label="Bantuan dan layanan pengguna">
          <div>
            <h2 class="card-title">Butuh bantuan membaca data atau ingin memberi masukan?</h2>
            <p class="card-desc">
              Hubungi layanan pengguna berasak.ai di
              <a class="inline-contact-link font-mono" href="mailto:${CONTACT_INFO.email}">${CONTACT_INFO.email}</a>
              atau telepon <a class="inline-contact-link font-mono" href="${CONTACT_INFO.phoneHref}">${CONTACT_INFO.phoneDisplay}</a>.
            </p>
          </div>
          <div class="support-strip-links">
            <a class="btn btn-secondary" href="#panduan">Buka Panduan</a>
            <a class="btn btn-primary" href="#kontak">Halaman Kontak</a>
          </div>
        </section>
      `;

      const quickMount = document.getElementById("quick-checker-mount");
      if (quickMount) {
        quickMount.innerHTML = renderQuickCheckerHtml(data);
        bindQuickCheckerEvents(quickMount, data);
      }

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

  async function renderTren() {
    renderLoading(els.viewRoot, "Memuat grafik tren dan rata-rata bergerak...");
    try {
      const t = state.trends;
      const qProvs = t.provinces.join(",");
      const data = await apiGet(
        `/api/trends?segment=${encodeURIComponent(state.segment)}&provinces=${encodeURIComponent(qProvs)}&agg=${encodeURIComponent(t.agg)}&range=${encodeURIComponent(t.range)}`
      );

      const chipsHtml = ALL_PROVINCES.map((p) => {
        const active = t.provinces.includes(p);
        const col = PROVINCE_COLOR_VARS[p] || "var(--brand-primary)";
        return `
          <button
            type="button"
            class="chip-btn ${active ? "is-active" : ""}"
            aria-pressed="${active ? "true" : "false"}"
            data-trend-prov="${escapeHtml(p)}"
          >
            <span class="color-dot" style="--series-color: ${col};" aria-hidden="true"></span>
            <span>${escapeHtml(p)}</span>
          </button>
        `;
      }).join("");

      const sortedSummary = [...data.summary].sort((a, b) => b.latest_idr - a.latest_idr);
      const topProv = sortedSummary[0];
      const botProv = sortedSummary[sortedSummary.length - 1];
      const chartHeadline = sortedSummary.length > 1
        ? `${PROVINCE_SHORT[topProv.province] || topProv.province} tertinggi (${formatRp(topProv.latest_idr)}), terpaut ${formatRp(topProv.latest_idr - botProv.latest_idr)} dari ${PROVINCE_SHORT[botProv.province] || botProv.province}`
        : `${topProv.province}: ${formatRp(topProv.latest_idr)} / kg`;

      const summaryCards = data.summary.map((s) => `
        <div class="card">
          <div class="field-label">${escapeHtml(s.province)}</div>
          <div class="kpi-md">${escapeHtml(formatRp(s.latest_idr))}</div>
          <div class="section-note font-mono">Terendah ${escapeHtml(formatRp(s.min_idr))} · Tertinggi ${escapeHtml(formatRp(s.max_idr))}</div>
          <div class="section-note">Harga berubah pada ${formatInt(s.change_days)} dari ${formatInt(s.total_days)} hari</div>
        </div>
      `).join("");

      els.viewRoot.innerHTML = `
        <div class="filter-strip">
          <div class="field-group">
            <span class="field-label">Pilih Provinsi (1 sampai 6)</span>
            <div class="chip-list">${chipsHtml}</div>
          </div>

          <div class="controls-grid">
            <div class="field-group">
              <span class="field-label">Rentang Waktu</span>
              <div class="segment-group" role="group" aria-label="Rentang waktu grafik">
                ${[["3m", "3 Bulan"], ["1y", "1 Tahun"], ["all", "2022-2026"]].map(([id, lbl]) => `
                  <button type="button" class="seg-btn ${t.range === id ? "is-active" : ""}" aria-pressed="${t.range === id ? "true" : "false"}" data-trend-range="${id}">${lbl}</button>
                `).join("")}
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Tampilan Data</span>
              <div class="segment-group" role="group" aria-label="Mode tampilan data">
                ${[["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"]].map(([id, lbl]) => `
                  <button type="button" class="seg-btn ${t.agg === id ? "is-active" : ""}" aria-pressed="${t.agg === id ? "true" : "false"}" data-trend-agg="${id}">${lbl}</button>
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
            <span>Lingkaran biru: hari tanpa laporan (diisi harga sebelumnya)</span>
          </div>
        </div>

        <section class="editorial-section">
          <div class="section-bar">
            <h2 class="section-heading">Ringkasan Rentang Terpilih</h2>
            <span class="section-note">Harga terendah, tertinggi, dan frekuensi perubahan</span>
          </div>
          <div class="grid-3col">${summaryCards}</div>
        </section>
      `;

      const chartMount = document.getElementById("trend-chart-mount");
      renderTrendsChart(chartMount, data, {
        showMa4: t.showMa4,
        showAnomalies: t.showAnomalies,
        onReset: () => {
          state.trends.provinces = ["Sulawesi Tengah", "Gorontalo", "Sulawesi Selatan", "Sulawesi Barat"];
          state.trends.range = "1y";
          state.trends.agg = "monthly";
          renderTren();
        },
      });

      els.viewRoot.querySelectorAll("[data-trend-prov]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const prov = btn.getAttribute("data-trend-prov");
          const exists = state.trends.provinces.includes(prov);
          if (exists && state.trends.provinces.length > 1) {
            state.trends.provinces = state.trends.provinces.filter((p) => p !== prov);
            renderTren();
          } else if (!exists) {
            state.trends.provinces = ALL_PROVINCES.filter((p) => state.trends.provinces.includes(p) || p === prov);
            renderTren();
          }
        });
      });

      els.viewRoot.querySelectorAll("[data-trend-range]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.trends.range = btn.getAttribute("data-trend-range");
          renderTren();
        });
      });

      els.viewRoot.querySelectorAll("[data-trend-agg]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.trends.agg = btn.getAttribute("data-trend-agg");
          renderTren();
        });
      });

      document.getElementById("toggle-ma4").addEventListener("change", (ev) => {
        state.trends.showMa4 = ev.target.checked;
        renderTren();
      });
      document.getElementById("toggle-anom").addEventListener("change", (ev) => {
        state.trends.showAnomalies = ev.target.checked;
        renderTren();
      });
    } catch (err) {
      renderError(els.viewRoot, err.message, renderTren);
    }
  }

  async function renderBandingkan() {
    renderLoading(els.viewRoot, "Memuat peta, peringkat wilayah, dan selisih pasokan...");
    try {
      const cmp = state.compare;
      const data = await apiGet(
        `/api/compare?segment=${encodeURIComponent(state.segment)}&date=${encodeURIComponent(cmp.date)}`
      );

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

      const marginRowsHtml = data.supply_chain_margins.map((m) => `
        <tr class="${cmp.selectedProvince === m.province ? "is-highlighted" : ""}">
          <td><strong>${escapeHtml(m.province)}</strong></td>
          <td class="num-cell">${escapeHtml(formatRp(m.produsen_idr))}</td>
          <td class="num-cell">${escapeHtml(formatRp(m.tradisional_idr))}</td>
          <td class="num-cell"><strong>${escapeHtml(formatRp(m.modern_idr))}</strong></td>
          <td class="num-cell text-brand">+${escapeHtml(formatRp(m.spread_idr))} (${String(m.spread_pct).replace(".", ",")}%)</td>
        </tr>
      `).join("");

      const dateBadge = data.is_imputed_date
        ? badgeHtml("info", "Diisi dari hari sebelumnya", "dot")
        : badgeHtml("success", "Data teramati", "check");

      els.viewRoot.innerHTML = `
        <div class="filter-strip">
          <div class="controls-grid controls-row-between">
            <div class="controls-grid controls-row-center">
              <div class="field-group">
                <label class="field-label" for="compare-date-input">Tanggal Pantauan (${escapeHtml(formatDateId(data.date))})</label>
                <input
                  type="date"
                  id="compare-date-input"
                  class="input-control font-mono"
                  value="${escapeHtml(data.date)}"
                  min="${escapeHtml(data.min_date)}"
                  max="${escapeHtml(data.max_date)}"
                >
              </div>
              <div class="field-group">
                <span class="field-label">Status Laporan</span>
                ${dateBadge}
              </div>
            </div>
            <div>
              <div class="field-label">Selisih Harga Antarprovinsi</div>
              <div class="kpi-md text-alert">${escapeHtml(formatRp(data.disparity_idr))} / kg (${String(data.disparity_pct).replace(".", ",")}%)</div>
            </div>
          </div>
        </div>

        <div class="grid-compare-split">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Peringkat Harga (${escapeHtml(formatDateId(data.date))})</h2>
                <p class="card-desc">Pilih provinsi untuk menyorot posisi pada peta dan tabel di bawah. Rentang sumbu ${escapeHtml(formatRp(axisMin))} sampai ${escapeHtml(formatRp(axisMax))}.</p>
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
              <h2 class="card-title">Selisih Harga dari Produsen ke Pasar (${escapeHtml(formatDateId(data.date))})</h2>
              <p class="card-desc">Perbandingan langsung harga tingkat produsen, pasar tradisional, dan pasar modern di tanggal yang sama.</p>
            </div>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Provinsi</th>
                  <th>Produsen</th>
                  <th>Tradisional</th>
                  <th>Modern</th>
                  <th>Selisih Produsen ke Modern</th>
                </tr>
              </thead>
              <tbody>${marginRowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;

      const mapMount = document.getElementById("sulawesi-map-mount");
      renderSulawesiMap(mapMount, data.rankings, state.compare.selectedProvince, (prov) => {
        state.compare.selectedProvince = prov;
        renderBandingkan();
      });

      els.viewRoot.querySelectorAll("[data-bar-prov]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.compare.selectedProvince = btn.getAttribute("data-bar-prov");
          renderBandingkan();
        });
      });

      document.getElementById("compare-date-input").addEventListener("change", (ev) => {
        if (ev.target.value) {
          state.compare.date = ev.target.value;
          renderBandingkan();
        }
      });
    } catch (err) {
      renderError(els.viewRoot, err.message, renderBandingkan);
    }
  }

  async function renderPrakiraan() {
    renderLoading(els.viewRoot, "Memuat prediksi harga dan perbandingan akurasi...");
    try {
      const f = state.forecasts;
      const data = await apiGet(
        `/api/forecasts?segment=${encodeURIComponent(state.segment)}&province=${encodeURIComponent(f.province)}&horizon=${f.horizon}&model=${encodeURIComponent(f.model)}`
      );

      const selEval = data.model_comparison.find((m) => m.model_name === f.model) || data.model_comparison[0];
      const finalPt = data.forecast_points[data.forecast_points.length - 1];

      const evalRowsHtml = data.model_comparison.map((m) => `
        <tr class="${m.is_selected ? "is-highlighted" : ""}">
          <td>
            <strong>${escapeHtml(m.model_label)}</strong>
            ${m.is_best_mae ? ` ${badgeHtml("success", "Selisih Terkecil", "check")}` : ""}
          </td>
          <td class="num-cell">${escapeHtml(formatRpDecimal(m.eval_mae, 2))}</td>
          <td class="num-cell">${String(m.eval_mape.toFixed(2)).replace(".", ",")}%</td>
          <td class="num-cell">${escapeHtml(formatRp(m.final_pred_idr))}</td>
          <td class="num-cell">${escapeHtml(formatRp(m.final_lower_idr))} - ${escapeHtml(formatRp(m.final_upper_idr))}</td>
        </tr>
      `).join("");

      els.viewRoot.innerHTML = `
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
                  <button type="button" class="seg-btn ${f.horizon === hVal ? "is-active" : ""}" aria-pressed="${f.horizon === hVal ? "true" : "false"}" data-fc-horizon="${hVal}">${hVal} Minggu</button>
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
                  <button type="button" class="seg-btn ${f.model === mKey ? "is-active" : ""}" aria-pressed="${f.model === mKey ? "true" : "false"}" data-fc-model="${mKey}">${mLbl}</button>
                `).join("")}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">${escapeHtml(data.province)}: Perkiraan +${f.horizon} Minggu di ${escapeHtml(formatRp(finalPt.predicted_idr))}</h2>
              <p class="card-desc">
                Target ${escapeHtml(formatDateId(finalPt.target_date))} · Rentang perkiraan wajar 90%: ${escapeHtml(formatRp(finalPt.lower_idr))} sampai ${escapeHtml(formatRp(finalPt.upper_idr))}.
              </p>
            </div>
            ${badgeHtml("success", `${data.selected_model_label} · Rata-rata galat ${String(selEval.eval_mape.toFixed(2)).replace(".", ",")}%`, "dot")}
          </div>
          <div id="fc-chart-mount"></div>
        </div>

        <div class="grid-forecast-split">
          <div class="card">
            <div>
              <h2 class="card-title">Perbandingan Akurasi Metode (Jan 2025 - Feb 2026)</h2>
              <p class="card-desc">MAE menunjukkan rata-rata selisih prediksi dalam Rupiah per kg; MAPE menunjukkan persentase selisih rata-rata.</p>
            </div>
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Metode</th>
                    <th>MAE (Rp/kg)</th>
                    <th>MAPE</th>
                    <th>Prediksi +${f.horizon}M</th>
                    <th>Rentang Wajar 90%</th>
                  </tr>
                </thead>
                <tbody>${evalRowsHtml}</tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">Cara Membaca Prediksi Ini</h2>
            <p class="card-desc">
              Pada saluran ini, harga ${escapeHtml(data.province)} tercatat berubah pada <strong>${formatInt(data.change_days)}</strong> dari ${formatInt(data.total_days)} hari kalender sehingga grafiknya sering membentuk tangga datar.
            </p>
            <p class="card-desc">
              Angka prediksi adalah estimasi statistik untuk membantu perencanaan belanja atau stok usaha, bukan jaminan harga jual di lapangan.
            </p>
            <a class="btn btn-secondary" href="#artikel/cara-membaca-prediksi-harga-beras-untuk-belanja-dan-usaha">Baca Panduan Lengkap Prediksi</a>
          </div>
        </div>
      `;

      renderForecastChart(document.getElementById("fc-chart-mount"), data);

      document.getElementById("fc-prov-select").addEventListener("change", (ev) => {
        state.forecasts.province = ev.target.value;
        renderPrakiraan();
      });
      els.viewRoot.querySelectorAll("[data-fc-horizon]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.forecasts.horizon = Number(btn.getAttribute("data-fc-horizon"));
          renderPrakiraan();
        });
      });
      els.viewRoot.querySelectorAll("[data-fc-model]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.forecasts.model = btn.getAttribute("data-fc-model");
          renderPrakiraan();
        });
      });
    } catch (err) {
      renderError(els.viewRoot, err.message, renderPrakiraan);
    }
  }

  async function renderKualitas() {
    renderLoading(els.viewRoot, "Memuat catatan kelengkapan tanggal dan anomali...");
    try {
      const q = state.quality;
      const data = await apiGet(
        `/api/quality?segment=${encodeURIComponent(state.segment)}&province=${encodeURIComponent(q.province)}`
      );
      const etl = data.etl;

      const r3Html = q.province === "all"
        ? `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Sulsel</th>
                  <th>Sulteng</th>
                  <th>Cakupan</th>
                  <th>Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody>
                ${data.imputed_rows.map((r) => `
                  <tr>
                    <td class="num-cell">${escapeHtml(formatDateId(r.price_date))}</td>
                    <td class="num-cell">${escapeHtml(formatRp(r.sulsel_idr))}</td>
                    <td class="num-cell">${escapeHtml(formatRp(r.sulteng_idr))}</td>
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
                  <th>Harga Diisi</th>
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

      els.viewRoot.innerHTML = `
        <div class="filter-strip">
          <div class="controls-grid controls-row-between">
            <div class="field-group">
              <label class="field-label" for="quality-prov-select">Saring Provinsi</label>
              <select id="quality-prov-select" class="select-control">
                <option value="all" ${q.province === "all" ? "selected" : ""}>Semua 6 Provinsi Sulawesi</option>
                ${ALL_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${q.province === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>
            <div class="section-note font-mono">
              ${escapeHtml(etl.label)} · ${escapeHtml(formatDateId(etl.min_date))} s/d ${escapeHtml(formatDateId(etl.max_date))}
            </div>
          </div>
        </div>

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
            ${r3Html}
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Perubahan Harian di Atas 10%</h2>
                <p class="card-desc">Kenaikan atau penurunan tajam tetap ditampilkan apa adanya dengan status perlu verifikasi.</p>
              </div>
            </div>
            <div id="r5-anomaly-mount"></div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Catatan Temuan Data</h2>
          <ul class="alert-list">
            ${data.investigation_notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
          </ul>
          <p class="scope-footnote">
            Cakupan sumber: PIHPS Bank Indonesia (1 Jan 2022 s/d 12 Feb 2026) untuk komoditas beras rata-rata tingkat provinsi tanpa rincian merek/varietas.
          </p>
        </div>
      `;

      const r5Mount = document.getElementById("r5-anomaly-mount");
      if (!data.anomalies.length) {
        renderEmpty(
          r5Mount,
          "Tidak ada lonjakan > 10% pada filter ini",
          `Saluran ${etl.label} untuk ${q.province === "all" ? "Sulawesi" : q.province} tidak mencatat perubahan harian di atas 10%.`,
          "Reset Filter",
          () => {
            state.quality.province = "all";
            renderKualitas();
          }
        );
      } else {
        r5Mount.innerHTML = `
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Provinsi</th>
                  <th>Sebelum</th>
                  <th>Sesudah</th>
                  <th>&Delta; Harian</th>
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

      document.getElementById("quality-prov-select").addEventListener("change", (ev) => {
        state.quality.province = ev.target.value;
        renderKualitas();
      });
      els.viewRoot.querySelectorAll("[data-jump-date]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.compare.date = btn.getAttribute("data-jump-date");
          navigateTo("bandingkan");
        });
      });
    } catch (err) {
      renderError(els.viewRoot, err.message, renderKualitas);
    }
  }

  async function renderUnduh() {
    renderLoading(els.viewRoot, "Menyiapkan pratinjau ekspor CSV...");
    try {
      const cfg = state.exportCfg;
      cfg.segment = state.segment;
      const provParam = cfg.provinces.length === 6 ? "all" : cfg.provinces.join(",");
      const qs = `segment=${encodeURIComponent(cfg.segment)}&provinces=${encodeURIComponent(provParam)}&from=${encodeURIComponent(cfg.from)}&to=${encodeURIComponent(cfg.to)}&shape=${encodeURIComponent(cfg.shape)}&include_flags=${cfg.includeFlags ? "1" : "0"}`;
      const prev = await apiGet(`/api/export?${qs}&preview=1`);

      els.viewRoot.innerHTML = `
        <div class="grid-export-split">
          <form class="card" id="export-form">
            <h2 class="card-title">Pengaturan Unduhan</h2>

            <div class="field-group">
              <label class="field-label" for="exp-segment">Saluran Pasar</label>
              <select id="exp-segment" class="select-control">
                <option value="modern" ${cfg.segment === "modern" ? "selected" : ""}>Pasar Modern</option>
                <option value="tradisional" ${cfg.segment === "tradisional" ? "selected" : ""}>Pasar Tradisional</option>
                <option value="produsen" ${cfg.segment === "produsen" ? "selected" : ""}>Tingkat Produsen</option>
              </select>
            </div>

            <div class="field-group">
              <span class="field-label">Cakupan Provinsi (minimal 1)</span>
              <div class="chip-list">
                ${ALL_PROVINCES.map((p) => `
                  <label class="check-label">
                    <input type="checkbox" name="exp_prov" value="${escapeHtml(p)}" ${cfg.provinces.includes(p) ? "checked" : ""}>
                    <span>${escapeHtml(p)}</span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="grid-2col">
              <div class="field-group">
                <label class="field-label" for="exp-from">Dari Tanggal</label>
                <input type="date" id="exp-from" class="input-control font-mono" value="${escapeHtml(prev.start_date)}" min="2022-01-01" max="2026-02-12">
              </div>
              <div class="field-group">
                <label class="field-label" for="exp-to">Sampai Tanggal</label>
                <input type="date" id="exp-to" class="input-control font-mono" value="${escapeHtml(prev.end_date)}" min="2022-01-01" max="2026-02-12">
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Bentuk Tabel CSV</span>
              <div class="segment-group" role="group" aria-label="Bentuk tabel CSV">
                <button type="button" class="seg-btn ${cfg.shape === "long" ? "is-active" : ""}" aria-pressed="${cfg.shape === "long" ? "true" : "false"}" data-exp-shape="long">Memanjang</button>
                <button type="button" class="seg-btn ${cfg.shape === "wide" ? "is-active" : ""}" aria-pressed="${cfg.shape === "wide" ? "true" : "false"}" data-exp-shape="wide">Melebar (per Provinsi)</button>
              </div>
              <span class="field-helper">Memanjang cocok untuk olah data lanjut; Melebar praktis dibuka langsung di Excel/Spreadsheet.</span>
            </div>

            <label class="check-label" for="exp-flags">
              <input type="checkbox" id="exp-flags" ${cfg.includeFlags ? "checked" : ""}>
              <span>Sertakan kolom penanda kualitas data</span>
            </label>

            <a class="btn btn-primary" href="/api/export?${qs}&preview=0" download="${escapeHtml(prev.filename)}" id="btn-download-csv">
              Unduh CSV (${formatInt(prev.total_rows)} baris)
            </a>
          </form>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Pratinjau 5 Baris Pertama</h2>
                <p class="card-desc">${formatInt(prev.total_rows)} baris siap unduh · ${escapeHtml(formatDateId(prev.start_date))} s/d ${escapeHtml(formatDateId(prev.end_date))}</p>
              </div>
              <span class="badge badge-neutral font-mono">${escapeHtml(prev.filename)}</span>
            </div>

            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>${prev.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>
                </thead>
                <tbody>
                  ${prev.rows.map((row) => `
                    <tr>${row.map((cell, ci) => `<td class="${ci === 0 || ci >= 2 ? "num-cell" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      document.getElementById("exp-segment").addEventListener("change", (ev) => {
        state.segment = ev.target.value;
        state.exportCfg.segment = ev.target.value;
        syncNavAndSegmentUI();
        renderUnduh();
      });

      els.viewRoot.querySelectorAll('input[name="exp_prov"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          const checked = [...els.viewRoot.querySelectorAll('input[name="exp_prov"]:checked')].map((el) => el.value);
          if (checked.length === 0) {
            cb.checked = true;
            return;
          }
          state.exportCfg.provinces = checked;
          renderUnduh();
        });
      });

      document.getElementById("exp-from").addEventListener("change", (ev) => {
        if (ev.target.value) {
          state.exportCfg.from = ev.target.value;
          renderUnduh();
        }
      });
      document.getElementById("exp-to").addEventListener("change", (ev) => {
        if (ev.target.value) {
          state.exportCfg.to = ev.target.value;
          renderUnduh();
        }
      });

      els.viewRoot.querySelectorAll("[data-exp-shape]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.exportCfg.shape = btn.getAttribute("data-exp-shape");
          renderUnduh();
        });
      });

      document.getElementById("exp-flags").addEventListener("change", (ev) => {
        state.exportCfg.includeFlags = ev.target.checked;
        renderUnduh();
      });
    } catch (err) {
      renderError(els.viewRoot, err.message, renderUnduh);
    }
  }

  function renderArticleCardsContent(filteredArticles) {
    if (!filteredArticles.length) {
      return `
        <div class="feedback-card">
          <h2 class="feedback-title">Artikel tidak ditemukan</h2>
          <p class="feedback-desc">Tidak ada artikel yang cocok dengan kata kunci atau kategori pilihan Anda.</p>
          <button type="button" class="btn btn-secondary" id="reset-article-filter-btn">Reset Pencarian</button>
        </div>
      `;
    }

    const [featured, ...rest] = filteredArticles;
    const featuredHtml = `
      <article class="article-featured">
        <div class="article-meta">
          <span class="article-category">${escapeHtml(featured.category)}</span>
          <span>${featured.readMinutes} menit baca</span>
          <span>Diperbarui ${escapeHtml(featured.updatedLabel)}</span>
        </div>
        <h2 class="article-featured-title">${escapeHtml(featured.title)}</h2>
        <p class="article-excerpt">${escapeHtml(featured.excerpt)}</p>
        <a class="btn btn-primary" href="#artikel/${escapeHtml(featured.slug)}">Baca Artikel Lengkap</a>
      </article>
    `;

    const restHtml = rest.length
      ? `
        <div class="grid-article-index">
          ${rest.map((art) => `
            <article class="article-card">
              <div class="article-card-body">
                <div class="article-meta">
                  <span class="article-category">${escapeHtml(art.category)}</span>
                  <span>${art.readMinutes} menit baca</span>
                </div>
                <h3 class="article-title">${escapeHtml(art.title)}</h3>
                <p class="article-excerpt">${escapeHtml(art.excerpt)}</p>
              </div>
              <a class="btn btn-secondary" href="#artikel/${escapeHtml(art.slug)}">Baca Artikel</a>
            </article>
          `).join("")}
        </div>
      `
      : "";

    return `${featuredHtml}${restHtml}`;
  }

  function renderArtikel(slug) {
    if (slug) {
      const article = ARTICLES.find((a) => a.slug === slug);
      if (!article) {
        renderEmpty(
          els.viewRoot,
          "Artikel tidak ditemukan",
          "Tautan artikel tidak tersedia atau telah dipindahkan. Silakan pilih artikel dari daftar utama.",
          "Kembali ke Daftar Artikel",
          () => navigateTo("artikel")
        );
        return;
      }

      const related = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 2);

      els.viewRoot.innerHTML = `
        <article class="article-reader">
          <nav class="breadcrumb" aria-label="Jejak halaman artikel">
            <a href="#artikel">Artikel</a>
            <span aria-hidden="true">/</span>
            <span>${escapeHtml(article.category)}</span>
          </nav>

          <div class="article-meta">
            <span class="article-category">${escapeHtml(article.category)}</span>
            <span>${article.readMinutes} menit baca</span>
            <span>Diperbarui ${escapeHtml(article.updatedLabel)}</span>
          </div>

          <div class="article-takeaways">
            <h2 class="article-takeaways-title">Poin Utama Artikel</h2>
            <ul class="alert-list">
              ${article.takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>

          <div class="article-prose">
            ${article.sections.map((sec) => `
              <section>
                <h2 class="article-section-heading">${escapeHtml(sec.heading)}</h2>
                ${sec.paragraphs.map((p) => `<p class="article-paragraph">${escapeHtml(p)}</p>`).join("")}
              </section>
            `).join("")}
          </div>

          <div class="article-cta-bar">
            <a class="btn btn-primary" href="#${escapeHtml(article.ctaRoute)}">${escapeHtml(article.ctaLabel)}</a>
            <a class="btn btn-secondary" href="#artikel">Kembali ke Daftar Artikel</a>
          </div>
        </article>

        <section class="editorial-section" aria-label="Artikel terkait lainnya">
          <div class="section-bar">
            <h2 class="section-heading">Artikel Lainnya di berasak.ai</h2>
          </div>
          <div class="grid-article-index">
            ${related.map((art) => `
              <article class="article-card">
                <div class="article-card-body">
                  <div class="article-meta">
                    <span class="article-category">${escapeHtml(art.category)}</span>
                    <span>${art.readMinutes} menit baca</span>
                  </div>
                  <h3 class="article-title">${escapeHtml(art.title)}</h3>
                  <p class="article-excerpt">${escapeHtml(art.excerpt)}</p>
                </div>
                <a class="btn btn-secondary" href="#artikel/${escapeHtml(art.slug)}">Baca Artikel</a>
              </article>
            `).join("")}
          </div>
        </section>
      `;
      return;
    }

    const categories = ["Semua", ...new Set(ARTICLES.map((a) => a.category))];
    const filterState = state.articlesFilter;

    const getFiltered = () => {
      const q = filterState.query.trim().toLowerCase();
      return ARTICLES.filter((a) => {
        const matchCat = filterState.category === "Semua" || a.category === filterState.category;
        const matchQuery = !q
          || a.title.toLowerCase().includes(q)
          || a.excerpt.toLowerCase().includes(q)
          || a.category.toLowerCase().includes(q);
        return matchCat && matchQuery;
      });
    };

    els.viewRoot.innerHTML = `
      <div class="article-filter-bar">
        <div class="controls-grid controls-row-between">
          <div class="field-group">
            <span class="field-label">Kategori Artikel</span>
            <div class="chip-list" id="article-cat-chips">
              ${categories.map((cat) => `
                <button type="button" class="chip-btn ${filterState.category === cat ? "is-active" : ""}" aria-pressed="${filterState.category === cat ? "true" : "false"}" data-art-cat="${escapeHtml(cat)}">
                  ${escapeHtml(cat)}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="field-group article-search-group">
            <label class="field-label" for="article-search-input">Cari Artikel</label>
            <input
              type="search"
              id="article-search-input"
              class="input-control"
              placeholder="Cari topik, misal: prediksi atau pasar..."
              value="${escapeHtml(filterState.query)}"
            >
          </div>
        </div>
      </div>

      <div id="articles-list-mount"></div>
    `;

    const listMount = document.getElementById("articles-list-mount");
    const updateArticleList = () => {
      listMount.innerHTML = renderArticleCardsContent(getFiltered());
      const resetBtn = document.getElementById("reset-article-filter-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          filterState.category = "Semua";
          filterState.query = "";
          renderArtikel(null);
        });
      }
    };

    updateArticleList();

    els.viewRoot.querySelectorAll("[data-art-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterState.category = btn.getAttribute("data-art-cat");
        els.viewRoot.querySelectorAll("[data-art-cat]").forEach((other) => {
          const isAct = other === btn;
          other.classList.toggle("is-active", isAct);
          other.setAttribute("aria-pressed", isAct ? "true" : "false");
        });
        updateArticleList();
      });
    });

    const searchInput = document.getElementById("article-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (ev) => {
        filterState.query = ev.target.value;
        updateArticleList();
      });
    }
  }

  function renderPanduan() {
    const steps = [
      {
        num: "01",
        title: "Pilih Saluran Pasar",
        desc: "Di bagian atas halaman data, pilih Pasar Modern (supermarket), Pasar Tradisional (pasar rakyat), atau Tingkat Produsen (penggilingan) sesuai kebutuhan Anda.",
        ctaLabel: "Buka Beranda",
        ctaHref: "#beranda",
      },
      {
        num: "02",
        title: "Cek Provinsi & Estimasi Belanja",
        desc: "Gunakan kotak Cek Cepat di Beranda untuk memilih provinsi tempat tinggal Anda dan melihat perkiraan biaya kemasan 1 kg hingga 50 kg.",
        ctaLabel: "Bandingkan Wilayah",
        ctaHref: "#bandingkan",
      },
      {
        num: "03",
        title: "Baca Tren & Perkiraan Ke Depan",
        desc: "Buka halaman Tren untuk melihat riwayat harian atau bulanan, dan buka halaman Prediksi untuk melihat perkiraan 4 sampai 8 minggu ke depan.",
        ctaLabel: "Lihat Grafik Tren",
        ctaHref: "#tren",
      },
    ];

    const glossary = [
      {
        term: "Pasar Modern",
        desc: "Harga beras eceran yang dipantau di gerai ritel modern seperti supermarket atau minimarket.",
      },
      {
        term: "Pasar Tradisional",
        desc: "Harga beras harian yang tercatat di pasar rakyat atau pasar tradisional setempat.",
      },
      {
        term: "Tingkat Produsen",
        desc: "Harga beras di tingkat penggilingan padi atau distributor awal sebelum biaya kirim eceran.",
      },
      {
        term: "Selisih Harga Antarprovinsi",
        desc: "Jarak Rupiah per kilogram antara provinsi dengan harga termahal dan termurah di Sulawesi.",
      },
      {
        term: "Rata-rata 4 Minggu (MA 4W)",
        desc: "Garis bantu yang meratakan fluktuasi singkat agar arah pergerakan harga lebih mudah terbaca.",
      },
      {
        term: "Rentang Wajar 90%",
        desc: "Batas perkiraan bawah hingga atas pada grafik Prediksi sebagai gambaran ruang gerak harga.",
      },
      {
        term: "Hari Tanpa Laporan (Diisi Otomatis)",
        desc: "Tanggal yang tidak memiliki pembaruan laporan (misalnya hari libur), diisi dari harga hari sebelumnya dan tetap ditandai.",
      },
      {
        term: "Lonjakan Harian >10%",
        desc: "Perubahan harga lebih dari sepuluh persen dalam satu hari yang diberi tanda khusus untuk verifikasi terbuka.",
      },
    ];

    const faqs = [
      {
        q: "Apakah angka di berasak.ai adalah harga satu merek beras tertentu?",
        a: "Bukan. Angka pada berasak.ai merupakan harga rata-rata komoditas beras tingkat provinsi dari Pusat Informasi Harga Pangan Strategis (PIHPS) Bank Indonesia tanpa merinci merek atau varietas tertentu.",
      },
      {
        q: "Mengapa harga di warung dekat rumah bisa berbeda dari angka di layar?",
        a: "Harga di tingkat toko sangat dipengaruhi merek beras (medium atau premium), kemasan eceran, dan ongkos angkut setempat. Data berasak.ai paling tepat digunakan sebagai patokan tren dan perbandingan antarwilayah.",
      },
      {
        q: "Apakah grafik Prediksi menjamin harga pasti di masa depan?",
        a: "Tidak. Prediksi dibuat secara statistik dari riwayat mingguan sebelumnya untuk membantu perkiraan anggaran dan stok. Selalu perhatikan rentang wajar 90% dan kondisi pasokan terbaru.",
      },
      {
        q: "Bisakah masyarakat atau mahasiswa mengunduh datanya secara gratis?",
        a: "Ya. Buka menu Data lalu pilih Unduh Data CSV. Anda dapat memilih provinsi, rentang tanggal 2022 sampai 2026, serta bentuk tabel memanjang atau melebar sebelum mengunduh.",
      },
    ];

    els.viewRoot.innerHTML = `
      <section class="editorial-section" aria-label="Langkah cepat memakai berasak.ai">
        <div class="section-bar">
          <h2 class="section-heading">Mulai dalam 3 Langkah Sederhana</h2>
          <span class="section-note">Dirancang untuk pembaca umum tanpa latar belakang statistik</span>
        </div>
        <div class="grid-3col">
          ${steps.map((s) => `
            <div class="card">
              <span class="guide-step-num">${s.num}</span>
              <h3 class="card-title">${escapeHtml(s.title)}</h3>
              <p class="card-desc">${escapeHtml(s.desc)}</p>
              <a class="btn btn-secondary" href="${s.ctaHref}">${escapeHtml(s.ctaLabel)}</a>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="editorial-section" aria-label="Kamus istilah sederhana">
        <div class="section-bar">
          <h2 class="section-heading">Kamus Istilah Sederhana</h2>
          <span class="section-note">Penjelasan singkat istilah yang muncul di grafik dan tabel</span>
        </div>
        <div class="glossary-grid">
          ${glossary.map((item) => `
            <div class="glossary-item">
              <h3 class="glossary-term">${escapeHtml(item.term)}</h3>
              <p class="glossary-def">${escapeHtml(item.desc)}</p>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="editorial-section" aria-label="Pertanyaan yang sering diajukan">
        <div class="section-bar">
          <h2 class="section-heading">Pertanyaan yang Sering Diajukan</h2>
          <span class="section-note">Klik pertanyaan untuk membuka jawaban</span>
        </div>
        <div class="faq-list">
          ${faqs.map((item) => `
            <details class="faq-item">
              <summary class="faq-summary">
                <span>${escapeHtml(item.q)}</span>
                <svg class="faq-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"></path>
                </svg>
              </summary>
              <p class="faq-body">${escapeHtml(item.a)}</p>
            </details>
          `).join("")}
        </div>
      </section>

      <section class="support-strip" aria-label="Masih ada pertanyaan">
        <div>
          <h2 class="card-title">Masih ada hal yang ingin ditanyakan?</h2>
          <p class="card-desc">Tim layanan pengguna kami siap membantu melalui email atau telepon resmi.</p>
        </div>
        <a class="btn btn-primary" href="#kontak">Buka Halaman Kontak</a>
      </section>
    `;
  }

  async function copyToClipboard(text, statusEl, successMessage) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        statusEl.textContent = successMessage;
        return;
      }
    } catch (_) {
      // Fallback below when clipboard API is restricted on non-HTTPS origins
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "sr-only";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      statusEl.textContent = successMessage;
    } catch (_) {
      statusEl.textContent = `Salin manual: ${text}`;
    } finally {
      document.body.removeChild(ta);
    }
  }

  function renderKontak() {
    els.viewRoot.innerHTML = `
      <div class="grid-contact-split">
        <div class="card">
          <div>
            <h2 class="card-title">Saluran Resmi Layanan Pengguna</h2>
            <p class="card-desc">Gunakan kontak resmi berasak.ai berikut untuk pertanyaan seputar pembacaan data, laporan kendala halaman, atau masukan publik.</p>
          </div>

          <div class="contact-channel-card">
            <span class="field-label">Email Layanan Pelanggan</span>
            <a class="contact-value" href="mailto:${CONTACT_INFO.email}">${CONTACT_INFO.email}</a>
            <div class="contact-channel-actions">
              <a class="btn btn-secondary" href="mailto:${CONTACT_INFO.email}">Kirim Email</a>
              <button type="button" class="btn btn-ghost" id="copy-email-btn">Salin Email</button>
              <span class="copy-feedback" id="copy-email-status" aria-live="polite"></span>
            </div>
          </div>

          <div class="contact-channel-card">
            <span class="field-label">Telepon Layanan Pelanggan</span>
            <a class="contact-value" href="${CONTACT_INFO.phoneHref}">${CONTACT_INFO.phoneDisplay}</a>
            <div class="contact-channel-actions">
              <a class="btn btn-secondary" href="${CONTACT_INFO.phoneHref}">Hubungi Telepon</a>
              <button type="button" class="btn btn-ghost" id="copy-phone-btn">Salin Nomor</button>
              <span class="copy-feedback" id="copy-phone-status" aria-live="polite"></span>
            </div>
          </div>

          <p class="scope-footnote">
            Seluruh data harga pada berasak.ai bersumber dari PIHPS Bank Indonesia (cakupan 1 Jan 2022 s/d 12 Feb 2026) untuk enam provinsi Pulau Sulawesi.
          </p>
        </div>

        <div class="card">
          <div>
            <h2 class="card-title">Kirim Pesan atau Pertanyaan</h2>
            <p class="card-desc">Siapkan pesan Anda di sini, lalu lanjutkan mengirim langsung melalui aplikasi email perangkat Anda.</p>
          </div>

          <div class="form-error-summary" id="contact-error-summary" tabindex="-1" role="alert" hidden>
            <h3 class="form-error-title">Periksa kembali isian berikut:</h3>
            <ul class="form-error-list" id="contact-error-list"></ul>
          </div>

          <form id="contact-form" novalidate>
            <div class="field-group">
              <label class="field-label" for="contact-name">Nama Lengkap <span aria-hidden="true">*</span></label>
              <input
                type="text"
                id="contact-name"
                name="name"
                class="input-control"
                autocomplete="name"
                placeholder="Contoh: Andi Pratama"
                aria-describedby="contact-name-help contact-name-error"
                required
              >
              <span class="field-helper" id="contact-name-help">Isi nama Anda atau instansi/komunitas.</span>
              <span class="field-error" id="contact-name-error" hidden></span>
            </div>

            <div class="field-group">
              <label class="field-label" for="contact-email">Alamat Email <span aria-hidden="true">*</span></label>
              <input
                type="email"
                id="contact-email"
                name="email"
                class="input-control"
                autocomplete="email"
                placeholder="nama@contoh.com"
                aria-describedby="contact-email-help contact-email-error"
                required
              >
              <span class="field-helper" id="contact-email-help">Alamat email ini dicantumkan sebagai pengirim saat membuka email Anda.</span>
              <span class="field-error" id="contact-email-error" hidden></span>
            </div>

            <div class="field-group">
              <label class="field-label" for="contact-topic">Topik Pesan <span aria-hidden="true">*</span></label>
              <select
                id="contact-topic"
                name="topic"
                class="select-control"
                aria-describedby="contact-topic-error"
                required
              >
                <option value="Pertanyaan Pembacaan Data">Pertanyaan Pembacaan Data</option>
                <option value="Laporan Kendala Situs">Laporan Kendala Situs</option>
                <option value="Permintaan Informasi Dataset">Permintaan Informasi Dataset</option>
                <option value="Masukan & Saran Publik">Masukan &amp; Saran Publik</option>
              </select>
              <span class="field-error" id="contact-topic-error" hidden></span>
            </div>

            <div class="field-group">
              <label class="field-label" for="contact-message">Pesan Anda <span aria-hidden="true">*</span></label>
              <textarea
                id="contact-message"
                name="message"
                class="textarea-control"
                placeholder="Tuliskan pertanyaan, provinsi yang dimaksud, atau masukan Anda secara jelas..."
                aria-describedby="contact-message-help contact-message-error"
                required
              ></textarea>
              <span class="field-helper" id="contact-message-help">Minimal 10 karakter agar tim kami memahami kebutuhan Anda.</span>
              <span class="field-error" id="contact-message-error" hidden></span>
            </div>

            <div class="form-actions-row">
              <button type="submit" class="btn btn-primary" id="contact-submit-btn">Siapkan Pesan Email</button>
              <button type="reset" class="btn btn-secondary" id="contact-reset-btn">Kosongkan Formulir</button>
            </div>
          </form>

          <div class="contact-result-card" id="contact-result-mount" hidden role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    const copyEmailBtn = document.getElementById("copy-email-btn");
    const copyEmailStatus = document.getElementById("copy-email-status");
    const copyPhoneBtn = document.getElementById("copy-phone-btn");
    const copyPhoneStatus = document.getElementById("copy-phone-status");

    if (copyEmailBtn && copyEmailStatus) {
      copyEmailBtn.addEventListener("click", () => {
        copyToClipboard(CONTACT_INFO.email, copyEmailStatus, "Email tersalin.");
      });
    }
    if (copyPhoneBtn && copyPhoneStatus) {
      copyPhoneBtn.addEventListener("click", () => {
        copyToClipboard(CONTACT_INFO.phoneDisplay, copyPhoneStatus, "Nomor telepon tersalin.");
      });
    }

    const form = document.getElementById("contact-form");
    const errorSummary = document.getElementById("contact-error-summary");
    const errorList = document.getElementById("contact-error-list");
    const resultMount = document.getElementById("contact-result-mount");

    const fields = {
      name: {
        input: document.getElementById("contact-name"),
        err: document.getElementById("contact-name-error"),
        validate: (v) => (v.trim().length >= 2 ? "" : "Nama lengkap wajib diisi minimal 2 huruf."),
      },
      email: {
        input: document.getElementById("contact-email"),
        err: document.getElementById("contact-email-error"),
        validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Masukkan alamat email yang valid (contoh: nama@domain.com)."),
      },
      topic: {
        input: document.getElementById("contact-topic"),
        err: document.getElementById("contact-topic-error"),
        validate: (v) => (v.trim() ? "" : "Pilih topik pesan."),
      },
      message: {
        input: document.getElementById("contact-message"),
        err: document.getElementById("contact-message-error"),
        validate: (v) => (v.trim().length >= 10 ? "" : "Pesan minimal 10 karakter agar konteksnya jelas."),
      },
    };

    const setFieldError = (key, msg) => {
      const f = fields[key];
      if (!f) return;
      if (msg) {
        f.input.classList.add("is-invalid");
        f.input.setAttribute("aria-invalid", "true");
        f.err.textContent = msg;
        f.err.hidden = false;
      } else {
        f.input.classList.remove("is-invalid");
        f.input.removeAttribute("aria-invalid");
        f.err.textContent = "";
        f.err.hidden = true;
      }
    };

    Object.keys(fields).forEach((key) => {
      const f = fields[key];
      f.input.addEventListener("blur", () => {
        setFieldError(key, f.validate(f.input.value));
      });
      f.input.addEventListener("input", () => {
        if (!f.err.hidden) {
          setFieldError(key, f.validate(f.input.value));
        }
      });
    });

    form.addEventListener("reset", () => {
      Object.keys(fields).forEach((key) => setFieldError(key, ""));
      errorSummary.hidden = true;
      errorList.innerHTML = "";
      resultMount.hidden = true;
      resultMount.innerHTML = "";
    });

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const errors = [];
      Object.keys(fields).forEach((key) => {
        const msg = fields[key].validate(fields[key].input.value);
        setFieldError(key, msg);
        if (msg) {
          errors.push({ id: fields[key].input.id, msg });
        }
      });

      if (errors.length) {
        errorList.innerHTML = errors.map((e) => `<li><a href="#${escapeHtml(e.id)}">${escapeHtml(e.msg)}</a></li>`).join("");
        errorSummary.hidden = false;
        resultMount.hidden = true;
        errorSummary.querySelectorAll("a").forEach((a) => {
          a.addEventListener("click", (linkEv) => {
            linkEv.preventDefault();
            const target = document.getElementById(a.getAttribute("href").slice(1));
            if (target) target.focus();
          });
        });
        errorSummary.focus();
        return;
      }

      errorSummary.hidden = true;
      const nameVal = fields.name.input.value.trim();
      const emailVal = fields.email.input.value.trim();
      const topicVal = fields.topic.input.value.trim();
      const msgVal = fields.message.input.value.trim();

      const subject = `[berasak.ai] ${topicVal} - ${nameVal}`;
      const bodyText = `Nama: ${nameVal}\nEmail Pengirim: ${emailVal}\nTopik: ${topicVal}\n\nPesan:\n${msgVal}`;
      const mailtoHref = `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      form.hidden = true;
      resultMount.hidden = false;
      resultMount.innerHTML = `
        <h3 class="card-title">Draf Pesan Siap Dikirim</h3>
        <p class="card-desc">
          Portal web ini tidak mengirim email otomatis langsung dari server. Klik tombol di bawah untuk membuka aplikasi email Anda dengan tujuan
          <strong class="font-mono">${CONTACT_INFO.email}</strong>, atau salin teks pesan untuk dikirim secara manual.
        </p>
        <div class="contact-channel-actions">
          <a class="btn btn-primary" href="${mailtoHref}">Buka di Aplikasi Email</a>
          <button type="button" class="btn btn-secondary" id="copy-draft-btn">Salin Isi Pesan</button>
          <button type="button" class="btn btn-ghost" id="new-draft-btn">Tulis Pesan Baru</button>
        </div>
        <span class="copy-feedback" id="copy-draft-status" aria-live="polite"></span>
      `;

      const copyDraftBtn = document.getElementById("copy-draft-btn");
      const copyDraftStatus = document.getElementById("copy-draft-status");
      const newDraftBtn = document.getElementById("new-draft-btn");

      if (copyDraftBtn && copyDraftStatus) {
        copyDraftBtn.addEventListener("click", () => {
          copyToClipboard(`Kepada: ${CONTACT_INFO.email}\nSubjek: ${subject}\n\n${bodyText}`, copyDraftStatus, "Draf pesan tersalin.");
        });
      }
      if (newDraftBtn) {
        newDraftBtn.addEventListener("click", () => {
          form.hidden = false;
          form.reset();
          fields.name.input.focus();
        });
      }
    });
  }

  async function renderCurrentRoute() {
    syncNavAndSegmentUI();
    closeMobileDrawer(false);
    setDataDropdownOpen(false);
    if (state.route === "beranda") return renderBeranda();
    if (state.route === "tren") return renderTren();
    if (state.route === "bandingkan") return renderBandingkan();
    if (state.route === "prakiraan") return renderPrakiraan();
    if (state.route === "kualitas") return renderKualitas();
    if (state.route === "unduh") return renderUnduh();
    if (state.route === "artikel") return renderArtikel(state.articleSlug);
    if (state.route === "panduan") return renderPanduan();
    if (state.route === "kontak") return renderKontak();
    return renderBeranda();
  }

  async function bootstrap() {
    applyTheme(state.theme);

    if (els.themeBtn) els.themeBtn.addEventListener("click", toggleTheme);
    if (els.menuBtn) els.menuBtn.addEventListener("click", openMobileDrawer);
    if (els.drawerCloseBtn) els.drawerCloseBtn.addEventListener("click", () => closeMobileDrawer(true));
    if (els.backdrop) els.backdrop.addEventListener("click", () => closeMobileDrawer(true));

    if (els.dataMenuBtn && els.dataMenu) {
      els.dataMenuBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const isExpanded = els.dataMenuBtn.getAttribute("aria-expanded") === "true";
        setDataDropdownOpen(!isExpanded);
      });
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
        renderCurrentRoute();
      });
    });

    window.addEventListener("hashchange", () => {
      const parsed = parseRouteFromHash();
      state.route = parsed.route;
      state.articleSlug = parsed.articleSlug;
      renderCurrentRoute();
      scrollWindowToTop();
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
    renderCurrentRoute();
  }

  bootstrap();
})();
