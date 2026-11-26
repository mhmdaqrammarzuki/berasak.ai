"""HTTP REST API and static frontend server for berasak.ai."""

from __future__ import annotations

import csv
import io
import json
import mimetypes
import os
import sqlite3
import sys
from datetime import datetime, timedelta
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "data" / "pantau_beras.db"
WEB_DIR = ROOT_DIR / "web"

VALID_SEGMENTS = {"modern", "tradisional", "produsen"}
VALID_AGGS = {"daily", "weekly", "monthly"}
VALID_RANGES = {"3m", "1y", "all", "custom"}
VALID_MODELS = {"arima_110", "seasonal_naive", "moving_average_4w"}
VALID_HORIZONS = {4, 8}
VALID_SHAPES = {"long", "wide"}

MODEL_LABELS = {
    "arima_110": "ARIMA(1,1,0)",
    "seasonal_naive": "Seasonal Naive (t-52w)",
    "moving_average_4w": "Moving Average 4W",
}


class BadRequestError(ValueError):
    """Raised when query parameters fail validation."""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def first_param(qs: dict[str, list[str]], key: str, default: str = "") -> str:
    vals = qs.get(key)
    if not vals:
        return default
    return vals[0].strip()


def validate_segment(slug: str) -> str:
    if slug not in VALID_SEGMENTS:
        raise BadRequestError(f"Segmen pasar tidak valid: '{slug}'. Gunakan modern, tradisional, atau produsen.")
    return slug


