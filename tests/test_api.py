"""API integration tests for Pantau Beras Sulawesi backend server."""

from __future__ import annotations

import csv
import io
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
from unittest import mock
import urllib.error
import urllib.request

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.environ["PANTAU_BERAS_QUIET"] = "1"

from backend.server import create_server, get_conn, query_predict_date  # noqa: E402


class TestApiServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = create_server(host="127.0.0.1", port=0)
        cls.port = cls.server.server_address[1]
        cls.base = f"http://127.0.0.1:{cls.port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def get_json(self, path: str) -> tuple[int, dict]:
        try:
            with urllib.request.urlopen(self.base + path) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            try:
                return err.code, json.loads(err.read().decode("utf-8"))
            finally:
                err.close()

    def post_json(self, path: str, payload: dict) -> tuple[int, dict]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.base + path,
            data=data,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            try:
                return err.code, json.loads(err.read().decode("utf-8"))
            finally:
                err.close()

    def test_health_and_meta(self) -> None:
        code, health = self.get_json("/api/health")
        self.assertEqual(code, 200)
        self.assertEqual(health["status"], "ok")

        with urllib.request.urlopen(self.base + "/favicon.ico") as fav_resp:
            self.assertEqual(fav_resp.status, 204)

        code, meta = self.get_json("/api/meta")
        self.assertEqual(code, 200)
        self.assertEqual(meta["commodity"]["name"], "Beras (jenis tidak dirinci)")
        self.assertEqual(len(meta["provinces"]), 6)
        self.assertEqual(len(meta["segments"]), 3)

    def test_overview_modern_tradisional_produsen(self) -> None:
        code, mod = self.get_json("/api/overview?segment=modern")
        self.assertEqual(code, 200)
        self.assertEqual(mod["latest_date"], "2026-02-12")
        self.assertEqual(mod["disparity"]["gap_idr"], 3400)
        self.assertEqual(mod["disparity"]["cheapest"]["province"], "Sulawesi Barat")
        self.assertEqual(mod["disparity"]["cheapest"]["price_idr"], 14300)
        self.assertEqual(mod["disparity"]["most_expensive"]["province"], "Sulawesi Tengah")
        self.assertEqual(mod["disparity"]["most_expensive"]["price_idr"], 17700)

        code, trad = self.get_json("/api/overview?segment=tradisional")
        self.assertEqual(code, 200)
        self.assertEqual(trad["disparity"]["gap_idr"], 1200)

        code, prod = self.get_json("/api/overview?segment=produsen")
        self.assertEqual(code, 200)
        self.assertEqual(prod["disparity"]["gap_idr"], 1750)

    def test_trends_daily_weekly_monthly(self) -> None:
        for agg in ("daily", "weekly", "monthly"):
            code, data = self.get_json(f"/api/trends?segment=modern&provinces=Sulawesi+Tengah,Sulawesi+Selatan&agg={agg}&range=1y")
            self.assertEqual(code, 200)
            self.assertEqual(data["agg"], agg)
            self.assertEqual(len(data["series"]), 2)
            self.assertTrue(len(data["series"][0]["points"]) >= 12)

    def test_compare_and_imputed_date(self) -> None:
        code, cmp_latest = self.get_json("/api/compare?segment=modern&date=2026-02-12")
        self.assertEqual(code, 200)
        self.assertFalse(cmp_latest["is_imputed_date"])
        self.assertEqual(cmp_latest["disparity_idr"], 3400)
        self.assertEqual(cmp_latest["supply_chain_margins"][0]["province"], "Sulawesi Tengah")
        self.assertEqual(cmp_latest["supply_chain_margins"][0]["spread_idr"], 5250)

        code, cmp_imp = self.get_json("/api/compare?segment=modern&date=2024-04-13")
        self.assertEqual(code, 200)
        self.assertTrue(cmp_imp["is_imputed_date"])

    def test_forecasts_endpoint(self) -> None:
        code, fc = self.get_json("/api/forecasts?segment=modern&province=Sulawesi+Selatan&horizon=4")
        self.assertEqual(code, 200)
        self.assertEqual(fc["selected_model"], "jsb_mlp")
        self.assertEqual(len(fc["forecast_points"]), 4)
        self.assertEqual(len(fc["model_comparison"]), 1)
        self.assertEqual(fc["model_comparison"][0]["model_name"], "jsb_mlp")
        self.assertGreater(fc["model_comparison"][0]["eval_mae"], 0.0)
        self.assertLess(fc["model_comparison"][0]["eval_mape"], 15.0)
        self.assertIn("jsb_info", fc)
        self.assertGreaterEqual(fc["jsb_info"]["architecture"]["hidden_layers"], 1)
        self.assertGreaterEqual(fc["jsb_info"]["features"]["count"], 2)
        self.assertGreater(len(fc["jsb_info"]["loss_history"]), 1)
        self.assertEqual(len(fc["jsb_info"]["province_metrics"]), 6)

        code2, fc_st = self.get_json("/api/forecasts?segment=modern&province=Sulawesi+Tengah&horizon=8&model=jsb_mlp")
        self.assertEqual(code2, 200)
        self.assertEqual(len(fc_st["forecast_points"]), 8)
        for pt in fc_st["forecast_points"]:
            self.assertLessEqual(pt["lower_idr"], pt["predicted_idr"])
            self.assertLessEqual(pt["predicted_idr"], pt["upper_idr"])

    def test_jsb_info_endpoint(self) -> None:
        code, info = self.get_json("/api/jsb-info?segment=modern&province=Sulawesi+Selatan")
        self.assertEqual(code, 200)
        self.assertEqual(info["model_name"], "jsb_mlp")
        self.assertEqual(info["holdout_start"], "2025-01-01")
        self.assertEqual(info["split"]["cutoff_date"], "2025-01-01")
        self.assertGreater(len(info["loss_history"]), 1)
        self.assertEqual(len(info["feature_importance"]), 5)
        self.assertEqual(len(info["province_metrics"]), 6)
        self.assertGreater(len(info["holdout_samples"]), 0)
        self.assertLess(info["aggregate_metrics"]["avg_mape_4w"], 5.0)

        code_all, info_all = self.get_json("/api/jsb-info?segment=tradisional&province=all")
        self.assertEqual(code_all, 200)
        self.assertEqual(info_all["province"], "all")
        self.assertIsNotNone(info_all["series_eval"])

        bad_seg, _ = self.get_json("/api/jsb-info?segment=grosir")
        self.assertEqual(bad_seg, 400)
        bad_prov, _ = self.get_json("/api/jsb-info?province=Jawa+Barat")
        self.assertEqual(bad_prov, 400)

    def test_quality_and_empty_state_filter(self) -> None:
        code, q_mod = self.get_json("/api/quality?segment=modern&province=all")
        self.assertEqual(code, 200)
        self.assertEqual(q_mod["imputed_dates_count"], 11)
        self.assertEqual(q_mod["anomalies_count"], 12)

        code, q_empty = self.get_json("/api/quality?segment=tradisional&province=Sulawesi+Selatan")
        self.assertEqual(code, 200)
        self.assertEqual(q_empty["anomalies_count"], 0)

    def test_export_preview_and_csv_download(self) -> None:
        code, prev = self.get_json("/api/export?segment=modern&provinces=all&shape=long&preview=1")
        self.assertEqual(code, 200)
        self.assertEqual(prev["total_rows"], 9024)
        self.assertEqual(len(prev["rows"]), 5)

        with urllib.request.urlopen(self.base + "/api/export?segment=modern&provinces=all&shape=wide&preview=0") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("text/csv", resp.headers.get("Content-Type", ""))
            csv_rows = list(csv.reader(io.StringIO(resp.read().decode("utf-8"))))
            self.assertEqual(len(csv_rows), 1505)  # header + 1504 calendar days
            self.assertIn("Sulawesi Selatan", csv_rows[0])

    def test_invalid_params_return_400(self) -> None:
        code, err = self.get_json("/api/overview?segment=invalid")
        self.assertEqual(code, 400)
        self.assertIn("error", err)

        code, err2 = self.get_json("/api/compare?segment=modern&date=1999-01-01")
        self.assertEqual(code, 400)
        self.assertIn("error", err2)

    def test_predict_date_future_and_models(self) -> None:
        for target_date in ("2026-02-13", "2026-11-27", "2026-11-28", "2027-12-31", "2028-06-15", "2028-12-31"):
            code, data = self.get_json(
                f"/api/predict-date?segment=modern&province=Sulawesi+Selatan&date={target_date}"
            )
            self.assertEqual(code, 200)
            self.assertEqual(data["mode"], "predicted")
            self.assertEqual(data["model"], "jsb_mlp")
            self.assertEqual(data["model_label"], "JSB MLP (Jaringan Syaraf Buatan)")
            self.assertEqual(data["confidence_label"], "Estimasi 90%")
            self.assertEqual(data["target_date"], target_date)
            self.assertGreater(data["predicted_idr"], 0)
            self.assertGreater(data["lower_idr"], 0)
            self.assertLess(data["lower_idr"], data["predicted_idr"])
            self.assertLess(data["predicted_idr"], data["upper_idr"])
            self.assertEqual(len(data["daily_outlook"]), 7)
            self.assertEqual(sum(1 for d in data["daily_outlook"] if d["is_target"]), 1)
            self.assertTrue(all(d["date"] <= "2028-12-31" for d in data["daily_outlook"]))
            self.assertEqual(len(data["province_comparison"]), 6)
            self.assertIn(data["status_tier"], {"Stabil", "Waspada", "Tinggi"})
            self.assertIn("jsb_features", data)
            self.assertIn("jsb_meta", data)
            self.assertNotIn("\u2014", data["explanation"])

        for seg in ("modern", "tradisional", "produsen"):
            prov = "Sulawesi Utara" if seg == "produsen" else "Sulawesi Tengah"
            prov_q = prov.replace(" ", "+")
            code, res = self.get_json(
                f"/api/predict-date?segment={seg}&province={prov_q}&date=2026-11-27&model=jsb_mlp"
            )
            self.assertEqual(code, 200)
            self.assertEqual(res["model"], "jsb_mlp")
            self.assertGreaterEqual(res["predicted_idr"], 6000)
            self.assertLessEqual(res["predicted_idr"], 25000)
            self.assertLess(res["lower_idr"], res["predicted_idr"])
            self.assertLess(res["predicted_idr"], res["upper_idr"])

    def test_predict_date_historical_exact(self) -> None:
        code, hist_latest = self.get_json(
            "/api/predict-date?segment=modern&province=Sulawesi+Selatan&date=2026-02-12"
        )
        self.assertEqual(code, 200)
        self.assertEqual(hist_latest["mode"], "historical")
        self.assertEqual(hist_latest["confidence_label"], "Data Aktual")
        self.assertEqual(hist_latest["predicted_idr"], 14950)
        self.assertEqual(hist_latest["actual_idr"], 14950)
        self.assertEqual(hist_latest["lower_idr"], 14950)
        self.assertEqual(hist_latest["upper_idr"], 14950)
        self.assertEqual(len(hist_latest["daily_outlook"]), 7)
        self.assertEqual(len(hist_latest["province_comparison"]), 6)
        self.assertIn(hist_latest["status_label"], {"Stabil", "Fluktuatif", "Perlu Atensi"})

        code2, hist_mid = self.get_json(
            "/api/predict-date?segment=modern&province=Sulawesi+Tengah&date=2025-05-10"
        )
        self.assertEqual(code2, 200)
        self.assertEqual(hist_mid["mode"], "historical")
        self.assertEqual(hist_mid["lower_idr"], hist_mid["predicted_idr"])
        self.assertEqual(hist_mid["upper_idr"], hist_mid["predicted_idr"])
        self.assertNotIn("diisi otomatis", hist_mid["explanation"].lower())
        self.assertNotIn("perlu verifikasi", hist_mid["explanation"].lower())

    def test_predict_date_province_all_and_defaults(self) -> None:
        code, all_pred = self.get_json("/api/predict-date?segment=modern&province=all&date=2026-11-27")
        self.assertEqual(code, 200)
        self.assertEqual(all_pred["province"], "all")
        self.assertEqual(len(all_pred["provinces"]), 6)
        self.assertEqual(len(all_pred["province_comparison"]), 6)
        self.assertIn("regional_summary", all_pred)
        self.assertEqual(all_pred["regional_summary"]["avg_predicted_idr"], all_pred["predicted_idr"])
        self.assertEqual(len(all_pred["daily_outlook"]), 7)

        code_upper, all_upper = self.get_json("/api/predict-date?segment=tradisional&province=ALL&date=2026-02-12")
        self.assertEqual(code_upper, 200)
        self.assertEqual(all_upper["province"], "all")
        self.assertEqual(all_upper["mode"], "historical")

        code_def, defaults = self.get_json("/api/predict-date")
        self.assertEqual(code_def, 200)
        self.assertEqual(defaults["segment"], "modern")
        self.assertEqual(defaults["province"], "Sulawesi Selatan")
        self.assertEqual(defaults["model"], "jsb_mlp")

    def test_predict_date_validation_errors(self) -> None:
        bad_urls = [
            "/api/predict-date?date=2019-01-01",
            "/api/predict-date?date=2030-01-01",
            "/api/predict-date?date=not-a-date",
            "/api/predict-date?date=2026-02-30",
            "/api/predict-date?date=2026-11-27&model=unknown_model",
            "/api/predict-date?date=2026-11-27&model=arima_110",
            "/api/predict-date?date=2026-11-27&model=seasonal_naive",
            "/api/predict-date?date=2026-11-27&model=moving_average_4w",
            "/api/predict-date?date=2026-11-27&model=ai_ensemble",
            "/api/forecasts?segment=modern&province=Sulawesi+Selatan&horizon=4&model=arima_110",
            "/api/forecasts?segment=modern&province=Sulawesi+Selatan&horizon=4&model=seasonal_naive",
            "/api/forecasts?segment=modern&province=Sulawesi+Selatan&horizon=4&model=moving_average_4w",
            "/api/predict-date?date=2026-11-27&segment=grosir",
            "/api/predict-date?date=2026-11-27&province=Jawa+Barat",
        ]
        for url in bad_urls:
            code, err = self.get_json(url)
            self.assertEqual(code, 400, f"Expected 400 for {url}")
            self.assertIn("error", err)

        conn = get_conn()
        try:
            with self.assertRaises(ValueError):
                query_predict_date(conn, "modern", "Sulawesi Selatan", "2019-01-01", "jsb_mlp")
            with self.assertRaises(ValueError):
                query_predict_date(conn, "modern", "Sulawesi Selatan", "2030-01-01", "jsb_mlp")
            with self.assertRaises(ValueError):
                query_predict_date(conn, "modern", "Sulawesi Selatan", "not-a-date", "jsb_mlp")
        finally:
            conn.close()

    def test_static_logo_asset_png(self) -> None:
        with urllib.request.urlopen(self.base + "/assets/berasak-logo-dark.png") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("image/png", resp.headers.get("Content-Type", ""))
            payload = resp.read()
            self.assertTrue(payload.startswith(b"\x89PNG\r\n\x1a\n"))
            self.assertGreater(len(payload), 10000)

    def test_predict_date_model_specific_explanations(self) -> None:
        for prov_q in ("Sulawesi+Selatan", "all"):
            code, data = self.get_json(
                f"/api/predict-date?segment=modern&province={prov_q}&date=2026-11-27&model=jsb_mlp"
            )
            self.assertEqual(code, 200)
            self.assertEqual(data["model_label"], "JSB MLP (Jaringan Syaraf Buatan)")
            self.assertNotIn("4M", data["model_label"])
            self.assertNotIn("52M", data["model_label"])
            self.assertNotIn("\u2014", data["explanation"])
            self.assertIn("Jaringan Syaraf Buatan", data["explanation"])
            self.assertIn("JSB MLP", data["explanation"])
            for legacy_term in ("arima", "seasonal naive", "moving average", "ensemble"):
                self.assertNotIn(legacy_term, data["explanation"].lower())

    def test_post_contact_valid_and_validation_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_db = Path(tmp_dir) / "contact_test.db"
            sqlite3.connect(tmp_db).close()
            with mock.patch("backend.server.DB_PATH", tmp_db):
                valid_payload = {
                    "name": "Siti Aminah",
                    "email": "siti@contoh.id",
                    "topic": "Pertanyaan Pembacaan Data",
                    "message": "Mohon penjelasan selisih harga pasar modern dan tradisional di Sulawesi Tengah.",
                }
                code, body = self.post_json("/api/contact", valid_payload)
                self.assertEqual(code, 201)
                self.assertEqual(body["status"], "received")
                self.assertTrue(body["reference_id"].startswith("BRS-"))
                self.assertEqual(body["name"], "Siti Aminah")
                self.assertEqual(body["email"], "siti@contoh.id")
                self.assertEqual(body["topic"], "Pertanyaan Pembacaan Data")
                self.assertTrue(body["submitted_at"].endswith("Z"))
                self.assertIn("berhasil dikirim", body["message"])

                verify_conn = sqlite3.connect(tmp_db)
                try:
                    row = verify_conn.execute(
                        "SELECT reference_id, name, email, topic, message FROM contact_messages"
                    ).fetchone()
                    self.assertIsNotNone(row)
                    self.assertEqual(row[0], body["reference_id"])
                    self.assertEqual(row[1], "Siti Aminah")
                    self.assertEqual(row[2], "siti@contoh.id")
                    self.assertEqual(row[3], "Pertanyaan Pembacaan Data")
                    self.assertEqual(row[4], valid_payload["message"])
                finally:
                    verify_conn.close()

                invalid_cases = [
                    {**valid_payload, "name": "A"},
                    {**valid_payload, "email": "bukan-email"},
                    {**valid_payload, "message": "Singkat"},
                    {**valid_payload, "topic": ""},
                ]
                for bad_payload in invalid_cases:
                    bad_code, bad_body = self.post_json("/api/contact", bad_payload)
                    self.assertEqual(bad_code, 400)
                    self.assertIn("error", bad_body)

                raw_req = urllib.request.Request(
                    self.base + "/api/contact",
                    data=b"{invalid-json",
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    urllib.request.urlopen(raw_req)
                    self.fail("Expected HTTPError 400 for malformed JSON")
                except urllib.error.HTTPError as err:
                    try:
                        self.assertEqual(err.code, 400)
                    finally:
                        err.close()

                nf_code, nf_body = self.post_json("/api/tidak-ada", valid_payload)
                self.assertEqual(nf_code, 404)
                self.assertIn("error", nf_body)


if __name__ == "__main__":
    unittest.main()
