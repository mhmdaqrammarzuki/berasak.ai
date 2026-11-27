# DESIGN.md - berasak.ai

## Design Read
Reading this as: public commodity monitoring portal and AI predictor for Sulawesi households and SMEs, in a Keyvo minimalist SaaS style, dial ENERGY 2 / RHYTHM 2 / MOTION 1.
Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

**berasak.ai** is a public Indonesian regional rice-price monitoring and AI date-prediction portal for Sulawesi, reconstructed in the **Keyvo Minimalist SaaS** visual system with calibrated Light and Dark themes.

## Core Design Principles
- **Keyvo Surface Alternation**: Crisp full-bleed white (`#FFFFFF`) and subtle neutral (`#F7F8F7`) sections in Light mode (paired with `#061407` / `#0B1E0C` / `#112913` forest surfaces in Dark mode), framed by `#082609` dark-forest structural containers, `--footer-bg: #09270b` deep-forest footer matching `berasak-logo-dark.png` corner RGB `(9, 39, 11)` with `mix-blend-mode: lighten`, `#0A5F0A` emerald KPI cards, `#BEF9BE` mint brand marks, and `#18EE1A` electric-green CTA highlights.
- **Zero-Slop Public Language**: Every metric, chart tooltip, status badge, and table column speaks directly to households and SMEs in plain Indonesian (`Harga Terbaru`, `Kondisi Pasar`, `Stabil`, `Waspada`, `Fluktuatif`, `Data Lengkap`, `Estimasi AI`, `Rentang Wajar 90%`, `Seluruh Provinsi`). Internal pipeline codes and raw audit jargon are strictly omitted from public charts and UI.
- **Typography & Tabular Discipline**:
  - `Plus Jakarta Sans` (`400`, `500`, `600`, `700`, `800`): Display headlines (`--tracking-tight: -0.03em`), section headings, body copy (`--prose-max: 68ch`, `--leading-relaxed: 1.72`), UI controls, non-currency KPI summaries (`.kpi-text-val`), and clean sans-serif tabular labels (`.tabular-nums`).
  - `JetBrains Mono` (`400`, `500`, `600`, `700`): Tabular Rupiah prices, percentages, calendar dates, and accuracy decimals (`.font-mono`, `.num-cell`).
  - **12px Minimum Typography Floor**: Component labels, table headers, eyebrows (`.masthead-eyebrow`), bar axis ticks (`.bar-axis-ticks`), bento micro-labels (`.bento-micro-label`), and mobile bottom navigation tabs (`.bottom-tab`) enforce `>= var(--text-xs)` (`12px`).
- **Token-Driven SVG & Motion**: Charts (`charts.js`) and technical line-art illustrations (`illustrations.js`) read CSS custom properties via `getComputedStyle(document.documentElement)` with zero hard-coded hex colors outside `web/styles/tokens.css`, updating cleanly on `#theme-toggle`. Transitions honor `prefers-reduced-motion: reduce`.

## Token Specifications (Light / Dark)

### Brand & Surface Tokens
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bg-canvas` | `#ffffff` | `#061407` | Page background canvas |
| `--bg-surface` | `#ffffff` | `#0b1e0c` | Header, cards, platform table, inputs |
| `--bg-subtle` | `#f7f8f7` | `#112913` | Alternating landing bands, filter strips, bento wells |
| `--bg-mint` | `#d1ffce` | `#133315` | Mint accent surfaces and illustration highlights |
| `--brand-forest` | `#082609` | `#082609` | Primary brand dark ink and showcase sidebar |
| `--footer-bg` | `#09270b` | `#09270b` | Deep-forest footer matching `berasak-logo-dark.png` corner RGB `(9, 39, 11)` |
| `--brand-emerald` | `#0a5f0a` | `#0a5f0a` | Featured KPI bento and AI highlight card surface |
| `--brand-mint-logo` | `#bef9be` | `#bef9be` | Brand wordmark/icon accent on dark forest surfaces |
| `--accent-electric` | `#18ee1a` | `#18ee1a` | Electric CTA banner surface and active forecast dots |
| `--brand-primary` | `#0a6e0c` | `#6ee872` | Interactive links, active nav states, focus accents |

