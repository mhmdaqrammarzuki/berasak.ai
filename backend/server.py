"""HTTP REST API and static frontend server for berasak.ai."""

from __future__ import annotations

import bisect
import csv
import io
import json
import math
import mimetypes
import os
import re
import sqlite3
import statistics
import sys
import uuid
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipeline.jsb_model import (  # noqa: E402
    ARTIFACTS_PATH,
    MODEL_LABEL as JSB_MODEL_LABEL,
    MODEL_NAME as JSB_MODEL_NAME,
    JsbInferenceEngine,
    aggregate_weekly,
)

DB_PATH = ROOT_DIR / "data" / "pantau_beras.db"
WEB_DIR = ROOT_DIR / "web"

VALID_SEGMENTS = {"modern", "tradisional", "produsen"}
VALID_AGGS = {"daily", "weekly", "monthly"}
VALID_RANGES = {"3m", "1y", "all", "custom"}
VALID_MODELS = {JSB_MODEL_NAME}
VALID_HORIZONS = {4, 8}
VALID_SHAPES = {"long", "wide"}

MODEL_LABELS = {
    JSB_MODEL_NAME: JSB_MODEL_LABEL,
}

VALID_PREDICT_MODELS = {JSB_MODEL_NAME}
PREDICT_MODEL_LABELS = {
    JSB_MODEL_NAME: JSB_MODEL_LABEL,
}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

_JSB_CACHE: dict[str, object] = {"mtime": None, "engine": None}


def get_jsb_engine() -> JsbInferenceEngine:
    if not ARTIFACTS_PATH.exists():
        raise FileNotFoundError(
            f"Artefak model JSB tidak ditemukan di {ARTIFACTS_PATH}. Jalankan pipeline/forecast.py terlebih dahulu."
        )
    mtime = ARTIFACTS_PATH.stat().st_mtime
    if _JSB_CACHE["engine"] is None or _JSB_CACHE["mtime"] != mtime:
        _JSB_CACHE["engine"] = JsbInferenceEngine.from_file(ARTIFACTS_PATH)
        _JSB_CACHE["mtime"] = mtime
    return _JSB_CACHE["engine"]  # type: ignore[return-value]

PREDICT_MIN_DATE = "2022-01-01"
PREDICT_MAX_DATE = "2028-12-31"
WEEKDAYS_ID = ("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")
MONTHS_SHORT_ID = ("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des")


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
                    "kind": "significant_daily_move",
                    "date": last_a["price_date"],
                    "value_pct": round(last_a["pct_change_daily"], 2),
                    "price_idr": last_a["price_idr"],
                    "message": f"Pergerakan harga harian signifikan pada {last_a['price_date']} ({last_a['pct_change_daily']:+.2f}%).",
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