def validate_iso_date(value: str, label: str) -> str:
    try:
        dt = datetime.strptime(value, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError as exc:
        raise BadRequestError(f"Format {label} harus YYYY-MM-DD, diterima '{value}'.") from exc


def get_valid_provinces(conn: sqlite3.Connection) -> list[str]:
    return [r["name"] for r in conn.execute("SELECT name FROM provinces ORDER BY name ASC").fetchall()]


def parse_province_list(conn: sqlite3.Connection, raw: str, default_all: bool = True) -> list[str]:
    all_provs = get_valid_provinces(conn)
    if not raw or raw.lower() == "all":
        return all_provs if default_all else []
    selected = [p.strip() for p in raw.split(",") if p.strip()]
    invalid = [p for p in selected if p not in all_provs]
    if invalid:
        raise BadRequestError(f"Provinsi tidak dikenal: {', '.join(invalid)}.")
    if not selected:
        raise BadRequestError("Pilih minimal satu provinsi.")
    return [p for p in all_provs if p in selected]


def query_meta(conn: sqlite3.Connection) -> dict:
    commodity = dict(conn.execute("SELECT slug, name, unit_label, grade_note FROM commodities LIMIT 1").fetchone())
    provinces = [dict(r) for r in conn.execute("SELECT code, name, island FROM provinces ORDER BY name ASC").fetchall()]
    segments = [
        dict(r)
        for r in conn.execute(
            """
            SELECT ms.slug, ms.label, er.min_date, er.max_date, er.raw_rows,
                   er.calendar_days, er.rows_long, er.rows_imputed, er.rows_anomaly, er.executed_at
            FROM market_segments ms
            JOIN etl_runs er ON er.market_segment_id = ms.id
            ORDER BY ms.id ASC
            """
        ).fetchall()
    ]
    return {
        "commodity": commodity,
        "provinces": provinces,
        "segments": segments,
        "source_label": "PIHPS Bank Indonesia (via Kaggle)",
    }


def query_overview(conn: sqlite3.Connection, segment: str) -> dict:
    segment = validate_segment(segment)
    seg_row = conn.execute(
        """
        SELECT ms.id, ms.slug, ms.label, er.min_date, er.max_date, er.calendar_days,
               er.rows_long, er.rows_imputed, er.rows_anomaly
        FROM market_segments ms
        JOIN etl_runs er ON er.market_segment_id = ms.id
        WHERE ms.slug = ?
        """,
        (segment,),
    ).fetchone()
    latest_date = seg_row["max_date"]
    provinces = get_valid_provinces(conn)

    cards: list[dict] = []
    alerts: list[dict] = []
    cutoff_30d = (datetime.strptime(latest_date, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")

    for prov in provinces:
        rows = conn.execute(
            """
            SELECT o.price_date, o.price_idr, o.pct_change_daily, o.is_imputed, o.is_anomaly, o.year, o.month
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            WHERE o.market_segment_id = ? AND p.name = ?
            ORDER BY o.price_date ASC
            """,
            (seg_row["id"], prov),
        ).fetchall()
        prices = [r["price_idr"] for r in rows]
        p_now = prices[-1]
        p_7d = prices[-8]
        p_30d = prices[-31]
        pct_7d = round(((p_now - p_7d) / p_7d) * 100.0, 2)
        pct_30d = round(((p_now - p_30d) / p_30d) * 100.0, 2)

        cur_ym = (rows[-1]["year"], rows[-1]["month"])
        prev_year, prev_month = (cur_ym[0] - 1, 12) if cur_ym[1] == 1 else (cur_ym[0], cur_ym[1] - 1)
        cur_m_vals = [r["price_idr"] for r in rows if (r["year"], r["month"]) == cur_ym]
        prev_m_vals = [r["price_idr"] for r in rows if (r["year"], r["month"]) == (prev_year, prev_month)]
        cur_m_avg = sum(cur_m_vals) / len(cur_m_vals)
        prev_m_avg = sum(prev_m_vals) / len(prev_m_vals)
        mom_pct = round(((cur_m_avg - prev_m_avg) / prev_m_avg) * 100.0, 2)

        change_days = sum(1 for i in range(1, len(prices)) if prices[i] != prices[i - 1])
        spark = [prices[i] for i in range(len(prices) - 90, len(prices), 3)]
        if spark[-1] != p_now:
            spark.append(p_now)

        recent_anoms = [r for r in rows if r["is_anomaly"] == 1 and r["price_date"] >= cutoff_30d]
        if recent_anoms:
            last_a = recent_anoms[-1]
            alerts.append(
                {
                    "province": prov,
                    "kind": "anomaly_r5",
                    "date": last_a["price_date"],
                    "value_pct": round(last_a["pct_change_daily"], 2),
                    "price_idr": last_a["price_idr"],
                    "message": f"Lonjakan harian R5 pada {last_a['price_date']} ({last_a['pct_change_daily']:+.2f}%).",
                }
            )
        elif mom_pct > 5.0:
            alerts.append(
                {
                    "province": prov,
                    "kind": "mom_threshold",
                    "date": latest_date,
                    "value_pct": mom_pct,
                    "price_idr": p_now,
                    "message": f"Kenaikan rata-rata bulanan melewati ambang 5% ({mom_pct:+.2f}%).",
                }
            )

        cards.append(
            {
                "province": prov,
                "price_idr": p_now,
                "pct_7d": pct_7d,
                "pct_30d": pct_30d,
                "mom_pct": mom_pct,
                "change_days": change_days,
                "total_days": len(prices),
                "is_imputed_latest": bool(rows[-1]["is_imputed"]),
                "spark_90d": spark,
            }
        )

    cards.sort(key=lambda c: c["price_idr"])
    cheapest = cards[0]
    most_exp = cards[-1]
    disparity = most_exp["price_idr"] - cheapest["price_idr"]
    disparity_pct = round((disparity / cheapest["price_idr"]) * 100.0, 1)

    return {
        "segment": {"slug": seg_row["slug"], "label": seg_row["label"]},
        "latest_date": latest_date,
        "min_date": seg_row["min_date"],
        "calendar_days": seg_row["calendar_days"],
        "historical_anomalies_count": seg_row["rows_anomaly"],
        "disparity": {
            "gap_idr": disparity,
            "gap_pct": disparity_pct,
            "cheapest": {"province": cheapest["province"], "price_idr": cheapest["price_idr"]},
            "most_expensive": {"province": most_exp["province"], "price_idr": most_exp["price_idr"]},
        },
        "alerts": alerts,
        "provinces": cards,
    }


def query_trends(
    conn: sqlite3.Connection,
    segment: str,
    provinces_raw: str,
    agg: str,
    range_mode: str,
    from_raw: str,
    to_raw: str,
) -> dict:
    segment = validate_segment(segment)
    if agg not in VALID_AGGS:
        raise BadRequestError(f"Agregasi tidak valid: '{agg}'. Gunakan daily, weekly, atau monthly.")
    if range_mode not in VALID_RANGES:
        raise BadRequestError(f"Rentang waktu tidak valid: '{range_mode}'.")

    selected_provs = parse_province_list(conn, provinces_raw, default_all=True)
    seg_row = conn.execute(
        """
        SELECT ms.id, ms.label, er.min_date, er.max_date
        FROM market_segments ms
        JOIN etl_runs er ON er.market_segment_id = ms.id
        WHERE ms.slug = ?
        """,
        (segment,),
    ).fetchone()
    min_bound = seg_row["min_date"]
    max_bound = seg_row["max_date"]
    max_dt = datetime.strptime(max_bound, "%Y-%m-%d")

    if range_mode == "3m":
        start_date = (max_dt - timedelta(days=90)).strftime("%Y-%m-%d")
        end_date = max_bound
    elif range_mode == "1y":
        start_date = (max_dt - timedelta(days=365)).strftime("%Y-%m-%d")
        end_date = max_bound
    elif range_mode == "all":
        start_date = min_bound
        end_date = max_bound
    else:
        start_date = validate_iso_date(from_raw or min_bound, "tanggal mulai")
        end_date = validate_iso_date(to_raw or max_bound, "tanggal akhir")

    if start_date > end_date:
        raise BadRequestError("Tanggal mulai tidak boleh melebihi tanggal akhir.")

    start_date = max(start_date, min_bound)
    end_date = min(end_date, max_bound)

    series_out: list[dict] = []
    summary_stats: list[dict] = []
    x_labels: list[str] = []

    for prov in selected_provs:
        rows = conn.execute(
            """
            SELECT o.price_date, o.price_idr, o.pct_change_daily, o.is_imputed, o.is_anomaly, o.year, o.month
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            WHERE o.market_segment_id = ? AND p.name = ?
              AND o.price_date BETWEEN ? AND ?
            ORDER BY o.price_date ASC
            """,
            (seg_row["id"], prov, start_date, end_date),
        ).fetchall()
        if not rows:
            continue

        raw_prices = [r["price_idr"] for r in rows]
        change_days = sum(1 for i in range(1, len(raw_prices)) if raw_prices[i] != raw_prices[i - 1])
        summary_stats.append(
            {
                "province": prov,
                "min_idr": min(raw_prices),
                "max_idr": max(raw_prices),
                "mean_idr": round(sum(raw_prices) / len(raw_prices)),
                "latest_idr": raw_prices[-1],
                "change_days": change_days,
                "total_days": len(raw_prices),
            }
        )

        points: list[dict] = []
        if agg == "daily":
            for idx, r in enumerate(rows):
                w_slice = raw_prices[max(0, idx - 27) : idx + 1]
                ma4 = round(sum(w_slice) / len(w_slice))
                points.append(
                    {
                        "x": r["price_date"],
                        "price_idr": r["price_idr"],
                        "ma4_idr": ma4,
                        "is_imputed": r["is_imputed"] == 1,
                        "is_anomaly": r["is_anomaly"] == 1,
                        "pct_change_daily": r["pct_change_daily"],
                    }
                )
        elif agg == "weekly":
            buckets: dict[str, list[sqlite3.Row]] = {}
            for r in rows:
                dt = datetime.strptime(r["price_date"], "%Y-%m-%d")
                monday = (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
                buckets.setdefault(monday, []).append(r)
            ordered = sorted(buckets.items(), key=lambda kv: kv[0])
            wk_vals: list[float] = []
            for label, b_rows in ordered:
                avg_v = sum(x["price_idr"] for x in b_rows) / len(b_rows)
                wk_vals.append(avg_v)
                ma4 = round(sum(wk_vals[max(0, len(wk_vals) - 4) :]) / min(4, len(wk_vals)))
                points.append(
                    {
                        "x": label,
                        "price_idr": round(avg_v),
                        "ma4_idr": ma4,
                        "is_imputed": all(x["is_imputed"] == 1 for x in b_rows),
                        "is_anomaly": any(x["is_anomaly"] == 1 for x in b_rows),
                        "pct_change_daily": None,
                    }
                )
        else:  # monthly
            buckets_m: dict[str, list[sqlite3.Row]] = {}
            for r in rows:
                ym = f"{r['year']}-{r['month']:02d}"
                buckets_m.setdefault(ym, []).append(r)
            ordered_m = sorted(buckets_m.items(), key=lambda kv: kv[0])
            m_vals: list[float] = []
            for label, b_rows in ordered_m:
                avg_v = sum(x["price_idr"] for x in b_rows) / len(b_rows)
                m_vals.append(avg_v)
                # 1-month window is roughly 4 weeks; keep rolling 3-month indicator as trend smoothing
                ma = round(sum(m_vals[max(0, len(m_vals) - 3) :]) / min(3, len(m_vals)))
                points.append(
                    {
                        "x": label,
                        "price_idr": round(avg_v),
                        "ma4_idr": ma,
                        "is_imputed": False,
                        "is_anomaly": any(x["is_anomaly"] == 1 for x in b_rows),
                        "pct_change_daily": None,
                    }
                )

        if not x_labels:
            x_labels = [p["x"] for p in points]
        series_out.append({"province": prov, "points": points})

    return {
        "segment": {"slug": segment, "label": seg_row["label"]},
        "agg": agg,
        "range": range_mode,
        "start_date": start_date,
        "end_date": end_date,
        "x_labels": x_labels,
        "series": series_out,
        "summary": summary_stats,
    }


def query_compare(conn: sqlite3.Connection, segment: str, date_raw: str) -> dict:
    segment = validate_segment(segment)
    bounds = conn.execute(
        """
        SELECT er.min_date, er.max_date
        FROM etl_runs er
        JOIN market_segments ms ON ms.id = er.market_segment_id
        WHERE ms.slug = ?
        """,
        (segment,),
    ).fetchone()
    target_date = validate_iso_date(date_raw or bounds["max_date"], "tanggal perbandingan")
    if target_date < bounds["min_date"] or target_date > bounds["max_date"]:
        raise BadRequestError(
            f"Tanggal harus berada di antara {bounds['min_date']} dan {bounds['max_date']}."
        )

    rows = conn.execute(
        """
        SELECT p.name AS province, o.price_idr, o.pct_change_daily, o.is_imputed, o.is_anomaly
        FROM price_observations o
        JOIN provinces p ON p.id = o.province_id
        JOIN market_segments ms ON ms.id = o.market_segment_id
        WHERE ms.slug = ? AND o.price_date = ?
        ORDER BY o.price_idr ASC, p.name ASC
        """,
        (segment, target_date),
    ).fetchall()

    ranked = [
        {
            "rank": idx + 1,
            "province": r["province"],
            "price_idr": r["price_idr"],
            "pct_change_daily": r["pct_change_daily"],
            "is_imputed": r["is_imputed"] == 1,
            "is_anomaly": r["is_anomaly"] == 1,
        }
        for idx, r in enumerate(rows)
    ]

    disparity = ranked[-1]["price_idr"] - ranked[0]["price_idr"]
    disparity_pct = round((disparity / ranked[0]["price_idr"]) * 100.0, 1)
    any_imputed = any(r["is_imputed"] for r in ranked)

    margin_rows = conn.execute(
        """
        SELECT p.name AS province,
               MAX(CASE WHEN ms.slug = 'produsen' THEN o.price_idr END) AS produsen_idr,
               MAX(CASE WHEN ms.slug = 'tradisional' THEN o.price_idr END) AS tradisional_idr,
               MAX(CASE WHEN ms.slug = 'modern' THEN o.price_idr END) AS modern_idr
        FROM price_observations o
        JOIN provinces p ON p.id = o.province_id
        JOIN market_segments ms ON ms.id = o.market_segment_id
        WHERE o.price_date = ?
        GROUP BY p.name
        """,
        (target_date,),
    ).fetchall()

    margins: list[dict] = []
    for m in margin_rows:
        prod = m["produsen_idr"]
        trad = m["tradisional_idr"]
        mod = m["modern_idr"]
        spread = mod - prod
        margins.append(
            {
                "province": m["province"],
                "produsen_idr": prod,
                "tradisional_idr": trad,
                "modern_idr": mod,
                "spread_idr": spread,
                "spread_pct": round((spread / prod) * 100.0, 1),
            }
        )
    margins.sort(key=lambda x: x["spread_idr"], reverse=True)

    return {
        "segment": segment,
        "date": target_date,
        "min_date": bounds["min_date"],
        "max_date": bounds["max_date"],
        "is_imputed_date": any_imputed,
        "disparity_idr": disparity,
        "disparity_pct": disparity_pct,
        "cheapest": ranked[0],
        "most_expensive": ranked[-1],
        "rankings": ranked,
        "supply_chain_margins": margins,
    }


def query_forecasts(
    conn: sqlite3.Connection,
    segment: str,
    province_raw: str,
    horizon_raw: str,
    model: str,
) -> dict:
    segment = validate_segment(segment)
    all_provs = get_valid_provinces(conn)
    province = province_raw or "Sulawesi Selatan"
    if province not in all_provs:
        raise BadRequestError(f"Provinsi tidak dikenal: '{province}'.")

    try:
        horizon = int(horizon_raw or "4")
    except ValueError as exc:
        raise BadRequestError("Horizon prakiraan harus 4 atau 8 minggu.") from exc
    if horizon not in VALID_HORIZONS:
        raise BadRequestError("Horizon prakiraan hanya mendukung 4 atau 8 minggu.")

    if model not in VALID_MODELS:
        raise BadRequestError(f"Model prakiraan tidak dikenal: '{model}'.")

    daily = conn.execute(
        """
        SELECT o.price_date, o.price_idr
        FROM price_observations o
        JOIN provinces p ON p.id = o.province_id
        JOIN market_segments ms ON ms.id = o.market_segment_id
        WHERE ms.slug = ? AND p.name = ?
        ORDER BY o.price_date ASC
        """,
        (segment, province),
    ).fetchall()

    buckets: dict[str, list[int]] = {}
    for r in daily:
        dt = datetime.strptime(r["price_date"], "%Y-%m-%d")
        monday = (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
        buckets.setdefault(monday, []).append(r["price_idr"])
    weekly_all = sorted(buckets.items(), key=lambda kv: kv[0])
    recent_weekly = [{"week": w, "price_idr": round(sum(v) / len(v))} for w, v in weekly_all[-26:]]
    change_days = sum(1 for i in range(1, len(daily)) if daily[i]["price_idr"] != daily[i - 1]["price_idr"])

    fc_rows = conn.execute(
        """
        SELECT pf.step_week, pf.target_date, pf.predicted_idr, pf.lower_idr, pf.upper_idr,
               pf.eval_mae, pf.eval_mape, pf.eval_period, pf.trained_at
        FROM price_forecasts pf
        JOIN provinces p ON p.id = pf.province_id
        JOIN market_segments ms ON ms.id = pf.market_segment_id
        WHERE ms.slug = ? AND p.name = ? AND pf.horizon_weeks = ? AND pf.model_name = ?
        ORDER BY pf.step_week ASC
        """,
        (segment, province, horizon, model),
    ).fetchall()

    eval_rows = conn.execute(
        """
        SELECT pf.model_name, pf.eval_mae, pf.eval_mape, pf.eval_period,
               MAX(CASE WHEN pf.step_week = ? THEN pf.predicted_idr END) AS final_pred_idr,
               MAX(CASE WHEN pf.step_week = ? THEN pf.lower_idr END) AS final_lower_idr,
               MAX(CASE WHEN pf.step_week = ? THEN pf.upper_idr END) AS final_upper_idr
        FROM price_forecasts pf
        JOIN provinces p ON p.id = pf.province_id
        JOIN market_segments ms ON ms.id = pf.market_segment_id
        WHERE ms.slug = ? AND p.name = ? AND pf.horizon_weeks = ?
        GROUP BY pf.model_name, pf.eval_mae, pf.eval_mape, pf.eval_period
        ORDER BY pf.eval_mae ASC
        """,
        (horizon, horizon, horizon, segment, province, horizon),
    ).fetchall()

    return {
        "segment": segment,
        "province": province,
        "horizon_weeks": horizon,
        "selected_model": model,
        "selected_model_label": MODEL_LABELS[model],
        "cutoff_date": daily[-1]["price_date"],
        "latest_price_idr": daily[-1]["price_idr"],
        "change_days": change_days,
        "total_days": len(daily),
        "history_weekly": recent_weekly,
        "forecast_points": [dict(r) for r in fc_rows],
        "model_comparison": [
            {
                "model_name": r["model_name"],
                "model_label": MODEL_LABELS[r["model_name"]],
                "eval_mae": r["eval_mae"],
                "eval_mape": r["eval_mape"],
                "eval_period": r["eval_period"],
                "final_pred_idr": r["final_pred_idr"],
                "final_lower_idr": r["final_lower_idr"],
                "final_upper_idr": r["final_upper_idr"],
                "is_selected": r["model_name"] == model,
                "is_best_mae": idx == 0,
            }
            for idx, r in enumerate(eval_rows)
        ],
    }


def query_quality(conn: sqlite3.Connection, segment: str, province_raw: str) -> dict:
    segment = validate_segment(segment)
    all_provs = get_valid_provinces(conn)
    province = province_raw or "all"
    if province != "all" and province not in all_provs:
        raise BadRequestError(f"Provinsi tidak dikenal: '{province}'.")

    etl = dict(
        conn.execute(
            """
            SELECT ms.slug, ms.label, er.min_date, er.max_date, er.raw_rows,
                   er.calendar_days, er.rows_long, er.rows_imputed, er.rows_anomaly, er.executed_at
            FROM etl_runs er
            JOIN market_segments ms ON ms.id = er.market_segment_id
            WHERE ms.slug = ?
            """,
            (segment,),
        ).fetchone()
    )

    if province == "all":
        imputed_rows = [
            dict(r)
            for r in conn.execute(
                """
                SELECT o.price_date,
                       MAX(CASE WHEN p.name = 'Gorontalo' THEN o.price_idr END) AS gorontalo_idr,
                       MAX(CASE WHEN p.name = 'Sulawesi Barat' THEN o.price_idr END) AS sulbar_idr,
                       MAX(CASE WHEN p.name = 'Sulawesi Selatan' THEN o.price_idr END) AS sulsel_idr,
                       MAX(CASE WHEN p.name = 'Sulawesi Tengah' THEN o.price_idr END) AS sulteng_idr,
                       MAX(CASE WHEN p.name = 'Sulawesi Tenggara' THEN o.price_idr END) AS sultra_idr,
                       MAX(CASE WHEN p.name = 'Sulawesi Utara' THEN o.price_idr END) AS sulut_idr,
                       COUNT(*) AS province_rows
                FROM price_observations o
                JOIN provinces p ON p.id = o.province_id
                JOIN market_segments ms ON ms.id = o.market_segment_id
                WHERE ms.slug = ? AND o.is_imputed = 1
                GROUP BY o.price_date
                ORDER BY o.price_date DESC
                """,
                (segment,),
            ).fetchall()
        ]
    else:
        imputed_rows = [
            dict(r)
            for r in conn.execute(
                """
                SELECT o.price_date, p.name AS province, o.price_idr
                FROM price_observations o
                JOIN provinces p ON p.id = o.province_id
                JOIN market_segments ms ON ms.id = o.market_segment_id
                WHERE ms.slug = ? AND p.name = ? AND o.is_imputed = 1
                ORDER BY o.price_date DESC
                """,
                (segment, province),
            ).fetchall()
        ]

    anom_params: list[str] = [segment]
    prov_clause = ""
    if province != "all":
        prov_clause = "AND p.name = ?"
        anom_params.append(province)

    anom_rows = [
        dict(r)
        for r in conn.execute(
            f"""
            SELECT o.price_date, p.name AS province, o.price_idr, o.pct_change_daily, o.anomaly_status,
                   (SELECT prev.price_idr
                    FROM price_observations prev
                    WHERE prev.market_segment_id = o.market_segment_id
                      AND prev.province_id = o.province_id
                      AND prev.price_date < o.price_date
                    ORDER BY prev.price_date DESC
                    LIMIT 1) AS prev_price_idr
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = ? {prov_clause} AND o.is_anomaly = 1
            ORDER BY o.price_date DESC, p.name ASC
            """,
            anom_params,
        ).fetchall()
    ]

    investigation_notes = [
        "Penurunan -24,94% di Sulawesi Tenggara pada 2023-11-01 (Rp 19.450 menjadi Rp 14.600 pada Pasar Modern) belum terkonfirmasi penyebabnya apakah perubahan varian beras atau perubahan pencatatan PIHPS.",
        "Sulawesi Selatan (Pasar Modern) menunjukkan pergeseran tepat Rp 1.800 antara Rp 12.650 dan Rp 14.450 pada 2022-05-31, 2022-06-14, dan 2023-01-03 yang mengindikasikan artefak pelaporan.",
        "Tingkat Produsen Sulawesi Utara mencatat lonjakan ekstrem pada 2022-04-25 (Rp 9.000 menjadi Rp 35.750) hingga 2022-10-25 (Rp 36.600 menjadi Rp 10.650); model prakiraan membatasi bobot perbedaan >25% hanya saat estimasi parameter AR(1).",
    ]

    return {
        "segment": segment,
        "province": province,
        "etl": etl,
        "imputed_dates_count": len(imputed_rows),
        "imputed_rows": imputed_rows,
        "anomalies_count": len(anom_rows),
        "anomalies": anom_rows,
        "investigation_notes": investigation_notes,
    }


def query_export(
    conn: sqlite3.Connection,
    segment: str,
    provinces_raw: str,
    from_raw: str,
    to_raw: str,
    shape: str,
    include_flags: bool,
    preview: bool,
) -> tuple[dict | None, str | None, str]:
    segment = validate_segment(segment)
    if shape not in VALID_SHAPES:
        raise BadRequestError(f"Format tabel tidak valid: '{shape}'. Gunakan long atau wide.")

    selected_provs = parse_province_list(conn, provinces_raw, default_all=True)
    bounds = conn.execute(
        """
        SELECT er.min_date, er.max_date
        FROM etl_runs er
        JOIN market_segments ms ON ms.id = er.market_segment_id
        WHERE ms.slug = ?
        """,
        (segment,),
    ).fetchone()
    start_date = validate_iso_date(from_raw or bounds["min_date"], "tanggal mulai")
    end_date = validate_iso_date(to_raw or bounds["max_date"], "tanggal akhir")
    if start_date > end_date:
        raise BadRequestError("Tanggal mulai tidak boleh melebihi tanggal akhir.")

    start_date = max(start_date, bounds["min_date"])
    end_date = min(end_date, bounds["max_date"])
    placeholders = ",".join("?" for _ in selected_provs)

    filename = f"beras_sulawesi_{segment}_{shape}.csv"

    if shape == "long":
        cols = ["tanggal", "provinsi", "harga_rp_per_kg", "pct_change_harian"]
        if include_flags:
            cols.extend(["is_imputed", "is_anomaly"])
        cols.extend(["tahun", "bulan"])

        rows_sql = conn.execute(
            f"""
            SELECT o.price_date, p.name AS province, o.price_idr, o.pct_change_daily,
                   o.is_imputed, o.is_anomaly, o.year, o.month
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = ? AND p.name IN ({placeholders})
              AND o.price_date BETWEEN ? AND ?
            ORDER BY o.price_date DESC, p.name ASC
            """,
            [segment, *selected_provs, start_date, end_date],
        ).fetchall()

        formatted = []
        for r in rows_sql:
            pct_str = "" if r["pct_change_daily"] is None else f"{r['pct_change_daily']:.4f}"
            row_vals = [r["price_date"], r["province"], r["price_idr"], pct_str]
            if include_flags:
                row_vals.extend([r["is_imputed"], r["is_anomaly"]])
            row_vals.extend([r["year"], r["month"]])
            formatted.append(row_vals)
    else:  # wide
        cols = ["tanggal", *selected_provs]
        if include_flags:
            cols.append("jumlah_imputasi_tanggal")
        rows_sql = conn.execute(
            f"""
            SELECT o.price_date, p.name AS province, o.price_idr, o.is_imputed
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = ? AND p.name IN ({placeholders})
              AND o.price_date BETWEEN ? AND ?
            ORDER BY o.price_date DESC, p.name ASC
            """,
            [segment, *selected_provs, start_date, end_date],
        ).fetchall()

        by_date: dict[str, dict[str, int]] = {}
        imp_by_date: dict[str, int] = {}
        for r in rows_sql:
            by_date.setdefault(r["price_date"], {})[r["province"]] = r["price_idr"]
            imp_by_date[r["price_date"]] = imp_by_date.get(r["price_date"], 0) + r["is_imputed"]

        formatted = []
        for dt_key in sorted(by_date.keys(), reverse=True):
            row_vals = [dt_key] + [by_date[dt_key].get(p, "") for p in selected_provs]
            if include_flags:
                row_vals.append(imp_by_date[dt_key])
            formatted.append(row_vals)

    if preview:
        return (
            {
                "filename": filename,
                "segment": segment,
                "shape": shape,
                "start_date": start_date,
                "end_date": end_date,
                "total_rows": len(formatted),
                "columns": cols,
                "rows": formatted[:5],
            },
            None,
            filename,
        )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(cols)
    writer.writerows(formatted)
    return None, buf.getvalue(), filename


class AppHandler(BaseHTTPRequestHandler):
    server_version = "BerasakAIHTTP/1.0"

    def log_message(self, format: str, *args) -> None:
        if os.environ.get("PANTAU_BERAS_QUIET") == "1":
            return
        super().log_message(format, *args)

    def send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def send_csv(self, csv_text: str, filename: str) -> None:
        raw = csv_text.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def serve_static(self, rel_path: str) -> None:
        if rel_path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        target = "index.html" if rel_path in ("", "/") else rel_path.lstrip("/")
        safe_path = (WEB_DIR / target).resolve()
        if not str(safe_path).startswith(str(WEB_DIR.resolve())) or not safe_path.is_file():
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Halaman atau berkas tidak ditemukan."})
            return
        mime, _ = mimetypes.guess_type(str(safe_path))
        if safe_path.suffix == ".css":
            mime = "text/css; charset=utf-8"
        elif safe_path.suffix == ".js":
            mime = "application/javascript; charset=utf-8"
        elif safe_path.suffix == ".html":
            mime = "text/html; charset=utf-8"
        data = safe_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if not path.startswith("/api/"):
            self.serve_static(path)
            return

        if not DB_PATH.exists():
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "Basis data SQLite belum tersedia. Jalankan pipeline/etl.py terlebih dahulu."},
            )
            return

        conn = get_conn()
        try:
            if path == "/api/health":
                self.send_json(HTTPStatus.OK, {"status": "ok", "db": str(DB_PATH.name)})
            elif path == "/api/meta":
                self.send_json(HTTPStatus.OK, query_meta(conn))
            elif path == "/api/overview":
                seg = first_param(qs, "segment", "modern")
                self.send_json(HTTPStatus.OK, query_overview(conn, seg))
            elif path == "/api/trends":
                seg = first_param(qs, "segment", "modern")
                provs = first_param(qs, "provinces", "Sulawesi Tengah,Gorontalo,Sulawesi Selatan,Sulawesi Barat")
                agg = first_param(qs, "agg", "monthly")
                rng = first_param(qs, "range", "1y")
                frm = first_param(qs, "from", "")
                to = first_param(qs, "to", "")
                self.send_json(HTTPStatus.OK, query_trends(conn, seg, provs, agg, rng, frm, to))
            elif path == "/api/compare":
                seg = first_param(qs, "segment", "modern")
                dt = first_param(qs, "date", "")
                self.send_json(HTTPStatus.OK, query_compare(conn, seg, dt))
            elif path == "/api/forecasts":
                seg = first_param(qs, "segment", "modern")
                prov = first_param(qs, "province", "Sulawesi Selatan")
                hor = first_param(qs, "horizon", "4")
                mod = first_param(qs, "model", "arima_110")
                self.send_json(HTTPStatus.OK, query_forecasts(conn, seg, prov, hor, mod))
            elif path == "/api/quality":
                seg = first_param(qs, "segment", "modern")
                prov = first_param(qs, "province", "all")
                self.send_json(HTTPStatus.OK, query_quality(conn, seg, prov))
            elif path == "/api/export":
                seg = first_param(qs, "segment", "modern")
                provs = first_param(qs, "provinces", "all")
                frm = first_param(qs, "from", "")
                to = first_param(qs, "to", "")
                shape = first_param(qs, "shape", "long")
                inc_flags = first_param(qs, "include_flags", "1") != "0"
                preview = first_param(qs, "preview", "0") == "1"
                json_data, csv_text, filename = query_export(conn, seg, provs, frm, to, shape, inc_flags, preview)
                if preview and json_data is not None:
                    self.send_json(HTTPStatus.OK, json_data)
                elif csv_text is not None:
                    self.send_csv(csv_text, filename)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Endpoint tidak ditemukan: {path}"})
        except BadRequestError as err:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(err)})
        except Exception as exc:  # pragma: no cover
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Kesalahan server: {exc}"})
        finally:
            conn.close()


def create_server(host: str = "127.0.0.1", port: int | None = None) -> ThreadingHTTPServer:
    resolved_port = int(os.environ.get("PORT", "8765")) if port is None else port
    return ThreadingHTTPServer((host, resolved_port), AppHandler)


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    srv = create_server(host=host)
    addr = srv.server_address
    print(f"berasak.ai server listening on http://{addr[0]}:{addr[1]}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.", flush=True)
        srv.shutdown()
        sys.exit(0)
