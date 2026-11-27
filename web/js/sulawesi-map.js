window.PBS = window.PBS || {};

(function () {
  const { PROVINCE_COLOR_VARS, PROVINCE_SHORT, formatRp, escapeHtml } = window.PBS;

  const REGIONS = [
    {
      name: "Sulawesi Utara",
      cx: 292,
      cy: 46,
      tx: 344,
      ty: 40,
      align: "start",
      paths: [
        "M 244 58 L 270 50 L 302 36 L 330 22 L 340 36 L 314 58 L 284 68 L 252 76 Z",
      ],
    },
    {
      name: "Gorontalo",
      cx: 204,
      cy: 68,
      tx: 204,
      ty: 24,
      align: "middle",
      paths: [
        "M 164 66 L 204 58 L 244 58 L 252 76 L 208 82 L 166 86 Z",
      ],
    },
    {
      name: "Sulawesi Tengah",
      cx: 194,
      cy: 124,
      tx: 344,
      ty: 118,
      align: "start",
      paths: [
        "M 134 66 L 164 66 L 166 86 L 172 108 L 214 106 L 266 96 L 298 106 L 288 122 L 240 128 L 214 146 L 222 174 L 194 176 L 170 182 L 150 170 L 122 154 L 116 120 L 122 92 Z",
        "M 232 94 L 246 90 L 244 100 L 230 100 Z",
      ],
    },
    {
      name: "Sulawesi Barat",
      cx: 108,
      cy: 186,
      tx: 72,
      ty: 170,
      align: "end",
      paths: [
        "M 98 160 L 122 154 L 144 166 L 132 202 L 108 224 L 90 218 L 84 190 Z",
      ],
    },
    {
      name: "Sulawesi Selatan",
      cx: 132,
      cy: 266,
      tx: 76,
      ty: 274,
      align: "end",
      paths: [
        "M 144 166 L 150 170 L 170 182 L 186 214 L 164 226 L 150 252 L 156 286 L 148 308 L 128 314 L 108 308 L 106 274 L 110 242 L 108 224 L 132 202 Z",
      ],
    },
    {
      name: "Sulawesi Tenggara",
      cx: 214,
      cy: 228,
      tx: 344,
      ty: 238,
      align: "start",
      paths: [
        "M 170 182 L 194 176 L 222 174 L 236 206 L 248 230 L 238 262 L 216 274 L 198 250 L 186 214 Z",
        "M 218 280 L 234 276 L 236 302 L 218 302 Z",
        "M 244 270 L 260 264 L 266 294 L 246 302 Z",
      ],
    },
  ];

  function formatMapCaption(byName, selectedProvince) {
    const selectedRec = selectedProvince ? byName[selectedProvince] : null;
    if (!selectedRec) {
      return "Pilih provinsi pada peta atau tabel untuk melihat perbandingan.";
    }
    return `${selectedProvince}: ${formatRp(selectedRec.price_idr)} per kg (Peringkat ke-${selectedRec.rank} dari 6 provinsi)`;
  }

  window.PBS.renderSulawesiMap = function renderSulawesiMap(container, rankings, selectedProvince, onSelect) {
    const byName = {};
    (rankings || []).forEach((r) => {
      byName[r.province] = r;
    });

    const shapesHtml = REGIONS.map((reg) => {
      const col = PROVINCE_COLOR_VARS[reg.name] || "var(--brand-primary)";
      const rec = byName[reg.name];
      const priceText = rec ? formatRp(rec.price_idr) : "-";
      const shortName = PROVINCE_SHORT[reg.name] || reg.name;
      const isSel = selectedProvince === reg.name;
      const fillOpacity = isSel ? "1" : "0.72";
      const strokeCol = isSel ? "var(--text-primary)" : "var(--bg-surface)";
      const strokeW = isSel ? "2.4" : "1.6";
      const pathsMarkup = reg.paths
        .map((d) => `<path d="${d}" fill="${col}" fill-opacity="${fillOpacity}" stroke="${strokeCol}" stroke-width="${strokeW}" stroke-linejoin="round"></path>`)
        .join("");

      const leaderEndX = reg.align === "start" ? reg.tx - 5 : reg.align === "end" ? reg.tx + 5 : reg.tx;
      const leaderEndY = reg.align === "middle" ? reg.ty + 10 : reg.ty - 3;

      return `
        <g
          class="map-region ${isSel ? "is-selected" : ""}"
          data-province="${escapeHtml(reg.name)}"
          role="button"
          tabindex="0"
          aria-pressed="${isSel ? "true" : "false"}"
          aria-label="${escapeHtml(reg.name)}: ${escapeHtml(priceText)} per kg"
        >
          ${pathsMarkup}
          <line x1="${reg.cx}" y1="${reg.cy}" x2="${leaderEndX}" y2="${leaderEndY}" stroke="${isSel ? "var(--text-primary)" : "var(--border-strong)"}" stroke-width="${isSel ? "1.6" : "1"}" stroke-dasharray="${isSel ? "none" : "2 2"}"></line>
          <circle cx="${reg.cx}" cy="${reg.cy}" r="${isSel ? "3.5" : "2.4"}" fill="var(--bg-surface)" stroke="${col}" stroke-width="1.6"></circle>
          <text class="map-label-name" x="${reg.tx}" y="${reg.ty - 5}" text-anchor="${reg.align}" fill="${isSel ? "var(--text-primary)" : "var(--text-secondary)"}" font-size="12" font-weight="${isSel ? "700" : "600"}" font-family="var(--font-sans)">${escapeHtml(shortName)}</text>
          <text class="map-label-price" x="${reg.tx}" y="${reg.ty + 9}" text-anchor="${reg.align}" fill="${col}" font-size="12" font-weight="700" font-family="var(--font-mono)">${escapeHtml(priceText)}</text>
        </g>
      `;
    }).join("");

    const selectedInfo = formatMapCaption(byName, selectedProvince);

    container.innerHTML = `
      <div class="sulawesi-map-wrap" role="region" aria-label="Peta sebaran harga beras Sulawesi">
        <svg viewBox="0 0 430 336" width="100%" height="268" role="group" aria-label="Peta interaktif 6 provinsi Pulau Sulawesi">
          <rect x="4" y="4" width="422" height="328" rx="2" fill="var(--bg-subtle)" fill-opacity="0.28" stroke="var(--border-subtle)" stroke-width="1"></rect>
          ${shapesHtml}
        </svg>
        <p class="card-desc map-caption" id="map-selection-caption" aria-live="polite">${escapeHtml(selectedInfo)}</p>
      </div>
    `;

    container.querySelectorAll(".map-region").forEach((g) => {
      const prov = g.getAttribute("data-province");
      const activate = () => {
        if (typeof onSelect === "function") onSelect(prov);
      };
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          activate();
        }
      });
    });
  };

  window.PBS.updateSulawesiMapSelection = function updateSulawesiMapSelection(container, rankings, selectedProvince) {
    if (!container) return;
    const byName = {};
    (rankings || []).forEach((r) => {
      byName[r.province] = r;
    });

    container.querySelectorAll(".map-region").forEach((g) => {
      const prov = g.getAttribute("data-province");
      const rec = byName[prov];
      const priceText = rec ? formatRp(rec.price_idr) : "-";
      const isSel = selectedProvince === prov;
      g.classList.toggle("is-selected", isSel);
      g.setAttribute("aria-pressed", isSel ? "true" : "false");
      g.setAttribute("aria-label", `${prov}: ${priceText} per kg`);

      g.querySelectorAll("path").forEach((p) => {
        p.setAttribute("fill-opacity", isSel ? "1" : "0.72");
        p.setAttribute("stroke", isSel ? "var(--text-primary)" : "var(--bg-surface)");
        p.setAttribute("stroke-width", isSel ? "2.4" : "1.6");
      });

      const line = g.querySelector("line");
      if (line) {
        line.setAttribute("stroke", isSel ? "var(--text-primary)" : "var(--border-strong)");
        line.setAttribute("stroke-width", isSel ? "1.6" : "1");
        line.setAttribute("stroke-dasharray", isSel ? "none" : "2 2");
      }

      const circle = g.querySelector("circle");
      if (circle) {
        circle.setAttribute("r", isSel ? "3.5" : "2.4");
      }

      const nameText = g.querySelector(".map-label-name");
      if (nameText) {
        nameText.setAttribute("fill", isSel ? "var(--text-primary)" : "var(--text-secondary)");
        nameText.setAttribute("font-weight", isSel ? "700" : "600");
      }

      const priceNode = g.querySelector(".map-label-price");
      if (priceNode && rec) {
        priceNode.textContent = priceText;
      }
    });

    const caption = container.querySelector(".map-caption, #map-selection-caption");
    if (caption) {
      caption.textContent = formatMapCaption(byName, selectedProvince);
    }
  };
})();