def _build_jsb_info_payload(
    artifacts: dict,
    segment: str | None = None,
    province: str | None = None,
) -> dict:
    """Project JSON-safe JSB metadata, training curve, feature importance, and holdout accuracy."""
    series_eval = artifacts.get("series_eval", {}) or {}
    province_metrics: list[dict] = []
    if segment:
        for key, ev in series_eval.items():
            if ev.get("segment") == segment or key.startswith(f"{segment}::"):
                province_metrics.append(
                    {
                        "province": ev["province"],
                        "mae_4w": ev["mae_4w"],
                        "mape_4w": ev["mape_4w"],
                        "rmse_4w": ev["rmse_4w"],
                        "mae_8w": ev["mae_8w"],
                        "mape_8w": ev["mape_8w"],
                        "rmse_8w": ev["rmse_8w"],
                    }
                )
        province_metrics.sort(key=lambda item: (item["mae_4w"], item["province"]))

    selected_eval: dict | None = None
    if segment and province and province != "all":
        selected_eval = series_eval.get(f"{segment}::{province}")
    elif segment and province == "all" and province_metrics:
        n_m = len(province_metrics)
        selected_eval = {
            "segment": segment,
            "province": "all",
            "mae_4w": round(sum(m["mae_4w"] for m in province_metrics) / n_m, 2),
            "mape_4w": round(sum(m["mape_4w"] for m in province_metrics) / n_m, 2),
            "rmse_4w": round(sum(m["rmse_4w"] for m in province_metrics) / n_m, 2),
            "mae_8w": round(sum(m["mae_8w"] for m in province_metrics) / n_m, 2),
            "mape_8w": round(sum(m["mape_8w"] for m in province_metrics) / n_m, 2),
            "rmse_8w": round(sum(m["rmse_8w"] for m in province_metrics) / n_m, 2),
            "test_samples": (series_eval.get(f"{segment}::Sulawesi Selatan") or {}).get("test_samples", []),
        }

    prep = artifacts.get("preprocessing", {}) or {}
    prep_public = {
        "scaler": prep.get("scaler"),
        "continuous_dim": prep.get("continuous_dim"),
        "target_clip": prep.get("target_clip"),
        "outlier_note": prep.get("outlier_note"),
    }

    return {
        "model_name": artifacts.get("model_name", JSB_MODEL_NAME),
        "model_label": artifacts.get("model_label", JSB_MODEL_LABEL),
        "framework": artifacts.get("framework", "TensorFlow / Keras (Sequential MLP)"),
        "tensorflow_version": artifacts.get("tensorflow_version", ""),
        "keras_version": artifacts.get("keras_version", ""),
        "keras_model_file": artifacts.get("keras_model_file", "data/models/jsb_mlp.keras"),
        "holdout_start": artifacts.get("holdout_start", "2025-01-01"),
        "eval_period": artifacts.get("eval_period", "2025-01-01..2026-02-12"),
        "trained_at": artifacts.get("trained_at", ""),
        "architecture": artifacts.get("architecture", {}),
        "features": artifacts.get("features", {}),
        "preprocessing": prep_public,
        "split": artifacts.get("split", {}),
        "training": artifacts.get("training", {}),
        "loss_history": artifacts.get("loss_history", []),
        "feature_importance": artifacts.get("feature_importance", []),
        "aggregate_metrics": artifacts.get("aggregate_metrics", {}),
        "series_eval": {
            "mae_4w": selected_eval.get("mae_4w"),
            "mape_4w": selected_eval.get("mape_4w"),
            "rmse_4w": selected_eval.get("rmse_4w"),
            "mae_8w": selected_eval.get("mae_8w"),
            "mape_8w": selected_eval.get("mape_8w"),
            "rmse_8w": selected_eval.get("rmse_8w"),
            "residual_std": selected_eval.get("residual_std"),
        }
        if selected_eval
        else None,
        "holdout_samples": (selected_eval or {}).get("test_samples", []),
        "province_metrics": province_metrics,
    }


def query_jsb_info(conn: sqlite3.Connection, segment: str = "modern", province_raw: str = "Sulawesi Selatan") -> dict:
    """Return full TensorFlow/Keras JSB MLP architecture, split, loss curve, and holdout accuracy."""
    segment = validate_segment(segment or "modern")
    all_provs = get_valid_provinces(conn)
    prov_clean = (province_raw or "").strip()
    if not prov_clean:
        province = "Sulawesi Selatan"
    elif prov_clean.lower() == "all":
        province = "all"
    elif prov_clean in all_provs:
        province = prov_clean
    else:
        raise BadRequestError(f"Provinsi tidak dikenal: '{prov_clean}'.")

    engine = get_jsb_engine()
    return {
        "segment": segment,
        "province": province,
        **_build_jsb_info_payload(engine.artifacts, segment=segment, province=province),
    }


