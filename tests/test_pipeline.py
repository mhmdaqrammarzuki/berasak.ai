"""Verification suite for ETL (R1-R7) and forecasting models."""

from __future__ import annotations

import json
import sqlite3
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipeline.jsb_model import (  # noqa: E402
    ARTIFACTS_PATH,
    HOLDOUT_START,
    KERAS_MODEL_PATH,
    MODEL_NAME,
    JsbInferenceEngine,
    aggregate_weekly,
    build_feature_vector,
)

DB_PATH = ROOT_DIR / "data" / "pantau_beras.db"
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
SNAPSHOT_PATH = ROOT_DIR / "data" / "verified_figma_snapshot.json"


class TestPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.conn = sqlite3.connect(DB_PATH)
        cls.conn.row_factory = sqlite3.Row

    @classmethod
    def tearDownClass(cls) -> None:
        cls.conn.close()

    def test_etl_counts_all_segments(self) -> None:
        runs = {
            r["slug"]: dict(r)
            for r in self.conn.execute(
                """
                SELECT ms.slug, er.raw_rows, er.calendar_days, er.rows_long,
                       er.rows_imputed, er.rows_anomaly, er.min_date, er.max_date
                FROM etl_runs er
                JOIN market_segments ms ON ms.id = er.market_segment_id
                """
            ).fetchall()
        }
        self.assertEqual(set(runs.keys()), {"modern", "tradisional", "produsen"})

        self.assertEqual(runs["modern"]["raw_rows"], 1493)
        self.assertEqual(runs["modern"]["calendar_days"], 1504)
        self.assertEqual(runs["modern"]["rows_long"], 9024)
        self.assertEqual(runs["modern"]["rows_imputed"], 66)
        self.assertEqual(runs["modern"]["rows_anomaly"], 12)

        self.assertEqual(runs["tradisional"]["raw_rows"], 1415)
        self.assertEqual(runs["tradisional"]["rows_long"], 9024)
        self.assertEqual(runs["tradisional"]["rows_imputed"], 534)
        self.assertEqual(runs["tradisional"]["rows_anomaly"], 1)

        self.assertEqual(runs["produsen"]["raw_rows"], 1493)
        self.assertEqual(runs["produsen"]["rows_long"], 9024)
        self.assertEqual(runs["produsen"]["rows_imputed"], 66)
        self.assertEqual(runs["produsen"]["rows_anomaly"], 27)

    def test_modern_latest_prices_and_disparity(self) -> None:
        rows = self.conn.execute(
            """
            SELECT p.name, o.price_idr
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = 'modern' AND o.price_date = '2026-02-12'
            """
        ).fetchall()
        actual = {r["name"]: r["price_idr"] for r in rows}
        expected = {
            "Sulawesi Barat": 14300,
            "Sulawesi Selatan": 14950,
            "Sulawesi Utara": 15450,
            "Sulawesi Tenggara": 15750,
            "Gorontalo": 16750,
            "Sulawesi Tengah": 17700,
        }
        self.assertEqual(actual, expected)
        self.assertEqual(max(actual.values()) - min(actual.values()), 3400)

    def test_tradisional_and_produsen_disparity(self) -> None:
        for slug, expected_disp in [("tradisional", 1200), ("produsen", 1750)]:
            row = self.conn.execute(
                """
                SELECT MAX(o.price_idr) - MIN(o.price_idr) AS disp
                FROM price_observations o
                JOIN market_segments ms ON ms.id = o.market_segment_id
                WHERE ms.slug = ? AND o.price_date = '2026-02-12'
                """,
                (slug,),
            ).fetchone()
            self.assertEqual(row["disp"], expected_disp)

    def test_r4_positive_integers_and_r5_sultra_spike(self) -> None:
        bad = self.conn.execute("SELECT COUNT(*) AS c FROM price_observations WHERE price_idr <= 0").fetchone()
        self.assertEqual(bad["c"], 0)
        sultra = self.conn.execute(
            """
            SELECT o.price_idr, o.pct_change_daily, o.is_anomaly, o.anomaly_status
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = 'modern' AND p.name = 'Sulawesi Tenggara' AND o.price_date = '2023-11-01'
            """
        ).fetchone()
        self.assertEqual(sultra["price_idr"], 14600)
        self.assertEqual(sultra["is_anomaly"], 1)
        self.assertEqual(sultra["anomaly_status"], "perlu_verifikasi")
        self.assertAlmostEqual(sultra["pct_change_daily"], -24.9357, places=2)

    def test_forecasts_complete_and_bounded(self) -> None:
        count = self.conn.execute("SELECT COUNT(*) AS c FROM price_forecasts").fetchone()["c"]
        # 3 segments x 6 provinces x 1 JSB MLP model x (4 + 8) steps = 216
        self.assertEqual(count, 216)

        models = [
            r["model_name"]
            for r in self.conn.execute("SELECT DISTINCT model_name FROM price_forecasts ORDER BY model_name").fetchall()
        ]
        self.assertEqual(models, [MODEL_NAME])

        bad_fc = self.conn.execute(
            """
            SELECT COUNT(*) AS c FROM price_forecasts
            WHERE predicted_idr < 5000 OR predicted_idr > 30000
               OR lower_idr > predicted_idr OR predicted_idr > upper_idr
               OR eval_mae <= 0 OR eval_mape <= 0 OR eval_mape >= 15
            """
        ).fetchone()
        self.assertEqual(bad_fc["c"], 0)

    def test_jsb_model_artifacts_and_keras_parity(self) -> None:
        self.assertTrue(KERAS_MODEL_PATH.exists(), "jsb_mlp.keras harus tersedia")
        self.assertTrue(ARTIFACTS_PATH.exists(), "jsb_mlp_artifacts.json harus tersedia")

        artifacts = json.loads(ARTIFACTS_PATH.read_text(encoding="utf-8"))
        self.assertEqual(artifacts["model_name"], MODEL_NAME)
        self.assertEqual(artifacts["holdout_start"], HOLDOUT_START)
        self.assertGreaterEqual(artifacts["features"]["count"], 2)
        self.assertEqual(artifacts["features"]["count"], 17)

        arch = artifacts["architecture"]
        self.assertGreaterEqual(arch["hidden_layers"], 1)
        hidden_layers = [l for l in arch["layers"] if str(l["name"]).startswith("hidden_layer")]
        self.assertEqual(len(hidden_layers), 2)
        self.assertTrue(all(l["activation"] == "relu" for l in hidden_layers))

        split = artifacts["split"]
        self.assertEqual(split["cutoff_date"], HOLDOUT_START)
        self.assertGreater(split["train_samples"], 1500)
        self.assertGreater(split["test_samples"], 500)

        training = artifacts["training"]
        self.assertGreater(training["epochs_run"], 1)
        self.assertLessEqual(training["final_train_loss"], training["initial_train_loss"])

        imp_sum = sum(float(x["importance_pct"]) for x in artifacts["feature_importance"])
        self.assertAlmostEqual(imp_sum, 100.0, delta=1.0)
        self.assertLess(artifacts["aggregate_metrics"]["avg_mape_4w"], 5.0)
        self.assertEqual(len(artifacts["series_eval"]), 18)

        # Verify pure forward-pass weights match loaded tf.keras.Sequential `.keras` file
        engine = JsbInferenceEngine.from_file(ARTIFACTS_PATH)
        daily = self.conn.execute(
            """
            SELECT o.price_date, o.price_idr
            FROM price_observations o
            JOIN provinces p ON p.id = o.province_id
            JOIN market_segments ms ON ms.id = o.market_segment_id
            WHERE ms.slug = 'modern' AND p.name = 'Sulawesi Selatan'
            ORDER BY o.price_date ASC
            """
        ).fetchall()
        weekly = aggregate_weekly([(r["price_date"], r["price_idr"]) for r in daily])
        vals = [v for _, v in weekly]
        sample_rows = [
            build_feature_vector(vals[-8:-4], 1, "modern", "Sulawesi Selatan"),
            build_feature_vector(vals[-4:], 3, "modern", "Sulawesi Selatan"),
            build_feature_vector(vals[-4:], 11, "tradisional", "Sulawesi Tengah"),
        ]
        keras_preds = engine.predict_delta_keras(sample_rows)
        for vec, k_pred in zip(sample_rows, keras_preds):
            w_pred = engine.predict_delta(vec)
            self.assertAlmostEqual(w_pred, k_pred, places=4)

    def test_csv_and_snapshot_artifacts_exist(self) -> None:
        for slug in ("modern", "tradisional", "produsen"):
            self.assertTrue((PROCESSED_DIR / f"beras_sulawesi_{slug}_long.csv").exists())
            self.assertTrue((PROCESSED_DIR / f"beras_sulawesi_{slug}_wide.csv").exists())
        snap = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(snap["modern_imputed_dates_r3"]), 11)
        self.assertEqual(len(snap["modern_anomalies_r5"]), 12)
        self.assertIn(MODEL_NAME, snap["sulsel_modern_forecasts_4w"])
        self.assertEqual(set(snap["sulsel_modern_forecasts_4w"].keys()), {MODEL_NAME})


if __name__ == "__main__":
    unittest.main()
