# DESIGN.md - berasak.ai

## Design Read
Reading this as: **berasak.ai**, an open public Indonesian regional rice-price portal for Sulawesi built in **Minimalism & Swiss Style** at dial **ENERGY 2 / RHYTHM 2 / MOTION 1**, supporting calibrated Light and Dark themes.

## Three Dials
- **ENERGY 2 (Balanced)**: Sharp architectural contrast (`#111111` ink on `#FFFFFF`/`#F8F8F6` paper in Light; `#F5F5F2` off-white on `#151716`/`#0D0E0D` graphite in Dark), structural `2px` section rules, and zero decorative blur, glass, or generic gradients.
- **RHYTHM 2 (Consistent with intentional breaks)**: Sticky single-row Swiss header with accessible `Data` dropdown, unified channel switcher, public Quick Province Checker & Household Budget Estimator, asymmetric disparity hero with 6-province spectrum rail, hairline Ranked Price Ledger, clean prose article reader, and a 4-column Swiss footer.
- **MOTION 1 (Hover, active, and focus transitions only)**: Fast (`120ms-180ms`) `cubic-bezier(0.2, 0, 0, 1)` interactive feedback on buttons, nav links, map regions, and chart probes; honors `prefers-reduced-motion: reduce`.

## Identity Motif & Visual Decisions
- **Brand Mark**: Wordmark `berasak.ai` (`SULAWESI` mono sub-label) paired with a minimal geometric step-chart square SVG (`2px` corner radius).
- **Swiss Structural Grid**: Sharp radii (`0px` bars/tracks, `2px` controls/inputs, `4px` cards), `box-shadow: none` on flat surfaces, and hairline/thick border dividers separating editorial zones.
- **Public Accessibility & Everyday Language**: Plain Indonesian labels (`Selisih Harga Antarprovinsi`, `Peringkat Harga 6 Provinsi`, `Prediksi 4-8 Minggu`), household kg budget estimator (`1` to `50` kg), 5 educational articles (`#artikel`), 3-step guide + glossary + FAQ (`#panduan`), and official support channels (`#kontak`: `customer.service@berasak.ai.com`, `(6767) 6996697`).
- **Two-Font System**:
  - `Plus Jakarta Sans` (`400`, `500`, `600`, `700`, `800`): Headings, prose (`max-width: 68ch`, `line-height: 1.72`), and UI controls.
  - `JetBrains Mono` (`400`, `500`, `600`, `700`): Tabular Rupiah prices, percentages, calendar dates, MAE/MAPE decimals, and step numbers.
- **WCAG AA Verified Contrast (Programmatically Audited)**:
  - **Light mode**: Minimum text/chart ratio `5.59:1` (`>= 4.5:1`), minimum UI/border ratio `7.38:1` (`>= 3.0:1`).
  - **Dark mode**: Minimum text/chart ratio `5.59:1` (`>= 4.5:1`), minimum UI/border ratio `4.13:1` (`>= 3.0:1`).

## Verified Token Specifications (Light / Dark)

### Surface, Border & Interaction Tokens
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bg-canvas` | `#F8F8F6` | `#0D0E0D` | Page canvas |
| `--bg-surface` | `#FFFFFF` | `#151716` | Cards, header, footer, ledger, tables |
| `--bg-subtle` | `#F0F0EC` | `#1F2220` | Recessed filter wells, table headers, glossary cards |
| `--bg-elevated` | `#FFFFFF` | `#1B1E1C` | Floating chart tooltips and nav dropdown menu |
| `--surface-hover` | `#ECECE7` | `#252927` | Hover background for buttons, rows, nav links |
| `--surface-active` | `#E3E3DD` | `#2E3330` | Active/pressed surface tint |
| `--border-subtle` | `#E2E2DC` | `#2B2F2C` | Hairline dividers |
| `--border-strong` | `#52524E` | `#737B75` | Input outlines, active controls |
| `--border-structural` | `#111111` | `#E8E8E3` | Swiss `2px` header/section/footer rules |

### Text & Semantic Tokens (WCAG AA Verified on `--bg-surface`)
| Token | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|
| `--text-primary` | `#111111` | 18.88:1 | `#F5F5F2` | 16.49:1 |
| `--text-secondary` | `#40403C` | 10.41:1 | `#B4B8B4` | 8.97:1 |
| `--text-muted` | `#595954` | 7.04:1 | `#949A95` | 6.27:1 |
| `--brand-primary` | `#0F5132` | 9.36:1 | `#3DD698` | 9.67:1 |
| `--text-on-brand` | `#FFFFFF` | 9.36:1 on brand | `#071A12` | 9.67:1 on brand |
| `--brand-subtle` | `#E6F2EC` | 8.15:1 (brand on subtle) | `#102B20` | 8.12:1 (brand on subtle) |
| `--status-alert` | `#C42B1C` | 5.66:1 | `#FF7B6B` | 7.12:1 |
| `--status-alert-text` on `--status-alert-subtle` | `#9B1C10` / `#FDECEB` | 7.16:1 | `#FF9588` / `#321714` | 7.81:1 |
| `--status-info` on `--status-info-subtle` | `#184E8A` / `#EAF2FB` | 7.45:1 | `#7CBEFF` / `#132538` | 7.90:1 |
| `--status-success` on `--status-success-subtle` | `#0F5132` / `#E6F2EC` | 8.15:1 | `#4BE0A5` / `#102B20` | 9.01:1 |

