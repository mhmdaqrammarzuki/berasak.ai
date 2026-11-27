window.PBS = window.PBS || {};

window.PBS.PROVINCE_COLOR_VARS = {
  "Sulawesi Tengah": "var(--chart-sulteng)",
  "Gorontalo": "var(--chart-gorontalo)",
  "Sulawesi Tenggara": "var(--chart-sultra)",
  "Sulawesi Utara": "var(--chart-sulut)",
  "Sulawesi Selatan": "var(--chart-sulsel)",
  "Sulawesi Barat": "var(--chart-sulbar)",
};

window.PBS.PROVINCE_SHORT = {
  "Gorontalo": "Gorontalo",
  "Sulawesi Barat": "Sulbar",
  "Sulawesi Selatan": "Sulsel",
  "Sulawesi Tengah": "Sulteng",
  "Sulawesi Tenggara": "Sultra",
  "Sulawesi Utara": "Sulut",
};

window.PBS.PROVINCE_DASH_PATTERNS = {
  "Sulawesi Tengah": "",
  "Gorontalo": "7 3",
  "Sulawesi Tenggara": "2 3",
  "Sulawesi Utara": "9 3 2 3",
  "Sulawesi Selatan": "12 4",
  "Sulawesi Barat": "4 2 2 2",
};

window.PBS.escapeHtml = function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.PBS.formatInt = function formatInt(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return "-";
  return Math.round(Number(num)).toLocaleString("id-ID");
};

window.PBS.formatRp = function formatRp(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return "-";
  const rounded = Math.round(Number(num));
  return "Rp " + rounded.toLocaleString("id-ID");
};

window.PBS.formatRpDecimal = function formatRpDecimal(num, decimals = 2) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return "-";
  const val = Number(num);
  return "Rp " + val.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

window.PBS.formatPct = function formatPct(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return "-";
  const num = Number(val);
  const sign = num > 0 ? "+" : "";
  return sign + num.toFixed(2).replace(".", ",") + "%";
};

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
window.PBS.MONTHS_ID = MONTHS_ID;

window.PBS.formatDateId = function formatDateId(isoStr) {
  if (!isoStr || typeof isoStr !== "string") return "-";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const mIdx = Number(parts[1]) - 1;
  const mon = MONTHS_ID[mIdx] || parts[1];
  return `${Number(parts[2])} ${mon} ${parts[0]}`;
};

window.PBS.formatMonthYearId = function formatMonthYearId(ymStr) {
  if (!ymStr || typeof ymStr !== "string") return "-";
  const parts = ymStr.trim().split("-");
  if (parts.length < 2) return ymStr;
  const mIdx = Number(parts[1]) - 1;
  const mon = MONTHS_ID[mIdx] || parts[1];
  return `${mon} ${parts[0]}`;
};

window.PBS.formatAxisDateId = function formatAxisDateId(raw, agg) {
  if (!raw || typeof raw !== "string") return "-";
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return agg === "monthly" ? window.PBS.formatMonthYearId(trimmed) : window.PBS.formatDateId(trimmed);
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return window.PBS.formatMonthYearId(trimmed);
  }
  return trimmed;
};

window.PBS.badgeHtml = function badgeHtml(variant, label, iconType = "dot") {
  const icons = {
    up: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 11 12 4m0 0H7m5 0v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 5 12 12m0 0H7m5 0V7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.2 14 13.5H2L8 3.2Zm0 4v2.8m0 1.8h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dot: '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="3" fill="currentColor"/></svg>',
  };
  const svg = icons[iconType] || icons.dot;
  return `<span class="badge badge-${variant}">${svg}<span>${window.PBS.escapeHtml(label)}</span></span>`;
};

window.PBS.apiGet = async function apiGet(url) {
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body.error || `Gagal memuat data (HTTP ${resp.status}).`);
  }
  return body;
};

window.PBS.apiPost = async function apiPost(path, payload) {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body.error || "Permintaan gagal.");
  }
  return body;
};

window.PBS.renderLoading = function renderLoading(container, label) {
  const safe = window.PBS.escapeHtml(label || "Memuat informasi harga beras Sulawesi...");
  container.innerHTML = `
    <div class="feedback-card is-loading" role="status" aria-live="polite">
      <h2 class="feedback-title">${safe}</h2>
      <p class="feedback-desc">Sedang mengambil data harga terkini untuk Anda.</p>
      <div class="skeleton-bars" aria-hidden="true">
        <div class="skeleton-bar skeleton-bar--full"></div>
        <div class="skeleton-bar skeleton-bar--lg"></div>
        <div class="skeleton-bar skeleton-bar--md"></div>
      </div>
    </div>
  `;
};

window.PBS.renderError = function renderError(container, message, onRetry) {
  const safe = window.PBS.escapeHtml(message || "Terjadi kendala saat memuat data dari server.");
  container.innerHTML = `
    <div class="feedback-card is-error" role="alert">
      <h2 class="feedback-title">Data belum dapat dimuat</h2>
      <p class="feedback-desc">${safe}</p>
      <button type="button" class="btn btn-secondary" data-action="retry">Coba Muat Ulang</button>
    </div>
  `;
  const btn = container.querySelector('[data-action="retry"]');
  if (btn && typeof onRetry === "function") {
    btn.addEventListener("click", onRetry);
  }
};

window.PBS.renderEmpty = function renderEmpty(container, title, description, actionLabel, onAction) {
  const safeTitle = window.PBS.escapeHtml(title);
  const safeDesc = window.PBS.escapeHtml(description);
  const safeBtn = window.PBS.escapeHtml(actionLabel || "Reset Pilihan");
  container.innerHTML = `
    <div class="feedback-card">
      <h2 class="feedback-title">${safeTitle}</h2>
      <p class="feedback-desc">${safeDesc}</p>
      ${onAction ? `<button type="button" class="btn btn-secondary" data-action="empty-reset">${safeBtn}</button>` : ""}
    </div>
  `;
  const btn = container.querySelector('[data-action="empty-reset"]');
  if (btn && typeof onAction === "function") {
    btn.addEventListener("click", onAction);
  }
};
