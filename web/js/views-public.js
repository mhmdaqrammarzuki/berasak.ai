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

  function syncExportFormUI() {
    const { state, els } = window.PBS.app;
    const cfg = state.exportCfg;
    const segSel = document.getElementById("exp-segment");
    if (segSel && segSel.value !== cfg.segment) segSel.value = cfg.segment;

    const fromEl = document.getElementById("exp-from");
    const toEl = document.getElementById("exp-to");
    if (fromEl && fromEl.value !== cfg.from) fromEl.value = cfg.from;
    if (toEl && toEl.value !== cfg.to) toEl.value = cfg.to;

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
    const provParam = cfg.provinces.length === 6 ? "all" : cfg.provinces.join(",");
    const qs = `segment=${encodeURIComponent(cfg.segment)}&provinces=${encodeURIComponent(provParam)}&from=${encodeURIComponent(cfg.from)}&to=${encodeURIComponent(cfg.to)}&shape=${encodeURIComponent(cfg.shape)}&include_flags=${cfg.includeFlags ? "1" : "0"}`;

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

      previewMount.innerHTML = `
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
                <tr>${prev.columns.map((c, ci) => `<th class="${ci === 0 || ci >= 2 ? "num-head" : ""}">${escapeHtml(c)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${prev.rows.map((row) => `
                  <tr>${row.map((cell, ci) => `<td class="${ci === 0 || ci >= 2 ? "num-cell" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>
                `).join("")}
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

    if (!document.getElementById("export-page-shell")) {
      const provParam = cfg.provinces.length === 6 ? "all" : cfg.provinces.join(",");
      const qs = `segment=${encodeURIComponent(cfg.segment)}&provinces=${encodeURIComponent(provParam)}&from=${encodeURIComponent(cfg.from)}&to=${encodeURIComponent(cfg.to)}&shape=${encodeURIComponent(cfg.shape)}&include_flags=${cfg.includeFlags ? "1" : "0"}`;

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
                <input type="date" id="exp-from" class="input-control font-mono" value="${escapeHtml(cfg.from)}" min="2022-01-01" max="2026-02-12">
              </div>
              <div class="field-group">
                <label class="field-label" for="exp-to">Sampai Tanggal</label>
                <input type="date" id="exp-to" class="input-control font-mono" value="${escapeHtml(cfg.to)}" min="2022-01-01" max="2026-02-12">
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
              <span>Sertakan kolom penanda kualitas data</span>
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
        state.exportCfg.from = ev.target.value;
        if (state.exportCfg.from > state.exportCfg.to) {
          state.exportCfg.to = state.exportCfg.from;
        }
        syncExportFormUI();
        loadExportPreview();
      });

      document.getElementById("exp-to").addEventListener("change", (ev) => {
        if (!ev.target.value) return;
        state.exportCfg.to = ev.target.value;
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
    const { state, els, navigateTo } = window.PBS.app;
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
      listMount.innerHTML = renderArticleCardsContent(matches);
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
        title: "Pilih Saluran Pasar",
        desc: "Di bagian atas halaman data, pilih Pasar Modern (supermarket), Pasar Tradisional (pasar rakyat), atau Tingkat Produsen (penggilingan) sesuai kebutuhan Anda.",
        ctaLabel: "Buka Beranda",
        ctaHref: "#beranda",
      },
      {
        num: "02",
        title: "Cek Provinsi & Estimasi Belanja",
        desc: "Gunakan Cek Cepat di Beranda untuk memilih provinsi Anda dan melihat perkiraan biaya kemasan 1 kg hingga 50 kg.",
        ctaLabel: "Bandingkan Wilayah",
        ctaHref: "#bandingkan",
      },
      {
        num: "03",
        title: "Baca Tren & Perkiraan Ke Depan",
        desc: "Buka halaman Tren Harga untuk melihat riwayat harian atau bulanan, dan buka Prediksi untuk proyeksi 4 sampai 8 minggu ke depan.",
        ctaLabel: "Lihat Tren Harga",
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
        desc: "Tanggal tanpa pembaruan laporan (misalnya hari libur), diisi dari harga hari sebelumnya dan tetap ditandai.",
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
        a: "Ya. Buka menu Data lalu pilih Unduh CSV. Anda dapat memilih provinsi, rentang tanggal 2022 sampai 2026, serta bentuk tabel memanjang atau melebar sebelum mengunduh.",
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

  function renderKontak() {
    const { els, CONTACT_INFO } = window.PBS.app;
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
              <a class="contact-value" href="mailto:${CONTACT_INFO.email}">${CONTACT_INFO.email}</a>
              <div class="contact-channel-actions">
                <a class="btn btn-secondary" href="mailto:${CONTACT_INFO.email}">Kirim Email</a>
                <button type="button" class="btn btn-ghost" id="copy-email-btn">Salin Email</button>
                <span class="copy-feedback" id="copy-email-status" aria-live="polite"></span>
              </div>
            </div>

            <div class="contact-channel-row">
              <span class="field-label">Telepon Layanan Pelanggan</span>
              <a class="contact-value" href="${CONTACT_INFO.phoneHref}">${CONTACT_INFO.phoneDisplay}</a>
              <div class="contact-channel-actions">
                <a class="btn btn-secondary" href="${CONTACT_INFO.phoneHref}">Hubungi Telepon</a>
                <button type="button" class="btn btn-ghost" id="copy-phone-btn">Salin Nomor</button>
                <span class="copy-feedback" id="copy-phone-status" aria-live="polite"></span>
              </div>
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

  window.PBS.publicViews = {
    renderUnduh,
    renderArtikel,
    renderPanduan,
    renderKontak,
  };
})();
