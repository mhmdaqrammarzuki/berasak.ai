window.PBS = window.PBS || {};

(function () {
  const {
    formatRp,
    formatDateId,
    formatAxisDateId,
    PROVINCE_COLOR_VARS,
    PROVINCE_DASH_PATTERNS,
    PROVINCE_SHORT,
    escapeHtml,
  } = window.PBS;

  function readDesignTokens() {
    const cs = getComputedStyle(document.documentElement);
    const read = (name) => (cs.getPropertyValue(name) || "").trim() || `var(${name})`;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      isDark,
      brandForest: read("--brand-forest"),
      brandEmerald: read("--brand-emerald"),
      accentElectric: read("--accent-electric"),
      statusPositive: read("--status-positive"),
      brandPrimary: read("--brand-primary"),
      textPrimary: read("--text-primary"),
      textMuted: read("--text-muted"),
      borderSubtle: read("--border-subtle"),
      borderStrong: read("--border-strong"),
      bgSurface: read("--bg-surface"),
      series: {
        "Sulawesi Tengah": read("--chart-sulteng"),
        "Gorontalo": read("--chart-gorontalo"),
        "Sulawesi Tenggara": read("--chart-sultra"),
        "Sulawesi Utara": read("--chart-sulut"),
        "Sulawesi Selatan": read("--chart-sulsel"),
        "Sulawesi Barat": read("--chart-sulbar"),
      },
    };
  }

  function resolveSeriesColor(colorOrProvince, tokens) {
    if (tokens.series[colorOrProvince]) return tokens.series[colorOrProvince];
    const mapped = PROVINCE_COLOR_VARS[colorOrProvince] || colorOrProvince || "";
    const match = /^var\((--[a-zA-Z0-9_-]+)\)$/.exec(String(mapped).trim());
    if (match) {
      const val = (getComputedStyle(document.documentElement).getPropertyValue(match[1]) || "").trim();
      if (val) return val;
    }
    return mapped || tokens.statusPositive;
  }

  function bindRovingChartNavigation(nodes, initialActivePos, onShow, onHide, getDataIdx) {
    if (!nodes.length) return;
    const setRoving = (pos) => {
      nodes.forEach((n, idx) => n.setAttribute("tabindex", idx === pos ? "0" : "-1"));
    };
    setRoving(Math.max(0, Math.min(nodes.length - 1, initialActivePos)));

    nodes.forEach((el, pos) => {
      const dataIdx = getDataIdx(el, pos);
      el.addEventListener("mouseenter", () => onShow(dataIdx));
      el.addEventListener("click", () => {
        setRoving(pos);
        onShow(dataIdx);
      });
      el.addEventListener("focus", () => {
        setRoving(pos);
        onShow(dataIdx);
      });
      el.addEventListener("keydown", (ev) => {
        let nextPos = null;
        if (ev.key === "ArrowRight") nextPos = Math.min(nodes.length - 1, pos + 1);
        else if (ev.key === "ArrowLeft") nextPos = Math.max(0, pos - 1);
        else if (ev.key === "Home") nextPos = 0;
        else if (ev.key === "End") nextPos = nodes.length - 1;
        else if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onShow(dataIdx);
          return;
        } else if (ev.key === "Escape") {
          onHide();
          return;
        }

        if (nextPos !== null) {
          ev.preventDefault();
          setRoving(nextPos);
          if (typeof nodes[nextPos].focus === "function") nodes[nextPos].focus();
          onShow(getDataIdx(nodes[nextPos], nextPos));
        }
      });
    });
  }

  window.PBS.renderStepSparkline = function renderStepSparkline(values, colorVar) {
    if (!values || values.length < 2) return "";
    const tokens = readDesignTokens();
    const strokeCol = resolveSeriesColor(colorVar, tokens);
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
        <path d="${areaD}" fill="${escapeHtml(strokeCol)}" fill-opacity="0.14"></path>
        <path d="${d}" fill="none" stroke="${escapeHtml(strokeCol)}" stroke-width="1.9" stroke-linecap="square" vector-effect="non-scaling-stroke"></path>
        <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="2.6" fill="${escapeHtml(strokeCol)}"></circle>
      </svg>
    `;
  };

  window.PBS.renderTrendsChart = function renderTrendsChart(container, payload, opts = {}) {
    if (!container) return;
    const { showMa4 = true } = opts;
    const seriesList = (payload && payload.series) || [];
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

    const tokens = readDesignTokens();
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

    const w = 760;
    const h = 280;
    const padL = 84;
    const padR = 18;
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
      gridHtml += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="${escapeHtml(tokens.borderSubtle)}" stroke-width="1"></line>`;
      gridHtml += `<text x="4" y="${Number(y) + 4}" fill="${escapeHtml(tokens.textMuted)}" font-size="12" font-family="var(--font-mono)">${escapeHtml(formatRp(val))}</text>`;
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
      const tickLbl = formatAxisDateId(labelsArr[idx] || "", payload.agg);
      xTicksHtml += `<text x="${x}" y="${h - 8}" text-anchor="${anchor}" fill="${escapeHtml(tokens.textMuted)}" font-size="12" font-family="var(--font-mono)">${escapeHtml(tickLbl)}</text>`;
    });

    let linesHtml = "";
    let seriesLegendHtml = "";
    let hasMa4Data = false;
    seriesList.forEach((s) => {
      const col = resolveSeriesColor(s.province, tokens);
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
        if (p && p.ma4_idr !== null && p.ma4_idr !== undefined) {
          hasMa4Data = true;
        }
      });
      const dashPat = seriesList.length > 1 && PROVINCE_DASH_PATTERNS
        ? (PROVINCE_DASH_PATTERNS[s.province] || "")
        : "";
      const dashAttr = dashPat ? ` stroke-dasharray="${escapeHtml(dashPat)}"` : "";
      linesHtml += `<path d="${pathD}" fill="none" stroke="${escapeHtml(col)}" stroke-width="2.3"${dashAttr} stroke-linejoin="round" stroke-linecap="round"></path>`;

      if (showMa4) {
        const maPts = pts.map((p, idx) => `${xOf(idx).toFixed(1)},${yOf(p.ma4_idr).toFixed(1)}`).join(" ");
        linesHtml += `<polyline points="${maPts}" fill="none" stroke="${escapeHtml(col)}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.72"></polyline>`;
      }

      seriesLegendHtml += `
        <span class="chart-series-item">
          <svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="${escapeHtml(col)}" stroke-width="2.5"${dashAttr} /></svg>
          <span class="chart-series-name">${escapeHtml(s.province)}</span>
        </span>
      `;
    });

    const sampleCount = Math.min(xLen, 60);
    let probesHtml = "";
    const sliceW = Math.max(10, plotW / sampleCount);
    for (let sIdx = 0; sIdx < sampleCount; sIdx++) {
      const idx = sampleCount === 1 ? 0 : Math.round((sIdx / (sampleCount - 1)) * (xLen - 1));
      const px = Math.max(padL, xOf(idx) - sliceW / 2).toFixed(1);
      const tabAttr = sIdx === sampleCount - 1 ? "0" : "-1";
      const probeLbl = formatAxisDateId(labelsArr[idx] || "", payload.agg);
      probesHtml += `<rect class="chart-probe" data-idx="${idx}" x="${px}" y="${padT}" width="${sliceW.toFixed(1)}" height="${plotH}" fill="transparent" tabindex="${tabAttr}" role="button" aria-label="Detail harga ${escapeHtml(probeLbl)} (gunakan panah kiri atau kanan)"></rect>`;
    }

    container.innerHTML = `
      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafik tren harga beras Sulawesi">
          ${gridHtml}
          ${xTicksHtml}
          ${linesHtml}
          <line id="trend-guide-line" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="${escapeHtml(tokens.borderStrong)}" stroke-width="1.2" stroke-dasharray="3 3" visibility="hidden"></line>
          <g id="trend-active-dots" aria-hidden="true"></g>
          ${probesHtml}
        </svg>
        <div class="chart-tooltip" id="trend-tooltip" hidden></div>
        <div class="sr-only" aria-live="polite" data-chart-live></div>
      </div>
      <div class="chart-series-legend" aria-label="Legenda provinsi aktif">${seriesLegendHtml}</div>
      <div class="chart-legend-strip"><span>Garis penuh: harga tercatat</span>${showMa4 && hasMa4Data ? "<span>Garis putus-putus tipis: garis bantu 4 minggu</span>" : ""}</div>
    `;

    const tooltip = container.querySelector("#trend-tooltip");
    const guide = container.querySelector("#trend-guide-line");
    const activeDots = container.querySelector("#trend-active-dots");
    const liveNode = opts.liveNode || container.querySelector("[data-chart-live]");

    const hideTooltip = () => {
      tooltip.hidden = true;
      guide.setAttribute("visibility", "hidden");
      activeDots.innerHTML = "";
    };

    const showPoint = (idx) => {
      const lbl = formatAxisDateId(labelsArr[idx] || "", payload.agg);
      const xNum = xOf(idx);
      const xPos = xNum.toFixed(1);
      guide.setAttribute("x1", xPos);
      guide.setAttribute("x2", xPos);
      guide.setAttribute("visibility", "visible");
      tooltip.classList.toggle("is-left", xNum > padL + plotW * 0.52);

      let rowsHtml = "";
      let dotsHtml = "";
      const announced = [];
      seriesList.forEach((s) => {
        const pt = s.points[idx];
        if (!pt) return;
        const col = resolveSeriesColor(s.province, tokens);
        const cssCol = PROVINCE_COLOR_VARS[s.province] || col;
        const shortName = PROVINCE_SHORT[s.province] || s.province;
        const yPos = yOf(pt.price_idr).toFixed(1);
        dotsHtml += `<circle cx="${xPos}" cy="${yPos}" r="4.5" fill="${escapeHtml(tokens.bgSurface)}" stroke="${escapeHtml(col)}" stroke-width="2.2"></circle>`;
        rowsHtml += `
          <div class="chart-tooltip-row">
            <span class="series-label" style="--series-color: ${cssCol}">${escapeHtml(shortName)}</span>
            <span>${escapeHtml(formatRp(pt.price_idr))}</span>
          </div>
        `;
        announced.push(`${shortName} ${formatRp(pt.price_idr)}`);
      });

      activeDots.innerHTML = dotsHtml;
      tooltip.innerHTML = `<div class="chart-tooltip-title">${escapeHtml(lbl)}</div>${rowsHtml}`;
      tooltip.hidden = false;
      if (liveNode) {
        liveNode.textContent = `${lbl}: ${announced.join(", ")}`;
      }
    };

    const probes = [...container.querySelectorAll(".chart-probe")];
    bindRovingChartNavigation(
      probes,
      probes.length - 1,
      showPoint,
      hideTooltip,
      (el) => Number(el.getAttribute("data-idx"))
    );
    container.addEventListener("mouseleave", hideTooltip);
    container.addEventListener("focusout", (ev) => {
      if (!container.contains(ev.relatedTarget)) hideTooltip();
    });
  };

  window.PBS.renderTrendChart = window.PBS.renderTrendsChart;

  window.PBS.renderForecastChart = function renderForecastChart(container, payload, opts = {}) {
    if (!container) return;
    const hist = (payload && payload.history_weekly) || [];
    const fc = (payload && payload.forecast_points) || [];
    if (!hist.length || !fc.length) {
      window.PBS.renderEmpty(container, "Data prediksi belum tersedia", "Pilih provinsi dan saluran pasar lain.");
      return;
    }

    const tokens = readDesignTokens();
    const histStroke = tokens.isDark ? tokens.statusPositive : tokens.brandEmerald;
    const fcStroke = tokens.isDark ? tokens.accentElectric : tokens.brandForest;
    const bandFill = tokens.statusPositive;
    const dotStroke = tokens.isDark ? tokens.bgSurface : tokens.brandForest;

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
    const w = 760;
    const h = 255;
    const padL = 84;
    const padR = 20;
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
      gridHtml += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="${escapeHtml(tokens.borderSubtle)}" stroke-width="1"></line>`;
      gridHtml += `<text x="4" y="${Number(y) + 4}" fill="${escapeHtml(tokens.textMuted)}" font-size="12" font-family="var(--font-mono)">${escapeHtml(formatRp(val))}</text>`;
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
      [0, formatAxisDateId(hist[0].week, "weekly")],
      [Math.floor(cutIdx / 2), formatAxisDateId(hist[Math.floor(cutIdx / 2)].week, "weekly")],
      [totalLen - 1, `${formatAxisDateId(fc[fc.length - 1].target_date, "weekly")} (+${fc.length}M)`],
    ];
    let xHtml = `<text x="${Number(cutX) - 6}" y="${padT + 12}" text-anchor="end" fill="${escapeHtml(histStroke)}" font-size="12" font-weight="600" font-family="var(--font-mono)">Acuan: ${escapeHtml(formatDateId(payload.cutoff_date))}</text>`;
    ticks.forEach(([idx, lbl], pos) => {
      const anchor = pos === 0 ? "start" : pos === ticks.length - 1 ? "end" : "middle";
      const col = idx >= cutIdx ? histStroke : tokens.textMuted;
      xHtml += `<text x="${xOf(idx).toFixed(1)}" y="${h - 8}" text-anchor="${anchor}" fill="${escapeHtml(col)}" font-size="12" font-family="var(--font-mono)">${escapeHtml(lbl)}</text>`;
    });

    let ptsHtml = "";
    fc.forEach((p, i) => {
      const cx = xOf(hist.length + i).toFixed(1);
      const cy = yOf(p.predicted_idr).toFixed(1);
      const tabAttr = i === 0 ? "0" : "-1";
      ptsHtml += `
        <g class="fc-dot" data-fc="${i}" tabindex="${tabAttr}" role="button" aria-label="Estimasi JSB minggu +${p.step_week} (${escapeHtml(formatDateId(p.target_date))}): ${escapeHtml(formatRp(p.predicted_idr))} (gunakan panah kiri atau kanan)">
          <circle cx="${cx}" cy="${cy}" r="22" fill="transparent"></circle>
          <circle cx="${cx}" cy="${cy}" r="5.5" fill="${escapeHtml(tokens.accentElectric)}" stroke="${escapeHtml(dotStroke)}" stroke-width="2"></circle>
        </g>
      `;
    });

    container.innerHTML = `
      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafik estimasi JSB harga beras mingguan">
          ${gridHtml}
          <polygon points="${polyPts}" fill="${escapeHtml(bandFill)}" fill-opacity="0.16"></polygon>
          <line x1="${cutX}" y1="${padT}" x2="${cutX}" y2="${padT + plotH}" stroke="${escapeHtml(tokens.borderStrong)}" stroke-width="1.5"></line>
          <polyline points="${histPts}" fill="none" stroke="${escapeHtml(histStroke)}" stroke-width="2.5" stroke-linejoin="round"></polyline>
          <polyline points="${fcPts}" fill="none" stroke="${escapeHtml(fcStroke)}" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round"></polyline>
          ${xHtml}
          ${ptsHtml}
        </svg>
        <div class="chart-tooltip is-left" id="fc-tooltip" hidden></div>
        <div class="sr-only" aria-live="polite" data-chart-live></div>
      </div>
    `;

    const tooltip = container.querySelector("#fc-tooltip");
    const liveNode = opts.liveNode || container.querySelector("[data-chart-live]");

    const hideTooltip = () => {
      tooltip.hidden = true;
    };

    const showFc = (i) => {
      const p = fc[i];
      if (!p) return;
      const dateStr = formatDateId(p.target_date);
      const xNum = xOf(hist.length + i);
      tooltip.classList.toggle("is-left", xNum > padL + plotW * 0.5);
      tooltip.innerHTML = `
        <div class="chart-tooltip-title">Minggu +${p.step_week} (${escapeHtml(dateStr)})</div>
        <div class="chart-tooltip-row"><span>Estimasi JSB</span><span>${escapeHtml(formatRp(p.predicted_idr))}</span></div>
        <div class="chart-tooltip-row"><span>Rentang Wajar 90%</span><span>${escapeHtml(formatRp(p.lower_idr))} - ${escapeHtml(formatRp(p.upper_idr))}</span></div>
      `;
      tooltip.hidden = false;
      if (liveNode) {
        liveNode.textContent = `Minggu +${p.step_week}, ${dateStr}: Estimasi JSB ${formatRp(p.predicted_idr)}, Rentang Wajar 90% ${formatRp(p.lower_idr)} sampai ${formatRp(p.upper_idr)}`;
      }
    };

    const dots = [...container.querySelectorAll(".fc-dot")];
    bindRovingChartNavigation(
      dots,
      0,
      showFc,
      hideTooltip,
      (el) => Number(el.getAttribute("data-fc"))
    );
    container.addEventListener("mouseleave", hideTooltip);
    container.addEventListener("focusout", (ev) => {
      if (!container.contains(ev.relatedTarget)) hideTooltip();
    });
  };

  window.PBS.renderJsbLossChart = function renderJsbLossChart(container, lossHistory) {
    if (!container) return;
    if (!Array.isArray(lossHistory) || lossHistory.length < 2) {
      window.PBS.renderEmpty(
        container,
        "Riwayat pelatihan belum tersedia",
        "Kurva error pelatihan akan tampil setelah model JSB selesai dievaluasi."
      );
      return;
    }

    const tokens = readDesignTokens();
    const trainStroke = tokens.isDark ? tokens.statusPositive : tokens.brandEmerald;
    const valStroke = tokens.isDark ? tokens.accentElectric : tokens.brandForest;

    const losses = lossHistory
      .flatMap((d) => [Number(d.train_loss), Number(d.val_loss)])
      .filter((v) => Number.isFinite(v));
    const yMin = 0;
    const yMax = Math.max(1e-5, Math.max(...losses) * 1.08);
    const ySpan = yMax - yMin;

    const w = 680;
    const h = 215;
    const padL = 74;
    const padR = 18;
    const padT = 16;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const n = lossHistory.length;

    const xOf = (idx) => padL + (idx / (n - 1)) * plotW;
    const yOf = (val) => padT + (1 - (val - yMin) / ySpan) * plotH;
    const fmtExp = (val) => (val <= 0 ? "0" : val.toExponential(1));
    const fmtLoss = (val) => Number(val).toFixed(6).replace(".", ",");

    let gridHtml = "";
    for (let t = 0; t <= 4; t++) {
      const val = yMin + (t / 4) * ySpan;
      const y = yOf(val).toFixed(1);
      gridHtml += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="${escapeHtml(tokens.borderSubtle)}" stroke-width="1"></line>`;
      gridHtml += `<text x="${padL - 8}" y="${Number(y) + 4}" text-anchor="end" fill="${escapeHtml(tokens.textMuted)}" font-size="12" font-family="var(--font-mono)">${escapeHtml(fmtExp(val))}</text>`;
    }

    const midIdx = Math.floor((n - 1) / 2);
    const tickDefs = [[0, "start"]];
    if (midIdx > 0 && midIdx < n - 1) tickDefs.push([midIdx, "middle"]);
    tickDefs.push([n - 1, "end"]);

    let xHtml = "";
    tickDefs.forEach(([idx, anchor]) => {
      const ep = lossHistory[idx] && lossHistory[idx].epoch !== undefined ? lossHistory[idx].epoch : idx + 1;
      xHtml += `<text x="${xOf(idx).toFixed(1)}" y="${h - 8}" text-anchor="${anchor}" fill="${escapeHtml(tokens.textMuted)}" font-size="12" font-family="var(--font-mono)">Epoch ${escapeHtml(String(ep))}</text>`;
    });

    const trainPts = lossHistory
      .map((d, idx) => `${xOf(idx).toFixed(1)},${yOf(Number(d.train_loss)).toFixed(1)}`)
      .join(" ");
    const valPts = lossHistory
      .map((d, idx) => `${xOf(idx).toFixed(1)},${yOf(Number(d.val_loss)).toFixed(1)}`)
      .join(" ");
    const xStart = xOf(0).toFixed(1);
    const xEnd = xOf(n - 1).toFixed(1);
    const plotBottom = (padT + plotH).toFixed(1);
    const areaPts = `${valPts} ${xEnd},${plotBottom} ${xStart},${plotBottom}`;

    const sampleCount = Math.min(n, 28);
    const sliceW = Math.max(12, plotW / sampleCount);
    let probesHtml = "";
    for (let sIdx = 0; sIdx < sampleCount; sIdx++) {
      const idx = sampleCount === 1 ? 0 : Math.round((sIdx / (sampleCount - 1)) * (n - 1));
      const d = lossHistory[idx];
      const ep = d.epoch !== undefined ? d.epoch : idx + 1;
      const px = Math.max(padL, xOf(idx) - sliceW / 2).toFixed(1);
      const tabAttr = sIdx === sampleCount - 1 ? "0" : "-1";
      probesHtml += `<rect class="chart-probe" data-loss-idx="${idx}" x="${px}" y="${padT}" width="${sliceW.toFixed(1)}" height="${plotH}" fill="transparent" tabindex="${tabAttr}" role="button" aria-label="Epoch ${escapeHtml(String(ep))}: Loss Latih ${escapeHtml(fmtLoss(d.train_loss))}, Loss Validasi ${escapeHtml(fmtLoss(d.val_loss))}"></rect>`;
    }

    const lastPt = lossHistory[n - 1];
    container.innerHTML = `
      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Kurva penurunan MSE pelatihan dan validasi model JSB selama ${escapeHtml(String(n))} epoch">
          ${gridHtml}
          ${xHtml}
          <polygon points="${areaPts}" fill="${escapeHtml(valStroke)}" fill-opacity="0.08"></polygon>
          <polyline points="${trainPts}" fill="none" stroke="${escapeHtml(trainStroke)}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline>
          <polyline points="${valPts}" fill="none" stroke="${escapeHtml(valStroke)}" stroke-width="2.2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round"></polyline>
          <line id="jsb-loss-guide" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="${escapeHtml(tokens.borderStrong)}" stroke-width="1.2" stroke-dasharray="3 3" visibility="hidden"></line>
          <g id="jsb-loss-dots" aria-hidden="true"></g>
          ${probesHtml}
        </svg>
        <div class="chart-tooltip" id="jsb-loss-tooltip" hidden></div>
        <div class="sr-only" aria-live="polite" data-chart-live></div>
      </div>
      <div class="chart-legend-strip">
        <span class="series-label" style="--series-color: ${escapeHtml(trainStroke)}">Loss Latih (MSE): <strong class="font-mono">${escapeHtml(fmtLoss(lastPt.train_loss))}</strong></span>
        <span class="series-label" style="--series-color: ${escapeHtml(valStroke)}">Loss Uji Validasi (MSE): <strong class="font-mono">${escapeHtml(fmtLoss(lastPt.val_loss))}</strong></span>
        <span>Total Epoch: <strong class="font-mono">${escapeHtml(String(n))}</strong></span>
      </div>
    `;

    const tooltip = container.querySelector("#jsb-loss-tooltip");
    const guide = container.querySelector("#jsb-loss-guide");
    const dotsLayer = container.querySelector("#jsb-loss-dots");
    const liveNode = container.querySelector("[data-chart-live]");

    const hideTooltip = () => {
      tooltip.hidden = true;
      guide.setAttribute("visibility", "hidden");
      dotsLayer.innerHTML = "";
    };

    const showEpoch = (idx) => {
      const d = lossHistory[idx];
      if (!d) return;
      const ep = d.epoch !== undefined ? d.epoch : idx + 1;
      const xNum = xOf(idx);
      const xPos = xNum.toFixed(1);
      guide.setAttribute("x1", xPos);
      guide.setAttribute("x2", xPos);
      guide.setAttribute("visibility", "visible");
      tooltip.classList.toggle("is-left", xNum > padL + plotW * 0.52);

      const yTrain = yOf(Number(d.train_loss)).toFixed(1);
      const yVal = yOf(Number(d.val_loss)).toFixed(1);
      dotsLayer.innerHTML = `
        <circle cx="${xPos}" cy="${yTrain}" r="4.2" fill="${escapeHtml(tokens.bgSurface)}" stroke="${escapeHtml(trainStroke)}" stroke-width="2.1"></circle>
        <circle cx="${xPos}" cy="${yVal}" r="4.2" fill="${escapeHtml(tokens.bgSurface)}" stroke="${escapeHtml(valStroke)}" stroke-width="2.1"></circle>
      `;

      const trainStr = fmtLoss(d.train_loss);
      const valStr = fmtLoss(d.val_loss);
      tooltip.innerHTML = `
        <div class="chart-tooltip-title">Epoch ${escapeHtml(String(ep))}</div>
        <div class="chart-tooltip-row"><span class="series-label" style="--series-color: ${escapeHtml(trainStroke)}">Loss Latih</span><span>${escapeHtml(trainStr)}</span></div>
        <div class="chart-tooltip-row"><span class="series-label" style="--series-color: ${escapeHtml(valStroke)}">Loss Validasi</span><span>${escapeHtml(valStr)}</span></div>
      `;
      tooltip.hidden = false;
      if (liveNode) {
        liveNode.textContent = `Epoch ${ep}: Loss Latih ${trainStr}, Loss Validasi ${valStr}`;
      }
    };

    const probes = [...container.querySelectorAll(".chart-probe")];
    bindRovingChartNavigation(
      probes,
      probes.length - 1,
      showEpoch,
      hideTooltip,
      (el) => Number(el.getAttribute("data-loss-idx"))
    );
    container.addEventListener("mouseleave", hideTooltip);
    container.addEventListener("focusout", (ev) => {
      if (!container.contains(ev.relatedTarget)) hideTooltip();
    });
  };
})();