def query_forecasts(
    conn: sqlite3.Connection,
    segment: str,
    province_raw: str,
    horizon_raw: str,
    model: str = JSB_MODEL_NAME,
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

    selected_model = (model or "").strip() or JSB_MODEL_NAME
    if selected_model not in VALID_MODELS:
        raise BadRequestError(
            f"Model prakiraan tidak dikenal: '{selected_model}'. Model aktif saat ini adalah {JSB_MODEL_NAME} (JSB MLP)."
        )

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

    weekly_all = aggregate_weekly([(r["price_date"], r["price_idr"]) for r in daily])
    recent_weekly = [{"week": w, "price_idr": round(v)} for w, v in weekly_all[-26:]]
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
        (segment, province, horizon, selected_model),
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
        WHERE ms.slug = ? AND p.name = ? AND pf.horizon_weeks = ? AND pf.model_name = ?
        GROUP BY pf.model_name, pf.eval_mae, pf.eval_mape, pf.eval_period
        ORDER BY pf.eval_mae ASC
        """,
        (horizon, horizon, horizon, segment, province, horizon, selected_model),
    ).fetchall()

    engine = get_jsb_engine()
    jsb_info = _build_jsb_info_payload(engine.artifacts, segment=segment, province=province)

    return {
        "segment": segment,
        "province": province,
        "horizon_weeks": horizon,
        "selected_model": selected_model,
        "selected_model_label": MODEL_LABELS[selected_model],
        "cutoff_date": daily[-1]["price_date"],
        "latest_price_idr": daily[-1]["price_idr"],
        "change_days": change_days,
        "total_days": len(daily),
        "history_weekly": recent_weekly,
        "forecast_points": [dict(r) for r in fc_rows],
        "model_comparison": [
            {
                "model_name": r["model_name"],
                "model_label": MODEL_LABELS.get(r["model_name"], JSB_MODEL_LABEL),
                "eval_mae": r["eval_mae"],
                "eval_mape": r["eval_mape"],
                "eval_rmse": (jsb_info.get("series_eval") or {}).get(f"rmse_{horizon}w"),
                "eval_period": r["eval_period"],
                "final_pred_idr": r["final_pred_idr"],
                "final_lower_idr": r["final_lower_idr"],
                "final_upper_idr": r["final_upper_idr"],
                "is_selected": True,
                "is_best_mae": idx == 0,
            }
            for idx, r in enumerate(eval_rows)
        ],
        "jsb_info": jsb_info,
    }


def _fmt_rp_id(amount: int) -> str:
    return f"Rp {amount:,}".replace(",", ".")


def _fmt_date_id(dt: datetime) -> str:
    return f"{dt.day} {MONTHS_SHORT_ID[dt.month - 1]} {dt.year}"


def _fmt_day_label_id(dt: datetime) -> str:
    return f"{WEEKDAYS_ID[dt.weekday()]}, {dt.day} {MONTHS_SHORT_ID[dt.month - 1]}"


def _round_idr_10(value: float, minimum: int = 500) -> int:
    return max(minimum, int(round(value / 10.0) * 10))


def _status_from_delta(delta_pct: float, is_anomaly: bool = False, daily_pct: float | None = None) -> tuple[str, str]:
    abs_d = abs(delta_pct)
    if is_anomaly or delta_pct >= 5.0 or abs_d >= 7.0:
        return "Tinggi", "Perlu Atensi"
    if abs_d >= 2.0 or (daily_pct is not None and abs(daily_pct) >= 2.0):
        return "Waspada", "Fluktuatif"
    return "Stabil", "Stabil"


def _seasonal_phase_cue(month: int) -> str:
    """Describe seasonal calendar context corresponding to month_sin / month_cos JSB features."""
    if month in (3, 4, 5):
        return "fase musiman panen raya cenderung menjaga pasokan tetap longgar"
    if month in (7, 8, 9):
        return "fase musiman panen gadu cenderung menopang kestabilan pasokan"
    if month in (12, 1, 2):
        return "fase musiman akhir hingga awal tahun kerap mengiringi penguatan harga"
    return "fase musiman peralihan bulan berjalan relatif moderat"


def _build_province_predict_ctx(
    rows: list[sqlite3.Row],
    segment: str,
    province: str,
    engine: JsbInferenceEngine,
) -> dict:
    """Precompute JSB MLP multi-week forecast trajectory and residual uncertainty for one series."""
    dates = [r["price_date"] for r in rows]
    prices = [int(r["price_idr"]) for r in rows]
    row_by_date = {r["price_date"]: r for r in rows}
    last_observed_date = dates[-1]
    last_dt = datetime.strptime(last_observed_date, "%Y-%m-%d")
    p0 = prices[-1]

    weekly = aggregate_weekly([(r["price_date"], int(r["price_idr"])) for r in rows])
    weekly_vals = [float(v) for _, v in weekly]
    last_weekly_dt = datetime.strptime(weekly[-1][0], "%Y-%m-%d")
    last_w_level = max(1.0, weekly_vals[-1])

    anchor_52w = sum(prices[-365:]) / min(365, len(prices))
    long_anchor = 0.65 * p0 + 0.35 * anchor_52w
    min_bound = max(1000.0, 0.76 * long_anchor)
    max_bound = 1.24 * long_anchor

    preds_weekly, jsb_features = engine.forecast_recursive(
        weekly_vals,
        last_weekly_dt,
        segment_slug=segment,
        province_name=province,
        horizon_weeks=154,
        long_anchor=long_anchor,
    )

    trajectory_weeks = [float(p0)]
    for pred_w in preds_weekly:
        anchored_pred = float(p0) * (pred_w / last_w_level)
        trajectory_weeks.append(max(min_bound, min(max_bound, anchored_pred)))

    series_eval = (engine.artifacts.get("series_eval") or {}).get(f"{segment}::{province}", {})
    raw_sigma = float(series_eval.get("residual_std") or 0.0)
    if raw_sigma <= 0.0:
        recent_diffs = [weekly_vals[i] - weekly_vals[i - 1] for i in range(max(1, len(weekly_vals) - 52), len(weekly_vals))]
        raw_sigma = statistics.pstdev(recent_diffs) if len(recent_diffs) > 1 else 0.01 * p0
    sigma_w = max(85.0, 0.006 * p0, min(0.04 * p0, raw_sigma))

    return {
        "dates": dates,
        "prices": prices,
        "row_by_date": row_by_date,
        "last_observed_date": last_observed_date,
        "last_dt": last_dt,
        "p0": p0,
        "sigma_w": sigma_w,
        "long_anchor": long_anchor,
        "trajectory_weeks": trajectory_weeks,
        "jsb_features": jsb_features,
        "series_eval": series_eval,
    }


def _lookup_prior_obs(ctx: dict, dt_str: str) -> sqlite3.Row:
    exact = ctx["row_by_date"].get(dt_str)
    if exact is not None:
        return exact
    pos = bisect.bisect_right(ctx["dates"], dt_str) - 1
    pos = max(0, min(len(ctx["dates"]) - 1, pos))
    return ctx["row_by_date"][ctx["dates"][pos]]


def _predict_province_for_date(ctx: dict, dt: datetime, model: str = JSB_MODEL_NAME) -> dict:
    """Evaluate historical or JSB MLP forward-pass prediction + 90% interval for one province and date."""
    del model  # Single validated JSB MLP model
    dt_str = dt.strftime("%Y-%m-%d")
    if dt_str <= ctx["last_observed_date"]:
        obs = _lookup_prior_obs(ctx, dt_str)
        price = int(obs["price_idr"])
        prior_dt_str = (dt - timedelta(days=30)).strftime("%Y-%m-%d")
        base_obs = _lookup_prior_obs(ctx, prior_dt_str)
        base_price = int(base_obs["price_idr"])
        delta_idr = price - base_price
        delta_pct = round((delta_idr / max(1, base_price)) * 100.0, 2)
        status_tier, status_label = _status_from_delta(
            delta_pct, is_anomaly=obs["is_anomaly"] == 1, daily_pct=obs["pct_change_daily"]
        )
        return {
            "mode": "historical",
            "predicted_idr": price,
            "lower_idr": price,
            "upper_idr": price,
            "actual_idr": price,
            "delta_idr": delta_idr,
            "delta_pct": delta_pct,
            "status_tier": status_tier,
            "status_label": status_label,
        }

    h_days = (dt - ctx["last_dt"]).days
    h_w = h_days / 7.0
    traj = ctx["trajectory_weeks"]
    w_low = min(len(traj) - 1, max(0, int(math.floor(h_w))))
    w_high = min(len(traj) - 1, w_low + 1)
    frac = max(0.0, min(1.0, h_w - w_low))
    raw_pred = traj[w_low] * (1.0 - frac) + traj[w_high] * frac

    min_bound = max(1000.0, 0.76 * ctx["long_anchor"])
    max_bound = 1.24 * ctx["long_anchor"]
    bounded_pred = max(min_bound, min(max_bound, raw_pred))
    eff_weeks = max(0.25, min(h_w, 52.0))
    hw = max(110.0, 1.645 * ctx["sigma_w"] * math.sqrt(eff_weeks) * 0.48)

    pred_idr = _round_idr_10(bounded_pred, minimum=1000)
    lower_idr = _round_idr_10(bounded_pred - hw, minimum=500)
    upper_idr = _round_idr_10(bounded_pred + hw, minimum=1000)
    if lower_idr >= pred_idr:
        lower_idr = max(500, pred_idr - 50)
    if upper_idr <= pred_idr:
        upper_idr = pred_idr + 50

    delta_idr = pred_idr - ctx["p0"]
    delta_pct = round((delta_idr / max(1, ctx["p0"])) * 100.0, 2)
    status_tier, status_label = _status_from_delta(delta_pct)
    return {
        "mode": "predicted",
        "predicted_idr": pred_idr,
        "lower_idr": lower_idr,
        "upper_idr": upper_idr,
        "delta_idr": delta_idr,
        "delta_pct": delta_pct,
        "status_tier": status_tier,
        "status_label": status_label,
    }


def _build_predict_explanation(
    mode: str,
    province: str,
    target_dt: datetime,
    last_dt: datetime,
    predicted_idr: int,
    lower_idr: int,
    upper_idr: int,
    delta_pct: float,
    features_snap: dict | None = None,
) -> str:
    scope = "rata-rata 6 provinsi Sulawesi" if province == "all" else province
    target_id = _fmt_date_id(target_dt)
    if mode == "historical":
        if abs(delta_pct) < 0.05:
            delta_phrase = "relatif sama"
        elif delta_pct > 0:
            delta_phrase = f"naik {delta_pct:.2f}%"
        else:
            delta_phrase = f"turun {abs(delta_pct):.2f}%"
        return (
            f"Pada {target_id}, harga aktual {scope} tercatat {_fmt_rp_id(predicted_idr)} "
            f"({delta_phrase} dibanding 30 hari sebelumnya)."
        )

    seasonal_cue = _seasonal_phase_cue(target_dt.month)
    last_id = _fmt_date_id(last_dt)
    if delta_pct >= 1.0:
        dir_cue = f"proyeksi {scope} mengarah naik {delta_pct:+.2f}% dari acuan terakhir {last_id}"
    elif delta_pct <= -1.0:
        dir_cue = f"proyeksi {scope} melandai {delta_pct:+.2f}% dari acuan terakhir {last_id}"
    else:
        dir_cue = f"proyeksi {scope} bergerak stabil ({delta_pct:+.2f}%) dari acuan terakhir {last_id}"

    input_hint = ""
    if features_snap and features_snap.get("ma_4w_idr"):
        input_hint = (
            f" dari masukan rata-rata 4 minggu terakhir {_fmt_rp_id(int(features_snap['ma_4w_idr']))} "
            f"dan perubahan mingguan {features_snap.get('pct_change_1w_pct', 0.0):+.2f}%"
        )

    range_text = f"Kisaran wajar 90% berada di {_fmt_rp_id(lower_idr)} hingga {_fmt_rp_id(upper_idr)}."
    return (
        f"Berdasarkan Jaringan Syaraf Buatan (JSB MLP 2 hidden layer ReLU){input_hint}, "
        f"{seasonal_cue} sehingga {dir_cue}. {range_text}"
    )


def query_predict_date(
    conn: sqlite3.Connection,
    segment: str = "modern",
    province_raw: str = "Sulawesi Selatan",
    target_date_raw: str = "",
    model: str = JSB_MODEL_NAME,
) -> dict:
    """Return historical observation or JSB MLP date-based prediction for a segment and province."""
    segment = validate_segment(segment or "modern")
    all_provs = get_valid_provinces(conn)

    prov_clean = (province_raw or "").strip()
    if not prov_clean:
        province = "Sulawesi Selatan"
    elif prov_clean.lower() == "all":
        province = "all"
    elif prov_clean in all_provs:
        province = prov_clean
    else:
        raise BadRequestError(f"Provinsi tidak dikenal: '{prov_clean}'.")

    raw_date = (target_date_raw or "").strip() or datetime.now().date().isoformat()
    target_date = validate_iso_date(raw_date, "tanggal target")
    if target_date < PREDICT_MIN_DATE or target_date > PREDICT_MAX_DATE:
        raise BadRequestError(
            f"Tanggal target harus berada di antara {PREDICT_MIN_DATE} dan {PREDICT_MAX_DATE}, diterima '{target_date}'."
        )

    selected_model = (model or "").strip() or JSB_MODEL_NAME
    if selected_model not in VALID_PREDICT_MODELS:
        raise BadRequestError(
            f"Model prediksi tidak dikenal: '{selected_model}'. Model aktif saat ini adalah {JSB_MODEL_NAME} (JSB MLP)."
        )

    obs_rows = conn.execute(
        """
        SELECT p.name AS province, o.price_date, o.price_idr, o.pct_change_daily,
               o.is_anomaly, o.year, o.month
        FROM price_observations o
        JOIN provinces p ON p.id = o.province_id
        JOIN market_segments ms ON ms.id = o.market_segment_id
        WHERE ms.slug = ?
        ORDER BY p.name ASC, o.price_date ASC
        """,
        (segment,),
    ).fetchall()

    grouped: dict[str, list[sqlite3.Row]] = {}
    for r in obs_rows:
        grouped.setdefault(r["province"], []).append(r)

    engine = get_jsb_engine()
    ctx_by_prov = {
        prov_name: _build_province_predict_ctx(p_rows, segment, prov_name, engine)
        for prov_name, p_rows in grouped.items()
    }
    target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    max_cap_dt = datetime.strptime(PREDICT_MAX_DATE, "%Y-%m-%d")
    outlook_start = min(target_dt, max_cap_dt - timedelta(days=6))

    province_comparison: list[dict] = []
    target_by_prov: dict[str, dict] = {}
    for prov_name in all_provs:
        ctx = ctx_by_prov[prov_name]
        res = _predict_province_for_date(ctx, target_dt, selected_model)
        target_by_prov[prov_name] = res
        province_comparison.append(
            {
                "province": prov_name,
                "predicted_idr": res["predicted_idr"],
                "lower_idr": res["lower_idr"],
                "upper_idr": res["upper_idr"],
                "last_observed_idr": ctx["p0"],
                "delta_idr": res["delta_idr"],
                "delta_pct": res["delta_pct"],
                "mode": res["mode"],
                "status_tier": res["status_tier"],
                "status_label": res["status_label"],
            }
        )
    province_comparison.sort(key=lambda item: (item["predicted_idr"], item["province"]))

    arch = engine.artifacts.get("architecture", {}) or {}
    layers_summary = "17 Fitur -> 32 (ReLU) -> 16 (ReLU) -> 1 (Linear)"

    if province == "all":
        n_prov = len(all_provs)
        last_observed_date = max(ctx_by_prov[p]["last_observed_date"] for p in all_provs)
        last_dt = datetime.strptime(last_observed_date, "%Y-%m-%d")
        last_observed_idr = _round_idr_10(sum(ctx_by_prov[p]["p0"] for p in all_provs) / n_prov, minimum=1000)

        avg_pred_raw = sum(target_by_prov[p]["predicted_idr"] for p in all_provs) / n_prov
        avg_low_raw = sum(target_by_prov[p]["lower_idr"] for p in all_provs) / n_prov
        avg_high_raw = sum(target_by_prov[p]["upper_idr"] for p in all_provs) / n_prov
        predicted_idr = _round_idr_10(avg_pred_raw, minimum=1000)

        mode = "historical" if target_date <= last_observed_date else "predicted"
        if mode == "historical":
            lower_idr = predicted_idr
            upper_idr = predicted_idr
            prior_str = (target_dt - timedelta(days=30)).strftime("%Y-%m-%d")
            base_avg = sum(int(_lookup_prior_obs(ctx_by_prov[p], prior_str)["price_idr"]) for p in all_provs) / n_prov
            delta_idr = predicted_idr - _round_idr_10(base_avg, minimum=1000)
            delta_pct = round((delta_idr / max(1.0, base_avg)) * 100.0, 2)
        else:
            lower_idr = _round_idr_10(avg_low_raw, minimum=500)
            upper_idr = _round_idr_10(avg_high_raw, minimum=1000)
            if lower_idr >= predicted_idr:
                lower_idr = max(500, predicted_idr - 50)
            if upper_idr <= predicted_idr:
                upper_idr = predicted_idr + 50
            delta_idr = predicted_idr - last_observed_idr
            delta_pct = round((delta_idr / max(1, last_observed_idr)) * 100.0, 2)

        status_tier, status_label = _status_from_delta(delta_pct)
        reg_features = {
            "lag_1w_idr": round(sum(ctx_by_prov[p]["jsb_features"]["lag_1w_idr"] for p in all_provs) / n_prov),
            "lag_2w_idr": round(sum(ctx_by_prov[p]["jsb_features"]["lag_2w_idr"] for p in all_provs) / n_prov),
            "lag_4w_idr": round(sum(ctx_by_prov[p]["jsb_features"]["lag_4w_idr"] for p in all_provs) / n_prov),
            "ma_4w_idr": round(sum(ctx_by_prov[p]["jsb_features"]["ma_4w_idr"] for p in all_provs) / n_prov),
            "pct_change_1w_pct": round(sum(ctx_by_prov[p]["jsb_features"]["pct_change_1w_pct"] for p in all_provs) / n_prov, 2),
            "pct_change_4w_pct": round(sum(ctx_by_prov[p]["jsb_features"]["pct_change_4w_pct"] for p in all_provs) / n_prov, 2),
            "target_month": target_dt.month,
            "segment": segment,
        }
        seg_evals = [ctx_by_prov[p]["series_eval"] for p in all_provs if ctx_by_prov[p]["series_eval"]]
        avg_mae_4w = round(sum(e["mae_4w"] for e in seg_evals) / len(seg_evals), 2) if seg_evals else None
        avg_mape_4w = round(sum(e["mape_4w"] for e in seg_evals) / len(seg_evals), 2) if seg_evals else None

        daily_outlook: list[dict] = []
        for offset in range(7):
            d_dt = outlook_start + timedelta(days=offset)
            d_str = d_dt.strftime("%Y-%m-%d")
            if d_str == target_date:
                d_pred, d_low, d_high = predicted_idr, lower_idr, upper_idr
            else:
                day_items = [_predict_province_for_date(ctx_by_prov[p], d_dt, selected_model) for p in all_provs]
                d_pred = _round_idr_10(sum(x["predicted_idr"] for x in day_items) / n_prov, minimum=1000)
                if d_str <= last_observed_date:
                    d_low = d_pred
                    d_high = d_pred
                else:
                    d_low = _round_idr_10(sum(x["lower_idr"] for x in day_items) / n_prov, minimum=500)
                    d_high = _round_idr_10(sum(x["upper_idr"] for x in day_items) / n_prov, minimum=1000)
                    if d_low >= d_pred:
                        d_low = max(500, d_pred - 50)
                    if d_high <= d_pred:
                        d_high = d_pred + 50
            daily_outlook.append(
                {
                    "date": d_str,
                    "day_label": _fmt_day_label_id(d_dt),
                    "predicted_idr": d_pred,
                    "lower_idr": d_low,
                    "upper_idr": d_high,
                    "is_target": d_str == target_date,
                }
            )

        cheapest = province_comparison[0]
        most_exp = province_comparison[-1]
        disparity_idr = most_exp["predicted_idr"] - cheapest["predicted_idr"]
        disparity_pct = round((disparity_idr / max(1, cheapest["predicted_idr"])) * 100.0, 1)

        payload = {
            "segment": segment,
            "province": "all",
            "target_date": target_date,
            "model": selected_model,
            "model_label": PREDICT_MODEL_LABELS[selected_model],
            "mode": mode,
            "last_observed_date": last_observed_date,
            "last_observed_idr": last_observed_idr,
            "predicted_idr": predicted_idr,
            "lower_idr": lower_idr,
            "upper_idr": upper_idr,
            "delta_idr": delta_idr,
            "delta_pct": delta_pct,
            "confidence_label": "Data Aktual" if mode == "historical" else "Estimasi 90%",
            "status_tier": status_tier,
            "status_label": status_label,
            "explanation": _build_predict_explanation(
                mode,
                "all",
                target_dt,
                last_dt,
                predicted_idr,
                lower_idr,
                upper_idr,
                delta_pct,
                reg_features,
            ),
            "daily_outlook": daily_outlook,
            "province_comparison": province_comparison,
            "provinces": province_comparison,
            "jsb_features": reg_features,
            "jsb_meta": {
                "model_name": JSB_MODEL_NAME,
                "framework": engine.artifacts.get("framework", "TensorFlow / Keras (Sequential MLP)"),
                "layers_summary": layers_summary,
                "hidden_layers": arch.get("hidden_layers", 2),
                "eval_mae_4w": avg_mae_4w,
                "eval_mape_4w": avg_mape_4w,
            },
            "regional_summary": {
                "avg_predicted_idr": predicted_idr,
                "avg_lower_idr": lower_idr,
                "avg_upper_idr": upper_idr,
                "avg_last_observed_idr": last_observed_idr,
                "disparity_idr": disparity_idr,
                "disparity_pct": disparity_pct,
                "cheapest": {"province": cheapest["province"], "predicted_idr": cheapest["predicted_idr"]},
                "most_expensive": {"province": most_exp["province"], "predicted_idr": most_exp["predicted_idr"]},
            },
        }
        if mode == "historical":
            payload["actual_idr"] = predicted_idr
        return payload

    ctx = ctx_by_prov[province]
    res = target_by_prov[province]
    mode = res["mode"]

    daily_outlook = []
    for offset in range(7):
        d_dt = outlook_start + timedelta(days=offset)
        d_str = d_dt.strftime("%Y-%m-%d")
        day_res = res if d_str == target_date else _predict_province_for_date(ctx, d_dt, selected_model)
        daily_outlook.append(
            {
                "date": d_str,
                "day_label": _fmt_day_label_id(d_dt),
                "predicted_idr": day_res["predicted_idr"],
                "lower_idr": day_res["lower_idr"],
                "upper_idr": day_res["upper_idr"],
                "is_target": d_str == target_date,
            }
        )

    prov_features = {
        **ctx["jsb_features"],
        "target_month": target_dt.month,
        "segment": segment,
        "province": province,
    }
    s_eval = ctx["series_eval"] or {}

    payload = {
        "segment": segment,
        "province": province,
        "target_date": target_date,
        "model": selected_model,
        "model_label": PREDICT_MODEL_LABELS[selected_model],
        "mode": mode,
        "last_observed_date": ctx["last_observed_date"],
        "last_observed_idr": ctx["p0"],
        "predicted_idr": res["predicted_idr"],
        "lower_idr": res["lower_idr"],
        "upper_idr": res["upper_idr"],
        "delta_idr": res["delta_idr"],
        "delta_pct": res["delta_pct"],
        "confidence_label": "Data Aktual" if mode == "historical" else "Estimasi 90%",
        "status_tier": res["status_tier"],
        "status_label": res["status_label"],
        "explanation": _build_predict_explanation(
            mode,
            province,
            target_dt,
            ctx["last_dt"],
            res["predicted_idr"],
            res["lower_idr"],
            res["upper_idr"],
            res["delta_pct"],
            prov_features,
        ),
        "daily_outlook": daily_outlook,
        "province_comparison": province_comparison,
        "jsb_features": prov_features,
        "jsb_meta": {
            "model_name": JSB_MODEL_NAME,
            "framework": engine.artifacts.get("framework", "TensorFlow / Keras (Sequential MLP)"),
            "layers_summary": layers_summary,
            "hidden_layers": arch.get("hidden_layers", 2),
            "eval_mae_4w": s_eval.get("mae_4w"),
            "eval_mape_4w": s_eval.get("mape_4w"),
        },
    }
    if mode == "historical":
        payload["actual_idr"] = res["actual_idr"]
    return payload


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
        "Tingkat Produsen Sulawesi Utara mencatat lonjakan ekstrem pada 2022-04-25 (Rp 9.000 menjadi Rp 35.750) hingga 2022-10-25 (Rp 36.600 menjadi Rp 10.650); tahap prapemrosesan JSB membatasi lonjakan mingguan ekstrem agar bobot jaringan syaraf tetap stabil selama pelatihan.",
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


def _ensure_contact_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            topic TEXT NOT NULL,
            message TEXT NOT NULL,
            submitted_at TEXT NOT NULL
        )
        """
    )


