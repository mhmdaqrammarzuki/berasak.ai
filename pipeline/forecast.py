"""JSB MLP time-series forecasting pipeline and verified snapshot generator."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import sqlite3
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipeline.jsb_model import (  # noqa: E402
    ARTIFACTS_PATH,
    HOLDOUT_START,
    MODEL_LABEL,
    MODEL_NAME,
    JsbInferenceEngine,
    aggregate_weekly,
    train_and_save_jsb,
)

DB_PATH = ROOT_DIR / "data" / "pantau_beras.db"
SNAPSHOT_PATH = ROOT_DIR / "data" / "verified_figma_snapshot.json"

HORIZONS = (4, 8)
MODELS = (MODEL_NAME,)


def evaluate_holdout(
    weekly: list[tuple[str, float]],
    segment_slug: str,
    province_name: str,
    engine: JsbInferenceEngine,
    horizon: int,
) -> dict:
    """Chronological walk-forward evaluation for origins in HOLDOUT_START..end."""
    dates = [w for w, _ in weekly]
    vals = [v for _, v in weekly]
    start_idx = next((i for i, d in enumerate(dates) if d >= HOLDOUT_START), len(vals) // 2)
    start_idx = max(start_idx, 53)

    abs_errors: list[float] = []
    pct_errors: list[float] = []
    sq_errors: list[float] = []
    step_residuals: list[list[float]] = [[] for _ in range(horizon)]
    step1_points: list[dict] = []

    for origin in range(start_idx, len(vals) - horizon + 1):
        hist = vals[:origin]
        origin_last_dt = datetime.strptime(dates[origin - 1], "%Y-%m-%d")
        preds, _ = engine.forecast_recursive(
            hist,
            origin_last_dt,
            segment_slug=segment_slug,
            province_name=province_name,
            horizon_weeks=horizon,
        )
        for s in range(horizon):
            actual = vals[origin + s]
            err = actual - preds[s]
            abs_errors.append(abs(err))
            pct_errors.append(abs(err) / actual * 100.0)
            sq_errors.append(err * err)
            step_residuals[s].append(err)

        target_week = dates[origin]
        actual_1 = round(vals[origin])
        pred_1 = max(1000, round(preds[0]))
        diff_1 = pred_1 - actual_1
        step1_points.append(
            {
                "week_date": target_week,
                "actual_idr": actual_1,
                "predicted_idr": pred_1,
                "error_idr": diff_1,
                "error_pct": round(abs(diff_1) / max(1, actual_1) * 100.0, 2),
            }
        )

    mae = sum(abs_errors) / len(abs_errors)
    mape = sum(pct_errors) / len(pct_errors)
    rmse = math.sqrt(sum(sq_errors) / len(sq_errors))

    step_stds: list[float] = []
    for res in step_residuals:
        if len(res) >= 2:
            rms = math.sqrt(sum(e * e for e in res) / len(res))
            step_stds.append(max(rms, 85.0))
        else:
            step_stds.append(max(mae * 1.25, 85.0))

    # Pick up to 8 evenly spaced test samples covering start through end of holdout
    if len(step1_points) > 8:
        indices = sorted({round(i * (len(step1_points) - 1) / 7) for i in range(8)})
        samples = [step1_points[i] for i in indices]
    else:
        samples = step1_points

    return {
        "mae": round(mae, 2),
        "mape": round(mape, 2),
        "rmse": round(rmse, 2),
        "step_stds": step_stds,
        "residual_std": round(step_stds[0], 2),
        "test_samples": samples,
    }


def run_forecasts() -> dict[str, list[dict]]:
    """Train TF/Keras JSB MLP, evaluate on holdout, and store 4w/8w forecasts."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        commodity_id = conn.execute("SELECT id FROM commodities WHERE slug = 'beras'").fetchone()["id"]
        segments = conn.execute("SELECT id, slug, label FROM market_segments ORDER BY id").fetchall()
        provinces = conn.execute("SELECT id, name FROM provinces ORDER BY name").fetchall()

        weekly_by_series: dict[tuple[str, str], list[tuple[str, float]]] = {}
        daily_by_series: dict[tuple[str, str], list[sqlite3.Row]] = {}
        for seg in segments:
            for prov in provinces:
                daily = conn.execute(
                    """
                    SELECT price_date, price_idr
                    FROM price_observations
                    WHERE market_segment_id = ? AND province_id = ?
                    ORDER BY price_date ASC
                    """,
                    (seg["id"], prov["id"]),
                ).fetchall()
                key = (seg["slug"], prov["name"])
                daily_by_series[key] = daily
                weekly_by_series[key] = aggregate_weekly([(r["price_date"], r["price_idr"]) for r in daily])

        artifacts = train_and_save_jsb(weekly_by_series)
        engine = JsbInferenceEngine(artifacts)
        trained_at = artifacts["trained_at"]

        summary_by_seg: dict[str, list[dict]] = {}
        series_eval: dict[str, dict] = {}
        insert_rows: list[tuple] = []

        for seg in segments:
            seg_list: list[dict] = []
            for prov in provinces:
                key = (seg["slug"], prov["name"])
                daily = daily_by_series[key]
                weekly = weekly_by_series[key]
                last_date = datetime.strptime(daily[-1]["price_date"], "%Y-%m-%d")
                last_weekly_dt = datetime.strptime(weekly[-1][0], "%Y-%m-%d")
                vals = [v for _, v in weekly]

                eval_by_horizon: dict[int, dict] = {}
                for horizon in HORIZONS:
                    ev = evaluate_holdout(weekly, seg["slug"], prov["name"], engine, horizon)
                    eval_by_horizon[horizon] = ev
                    preds, _ = engine.forecast_recursive(
                        vals,
                        last_weekly_dt,
                        segment_slug=seg["slug"],
                        province_name=prov["name"],
                        horizon_weeks=horizon,
                    )
                    for s_idx, pred in enumerate(preds):
                        step_week = s_idx + 1
                        target_dt = last_date + timedelta(days=7 * step_week)
                        margin = 1.645 * ev["step_stds"][s_idx]
                        pred_int = max(1000, round(pred))
                        lower_int = max(1000, round(pred - margin))
                        upper_int = max(pred_int, round(pred + margin))
                        insert_rows.append(
                            (
                                commodity_id,
                                seg["id"],
                                prov["id"],
                                MODEL_NAME,
                                horizon,
                                step_week,
                                target_dt.strftime("%Y-%m-%d"),
                                pred_int,
                                lower_int,
                                upper_int,
                                ev["mae"],
                                ev["mape"],
                                artifacts["eval_period"],
                                trained_at,
                            )
                        )
                    if horizon == 4:
                        seg_list.append(
                            {
                                "province": prov["name"],
                                "model": MODEL_NAME,
                                "mae": ev["mae"],
                                "mape": ev["mape"],
                                "rmse": ev["rmse"],
                                "week4_pred": round(preds[-1]),
                            }
                        )

                ev4 = eval_by_horizon[4]
                ev8 = eval_by_horizon[8]
                series_eval[f"{seg['slug']}::{prov['name']}"] = {
                    "segment": seg["slug"],
                    "province": prov["name"],
                    "mae_4w": ev4["mae"],
                    "mape_4w": ev4["mape"],
                    "rmse_4w": ev4["rmse"],
                    "mae_8w": ev8["mae"],
                    "mape_8w": ev8["mape"],
                    "rmse_8w": ev8["rmse"],
                    "residual_std": round(max(ev4["residual_std"], ev8["residual_std"] * 0.85), 2),
                    "test_samples": ev4["test_samples"],
                }
            summary_by_seg[seg["slug"]] = seg_list

        eval_items = list(series_eval.values())
        artifacts["series_eval"] = series_eval
        artifacts["aggregate_metrics"] = {
            "series_count": len(eval_items),
            "avg_mae_4w": round(sum(x["mae_4w"] for x in eval_items) / len(eval_items), 2),
            "avg_mape_4w": round(sum(x["mape_4w"] for x in eval_items) / len(eval_items), 2),
            "avg_rmse_4w": round(sum(x["rmse_4w"] for x in eval_items) / len(eval_items), 2),
            "avg_mae_8w": round(sum(x["mae_8w"] for x in eval_items) / len(eval_items), 2),
            "avg_mape_8w": round(sum(x["mape_8w"] for x in eval_items) / len(eval_items), 2),
            "avg_rmse_8w": round(sum(x["rmse_8w"] for x in eval_items) / len(eval_items), 2),
        }
        ARTIFACTS_PATH.write_text(json.dumps(artifacts, indent=2), encoding="utf-8")

        conn.execute("DELETE FROM price_forecasts")
        conn.executemany(
            """
            INSERT INTO price_forecasts (
                commodity_id, market_segment_id, province_id, model_name,
                horizon_weeks, step_week, target_date, predicted_idr,
                lower_idr, upper_idr, eval_mae, eval_mape, eval_period, trained_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            insert_rows,
        )
        conn.commit()
        build_verified_snapshot(conn, artifacts)
        return summary_by_seg
    finally:
        conn.close()


def build_verified_snapshot(conn: sqlite3.Connection, artifacts: dict | None = None) -> None:
    """Write a complete verified JSON snapshot including JSB evaluation summary."""
    etl_rows = [
        dict(r)
        for r in conn.execute(
            """
            SELECT ms.slug, ms.label, er.min_date, er.max_date, er.raw_rows,
                   er.calendar_days, er.rows_long, er.rows_imputed, er.rows_anomaly
            FROM etl_runs er
            JOIN market_segments ms ON ms.id = er.market_segment_id
            ORDER BY ms.id
            """
        ).fetchall()
    ]

    latest_date = "2026-02-12"
    provinces = [r["name"] for r in conn.execute("SELECT name FROM provinces ORDER BY name").fetchall()]
    latest_by_segment: dict[str, list[dict]] = {}
    for seg_slug in ("modern", "tradisional", "produsen"):
        rows = conn.execute(
            """
            SELECT p.name AS province, o.price_idr
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = ? AND o.price_date = ?
            ORDER BY o.price_idr ASC
            """,
            (seg_slug, latest_date),
        ).fetchall()

        enriched = []
        for r in rows:
            prov_name = r["province"]
            hist = conn.execute(
                """
                SELECT o.price_date, o.price_idr
                FROM price_observations o
                JOIN provinces p ON p.id = o.province_id
                JOIN market_segments ms ON ms.id = o.market_segment_id
                WHERE ms.slug = ? AND p.name = ?
                ORDER BY o.price_date ASC
                """,
                (seg_slug, prov_name),
            ).fetchall()
            prices = [h["price_idr"] for h in hist]
            p_now = prices[-1]
            p_7d = prices[-8]
            p_30d = prices[-31]
            change_days = sum(1 for i in range(1, len(prices)) if prices[i] != prices[i - 1])
            spark = [prices[i] for i in range(len(prices) - 90, len(prices), 3)]
            if spark[-1] != p_now:
                spark.append(p_now)
            enriched.append(
                {
                    "province": prov_name,
                    "price_idr": p_now,
                    "pct_7d": round((p_now - p_7d) / p_7d * 100.0, 2),
                    "pct_30d": round((p_now - p_30d) / p_30d * 100.0, 2),
                    "change_days": change_days,
                    "spark_90d": spark,
                }
            )
        latest_by_segment[seg_slug] = enriched

    margin_table = []
    for prov_name in provinces:
        p_mod = next(x["price_idr"] for x in latest_by_segment["modern"] if x["province"] == prov_name)
        p_trad = next(x["price_idr"] for x in latest_by_segment["tradisional"] if x["province"] == prov_name)
        p_prod = next(x["price_idr"] for x in latest_by_segment["produsen"] if x["province"] == prov_name)
        spread = p_mod - p_prod
        margin_table.append(
            {
                "province": prov_name,
                "produsen_idr": p_prod,
                "tradisional_idr": p_trad,
                "modern_idr": p_mod,
                "spread_idr": spread,
                "spread_pct": round(spread / p_prod * 100.0, 1),
            }
        )
    margin_table.sort(key=lambda x: x["spread_idr"], reverse=True)

    trend_provs = ["Sulawesi Tengah", "Gorontalo", "Sulawesi Selatan", "Sulawesi Barat"]
    monthly_series: dict[str, list[dict]] = {}
    for prov_name in trend_provs:
        mrows = conn.execute(
            """
            SELECT o.year, o.month, ROUND(AVG(o.price_idr)) AS avg_price
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = 'modern' AND p.name = ?
              AND ((o.year = 2025 AND o.month >= 3) OR o.year = 2026)
            GROUP BY o.year, o.month
            ORDER BY o.year, o.month
            """,
            (prov_name,),
        ).fetchall()
        monthly_series[prov_name] = [
            {"label": f"{r['year']}-{r['month']:02d}", "price": int(r["avg_price"])} for r in mrows
        ]

    sulsel_daily = conn.execute(
        """
        SELECT o.price_date, o.price_idr
        FROM price_observations o
        JOIN provinces p ON p.id = o.province_id
        JOIN market_segments ms ON ms.id = o.market_segment_id
        WHERE ms.slug = 'modern' AND p.name = 'Sulawesi Selatan'
        ORDER BY o.price_date ASC
        """
    ).fetchall()
    sulsel_weekly = aggregate_weekly([(r["price_date"], r["price_idr"]) for r in sulsel_daily])[-16:]

    sulsel_forecasts: dict[str, dict] = {}
    for model_name in MODELS:
        fc_rows = conn.execute(
            """
            SELECT pf.step_week, pf.target_date, pf.predicted_idr, pf.lower_idr, pf.upper_idr,
                   pf.eval_mae, pf.eval_mape
            FROM price_forecasts pf
            JOIN provinces p ON p.id = pf.province_id
            JOIN market_segments ms ON ms.id = pf.market_segment_id
            WHERE ms.slug = 'modern' AND p.name = 'Sulawesi Selatan'
              AND pf.model_name = ? AND pf.horizon_weeks = 4
            ORDER BY pf.step_week ASC
            """,
            (model_name,),
        ).fetchall()
        sulsel_forecasts[model_name] = {
            "model_label": MODEL_LABEL,
            "eval_mae": fc_rows[0]["eval_mae"],
            "eval_mape": fc_rows[0]["eval_mape"],
            "points": [dict(r) for r in fc_rows],
        }

    imputed_dates_modern = [
        dict(r)
        for r in conn.execute(
            """
            SELECT o.price_date,
                   MAX(CASE WHEN p.name = 'Sulawesi Selatan' THEN o.price_idr END) AS sulsel_idr,
                   MAX(CASE WHEN p.name = 'Sulawesi Tengah' THEN o.price_idr END) AS sulteng_idr
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = 'modern' AND o.is_imputed = 1
            GROUP BY o.price_date
            ORDER BY o.price_date DESC
            """
        ).fetchall()
    ]

    anomalies_modern = [
        dict(r)
        for r in conn.execute(
            """
            SELECT o.price_date, p.name AS province, o.price_idr, o.pct_change_daily, o.anomaly_status
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = 'modern' AND o.is_anomaly = 1
            ORDER BY o.price_date DESC
            """
        ).fetchall()
    ]

    if artifacts is None and ARTIFACTS_PATH.exists():
        artifacts = json.loads(ARTIFACTS_PATH.read_text(encoding="utf-8"))

    jsb_summary = {}
    if artifacts:
        jsb_summary = {
            "model_name": artifacts.get("model_name"),
            "model_label": artifacts.get("model_label"),
            "framework": artifacts.get("framework"),
            "tensorflow_version": artifacts.get("tensorflow_version"),
            "architecture": artifacts.get("architecture"),
            "split": artifacts.get("split"),
            "training": artifacts.get("training"),
            "aggregate_metrics": artifacts.get("aggregate_metrics"),
        }

    snapshot = {
        "latest_date": latest_date,
        "etl_runs": etl_rows,
        "latest_by_segment": latest_by_segment,
        "margin_table_2026_02_12": margin_table,
        "modern_monthly_trend_12m": monthly_series,
        "sulsel_modern_weekly_16w": [
            {"week": w, "price": round(v)} for w, v in sulsel_weekly
        ],
        "sulsel_modern_forecasts_4w": sulsel_forecasts,
        "jsb_summary": jsb_summary,
        "modern_imputed_dates_r3": imputed_dates_modern,
        "modern_anomalies_r5": anomalies_modern,
    }
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")


if __name__ == "__main__":
    out = run_forecasts()
    for slug, rows in out.items():
        print(f"=== Forecast Eval (4w) [{slug}] ===")
        for row in rows:
            print(
                f"  {row['province']:20s} | {row['model']:10s} | "
                f"MAE=Rp{row['mae']:.1f} | MAPE={row['mape']:.2f}% | RMSE=Rp{row['rmse']:.1f} | W4=Rp{row['week4_pred']}"
            )
