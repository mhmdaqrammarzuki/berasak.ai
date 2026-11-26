window.PBS = window.PBS || {};

(function () {
  const { formatRp, formatDateId, PROVINCE_COLOR_VARS, PROVINCE_SHORT, escapeHtml } = window.PBS;

  window.PBS.renderStepSparkline = function renderStepSparkline(values, colorVar) {
    if (!values || values.length < 2) return "";
    const w = 136;
    const h = 34;
    const min = Math.min(...values) - 80;
    const max = Math.max(...values) + 80;
    const span = Math.max(max - min, 200);
    const pts = values.map((v, i) => {
      const x = (2 + (i / (values.length - 1)) * (w - 6)).toFixed(1);
      const y = (h - 4 - ((v - min) / span) * (h - 10)).toFixed(1);
      return [x, y];
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H ${pts[i][0]} V ${pts[i][1]}`;
    }
    const lastPt = pts[pts.length - 1];
    const areaD = `${d} L ${lastPt[0]} ${h - 2} L ${pts[0][0]} ${h - 2} Z`;
    return `
      <svg class="sparkline-box" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${areaD}" fill="${colorVar}" fill-opacity="0.14"></path>
        <path d="${d}" fill="none" stroke="${colorVar}" stroke-width="1.9" stroke-linecap="square" vector-effect="non-scaling-stroke"></path>
        <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="2.6" fill="${colorVar}"></circle>
      </svg>
    `;
  };

  window.PBS.renderTrendsChart = function renderTrendsChart(container, payload, opts) {
    const { showMa4, showAnomalies } = opts;
    const seriesList = payload.series || [];
    if (!seriesList.length || !seriesList[0].points.length) {
      window.PBS.renderEmpty(
        container,
        "Tidak ada titik data pada rentang ini",
        "Ubah pilihan rentang waktu atau aktifkan kembali minimal satu provinsi.",
        opts.onReset ? "Reset Pilihan" : null,
        opts.onReset
      );
      return;
    }

    const allVals = [];
    seriesList.forEach((s) => {
      s.points.forEach((p) => {
        allVals.push(p.price_idr);
        if (showMa4 && p.ma4_idr) allVals.push(p.ma4_idr);
      });
    });

    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const padSpan = Math.max(400, Math.round((rawMax - rawMin) * 0.14));
    const yMin = Math.floor((rawMin - padSpan) / 500) * 500;
    const yMax = Math.ceil((rawMax + padSpan) / 500) * 500;
    const ySpan = Math.max(500, yMax - yMin);

    const w = 880;
    const h = 300;
    const padL = 82;
    const padR = 20;
    const padT = 18;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const xLen = seriesList[0].points.length;

    const xOf = (idx) => (xLen <= 1 ? padL : padL + (idx / (xLen - 1)) * plotW);
    const yOf = (val) => padT + (1 - (val - yMin) / ySpan) * plotH;

    let gridHtml = "";
    for (let t = 0; t <= 4; t++) {
      const val = yMin + (t / 4) * ySpan;
      const y = yOf(val).toFixed(1);
      gridHtml += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1"></line>`;
      gridHtml += `<text x="4" y="${Number(y) + 4}" fill="var(--text-muted)" font-size="11" font-family="var(--font-mono)">${escapeHtml(formatRp(val))}</text>`;
    }

    const tickIndices = new Set([0, xLen - 1]);
    const steps = Math.min(5, Math.max(1, xLen - 1));
    for (let i = 1; i < steps; i++) {
      tickIndices.add(Math.round((i / steps) * (xLen - 1)));
    }
    let xTicksHtml = "";
    const labelsArr = payload.x_labels || seriesList[0].points.map((p) => p.x);
    [...tickIndices].sort((a, b) => a - b).forEach((idx) => {
      const x = xOf(idx).toFixed(1);
      const anchor = idx === 0 ? "start" : idx === xLen - 1 ? "end" : "middle";
      xTicksHtml += `<text x="${x}" y="${h - 8}" text-anchor="${anchor}" fill="var(--text-muted)" font-size="11" font-family="var(--font-mono)">${escapeHtml(labelsArr[idx] || "")}</text>`;
    });

    let linesHtml = "";
    let markersHtml = "";
    seriesList.forEach((s) => {
      const col = PROVINCE_COLOR_VARS[s.province] || "var(--brand-primary)";
      const pts = s.points;
      let pathD = "";
      pts.forEach((p, idx) => {
        const x = xOf(idx).toFixed(1);
        const y = yOf(p.price_idr).toFixed(1);
        if (idx === 0) {
          pathD = `M ${x} ${y}`;
        } else if (payload.agg === "daily") {
          pathD += ` H ${x} V ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      });
      linesHtml += `<path d="${pathD}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round"></path>`;

      if (showMa4) {
        const maPts = pts.map((p, idx) => `${xOf(idx).toFixed(1)},${yOf(p.ma4_idr).toFixed(1)}`).join(" ");
        linesHtml += `<polyline points="${maPts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.72"></polyline>`;
      }

      if (showAnomalies) {
        pts.forEach((p, idx) => {
          const cx = Number(xOf(idx).toFixed(1));
          const cy = Number(yOf(p.price_idr).toFixed(1));
          if (p.is_anomaly) {
            markersHtml += `<polygon points="${cx},${cy - 6} ${cx + 6},${cy} ${cx},${cy + 6} ${cx - 6},${cy}" fill="var(--status-alert)" stroke="var(--bg-surface)" stroke-width="1.5"></polygon>`;
          } else if (p.is_imputed && payload.agg === "daily") {
            markersHtml += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--bg-surface)" stroke="var(--status-info)" stroke-width="1.5"></circle>`;
          }
        });
      }
    });

    const sampleCount = Math.min(xLen, 60);
    let probesHtml = "";
    const sliceW = Math.max(8, plotW / sampleCount);
    for (let sIdx = 0; sIdx < sampleCount; sIdx++) {
      const idx = sampleCount === 1 ? 0 : Math.round((sIdx / (sampleCount - 1)) * (xLen - 1));
      const px = Math.max(padL, xOf(idx) - sliceW / 2).toFixed(1);
      probesHtml += `<rect class="chart-probe" data-idx="${idx}" x="${px}" y="${padT}" width="${sliceW.toFixed(1)}" height="${plotH}" fill="transparent" tabindex="0" role="button" aria-label="Detail harga ${escapeHtml(labelsArr[idx] || "")}"></rect>`;
    }

    container.innerHTML = `
      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafik tren harga beras Sulawesi">
          ${gridHtml}
          ${xTicksHtml}
          ${linesHtml}
          ${markersHtml}
          <line id="trend-guide-line" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"></line>
          ${probesHtml}
        </svg>
        <div class="chart-tooltip" id="trend-tooltip" hidden></div>
      </div>
    `;

    const tooltip = container.querySelector("#trend-tooltip");
    const guide = container.querySelector("#trend-guide-line");
    const hideTooltip = () => {
      tooltip.hidden = true;
      guide.setAttribute("visibility", "hidden");
    };
    const showPoint = (idx) => {
      const lbl = labelsArr[idx] || "";
      const xNum = xOf(idx);
      const xPos = xNum.toFixed(1);
      guide.setAttribute("x1", xPos);
      guide.setAttribute("x2", xPos);
      guide.setAttribute("visibility", "visible");

      tooltip.classList.toggle("is-left", xNum > padL + plotW * 0.52);

      let rowsHtml = "";
      seriesList.forEach((s) => {
        const pt = s.points[idx];
        if (!pt) return;
        const col = PROVINCE_COLOR_VARS[s.province] || "var(--brand-primary)";
        const shortName = PROVINCE_SHORT[s.province] || s.province;
        const flag = pt.is_anomaly ? " [Lonjakan >10%]" : pt.is_imputed ? " [Diisi otomatis]" : "";
        rowsHtml += `
          <div class="chart-tooltip-row">
            <span class="series-label" style="--series-color: ${col}">${escapeHtml(shortName)}</span>
            <span>${escapeHtml(formatRp(pt.price_idr))}${escapeHtml(flag)}</span>
          </div>
        `;
      });
      tooltip.innerHTML = `<div class="chart-tooltip-title">${escapeHtml(lbl)}</div>${rowsHtml}`;
      tooltip.hidden = false;
    };

    container.querySelectorAll(".chart-probe").forEach((el) => {
      const idx = Number(el.getAttribute("data-idx"));
      el.addEventListener("mouseenter", () => showPoint(idx));
      el.addEventListener("click", () => showPoint(idx));
      el.addEventListener("focus", () => showPoint(idx));
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          showPoint(idx);
        } else if (ev.key === "Escape") {
          hideTooltip();
        }
      });
    });
    container.addEventListener("mouseleave", hideTooltip);
    container.addEventListener("focusout", (ev) => {
      if (!container.contains(ev.relatedTarget)) hideTooltip();
    });
  };

  window.PBS.renderForecastChart = function renderForecastChart(container, payload) {
    const hist = payload.history_weekly || [];
    const fc = payload.forecast_points || [];
    if (!hist.length || !fc.length) {
      window.PBS.renderEmpty(container, "Data prediksi belum tersedia", "Pilih provinsi dan saluran pasar lain.");
      return;
    }

    const allVals = [
      ...hist.map((d) => d.price_idr),
      ...fc.map((d) => d.lower_idr),
      ...fc.map((d) => d.upper_idr),
    ];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const padSpan = Math.max(300, Math.round((maxVal - minVal) * 0.16));
    const yMin = Math.floor((minVal - padSpan) / 200) * 200;
    const yMax = Math.ceil((maxVal + padSpan) / 200) * 200;
    const ySpan = Math.max(400, yMax - yMin);

    const totalLen = hist.length + fc.length;
    const w = 880;
    const h = 270;
    const padL = 82;
    const padR = 24;
    const padT = 22;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xOf = (idx) => padL + (idx / (totalLen - 1)) * plotW;
    const yOf = (val) => padT + (1 - (val - yMin) / ySpan) * plotH;

    let gridHtml = "";
    for (let t = 0; t <= 4; t++) {
      const val = yMin + (t / 4) * ySpan;
      const y = yOf(val).toFixed(1);
      gridHtml += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1"></line>`;
      gridHtml += `<text x="4" y="${Number(y) + 4}" fill="var(--text-muted)" font-size="11" font-family="var(--font-mono)">${escapeHtml(formatRp(val))}</text>`;
    }

    const cutIdx = hist.length - 1;
    const cutX = xOf(cutIdx).toFixed(1);

    const lastHist = hist[cutIdx];
    const upperPts = [`${cutX},${yOf(lastHist.price_idr).toFixed(1)}`].concat(
      fc.map((p, i) => `${xOf(hist.length + i).toFixed(1)},${yOf(p.upper_idr).toFixed(1)}`)
    );
    const lowerPts = fc
      .map((p, i) => `${xOf(hist.length + i).toFixed(1)},${yOf(p.lower_idr).toFixed(1)}`)
      .reverse();
    const polyPts = upperPts.concat(lowerPts).join(" ");

    const histPts = hist.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.price_idr).toFixed(1)}`).join(" ");
    const fcPts = [`${cutX},${yOf(lastHist.price_idr).toFixed(1)}`]
      .concat(fc.map((p, i) => `${xOf(hist.length + i).toFixed(1)},${yOf(p.predicted_idr).toFixed(1)}`))
      .join(" ");

    const ticks = [
      [0, hist[0].week],
      [Math.floor(cutIdx / 2), hist[Math.floor(cutIdx / 2)].week],
      [totalLen - 1, `${formatDateId(fc[fc.length - 1].target_date)} (+${fc.length}M)`],
    ];
    let xHtml = `<text x="${Number(cutX) - 6}" y="${padT + 11}" text-anchor="end" fill="var(--brand-primary)" font-size="11" font-weight="600" font-family="var(--font-mono)">Batas data: ${escapeHtml(formatDateId(payload.cutoff_date))}</text>`;
    ticks.forEach(([idx, lbl], pos) => {
      const anchor = pos === 0 ? "start" : pos === ticks.length - 1 ? "end" : "middle";
      const col = idx >= cutIdx ? "var(--brand-primary)" : "var(--text-muted)";
      xHtml += `<text x="${xOf(idx).toFixed(1)}" y="${h - 8}" text-anchor="${anchor}" fill="${col}" font-size="11" font-family="var(--font-mono)">${escapeHtml(lbl)}</text>`;
    });

    let ptsHtml = "";
    fc.forEach((p, i) => {
      const cx = xOf(hist.length + i).toFixed(1);
      const cy = yOf(p.predicted_idr).toFixed(1);
      ptsHtml += `
        <g class="fc-dot" data-fc="${i}" tabindex="0" role="button" aria-label="Prediksi minggu ${p.step_week}: ${escapeHtml(formatRp(p.predicted_idr))}">
          <circle cx="${cx}" cy="${cy}" r="22" fill="transparent"></circle>
          <circle cx="${cx}" cy="${cy}" r="5" fill="var(--brand-primary)" stroke="var(--bg-surface)" stroke-width="2"></circle>
        </g>
      `;
    });

    container.innerHTML = `
      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafik prediksi harga beras">
          ${gridHtml}
          <polygon points="${polyPts}" fill="var(--brand-primary)" opacity="0.18"></polygon>
          <line x1="${cutX}" y1="${padT}" x2="${cutX}" y2="${padT + plotH}" stroke="var(--border-strong)" stroke-width="1.5"></line>
          <polyline points="${histPts}" fill="none" stroke="var(--brand-primary)" stroke-width="2.5"></polyline>
          <polyline points="${fcPts}" fill="none" stroke="var(--brand-primary)" stroke-width="2.5" stroke-dasharray="6 4"></polyline>
          ${xHtml}
          ${ptsHtml}
        </svg>
        <div class="chart-tooltip is-left" id="fc-tooltip" hidden></div>
      </div>
    `;

    const tooltip = container.querySelector("#fc-tooltip");
    const hideTooltip = () => {
      tooltip.hidden = true;
    };
    const showFc = (i) => {
      const p = fc[i];
      tooltip.innerHTML = `
        <div class="chart-tooltip-title">Minggu +${p.step_week} (${escapeHtml(formatDateId(p.target_date))})</div>
        <div class="chart-tooltip-row"><span>Prediksi</span><span>${escapeHtml(formatRp(p.predicted_idr))}</span></div>
        <div class="chart-tooltip-row"><span>Rentang 90%</span><span>${escapeHtml(formatRp(p.lower_idr))} - ${escapeHtml(formatRp(p.upper_idr))}</span></div>
      `;
      tooltip.hidden = false;
    };
    container.querySelectorAll(".fc-dot").forEach((dot) => {
      const idx = Number(dot.getAttribute("data-fc"));
      dot.addEventListener("mouseenter", () => showFc(idx));
      dot.addEventListener("click", () => showFc(idx));
      dot.addEventListener("focus", () => showFc(idx));
      dot.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          showFc(idx);
        } else if (ev.key === "Escape") {
          hideTooltip();
        }
      });
    });
    container.addEventListener("mouseleave", hideTooltip);
    container.addEventListener("focusout", (ev) => {
      if (!container.contains(ev.relatedTarget)) hideTooltip();
    });
  };
})();