def handle_contact_submission(conn: sqlite3.Connection, payload: dict) -> dict:
    """Validate and persist a contact inquiry into SQLite."""
    if not isinstance(payload, dict):
        raise BadRequestError("Data formulir harus berupa objek JSON.")

    raw_name = payload.get("name")
    name = raw_name.strip() if isinstance(raw_name, str) else ""
    if not (2 <= len(name) <= 120):
        raise BadRequestError("Nama lengkap wajib diisi minimal 2 huruf.")

    raw_email = payload.get("email")
    email = raw_email.strip() if isinstance(raw_email, str) else ""
    if len(email) > 160 or not EMAIL_RE.match(email):
        raise BadRequestError("Format alamat email tidak valid.")

    raw_topic = payload.get("topic")
    if raw_topic is None:
        topic = "Pertanyaan Umum"
    elif isinstance(raw_topic, str):
        topic = raw_topic.strip()
    else:
        topic = ""
    if not (2 <= len(topic) <= 120):
        raise BadRequestError("Topik pesan wajib dipilih.")

    raw_message = payload.get("message")
    message = raw_message.strip() if isinstance(raw_message, str) else ""
    if not (10 <= len(message) <= 2000):
        raise BadRequestError("Pesan minimal 10 karakter (maksimal 2.000 karakter).")

    reference_id = f"BRS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    submitted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    _ensure_contact_table(conn)
    conn.execute(
        """
        INSERT INTO contact_messages (reference_id, name, email, topic, message, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (reference_id, name, email, topic, message, submitted_at),
    )
    conn.commit()
    return {
        "status": "received",
        "reference_id": reference_id,
        "submitted_at": submitted_at,
        "name": name,
        "email": email,
        "topic": topic,
        "message": "Pesan Anda berhasil dikirim dan tercatat oleh tim layanan pengguna berasak.ai.",
    }


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
        suffix = safe_path.suffix.lower()
        if suffix == ".css":
            mime = "text/css; charset=utf-8"
        elif suffix == ".js":
            mime = "application/javascript; charset=utf-8"
        elif suffix == ".html":
            mime = "text/html; charset=utf-8"
        elif suffix == ".png":
            mime = "image/png"
        elif suffix == ".svg":
            mime = "image/svg+xml"
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
                mod = first_param(qs, "model", JSB_MODEL_NAME)
                self.send_json(HTTPStatus.OK, query_forecasts(conn, seg, prov, hor, mod))
            elif path == "/api/jsb-info":
                seg = first_param(qs, "segment", "modern")
                prov = first_param(qs, "province", "Sulawesi Selatan")
                self.send_json(HTTPStatus.OK, query_jsb_info(conn, seg, prov))
            elif path == "/api/predict-date":
                seg = first_param(qs, "segment", "modern")
                prov = first_param(qs, "province", "Sulawesi Selatan")
                dt = first_param(qs, "date", "")
                mod = first_param(qs, "model", JSB_MODEL_NAME)
                self.send_json(HTTPStatus.OK, query_predict_date(conn, seg, prov, dt, mod))
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

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/contact":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Endpoint tidak ditemukan: {path}"})
            return

        raw_len = self.headers.get("Content-Length", "")
        try:
            length = int(raw_len)
        except (TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Header Content-Length tidak valid."})
            return

        if length < 1 or length > 65536:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "Ukuran payload harus antara 1 hingga 65.536 byte."},
            )
            return

        raw_body = self.rfile.read(length)
        if len(raw_body) != length:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Isi permintaan tidak lengkap."})
            return

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Body permintaan harus berupa JSON UTF-8 yang valid."})
            return

        if not DB_PATH.exists():
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "Basis data SQLite belum tersedia. Jalankan pipeline/etl.py terlebih dahulu."},
            )
            return

        conn = get_conn()
        try:
            result = handle_contact_submission(conn, payload)
            self.send_json(HTTPStatus.CREATED, result)
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