### Chart Series Tokens (6 Provinces)
| Token | Province | Light | Ratio on Surface | Dark | Ratio on Surface |
|---|---|---|---|---|---|
| `--chart-sulteng` | Sulawesi Tengah | `#C42B1C` | 5.66:1 | `#FF7B6B` | 7.12:1 |
| `--chart-gorontalo` | Gorontalo | `#945B00` | 5.59:1 | `#F2BC4D` | 10.36:1 |
| `--chart-sultra` | Sulawesi Tenggara | `#2E449E` | 8.62:1 | `#95A9FF` | 8.06:1 |
| `--chart-sulut` | Sulawesi Utara | `#0A6578` | 6.68:1 | `#4ED3E6` | 10.11:1 |
| `--chart-sulsel` | Sulawesi Selatan | `#0F5132` | 9.36:1 | `#3DD698` | 9.67:1 |
| `--chart-sulbar` | Sulawesi Barat | `#6E3E85` | 7.80:1 | `#D2A0E8` | 8.52:1 |

## Post-Audit UX & Interaction Enhancements
- **Modular Client Architecture (`index.html`, `views-public.js`, `app.js`)**:
  - `web/js/views-public.js` isolates CSV export (`#unduh`), article reader/filter (`#artikel`), guide/glossary/FAQ (`#panduan`), and official contact channels/form (`#kontak`) on `window.PBS.publicViews`, keeping `web/js/app.js` focused on routing, navigation state, and analytics views.
- **Navigation & Accessibility (`index.html`, `layout.css`, `app.js`)**:
  - Canonical navigation labels (`Beranda`, `Tren Harga`, `Wilayah`, `Prediksi`, `Kualitas Data`, `Unduh CSV`, `Artikel`, `Panduan`, `Kontak`) unified across desktop bar, `Data` dropdown, mobile drawer, and 4-column footer.
  - Desktop nav activation threshold lowered from `1080px` to `920px` so tablet/small-laptop viewports use the compact inline top navigation without hamburger indirection.
  - Separate `#route-announcer` live region replaces `aria-live` on `#view-root`; `#main-content` receives focus on route navigation without focus-ring flash on mouse clicks; `#page-breadcrumb` displays contextual hierarchy for article pages; mobile drawer traps `Tab`/`Shift+Tab` and marks background landmarks `inert` + `aria-hidden`; `Data` dropdown implements `role="menu"` / `role="menuitem"` arrow/Home/End/Escape/focusout keyboard control.
- **Cognitive Load & Hierarchy (`components.css`, `app.js`)**:
  - Unified `.overview-hero` on `#beranda` combines Cek Cepat + Estimasi Belanja alongside Selisih Antarprovinsi via a hairline `1px` split without stacked nested boxes; clicking any spectrum dot or province dropdown updates estimates, dot state, and active ledger row in place with persisted preferences (`localStorage`).
  - Calm/unchanged provinces render quiet `Stabil` labels instead of competing badge chips; alert strings containing internal code `R5` are normalized to `>10%` in UI rendering; bottom `#beranda`/`#panduan` support strips removed to avoid duplicating the footer; glossary uses a 2-column semantic `<dl class="glossary-list">` and `#kontak` channels use hairline rows inside a single card.
  - `#tren`, `#bandingkan`, `#prakiraan`, `#kualitas`, and `#unduh` keep filter forms/strips mounted across option changes (zero focus loss), add `.panel-loading` opacity feedback, cache client-side chart overlays (`MA 4W` & markers) on `#tren`, support clickable table rows on `#bandingkan` and `#prakiraan`, expose min/max spread across all 6 provinces on `#kualitas`, and align all table `th.num-head` headers with right-aligned `td.num-cell` values.
- **Charts & Map (`charts.js`, `sulawesi-map.js`)**:
  - SVG charts implement roving `tabindex` with `ArrowLeft`/`ArrowRight`/`Home`/`End`/`Escape` navigation and `12px` axis labels; `window.PBS.updateSulawesiMapSelection` updates map selection attributes in place without replacing SVG nodes.