### Text & Semantic Status Tokens
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--text-primary` | `#082609` | `#eef6ee` | Headings, primary data values, row titles |
| `--text-secondary` | `#3f5240` | `#b9cdb9` | Body copy, subheadings, secondary metadata |
| `--text-muted` | `#556856` | `#8fae90` | Axis ticks, helper notes, uppercase field labels |
| `--status-positive` / `-bg` | `#0a6e0c` / `#dffce0` | `#6be874` / `#0e2e10` | `Stabil` market condition and mint eyebrows |
| `--status-warning` / `-bg` | `#8f5000` / `#fef3c7` | `#f6c25b` / `#2d2007` | `Waspada` moderate movement status |
| `--status-danger` / `-bg` | `#9f2d34` / `#fce7e9` | `#ff9ea4` / `#341316` | `Fluktuatif` movement status and rose dilemma eyebrow |

### Typography Scale
| Token | Size | Usage |
|---|---|---|
| `--text-3xl` | `clamp(1.875rem, 3.6vw, 2.75rem)` | Primary hero & metric display scale |
| `--text-2xl` | `clamp(1.5rem, 2.6vw, 2.125rem)` | Page headers (`--text-2xl`) and section KPIs |
| `--text-xl` | `1.5rem` | Featured article headings and workflow preview values |
| `--text-md` / `--text-lg` | `1.125rem` / `1.25rem` | Card titles and section sub-headings |
| `--text-sm` / `--text-base` | `0.875rem` / `1rem` | Controls, tables, and body paragraphs |
| `--text-xs` / `--text-2xs` | `0.75rem` / `0.6875rem` | Typography floor (`>= 12px`) across labels, table headers, axis ticks, and bottom tabs / legacy micro-scale token |

## 8-Section Landing Architecture (`#beranda`)
1. **Sticky Header (`#site-header`)**: Geometric `berasak.ai` mark (`BerasakIllustrations.brandMarkSvg`), primary nav (`Tren`, `Wilayah`, `Prediksi AI`, `Artikel`, `Data` dropdown), `Hubungi Kami`, `Prediksi AI` CTA, `#theme-toggle`, and mobile `#nav-toggle` drawer.
2. **Hero + Asymmetric Bento (`.landing-band--white`)**: Headline + dual CTAs paired with interactive `.bento-checker` (live `/api/predict-date` across 3 channels), `.bento-illus` (`heroMintSvg`), `.bento-kpi` (`#0A5F0A`), and CSV/Article utility tiles.
3. **Tantangan Pasar (`.landing-band--subtle`)**: 3-column borderless `.dilemma-grid` (`fragmented`, `volatility`, `delayed` technical illustrations).
4. **Satu Platform Showcase (`.landing-band--white`)**: `.platform-window` with `#082609` `.platform-sidebar`, live search, date picker, 6-province table, anchored `.platform-popover` insight dialog, and 4 `.feature-card` pillars below.
5. **Cara Kerja Workflow (`.landing-band--subtle`)**: 2-column `.workflow-split` combining channel/time pills (`Hari Ini`, `Besok`, `+30 Hari`) with live price + `Rentang Wajar 90%` preview.
6. **Wawasan & Transparansi (`.landing-band--white`)**: Balanced `2+3` layout combining a 2-column `.landing-trust-row` (`Data Resmi PIHPS` and `Estimasi Transparan`) above a 3-column `.landing-articles-row` for featured articles (`penyebab-kenaikan-harga-beras-global-dan-nasional`, `langkah-pemerintah-menjaga-stabilitas-harga-beras`, `tips-trik-belanja-dan-menyimpan-beras-hemat-anti-kutu`) plus centered `.landing-articles-cta`, eliminating any empty 6th grid cell.
7. **Electric Green CTA Banner (`.cta-electric-banner`)**: `#18EE1A` surface with dot halftone corner mask, `ctaTabletSvg()`, and dual `#082609` / `#FFFFFF` action buttons.
8. **Deep-Forest Footer (`#global-footer`)**: Navigation links, official support contacts (`customer.service@berasak.ai.com`, `(6767) 6996697`), smooth scroll `#back-to-top-btn`, and oversized wordmark asset.

