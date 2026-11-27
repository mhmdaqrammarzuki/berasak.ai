window.BerasakIllustrations = (function () {
  "use strict";

  const STROKE = "var(--illus-stroke, var(--text-primary))";
  const FILL_MINT = "var(--illus-fill, var(--brand-subtle))";
  const SURFACE = "var(--bg-surface)";
  const ELECTRIC = "var(--accent-electric, var(--brand-primary))";
  const DANGER_BG = "var(--status-danger-bg, var(--status-alert-subtle))";

  function cleanClassName(raw) {
    if (!raw || typeof raw !== "string") return "";
    return raw.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  }

  function brandMarkSvg(className) {
    const extra = cleanClassName(className);
    const cls = extra ? `brand-mark-svg ${extra}` : "brand-mark-svg";
    return `<svg class="${cls}" viewBox="0 0 192 226" fill="none" aria-hidden="true" focusable="false">
  <path fill="currentColor" fill-rule="evenodd" d="M0 0H56V91L91 56H157L192 91V171L137 226H0V0ZM57 170C56 142 74 111 106 104L128 102L57 170ZM66 176L134 109C136 137 119 162 93 176H66Z"/>
</svg>`;
  }

  function heroMintSvg() {
    return `<svg class="illus-svg illus-hero-mint" viewBox="0 0 360 200" fill="none" aria-hidden="true" focusable="false">
  <g stroke="${STROKE}" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="2 5">
    <line x1="24" y1="36" x2="336" y2="36"/>
    <line x1="24" y1="76" x2="336" y2="76"/>
    <line x1="24" y1="116" x2="336" y2="116"/>
    <line x1="72" y1="20" x2="72" y2="164"/>
    <line x1="180" y1="20" x2="180" y2="164"/>
    <line x1="288" y1="20" x2="288" y2="164"/>
  </g>
  <line x1="20" y1="162" x2="340" y2="162" stroke="${STROKE}" stroke-width="1.8" stroke-linecap="round"/>
  <g stroke="${STROKE}" stroke-width="1.4" stroke-linecap="round">
    <line x1="40" y1="162" x2="40" y2="167"/>
    <line x1="110" y1="162" x2="110" y2="167"/>
    <line x1="180" y1="162" x2="180" y2="167"/>
    <line x1="250" y1="162" x2="250" y2="167"/>
    <line x1="320" y1="162" x2="320" y2="167"/>
  </g>

  <g stroke="${STROKE}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="34,90 66,68 98,90 98,162 34,162" fill="${SURFACE}"/>
    <rect x="44" y="102" width="44" height="60" fill="${FILL_MINT}"/>
    <rect x="48" y="114" width="16" height="10" rx="2" fill="${SURFACE}"/>
    <rect x="68" y="114" width="16" height="10" rx="2" fill="${SURFACE}"/>
    <rect x="48" y="128" width="16" height="10" rx="2" fill="${SURFACE}"/>
    <rect x="68" y="128" width="16" height="10" rx="2" fill="${SURFACE}"/>
    <rect x="58" y="142" width="16" height="20" fill="${SURFACE}"/>
    <path d="M28 90L66 64L104 90"/>
  </g>

  <path d="M104 120H126" stroke="${STROKE}" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"/>
  <path d="M122 116L127 120L122 124" stroke="${STROKE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

  <g stroke="${STROKE}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
    <rect x="132" y="98" width="64" height="46" rx="2" fill="${SURFACE}"/>
    <path d="M196 112H216L226 124V144H196V112Z" fill="${FILL_MINT}"/>
    <path d="M202 117H213L220 125H202V117Z" fill="${SURFACE}"/>
    <line x1="128" y1="144" x2="228" y2="144"/>
    <circle cx="152" cy="152" r="10" fill="${SURFACE}"/>
    <circle cx="152" cy="152" r="3.5" fill="${FILL_MINT}"/>
    <circle cx="208" cy="152" r="10" fill="${SURFACE}"/>
    <circle cx="208" cy="152" r="3.5" fill="${FILL_MINT}"/>
    <path d="M148 126C153 116 164 111 174 112C172 122 162 129 148 126Z" fill="${FILL_MINT}"/>
    <line x1="152" y1="125" x2="171" y2="114"/>
  </g>

  <path d="M232 120H254" stroke="${STROKE}" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"/>
  <path d="M250 116L255 120L250 124" stroke="${STROKE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

  <g stroke="${STROKE}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round">
    <rect x="260" y="54" width="76" height="90" rx="4" fill="${SURFACE}"/>
    <rect x="268" y="64" width="60" height="16" rx="2" fill="${FILL_MINT}"/>
    <line x1="274" y1="72" x2="306" y2="72"/>
    <circle cx="320" cy="72" r="3.5" fill="${ELECTRIC}"/>
    <path d="M270 126H284V114H298V102H312V92H326" stroke-width="2"/>
    <circle cx="326" cy="92" r="3.5" fill="${ELECTRIC}"/>
    <line x1="270" y1="134" x2="326" y2="134" stroke-opacity="0.35"/>
    <line x1="298" y1="144" x2="298" y2="162"/>
  </g>
</svg>`;
  }

  function dilemmaSvg(kind) {
    if (kind === "volatility") {
      return `<svg class="illus-svg illus-dilemma" viewBox="0 0 220 148" fill="none" aria-hidden="true" focusable="false">
  <g stroke="${STROKE}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="28" y="22" width="164" height="104" rx="4" fill="${SURFACE}"/>
    <rect x="38" y="56" width="144" height="28" fill="${FILL_MINT}" stroke="none"/>
    <line x1="38" y1="56" x2="182" y2="56" stroke-dasharray="3 4" stroke-opacity="0.55"/>
    <line x1="38" y1="84" x2="182" y2="84" stroke-dasharray="3 4" stroke-opacity="0.55"/>
    <line x1="38" y1="112" x2="182" y2="112"/>
    <line x1="38" y1="34" x2="38" y2="112"/>
    <path d="M42 82L68 78L88 86L108 40L128 96L150 66L176 58" stroke-width="2.1"/>
    <circle cx="108" cy="40" r="6" fill="${DANGER_BG}"/>
    <circle cx="108" cy="40" r="2.5" fill="${STROKE}"/>
    <circle cx="176" cy="58" r="4.5" fill="${ELECTRIC}"/>
    <path d="M22 28C22 24.7 24.7 22 28 22H42V32H28C24.7 32 22 29.3 22 28Z" fill="${FILL_MINT}"/>
    <path d="M178 116H192C195.3 116 198 118.7 198 122C198 125.3 195.3 128 192 128H178V116Z" fill="${FILL_MINT}"/>
  </g>
</svg>`;
    }

    if (kind === "delayed") {
      return `<svg class="illus-svg illus-dilemma" viewBox="0 0 220 148" fill="none" aria-hidden="true" focusable="false">
  <g stroke="${STROKE}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="26" y="20" width="122" height="108" rx="4" fill="${SURFACE}"/>
    <rect x="38" y="34" width="18" height="18" rx="2" fill="${FILL_MINT}"/>
    <path d="M42 43L46 47L53 39"/>
    <line x1="66" y1="40" x2="132" y2="40"/>
    <line x1="66" y1="48" x2="110" y2="48" stroke-opacity="0.45"/>

    <rect x="38" y="64" width="18" height="18" rx="2" fill="${SURFACE}"/>
    <line x1="66" y1="70" x2="132" y2="70"/>
    <line x1="66" y1="78" x2="118" y2="78" stroke-opacity="0.45"/>

    <rect x="38" y="94" width="18" height="18" rx="2" fill="${DANGER_BG}"/>
    <line x1="43" y1="99" x2="51" y2="107"/>
    <line x1="51" y1="99" x2="43" y2="107"/>
    <line x1="66" y1="100" x2="124" y2="100"/>
    <line x1="66" y1="108" x2="100" y2="108" stroke-opacity="0.45"/>

    <circle cx="164" cy="86" r="30" fill="${SURFACE}"/>
    <circle cx="164" cy="86" r="22" fill="${FILL_MINT}"/>
    <path d="M164 72V86L174 92" stroke-width="2"/>
    <circle cx="164" cy="86" r="2.5" fill="${STROKE}"/>
    <circle cx="188" cy="60" r="4.5" fill="${ELECTRIC}"/>
  </g>
</svg>`;
    }

    return `<svg class="illus-svg illus-dilemma" viewBox="0 0 220 148" fill="none" aria-hidden="true" focusable="false">
  <g stroke="${STROKE}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <line x1="68" y1="54" x2="146" y2="42" stroke-dasharray="3 4" stroke-opacity="0.6"/>
    <line x1="68" y1="54" x2="114" y2="104" stroke-dasharray="3 4" stroke-opacity="0.6"/>
    <line x1="146" y1="42" x2="114" y2="104" stroke-dasharray="3 4" stroke-opacity="0.6"/>

    <rect x="28" y="28" width="44" height="44" rx="4" fill="${SURFACE}"/>
    <circle cx="50" cy="50" r="12" fill="${FILL_MINT}"/>
    <path d="M50 34V38M50 62V66M34 50H38M62 50H66"/>

    <rect x="142" y="20" width="50" height="44" rx="4" fill="${SURFACE}"/>
    <rect x="150" y="30" width="34" height="10" rx="2" fill="${FILL_MINT}"/>
    <line x1="150" y1="48" x2="178" y2="48"/>
    <circle cx="182" cy="54" r="3.5" fill="${ELECTRIC}"/>

    <rect x="88" y="84" width="56" height="44" rx="4" fill="${SURFACE}"/>
    <circle cx="116" cy="106" r="14" fill="${DANGER_BG}"/>
    <circle cx="116" cy="106" r="6" fill="${SURFACE}"/>
    <path d="M116 88V92M116 120V124M98 106H102M130 106H134"/>
  </g>
</svg>`;
  }

  function ctaTabletSvg() {
    return `<svg class="illus-svg illus-cta-tablet" viewBox="0 0 280 200" fill="none" aria-hidden="true" focusable="false">
  <g stroke="${STROKE}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <rect x="26" y="18" width="212" height="150" rx="10" fill="${SURFACE}"/>
    <rect x="38" y="30" width="188" height="126" rx="4" fill="${SURFACE}"/>
    <circle cx="48" cy="39" r="2.2" fill="${STROKE}" stroke="none"/>
    <circle cx="56" cy="39" r="2.2" fill="${STROKE}" stroke="none"/>
    <line x1="38" y1="48" x2="226" y2="48" stroke-width="1.3" stroke-opacity="0.35"/>

    <path d="M52 126L86 116L120 112L152 104L184 94L212 84V112L184 118L152 124L120 128L86 130L52 134Z" fill="${FILL_MINT}" stroke="none"/>
    <line x1="52" y1="138" x2="212" y2="138" stroke-width="1.4" stroke-opacity="0.45"/>
    <line x1="52" y1="68" x2="52" y2="138" stroke-width="1.4" stroke-opacity="0.45"/>

    <path d="M52 130L86 122L120 118L142 112" stroke-width="2"/>
    <path d="M142 112L176 102L212 96" stroke-width="2" stroke-dasharray="4 4"/>
    <line x1="176" y1="64" x2="176" y2="138" stroke-width="1.4" stroke-dasharray="3 3"/>
    <circle cx="176" cy="102" r="5" fill="${ELECTRIC}"/>

    <circle cx="216" cy="134" r="14" stroke-width="1.4" stroke-opacity="0.35" stroke-dasharray="3 3"/>
    <path d="M214 134V162L222 155L229 170L236 167L229 152L240 151L214 134Z" fill="${SURFACE}" stroke-width="1.9"/>
  </g>
</svg>`;
  }

  const ICON_PATHS = {
    trend: '<path d="M3 17l6-6 4 4 7-8"/><path d="M15 7h5v5"/>',
    region: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z"/><path d="M9 4v13M15 7v13"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>',
    layers: '<path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5l9 4.5 9-4.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z"/><path d="M9.5 12l2 2 3.5-4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11.5L12 16l4.5-4.5"/><path d="M4 19h16"/>',
    article: '<path d="M5 4h10l4 4v12H5V4z"/><path d="M15 4v4h4"/><path d="M8.5 12h7M8.5 16h5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
  };

  function featureIconSvg(name) {
    const body = ICON_PATHS[name] || ICON_PATHS.check;
    const safeName = cleanClassName(name) || "icon";
    return `<svg class="feature-icon feature-icon-${safeName}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  return {
    brandMarkSvg: brandMarkSvg,
    heroMintSvg: heroMintSvg,
    dilemmaSvg: dilemmaSvg,
    ctaTabletSvg: ctaTabletSvg,
    featureIconSvg: featureIconSvg,
  };
})();
