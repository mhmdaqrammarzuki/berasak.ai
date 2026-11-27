window.PBS = window.PBS || {};

(function () {
  const {
    apiGet,
    formatInt,
    formatDateId,
    escapeHtml,
    renderLoading,
    renderError,
    renderEmpty,
    ARTICLES = [],
  } = window.PBS;

  const MIN_DATA_DATE = "2022-01-01";
  const MAX_DATA_DATE = "2026-02-12";

  const EXPORT_COL_LABELS = {
    tanggal: "Tanggal",
    provinsi: "Provinsi",
    harga_rp_per_kg: "Harga (Rp/kg)",
    pct_change_harian: "Perubahan (%)",
    is_imputed: "Imputasi",
    is_anomaly: "Lonjakan",
    tahun: "Tahun",
    bulan: "Bulan",
    jumlah_imputasi_tanggal: "Jml Imputasi",
  };

  const SLUG_ALIASES = {
    "cara-membaca-prediksi-harga-beras-untuk-belanja-dan-usaha": "cara-memanfaatkan-prediksi-harga-ai-untuk-belanja",
    "strategi-praktis-mengelola-stok-beras-saat-harga-berfluktuasi": "tips-trik-belanja-dan-menyimpan-beras-hemat-anti-kutu",
    "mengenal-sumber-data-pihps-dan-cara-membaca-anomali": "langkah-pemerintah-menjaga-stabilitas-harga-beras",
  };

  function buildExportQuery(cfg) {
    const provParam = cfg.provinces.length === 6 ? "all" : cfg.provinces.join(",");
    return `segment=${encodeURIComponent(cfg.segment)}&provinces=${encodeURIComponent(provParam)}&from=${encodeURIComponent(cfg.from)}&to=${encodeURIComponent(cfg.to)}&shape=${encodeURIComponent(cfg.shape)}&include_flags=${cfg.includeFlags ? "1" : "0"}`;
  }

  function clampDataDate(dateStr, fallback) {
    if (!dateStr || typeof dateStr !== "string") return fallback;
    if (dateStr < MIN_DATA_DATE) return MIN_DATA_DATE;
    if (dateStr > MAX_DATA_DATE) return MAX_DATA_DATE;
    return dateStr;
  }

  function syncExportFormUI() {
    const { state, els } = window.PBS.app;
    const cfg = state.exportCfg;
    const segSel = document.getElementById("exp-segment");
    if (segSel && segSel.value !== cfg.segment) segSel.value = cfg.segment;

    const fromEl = document.getElementById("exp-from");
    const toEl = document.getElementById("exp-to");
    if (fromEl && fromEl.value !== cfg.from) fromEl.value = cfg.from;
    if (toEl && toEl.value !== cfg.to) toEl.value = cfg.to;

    const fromLabel = document.getElementById("exp-from-label");
    const toLabel = document.getElementById("exp-to-label");
    if (fromLabel) fromLabel.textContent = `Dari Tanggal (${formatDateId(cfg.from)})`;
    if (toLabel) toLabel.textContent = `Sampai Tanggal (${formatDateId(cfg.to)})`;

    els.viewRoot.querySelectorAll('input[name="exp_prov"]').forEach((cb) => {
      cb.checked = cfg.provinces.includes(cb.value);
    });
    els.viewRoot.querySelectorAll("[data-exp-shape]").forEach((btn) => {
      const act = btn.getAttribute("data-exp-shape") === cfg.shape;
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-pressed", act ? "true" : "false");
    });
    const flagsEl = document.getElementById("exp-flags");
    if (flagsEl) flagsEl.checked = cfg.includeFlags;
  }

  async function loadExportPreview() {
    const { state } = window.PBS.app;
    const previewMount = document.getElementById("export-preview-mount");
    const dlBtn = document.getElementById("btn-download-csv");
    if (!previewMount) return;

    const cfg = state.exportCfg;
    const qs = buildExportQuery(cfg);

    const hadResults = previewMount.children.length > 0 && !previewMount.querySelector(".feedback-card");
    if (hadResults) {
      previewMount.classList.add("panel-loading");
    } else {
      renderLoading(previewMount, "Menyiapkan pratinjau ekspor CSV...");
    }

    try {
      const prev = await apiGet(`/api/export?${qs}&preview=1`);
      previewMount.classList.remove("panel-loading");

      if (dlBtn) {
        dlBtn.href = `/api/export?${qs}&preview=0`;
        dlBtn.setAttribute("download", prev.filename);
        dlBtn.textContent = `Unduh CSV (${formatInt(prev.total_rows)} baris)`;
      }

      const colLabels = prev.columns.map((c) => EXPORT_COL_LABELS[c] || c);
      const isNumCol = (colName) => colName !== "provinsi";

      previewMount.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Pratinjau 5 Baris Pertama</h2>
              <p class="card-desc">${escapeHtml(formatInt(prev.total_rows))} baris siap unduh · ${escapeHtml(formatDateId(prev.start_date))} s/d ${escapeHtml(formatDateId(prev.end_date))}</p>
            </div>
            <span class="badge badge-neutral font-mono">${escapeHtml(prev.filename)}</span>
          </div>

          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>${prev.columns.map((c, ci) => `<th scope="col" class="${isNumCol(c) ? "num-head" : ""}">${escapeHtml(colLabels[ci])}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${prev.rows && prev.rows.length
                  ? prev.rows.map((row) => `
                    <tr>${row.map((cell, ci) => `<td class="${isNumCol(prev.columns[ci]) ? "num-cell" : ""}">${escapeHtml(cell == null ? "-" : String(cell))}</td>`).join("")}</tr>
                  `).join("")
                  : `<tr><td colspan="${prev.columns.length}" class="text-muted">Tidak ada baris data pada rentang tanggal dan filter pilihan Anda.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      previewMount.classList.remove("panel-loading");
      renderError(previewMount, err.message, loadExportPreview);
    }
  }

  async function renderUnduh() {
    const { state, els, ALL_PROVINCES, safeStorageSet, syncNavAndSegmentUI } = window.PBS.app;
    const cfg = state.exportCfg;
    cfg.segment = state.segment;
    cfg.from = clampDataDate(cfg.from, MIN_DATA_DATE);
    cfg.to = clampDataDate(cfg.to, MAX_DATA_DATE);
    if (cfg.from > cfg.to) cfg.from = cfg.to;

    if (!document.getElementById("export-page-shell")) {
      const qs = buildExportQuery(cfg);

      els.viewRoot.innerHTML = `
        <div class="grid-export-split" id="export-page-shell">
          <form class="card" id="export-form">
            <h2 class="card-title">Pengaturan Unduhan</h2>

            <div class="field-group">
              <label class="field-label" for="exp-segment">Saluran Pasar</label>
              <select id="exp-segment" class="select-control">
                <option value="modern">Pasar Modern</option>
                <option value="tradisional">Pasar Tradisional</option>
                <option value="produsen">Tingkat Produsen</option>
              </select>
            </div>

            <div class="field-group">
              <span class="field-label">Pilih Provinsi (minimal 1)</span>
              <div class="chip-list">
                ${ALL_PROVINCES.map((p) => `
                  <label class="check-label">
                    <input type="checkbox" name="exp_prov" value="${escapeHtml(p)}" ${cfg.provinces.includes(p) ? "checked" : ""}>
                    <span>${escapeHtml(p)}</span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="export-dates-stack">
              <div class="field-group">
                <label class="field-label" id="exp-from-label" for="exp-from">Dari Tanggal (${escapeHtml(formatDateId(cfg.from))})</label>
                <input type="date" id="exp-from" class="input-control font-mono" value="${escapeHtml(cfg.from)}" min="${MIN_DATA_DATE}" max="${MAX_DATA_DATE}">
              </div>
              <div class="field-group">
                <label class="field-label" id="exp-to-label" for="exp-to">Sampai Tanggal (${escapeHtml(formatDateId(cfg.to))})</label>
                <input type="date" id="exp-to" class="input-control font-mono" value="${escapeHtml(cfg.to)}" min="${MIN_DATA_DATE}" max="${MAX_DATA_DATE}">
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Bentuk Tabel CSV</span>
              <div class="segment-group" role="group" aria-label="Bentuk tabel CSV">
                <button type="button" class="seg-btn" aria-pressed="false" data-exp-shape="long">Memanjang</button>
                <button type="button" class="seg-btn" aria-pressed="false" data-exp-shape="wide">Melebar (per Provinsi)</button>
              </div>
              <span class="field-helper">Memanjang cocok untuk olah data; Melebar praktis dibuka langsung di Excel/Spreadsheet.</span>
            </div>

            <label class="check-label" for="exp-flags">
              <input type="checkbox" id="exp-flags" ${cfg.includeFlags ? "checked" : ""}>
              <span>Sertakan kolom catatan tambahan CSV</span>
            </label>

            <a class="btn btn-primary" href="/api/export?${qs}&preview=0" download="berasak.csv" id="btn-download-csv">
              Unduh CSV
            </a>
          </form>

          <div id="export-preview-mount"></div>
        </div>
      `;

      document.getElementById("exp-segment").addEventListener("change", (ev) => {
        state.segment = ev.target.value;
        state.exportCfg.segment = ev.target.value;
        safeStorageSet("berasak_segment", state.segment);
        syncNavAndSegmentUI();
        loadExportPreview();
      });

      els.viewRoot.querySelectorAll('input[name="exp_prov"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          const checked = [...els.viewRoot.querySelectorAll('input[name="exp_prov"]:checked')].map((el) => el.value);
          if (checked.length === 0) {
            cb.checked = true;
            return;
          }
          state.exportCfg.provinces = checked;
          loadExportPreview();
        });
      });

      document.getElementById("exp-from").addEventListener("change", (ev) => {
        if (!ev.target.value) return;
        state.exportCfg.from = clampDataDate(ev.target.value, MIN_DATA_DATE);
        if (state.exportCfg.from > state.exportCfg.to) {
          state.exportCfg.to = state.exportCfg.from;
        }
        syncExportFormUI();
        loadExportPreview();
      });

      document.getElementById("exp-to").addEventListener("change", (ev) => {
        if (!ev.target.value) return;
        state.exportCfg.to = clampDataDate(ev.target.value, MAX_DATA_DATE);
        if (state.exportCfg.to < state.exportCfg.from) {
          state.exportCfg.from = state.exportCfg.to;
        }
        syncExportFormUI();
        loadExportPreview();
      });

      els.viewRoot.querySelectorAll("[data-exp-shape]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.exportCfg.shape = btn.getAttribute("data-exp-shape");
          syncExportFormUI();
          loadExportPreview();
        });
      });

      document.getElementById("exp-flags").addEventListener("change", (ev) => {
        state.exportCfg.includeFlags = ev.target.checked;
        loadExportPreview();
      });
    }

    syncExportFormUI();
    await loadExportPreview();
  }

  function renderArticleCardHtml(art) {
    return `
      <article class="article-card">
        <div class="article-card-body">
          <div class="article-meta">
            <span class="article-category">${escapeHtml(art.category)}</span>
            <span>${escapeHtml(String(art.readMinutes))} menit baca</span>
            <span>${escapeHtml(art.updatedLabel)}</span>
          </div>
          <h3 class="article-title">${escapeHtml(art.title)}</h3>
          <p class="article-excerpt">${escapeHtml(art.excerpt)}</p>
        </div>
        <a class="btn btn-secondary" href="#artikel/${escapeHtml(art.slug)}">Baca Artikel</a>
      </article>
    `;
  }

  function renderArticleCardsContent(filteredArticles, filterState = {}) {
    if (!filteredArticles.length) {
      const query = (filterState.query || "").trim();
      const category = filterState.category || "Semua";
      let emptyDesc = "Tidak ada artikel yang cocok dengan kata kunci atau kategori pilihan Anda.";
      if (query && category !== "Semua") {
        emptyDesc = `Tidak ada artikel yang cocok dengan filter "${query}" pada kategori "${category}". Coba kata kunci lain atau tampilkan semua artikel.`;
      } else if (query) {
        emptyDesc = `Tidak ada artikel yang cocok dengan filter "${query}". Coba kata kunci lain atau atur ulang pencarian.`;
      } else if (category !== "Semua") {
        emptyDesc = `Belum ada artikel yang tersedia pada kategori "${category}".`;
      }
      return `
        <div class="feedback-card">
          <h2 class="feedback-title">Artikel tidak ditemukan</h2>
          <p class="feedback-desc">${escapeHtml(emptyDesc)}</p>
          <button type="button" class="btn btn-secondary" id="reset-article-filter-btn">Reset Pencarian</button>
        </div>
      `;
    }

    const [featured, ...rest] = filteredArticles;
    const featuredHtml = `
      <article class="article-featured">
        <div class="article-meta">
          <span class="article-category">${escapeHtml(featured.category)}</span>
          <span>${escapeHtml(String(featured.readMinutes))} menit baca</span>
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
          ${rest.map(renderArticleCardHtml).join("")}
        </div>
      `
      : "";

    return `${featuredHtml}${restHtml}`;
  }

  function pickRelatedArticles(article) {
    const others = ARTICLES.filter((a) => a.slug !== article.slug);
    const sameCategory = others.filter((a) => a.category === article.category);
    const otherCategories = others.filter((a) => a.category !== article.category);
    return [...sameCategory, ...otherCategories].slice(0, 2);
  }

  function renderArtikel(slug) {
    const { state, els, navigateTo } = window.PBS.app;
    if (slug) {
      const resolvedSlug = SLUG_ALIASES[slug] || slug;
      const article = ARTICLES.find((a) => a.slug === resolvedSlug);
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

      if (resolvedSlug !== slug) {
        if (els.pageBreadcrumb) {
          els.pageBreadcrumb.innerHTML = `<a href="#artikel">Artikel</a><span aria-hidden="true">/</span><span>${escapeHtml(article.category)}</span>`;
          els.pageBreadcrumb.hidden = false;
        }
        if (els.pageTitle) els.pageTitle.textContent = article.title;
        if (els.pageSubtitle) {
          els.pageSubtitle.textContent = `${article.category} · ${article.readMinutes} menit baca · Diperbarui ${article.updatedLabel}`;
        }
        document.title = `${article.title} | berasak.ai`;
      }

      const related = pickRelatedArticles(article);

      els.viewRoot.innerHTML = `
        <article class="article-reader">
          <div class="article-meta">
            <span class="article-category">${escapeHtml(article.category)}</span>
            <span>${escapeHtml(String(article.readMinutes))} menit baca</span>
            <span>Diperbarui ${escapeHtml(article.updatedLabel)}</span>
          </div>

          <div class="article-takeaways">
            <h2 class="article-takeaways-title">Poin Utama</h2>
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
            <h2 class="section-heading">Artikel Terkait di berasak.ai</h2>
          </div>
          <div class="grid-article-index">
            ${related.map(renderArticleCardHtml).join("")}
          </div>
        </section>
      `;
      return;
    }

    const categories = ["Semua", ...new Set(ARTICLES.map((a) => a.category))];
    const filterState = state.articlesFilter;
    if (!categories.includes(filterState.category)) {
      filterState.category = "Semua";
    }

    const getFiltered = () => {
      const q = filterState.query.trim().toLowerCase();
      return ARTICLES.filter((a) => {
        const matchCat = filterState.category === "Semua" || a.category === filterState.category;
        const takeawaysText = Array.isArray(a.takeaways) ? a.takeaways.join(" ").toLowerCase() : "";
        const sectionsText = Array.isArray(a.sections)
          ? a.sections.map((s) => `${s.heading || ""} ${(s.paragraphs || []).join(" ")}`).join(" ").toLowerCase()
          : "";
        const matchQuery = !q
          || a.title.toLowerCase().includes(q)
          || a.excerpt.toLowerCase().includes(q)
          || a.category.toLowerCase().includes(q)
          || takeawaysText.includes(q)
          || sectionsText.includes(q);
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
              placeholder="Cari topik, misal: HET, SPHP, kutu, atau JSB..."
              value="${escapeHtml(filterState.query)}"
            >
          </div>
        </div>
        <p class="article-result-count" id="article-result-count" aria-live="polite"></p>
      </div>

      <div class="view-stack" id="articles-list-mount"></div>
    `;

    const listMount = document.getElementById("articles-list-mount");
    const countEl = document.getElementById("article-result-count");
    const searchInput = document.getElementById("article-search-input");

    const syncCatChips = () => {
      els.viewRoot.querySelectorAll("[data-art-cat]").forEach((btn) => {
        const isAct = btn.getAttribute("data-art-cat") === filterState.category;
        btn.classList.toggle("is-active", isAct);
        btn.setAttribute("aria-pressed", isAct ? "true" : "false");
      });
    };

    const updateArticleList = () => {
      const matches = getFiltered();
      if (countEl) {
        countEl.textContent = `Menampilkan ${matches.length} dari ${ARTICLES.length} artikel`;
      }
      listMount.innerHTML = renderArticleCardsContent(matches, filterState);
      const resetBtn = document.getElementById("reset-article-filter-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          filterState.category = "Semua";
          filterState.query = "";
          if (searchInput) searchInput.value = "";
          syncCatChips();
          updateArticleList();
          if (searchInput) searchInput.focus();
        });
      }
    };

    updateArticleList();

    els.viewRoot.querySelectorAll("[data-art-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterState.category = btn.getAttribute("data-art-cat");
        syncCatChips();
        updateArticleList();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", (ev) => {
        filterState.query = ev.target.value;
        updateArticleList();
      });
    }
  }

  function renderPanduan() {
    const { els } = window.PBS.app;
    const steps = [
      {
        num: "01",
        title: "Pilih Saluran Harga Beras",
        desc: "Tentukan saluran yang ingin dipantau: Pasar Modern (supermarket), Pasar Tradisional (pasar rakyat), atau Tingkat Produsen (penggilingan padi).",
        ctaLabel: "Buka Beranda",
        ctaHref: "#beranda",
      },
      {
        num: "02",
        title: "Bandingkan Wilayah & Tren",
        desc: "Cek posisi harga di provinsi Anda pada halaman Wilayah, lalu amati arah kenaikan atau penurunan bulanan di halaman Tren.",
        ctaLabel: "Bandingkan Wilayah",
        ctaHref: "#bandingkan",
      },
      {
        num: "03",
        title: "Cek Estimasi Harga AI per Tanggal",
        desc: "Masukkan tanggal rencana belanja Anda di Prediksi AI untuk melihat perkiraan harga per kilogram dari model Jaringan Syaraf Buatan (JSB MLP) beserta Rentang Wajar 90%.",
        ctaLabel: "Buka Prediksi AI",
        ctaHref: "#prakiraan",
      },
    ];

    const glossary = [
      {
        term: "berasak.ai",
        desc: "Platform pemantau dan estimasi harga beras untuk enam provinsi di Pulau Sulawesi berbasis catatan resmi PIHPS Bank Indonesia.",
      },
      {
        term: "Pasar Modern",
        desc: "Harga beras eceran yang dipantau di ritel modern seperti supermarket atau minimarket, umumnya sudah dalam kemasan bermerek.",
      },
      {
        term: "Pasar Tradisional",
        desc: "Harga beras harian yang tercatat di pasar rakyat setempat, mencerminkan transaksi curah maupun karungan.",
      },
      {
        term: "Tingkat Produsen",
        desc: "Harga beras di tingkat penggilingan padi atau pedagang besar awal sebelum ditambah ongkos angkut dan margin toko eceran.",
      },
      {
        term: "Estimasi Harga AI per Tanggal",
        desc: "Perkiraan harga beras untuk tanggal belanja pilihan Anda menggunakan model Jaringan Syaraf Buatan (JSB MLP) yang dilatih pada data historis PIHPS dengan evaluasi holdout kronologis serta dilengkapi Rentang Wajar 90%.",
      },
      {
        term: "Rentang Wajar 90%",
        desc: "Batas perkiraan terendah hingga tertinggi di sekitar angka estimasi JSB MLP sebagai ruang aman saat menyusun anggaran belanja.",
      },
      {
        term: "Selisih Harga Antarprovinsi",
        desc: "Perbedaan harga per kilogram antara provinsi termahal dan termurah di Sulawesi akibat jarak angkut serta pasokan panen lokal.",
      },
      {
        term: "Garis Bantu 4 Minggu",
        desc: "Garis bantu putus-putus pada grafik Tren untuk meratakan gejolak harian sehingga arah naik-turunnya harga lebih mudah dibaca.",
      },
    ];

    const faqs = [
      {
        q: "Apakah angka harga di berasak.ai berasal dari satu merek beras tertentu?",
        a: "Bukan. Angka pada berasak.ai merupakan harga rata-rata komoditas beras tingkat provinsi dari PIHPS Bank Indonesia tanpa memisahkan satu merek atau varietas tertentu, sehingga tepat dijadikan acuan tren umum.",
      },
      {
        q: "Mengapa harga di warung atau supermarket dekat rumah bisa sedikit berbeda?",
        a: "Harga di toko dipengaruhi kelas mutu beras (Medium, Premium, atau Beras Khusus), ukuran kemasan, ongkos kirim setempat, dan promo toko. Anda dapat membandingkan saluran Pasar Tradisional dan Pasar Modern untuk melihat gambarannya.",
      },
      {
        q: "Bagaimana cara membaca estimasi harga AI per tanggal dan Rentang Wajar 90%?",
        a: "Pilih provinsi, saluran pasar, lalu tentukan tanggal rencana belanja Anda di halaman Prediksi AI. Angka utama berasal dari model Jaringan Syaraf Buatan (JSB MLP) sebagai perkiraan paling mungkin, sedangkan batas atas Rentang Wajar 90% membantu menyiapkan dana cadangan yang aman.",
      },
      {
        q: "Kapan waktu yang baik melihat grafik tren sebelum membeli stok lebih banyak?",
        a: "Biasakan mengecek grafik tren 30 hari hingga 1 tahun sebelum membeli karung 10 kg atau 25 kg. Jika harga mulai melandai saat musim panen, membeli untuk kebutuhan 2 sampai 4 minggu lebih bijak dibanding menimbun berlebihan.",
      },
      {
        q: "Mengapa harga beras di antarprovinsi Sulawesi bisa terpaut ribuan rupiah?",
        a: "Wilayah lumbung padi seperti Sulawesi Selatan dan Sulawesi Barat memiliki pasokan lebih dekat dengan penggilingan, sedangkan wilayah jalur pegunungan dan kepulauan membutuhkan biaya angkutan darat maupun kapal laut tambahan.",
      },
      {
        q: "Bisakah data harga beras diunduh gratis untuk riset atau perencanaan usaha?",
        a: "Bisa. Buka menu Data lalu pilih Unduh Data. Anda dapat memilih provinsi lewat daftar Pilih Provinsi, menentukan rentang tanggal, serta memilih bentuk tabel Memanjang atau Melebar untuk dibuka di Excel/Spreadsheet.",
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
            <article class="card guide-step-card">
              <span class="guide-step-num">${escapeHtml(s.num)}</span>
              <h3 class="card-title">${escapeHtml(s.title)}</h3>
              <p class="card-desc">${escapeHtml(s.desc)}</p>
              <a class="btn btn-secondary" href="${escapeHtml(s.ctaHref)}">${escapeHtml(s.ctaLabel)}</a>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="editorial-section" aria-label="Kamus istilah sederhana">
        <div class="section-bar">
          <h2 class="section-heading">Kamus Istilah Sederhana</h2>
          <span class="section-note">Penjelasan singkat istilah yang sering muncul di berasak.ai</span>
        </div>
        <dl class="glossary-list">
          ${glossary.map((item) => `
            <div class="glossary-row">
              <dt class="glossary-term">${escapeHtml(item.term)}</dt>
              <dd class="glossary-def">${escapeHtml(item.desc)}</dd>
            </div>
          `).join("")}
        </dl>
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

  function formatSubmittedTimeId(isoStr) {
    if (!isoStr) return "";
    const parsed = new Date(isoStr);
    if (Number.isNaN(parsed.getTime())) return String(isoStr);
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed);
    } catch (_) {
      return String(isoStr);
    }
  }

  async function postContactPayload(payload) {
    if (typeof window.PBS.apiPost === "function") {
      return window.PBS.apiPost("/api/contact", payload);
    }
    let res;
    try {
      res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      const netErr = new Error("Server layanan pesan sedang tidak dapat dijangkau. Periksa koneksi Anda atau kirim melalui aplikasi email.");
      netErr.isNetwork = true;
      throw netErr;
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      let detailMsg = "";
      if (data) {
        if (typeof data.detail === "string") {
          detailMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          detailMsg = data.detail.map((d) => (d && d.msg ? d.msg : String(d))).join("; ");
        } else if (typeof data.message === "string") {
          detailMsg = data.message;
        }
      }
      const apiErr = new Error(detailMsg || `Pengiriman gagal diproses oleh server (kode ${res.status}).`);
      apiErr.status = res.status;
      throw apiErr;
    }

    return data;
  }

  function renderKontak() {
    const { els, CONTACT_INFO } = window.PBS.app;
    const contact = CONTACT_INFO || {
      email: "customer.service@berasak.ai.com",
      phoneDisplay: "(6767) 6996697",
      phoneHref: "tel:67676996697",
    };

    els.viewRoot.innerHTML = `
      <div class="grid-contact-split">
        <div class="card">
          <div>
            <h2 class="card-title">Saluran Resmi Layanan Pengguna</h2>
            <p class="card-desc">Gunakan kontak resmi berasak.ai berikut untuk pertanyaan seputar pembacaan data, laporan kendala halaman, atau masukan publik.</p>
          </div>

          <div class="contact-channel-list">
            <div class="contact-channel-row">
              <span class="field-label">Email Layanan Pelanggan</span>
              <a class="contact-value" href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>
              <div class="contact-channel-actions">
                <a class="btn btn-secondary" href="mailto:${escapeHtml(contact.email)}">Kirim Email</a>
                <button type="button" class="btn btn-ghost" id="copy-email-btn">Salin Email</button>
                <span class="copy-feedback" id="copy-email-status" aria-live="polite"></span>
              </div>
            </div>

            <div class="contact-channel-row">
              <span class="field-label">Telepon Layanan Pelanggan</span>
              <a class="contact-value" href="${escapeHtml(contact.phoneHref)}">${escapeHtml(contact.phoneDisplay)}</a>
              <div class="contact-channel-actions">
                <a class="btn btn-secondary" href="${escapeHtml(contact.phoneHref)}">Hubungi Telepon</a>
                <button type="button" class="btn btn-ghost" id="copy-phone-btn">Salin Nomor</button>
                <span class="copy-feedback" id="copy-phone-status" aria-live="polite"></span>
              </div>
            </div>
          </div>

          <p class="scope-footnote">
            Seluruh data harga pada berasak.ai bersumber dari PIHPS Bank Indonesia (1 Jan 2022 s/d 12 Feb 2026) untuk enam provinsi Pulau Sulawesi.
          </p>
        </div>

        <div class="card">
          <div>
            <h2 class="card-title">Kirim Pesan atau Pertanyaan</h2>
            <p class="card-desc">Kirim pertanyaan, laporan kendala, atau masukan Anda langsung dari formulir ini untuk tercatat di sistem layanan pengguna berasak.ai.</p>
          </div>

          <div class="form-error-summary" id="contact-error-summary" tabindex="-1" role="alert" hidden>
            <h3 class="form-error-title" id="contact-error-title">Periksa kembali isian berikut:</h3>
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
                placeholder="Nama lengkap atau instansi Anda"
                aria-describedby="contact-name-help contact-name-error"
                required
              >
              <span class="field-helper" id="contact-name-help">Isi nama Anda atau nama instansi/komunitas.</span>
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
              <span class="field-helper" id="contact-email-help">Alamat email ini digunakan tim kami untuk membalas pesan Anda.</span>
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
              <button type="submit" class="btn btn-primary" id="contact-submit-btn">Kirim Pesan</button>
              <button type="reset" class="btn btn-secondary" id="contact-reset-btn">Kosongkan Formulir</button>
            </div>
          </form>

          <div class="contact-result-card" id="contact-result-mount" tabindex="-1" hidden role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    const copyEmailBtn = document.getElementById("copy-email-btn");
    const copyEmailStatus = document.getElementById("copy-email-status");
    const copyPhoneBtn = document.getElementById("copy-phone-btn");
    const copyPhoneStatus = document.getElementById("copy-phone-status");

    if (copyEmailBtn && copyEmailStatus) {
      copyEmailBtn.addEventListener("click", () => {
        copyToClipboard(contact.email, copyEmailStatus, "Email tersalin.");
      });
    }
    if (copyPhoneBtn && copyPhoneStatus) {
      copyPhoneBtn.addEventListener("click", () => {
        copyToClipboard(contact.phoneDisplay, copyPhoneStatus, "Nomor telepon tersalin.");
      });
    }

    const form = document.getElementById("contact-form");
    const errorSummary = document.getElementById("contact-error-summary");
    const errorTitle = document.getElementById("contact-error-title");
    const errorList = document.getElementById("contact-error-list");
    const resultMount = document.getElementById("contact-result-mount");
    const submitBtn = document.getElementById("contact-submit-btn");
    const resetBtn = document.getElementById("contact-reset-btn");
    let isSubmitting = false;

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
      if (errorTitle) errorTitle.textContent = "Periksa kembali isian berikut:";
      errorSummary.hidden = true;
      errorList.innerHTML = "";
      resultMount.hidden = true;
      resultMount.innerHTML = "";
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (isSubmitting) return;

      const errors = [];
      Object.keys(fields).forEach((key) => {
        const msg = fields[key].validate(fields[key].input.value);
        setFieldError(key, msg);
        if (msg) {
          errors.push({ id: fields[key].input.id, msg });
        }
      });

      if (errors.length) {
        if (errorTitle) errorTitle.textContent = "Periksa kembali isian berikut:";
        errorList.innerHTML = errors.map((e) => `<li><a href="#${escapeHtml(e.id)}">${escapeHtml(e.msg)}</a></li>`).join("");
        errorSummary.hidden = false;
        resultMount.hidden = true;
        errorSummary.querySelectorAll('a[href^="#"]').forEach((a) => {
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
      errorList.innerHTML = "";
      resultMount.hidden = true;

      const nameVal = fields.name.input.value.trim();
      const emailVal = fields.email.input.value.trim();
      const topicVal = fields.topic.input.value.trim();
      const msgVal = fields.message.input.value.trim();

      const subject = `[berasak.ai] ${topicVal} - ${nameVal}`;
      const bodyText = `Nama: ${nameVal}\nEmail Pengirim: ${emailVal}\nTopik: ${topicVal}\n\nPesan:\n${msgVal}`;
      const mailtoHref = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      isSubmitting = true;
      const defaultSubmitText = submitBtn ? submitBtn.textContent : "Kirim Pesan";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Mengirim Pesan...";
      }
      if (resetBtn) resetBtn.disabled = true;

      try {
        const resData = await postContactPayload({
          name: nameVal,
          email: emailVal,
          topic: topicVal,
          message: msgVal,
        });

        const refId = resData && resData.reference_id ? String(resData.reference_id) : "BRS-TERCATAT";
        const submittedText = resData && resData.submitted_at ? formatSubmittedTimeId(resData.submitted_at) : "";
        const copyText = `Nomor Tiket: ${refId}\nKepada: ${contact.email}\nSubjek: ${subject}\n\n${bodyText}`;

        errorSummary.hidden = true;
        errorList.innerHTML = "";
        form.hidden = true;
        resultMount.hidden = false;
        resultMount.innerHTML = `
          <div class="contact-result-header">
            <span class="badge badge-neutral font-mono" id="contact-ticket-badge">Nomor Tiket: ${escapeHtml(refId)}</span>
          </div>
          <h3 class="card-title">Pesan Berhasil Diterima</h3>
          <p class="card-desc">
            Terima kasih, <strong>${escapeHtml(nameVal)}</strong>. Pesan Anda dengan topik <strong>${escapeHtml(topicVal)}</strong> telah tercatat oleh server berasak.ai${submittedText ? ` (${escapeHtml(submittedText)})` : ""}.
            Simpan nomor tiket <strong class="font-mono">${escapeHtml(refId)}</strong> sebagai rujukan tindak lanjut melalui <strong class="font-mono">${escapeHtml(contact.email)}</strong>.
          </p>
          <div class="contact-channel-actions">
            <button type="button" class="btn btn-primary" id="copy-draft-btn">Salin Isi Pesan</button>
            <a class="btn btn-secondary" href="${escapeHtml(mailtoHref)}">Buka di Aplikasi Email</a>
            <button type="button" class="btn btn-ghost" id="new-draft-btn">Kirim Pesan Baru</button>
          </div>
          <span class="copy-feedback" id="copy-draft-status" aria-live="polite"></span>
        `;

        const copyDraftBtn = document.getElementById("copy-draft-btn");
        const copyDraftStatus = document.getElementById("copy-draft-status");
        const newDraftBtn = document.getElementById("new-draft-btn");

        if (copyDraftBtn && copyDraftStatus) {
          copyDraftBtn.addEventListener("click", () => {
            copyToClipboard(copyText, copyDraftStatus, "Salinan pesan dan nomor tiket tersalin.");
          });
        }
        if (newDraftBtn) {
          newDraftBtn.addEventListener("click", () => {
            form.hidden = false;
            form.reset();
            fields.name.input.focus();
          });
        }
        resultMount.focus();
      } catch (err) {
        const errMessage = err && err.message
          ? err.message
          : "Pesan gagal dikirim ke server. Silakan coba lagi atau kirim melalui aplikasi email.";
        if (errorTitle) errorTitle.textContent = "Pesan belum dapat dikirim ke server:";
        errorList.innerHTML = `
          <li>${escapeHtml(errMessage)}</li>
          <li>Alternatif langsung: <a href="${escapeHtml(mailtoHref)}">Buka draf pesan di aplikasi email perangkat Anda</a>.</li>
        `;
        errorSummary.hidden = false;
        resultMount.hidden = true;
        errorSummary.focus();
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitBtn.textContent = defaultSubmitText;
        }
        if (resetBtn) resetBtn.disabled = false;
      }
    });
  }

  window.PBS.publicViews = {
    renderUnduh,
    renderArtikel,
    renderPanduan,
    renderKontak,
  };
})();