## Interior Workspaces & Accessibility
- **Routes Preserved**: `#tren` (token-aware SVG multi-series chart + garis tren 4 minggu with inline color and stroke-pattern legend `.chart-series-legend` / `.chart-legend-guides`), `#bandingkan` (rankings + Sulawesi interactive map + supply-chain spread), `#prakiraan` (JSB-only TensorFlow/Keras MLP AI Date Predictor), `#kualitas` (`Ringkasan Data` 5-column ledger + `.kpi-text-val` non-currency KPIs + Sulawesi map), `#unduh`, `#artikel`, `#panduan`, and `#kontak`.
- **JSB-Only Architecture & UX (`#prakiraan`)**:
  - Single verified JSB (Jaringan Saraf Berkelanjutan, TensorFlow/Keras MLP) predictor covering `2022-01-01`..`2028-12-31` and defaulting to local today, with zero legacy models in UI or copy.
  - Inline Rupiah KPI formatting (`.kpi-price-inline`, `.kpi-unit`, `.kpi-model-name`) prevents `/ kg` wrapping inside `.ai-outlook-card.is-highlight`; `.ai-range-val` and single-line `.ai-range-labels` keep Min/Maks bounds readable.
  - Dedicated 7-day `.ai-daily-grid` pairs the active day full-width above a `3x2` grid on mobile (`< 640px`), flows to 4 columns at `640px`, and sits in 1 full 7-card row on desktop (`>= 1120px`), with layout-stable hover/active states on `[data-ai-jump-date]`.
  - Weekly horizon controls (`.jsb-controls-row` + `.jsb-controls-meta`) align 4/8-week chart toggles with JSB metadata.
  - Hairline `.jsb-split-grid` panels display feature-importance bars (`.jsb-fi-list`, `.jsb-fi-name`, `.jsb-fi-track`, `.jsb-fi-fill` with `.is-zero` suppression) alongside JSB layer architecture cards (`.jsb-arch-grid`, `.jsb-arch-name`, `.jsb-arch-card`), training/holdout tables (`font-size >= var(--text-xs)`), and `.badge-warning` amber status badges.
- **Interior Layout, Touch Targets & Mobile Reflow**:
  - `#quality-page-shell .grid-compare-split` allocates `1.32fr` / `0.88fr` on desktop (`>= 1024px`) with `10px` table padding so the 5-column `#kualitas` table displays `Status Pasar` without horizontal clipping.
  - `#unduh` uses a `326px` filter sidebar (`minmax(0, 326px) minmax(0, 1fr)`), `#export-preview-mount .data-table` compact density, and stacked date fields (`#export-form .export-dates-stack`).
  - `#panduan` uses flex-column `.guide-step-card` layout so CTA buttons align along the bottom edge, and `.faq-chevron` rotates smoothly on `[open]` accordions.
  - `#kontak` enforces `[hidden] { display: none !important; }` and explicit `.contact-result-card[hidden], .form-error-summary[hidden]` hiding.
  - Mobile `< 640px` hides `.header-actions .header-primary-btn` so the sticky header fits cleanly at `375px`; `.platform-toolbar` stays single-row on `>= 768px`; `.platform-sidebar-nav` wraps cleanly below `960px`; `.workflow-step-pills` keeps 3 equal columns.
- **Keyboard, Touch & Screen Reader Support**: All charts provide roving `tabindex` (`ArrowLeft`, `ArrowRight`, `Home`, `End`, `Escape`) and `aria-live="polite"` readouts. Interactive controls keep `>= 44x44px` hit areas across all breakpoints (`.skip-link`, `.footer-nav a`, `.table-row-btn`, `.contact-value`, `.ai-chip`, `.preset-chip`, `.bento-channel-pill`, `.bento-micro-stat`, `.platform-row-btn`, `.workflow-step-pill`), `touch-action: manipulation`, pointer cursors (`[role="menuitem"]` included), `not-allowed` for disabled states, mobile `scroll-padding-bottom` preventing `.mobile-bottom-nav` from obscuring focused controls (WCAG 2.2 AA), focus traps on mobile drawer, and deterministic `Escape` dismissal order: `.platform-popover` -> header `Data` dropdown -> mobile drawer.
