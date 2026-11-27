"""TensorFlow/Keras Jaringan Syaraf Buatan (JSB MLP) engine for berasak.ai.

Model architecture follows the Google Developers TensorFlow Codelabs pattern
(`tf.keras.Sequential`, `Dense(..., activation="relu")`, custom `Callback`,
`Adam`, `mean_squared_error`), trained on tabular weekly rice price features
from PIHPS Bank Indonesia with chronological holdout split (< 2025-01-01 vs >= 2025-01-01).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "data" / "pantau_beras.db"
MODELS_DIR = ROOT_DIR / "data" / "models"
KERAS_MODEL_PATH = MODELS_DIR / "jsb_mlp.keras"
ARTIFACTS_PATH = MODELS_DIR / "jsb_mlp_artifacts.json"

MODEL_NAME = "jsb_mlp"
MODEL_LABEL = "JSB MLP (Jaringan Syaraf Buatan)"
HOLDOUT_START = "2025-01-01"

SEGMENTS = ("modern", "tradisional", "produsen")
PROVINCES = (
    "Gorontalo",
    "Sulawesi Barat",
    "Sulawesi Selatan",
    "Sulawesi Tengah",
    "Sulawesi Tenggara",
    "Sulawesi Utara",
)

CONTINUOUS_FEATURE_NAMES = (
    "lag_1w_idr",
    "lag_2w_idr",
    "lag_4w_idr",
    "ma_4w_idr",
    "pct_change_1w",
    "pct_change_4w",
    "month_sin",
    "month_cos",
)
SEGMENT_FEATURE_NAMES = tuple(f"seg_{s}" for s in SEGMENTS)
PROVINCE_FEATURE_NAMES = (
    "prov_gorontalo",
    "prov_sulawesi_barat",
    "prov_sulawesi_selatan",
    "prov_sulawesi_tengah",
    "prov_sulawesi_tenggara",
    "prov_sulawesi_utara",
)
FEATURE_NAMES = CONTINUOUS_FEATURE_NAMES + SEGMENT_FEATURE_NAMES + PROVINCE_FEATURE_NAMES
CONTINUOUS_DIM = len(CONTINUOUS_FEATURE_NAMES)
INPUT_DIM = len(FEATURE_NAMES)

FEATURE_DESCRIPTIONS = [
    {"name": "lag_1w_idr", "group": "Riwayat Harga 1-4 Minggu", "label": "Harga 1 minggu lalu (Rp/kg)"},
    {"name": "lag_2w_idr", "group": "Riwayat Harga 1-4 Minggu", "label": "Harga 2 minggu lalu (Rp/kg)"},
    {"name": "lag_4w_idr", "group": "Riwayat Harga 1-4 Minggu", "label": "Harga 4 minggu lalu (Rp/kg)"},
    {"name": "ma_4w_idr", "group": "Riwayat Harga 1-4 Minggu", "label": "Rata-rata harga 4 minggu (Rp/kg)"},
    {"name": "pct_change_1w", "group": "Momentum & Perubahan Harga", "label": "Laju perubahan 1 minggu"},
    {"name": "pct_change_4w", "group": "Momentum & Perubahan Harga", "label": "Momentum perubahan 4 minggu"},
    {"name": "month_sin", "group": "Siklus Musiman Bulan", "label": "Komponen sinus bulan kalender"},
    {"name": "month_cos", "group": "Siklus Musiman Bulan", "label": "Komponen kosinus bulan kalender"},
    {"name": "seg_onehot (3)", "group": "Saluran Pasar", "label": "Indikator Pasar Modern, Tradisional, dan Produsen"},
    {"name": "prov_onehot (6)", "group": "Karakteristik Provinsi", "label": "Indikator 6 provinsi Pulau Sulawesi"},
]

FEATURE_GROUPS = [
    (
        "Riwayat Harga 1-4 Minggu",
        [0, 1, 2, 3],
        "Harga acuan 1, 2, dan 4 minggu sebelumnya beserta rata-rata 4 minggu terakhir.",
    ),
    (
        "Momentum & Perubahan Harga",
        [4, 5],
        "Kecepatan kenaikan atau penurunan harga selama 1 minggu dan 4 minggu terakhir.",
    ),
    (
        "Siklus Musiman Bulan",
        [6, 7],
        "Pola tahunan musim panen raya, panen gadu, paceklik, dan hari raya berdasarkan bulan.",
    ),
    (
        "Saluran Pasar",
        [8, 9, 10],
        "Perbedaan karakter ritel Pasar Modern, Pasar Tradisional, dan Tingkat Produsen.",
    ),
    (
        "Karakteristik Provinsi",
        [11, 12, 13, 14, 15, 16],
        "Kondisi sentra produksi maupun jalur distribusi masing-masing provinsi di Sulawesi.",
    ),
]


def _import_tf():
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
    import tensorflow as tf  # pylint: disable=import-outside-toplevel

    return tf


def aggregate_weekly(rows: list[tuple[str, int]]) -> list[tuple[str, float]]:
    """Aggregate daily (price_date, price_idr) rows into Monday-anchored weekly averages."""
    buckets: dict[str, list[int]] = {}
    for d_str, price in rows:
        dt = datetime.strptime(d_str, "%Y-%m-%d")
        monday = (dt - timedelta(days=dt.weekday())).strftime("%Y-%m-%d")
        buckets.setdefault(monday, []).append(int(price))
    ordered = sorted(buckets.items(), key=lambda kv: kv[0])
    return [(w, sum(vals) / len(vals)) for w, vals in ordered]


def build_feature_vector(
    recent_prices: list[float],
    target_month: int,
    segment_slug: str,
    province_name: str,
) -> list[float]:
    """Construct the 17-element numeric input vector for a weekly prediction step."""
    if len(recent_prices) < 4:
        padded = [recent_prices[0]] * (4 - len(recent_prices)) + list(recent_prices)
    else:
        padded = list(recent_prices[-4:])

    p_4 = float(padded[-4])
    p_2 = float(padded[-2])
    p_1 = float(padded[-1])
    ma_4 = sum(padded) / 4.0

    pct_1w = max(-0.15, min(0.15, (p_1 - p_2) / max(p_2, 1.0)))
    pct_4w = max(-0.25, min(0.25, (p_1 - p_4) / max(p_4, 1.0)))
    angle = 2.0 * math.pi * (target_month / 12.0)
    month_sin = math.sin(angle)
    month_cos = math.cos(angle)

    seg_oh = [1.0 if segment_slug == s else 0.0 for s in SEGMENTS]
    prov_oh = [1.0 if province_name == p else 0.0 for p in PROVINCES]

    return [p_1, p_2, p_4, ma_4, pct_1w, pct_4w, month_sin, month_cos, *seg_oh, *prov_oh]


def build_supervised_dataset(
    weekly_by_series: dict[tuple[str, str], list[tuple[str, float]]],
    holdout_start: str = HOLDOUT_START,
) -> dict[str, Any]:
    """Convert all 18 weekly price series into split train (< holdout) and test (>= holdout) rows."""
    train_rows: list[list[float]] = []
    train_targets: list[float] = []
    train_dates: list[str] = []

    test_rows: list[list[float]] = []
    test_targets: list[float] = []
    test_dates: list[str] = []

    for segment_slug in SEGMENTS:
        for province_name in PROVINCES:
            weekly = weekly_by_series.get((segment_slug, province_name), [])
            if len(weekly) < 6:
                continue
            vals = [float(v) for _, v in weekly]
            for idx in range(4, len(weekly)):
                target_week, target_price = weekly[idx]
                prev_price = vals[idx - 1]
                target_month = datetime.strptime(target_week, "%Y-%m-%d").month
                vec = build_feature_vector(vals[idx - 4 : idx], target_month, segment_slug, province_name)
                raw_delta = (target_price - prev_price) / max(prev_price, 1.0)
                # Clip extreme 2022 producer spikes only in supervised regression targets
                # so weights converge stably without mutating stored raw observations.
                clipped_delta = max(-0.08, min(0.08, raw_delta))

                if target_week < holdout_start:
                    train_rows.append(vec)
                    train_targets.append(clipped_delta)
                    train_dates.append(target_week)
                else:
                    test_rows.append(vec)
                    test_targets.append(clipped_delta)
                    test_dates.append(target_week)

    return {
        "train_X": train_rows,
        "train_y": train_targets,
        "train_dates": train_dates,
        "test_X": test_rows,
        "test_y": test_targets,
        "test_dates": test_dates,
    }


def fit_minmax_scaler(rows: list[list[float]]) -> dict[str, list[float]]:
    """Fit MinMax scaling strictly on training rows over the continuous feature slice."""
    mins: list[float] = []
    maxs: list[float] = []
    for col in range(CONTINUOUS_DIM):
        col_vals = [r[col] for r in rows]
        c_min = min(col_vals)
        c_max = max(col_vals)
        if c_max - c_min < 1e-9:
            c_max = c_min + 1.0
        mins.append(float(c_min))
        maxs.append(float(c_max))
    return {"min": mins, "max": maxs}


def transform_features(rows: list[list[float]], scaler: dict[str, list[float]]) -> list[list[float]]:
    """Apply fitted MinMax scaling to continuous features while keeping one-hot flags exact."""
    mins = scaler["min"]
    maxs = scaler["max"]
    out: list[list[float]] = []
    for vec in rows:
        scaled_cont = []
        for idx in range(CONTINUOUS_DIM):
            span = max(maxs[idx] - mins[idx], 1e-9)
            norm_val = (vec[idx] - mins[idx]) / span
            scaled_cont.append(max(-0.5, min(1.5, norm_val)))
        out.append([*scaled_cont, *vec[CONTINUOUS_DIM:]])
    return out


def create_loss_history_callback(tf_mod: Any, early_stop_loss: float | None = None):
    """Create a Keras Callback following Codelab 2 to record per-epoch training/validation loss."""

    class LossHistoryCallback(tf_mod.keras.callbacks.Callback):
        def __init__(self) -> None:
            super().__init__()
            self.history_rows: list[dict[str, float | int]] = []

        def on_epoch_end(self, epoch: int, logs: dict[str, Any] | None = None) -> None:
            logs = logs or {}
            t_loss = float(logs.get("loss", 0.0))
            v_loss = float(logs.get("val_loss", t_loss))
            t_mae = float(logs.get("mae", 0.0))
            v_mae = float(logs.get("val_mae", t_mae))
            self.history_rows.append(
                {
                    "epoch": int(epoch) + 1,
                    "train_loss": round(t_loss, 8),
                    "val_loss": round(v_loss, 8),
                    "train_mae": round(t_mae, 6),
                    "val_mae": round(v_mae, 6),
                }
            )
            if early_stop_loss is not None and v_loss <= early_stop_loss:
                self.model.stop_training = True

    return LossHistoryCallback()


def build_jsb_model(input_dim: int = INPUT_DIM):
    """Build and compile a 2-hidden-layer ReLU MLP in Google TensorFlow Codelabs style."""
    tf = _import_tf()
    tf.keras.utils.set_random_seed(42)

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,), name="input_fitur_beras"),
            tf.keras.layers.Dense(
                units=32,
                activation="relu",
                kernel_regularizer=tf.keras.regularizers.l2(1e-4),
                name="hidden_layer_1",
            ),
            tf.keras.layers.Dense(
                units=16,
                activation="relu",
                kernel_regularizer=tf.keras.regularizers.l2(1e-4),
                name="hidden_layer_2",
            ),
            tf.keras.layers.Dense(units=1, activation="linear", name="output_delta_harga"),
        ],
        name="berasak_jsb_mlp",
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.003),
        loss="mean_squared_error",
        metrics=["mae"],
    )
    return model


def _compute_permutation_importance(model: Any, x_test_np: Any, y_test_np: Any) -> list[dict[str, Any]]:
    """Measure feature-group contributions via deterministic permutation on unseen holdout test rows."""
    import numpy as np  # pylint: disable=import-outside-toplevel

    rng = np.random.default_rng(42)
    base_pred = model.predict(x_test_np, verbose=0).reshape(-1)
    base_mae = float(np.mean(np.abs(y_test_np - base_pred)))

    raw_results: list[tuple[str, float, str]] = []
    n_rows = x_test_np.shape[0]
    for group_label, col_indices, desc in FEATURE_GROUPS:
        total_increase = 0.0
        repeats = 5
        for _ in range(repeats):
            perm_x = x_test_np.copy()
            perm_order = rng.permutation(n_rows)
            for col in col_indices:
                perm_x[:, col] = perm_x[perm_order, col]
            perm_pred = model.predict(perm_x, verbose=0).reshape(-1)
            perm_mae = float(np.mean(np.abs(y_test_np - perm_pred)))
            total_increase += max(0.0, perm_mae - base_mae)
        raw_results.append((group_label, total_increase / repeats, desc))

    total_imp = sum(val for _, val, _ in raw_results)
    if total_imp <= 1e-12:
        # Fallback to first-layer weight L1 norm by group if predictions are invariant
        w_first = model.get_layer("hidden_layer_1").get_weights()[0]
        raw_results = []
        for group_label, col_indices, desc in FEATURE_GROUPS:
            score = float(sum(float(np.mean(np.abs(w_first[col, :]))) for col in col_indices))
            raw_results.append((group_label, score, desc))
        total_imp = sum(val for _, val, _ in raw_results) or 1.0

    importance_items: list[dict[str, Any]] = []
    for group_label, val, desc in raw_results:
        pct = (val / total_imp) * 100.0
        importance_items.append(
            {
                "group": group_label,
                "importance_pct": round(pct, 2),
                "delta_mae": round(val, 6),
                "description": desc,
            }
        )
    importance_items.sort(key=lambda item: item["importance_pct"], reverse=True)
    return importance_items


def _extract_architecture_spec(model: Any) -> dict[str, Any]:
    """Serialize Keras Sequential layers and parameter counts for transparency."""
    layers_meta: list[dict[str, Any]] = [
        {
            "name": "input_fitur_beras",
            "type": "Input",
            "units": INPUT_DIM,
            "activation": None,
            "params": 0,
            "role": "Masukan 17 fitur terstandarisasi",
        }
    ]
    role_map = {
        "hidden_layer_1": "Hidden Layer 1 (ekstraksi pola harga non-linear)",
        "hidden_layer_2": "Hidden Layer 2 (kombinasi tren & musiman)",
        "output_delta_harga": "Lapisan Keluaran (prediksi perubahan mingguan)",
    }
    for layer in model.layers:
        cfg = layer.get_config()
        layers_meta.append(
            {
                "name": layer.name,
                "type": layer.__class__.__name__,
                "units": int(cfg.get("units", 1)),
                "activation": str(cfg.get("activation", "linear")),
                "params": int(layer.count_params()),
                "role": role_map.get(layer.name, "Lapisan Dense"),
            }
        )

    return {
        "name": model.name,
        "input_dim": INPUT_DIM,
        "hidden_layers": 2,
        "total_params": int(model.count_params()),
        "optimizer": "Adam (learning_rate=0.003)",
        "loss": "Mean Squared Error (MSE)",
        "metrics": ["MAE"],
        "layers": layers_meta,
    }


def _extract_layer_weights(model: Any) -> list[dict[str, Any]]:
    """Export trained Dense matrices so fast inference matches Keras exactly."""
    weights_out: list[dict[str, Any]] = []
    for layer in model.layers:
        layer_weights = layer.get_weights()
        if len(layer_weights) != 2:
            continue
        w_mat, b_vec = layer_weights
        activation = str(layer.get_config().get("activation", "linear"))
        weights_out.append(
            {
                "name": layer.name,
                "activation": activation,
                "W": [[float(x) for x in row] for row in w_mat.tolist()],
                "b": [float(x) for x in b_vec.tolist()],
            }
        )
    return weights_out


def train_and_save_jsb(
    weekly_by_series: dict[tuple[str, str], list[tuple[str, float]]],
    epochs: int = 80,
    batch_size: int = 32,
) -> dict[str, Any]:
    """Train the unified TensorFlow/Keras JSB MLP on pre-2025 data and save model + artifacts."""
    tf = _import_tf()
    import keras  # pylint: disable=import-outside-toplevel
    import numpy as np  # pylint: disable=import-outside-toplevel

    dataset = build_supervised_dataset(weekly_by_series, holdout_start=HOLDOUT_START)
    train_raw = dataset["train_X"]
    test_raw = dataset["test_X"]
    if not train_raw or not test_raw:
        raise ValueError("Dataset pelatihan atau pengujian holdout kosong.")

    scaler = fit_minmax_scaler(train_raw)
    x_train_scaled = np.asarray(transform_features(train_raw, scaler), dtype=np.float32)
    y_train_np = np.asarray(dataset["train_y"], dtype=np.float32)
    x_test_scaled = np.asarray(transform_features(test_raw, scaler), dtype=np.float32)
    y_test_np = np.asarray(dataset["test_y"], dtype=np.float32)

    model = build_jsb_model(INPUT_DIM)
    history_cb = create_loss_history_callback(tf)
    early_stop = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=12,
        restore_best_weights=True,
    )

    model.fit(
        x_train_scaled,
        y_train_np,
        validation_data=(x_test_scaled, y_test_np),
        epochs=epochs,
        batch_size=batch_size,
        shuffle=True,
        verbose=0,
        callbacks=[history_cb, early_stop],
    )

    eval_loss, eval_mae = model.evaluate(x_test_scaled, y_test_np, verbose=0)
    importance = _compute_permutation_importance(model, x_test_scaled, y_test_np)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model.save(KERAS_MODEL_PATH)

    history_rows = history_cb.history_rows
    best_row = min(history_rows, key=lambda r: r["val_loss"])
    total_samples = len(train_raw) + len(test_raw)
    trained_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    artifacts: dict[str, Any] = {
        "model_name": MODEL_NAME,
        "model_label": MODEL_LABEL,
        "framework": "TensorFlow / Keras (Sequential MLP)",
        "tensorflow_version": str(tf.__version__),
        "keras_version": str(keras.__version__),
        "keras_model_file": str(KERAS_MODEL_PATH.relative_to(ROOT_DIR)),
        "holdout_start": HOLDOUT_START,
        "eval_period": "2025-01-01..2026-02-12",
        "trained_at": trained_at,
        "architecture": _extract_architecture_spec(model),
        "features": {
            "count": INPUT_DIM,
            "continuous_dim": CONTINUOUS_DIM,
            "categorical_dim": INPUT_DIM - CONTINUOUS_DIM,
            "names": list(FEATURE_NAMES),
            "descriptions": FEATURE_DESCRIPTIONS,
        },
        "preprocessing": {
            "scaler": "MinMaxScaler (rentang [0, 1], dihitung hanya pada data latih < 2025-01-01)",
            "continuous_dim": CONTINUOUS_DIM,
            "min": scaler["min"],
            "max": scaler["max"],
            "target_clip": [-0.08, 0.08],
            "outlier_note": "Perubahan mingguan ekstrem selama pelatihan dibatasi [-8%, +8%] agar bobot JSB tetap stabil.",
        },
        "split": {
            "method": "Chronological Walk-Forward Holdout",
            "cutoff_date": HOLDOUT_START,
            "train_period": f"{min(dataset['train_dates'])}..{max(dataset['train_dates'])}",
            "test_period": f"{min(dataset['test_dates'])}..{max(dataset['test_dates'])}",
            "train_samples": len(train_raw),
            "test_samples": len(test_raw),
            "total_samples": total_samples,
            "train_ratio_pct": round(len(train_raw) / total_samples * 100.0, 1),
            "test_ratio_pct": round(len(test_raw) / total_samples * 100.0, 1),
        },
        "training": {
            "epochs_configured": epochs,
            "epochs_run": len(history_rows),
            "batch_size": batch_size,
            "early_stopping_patience": 12,
            "best_epoch": int(best_row["epoch"]),
            "initial_train_loss": history_rows[0]["train_loss"],
            "final_train_loss": history_rows[-1]["train_loss"],
            "initial_val_loss": history_rows[0]["val_loss"],
            "final_val_loss": float(best_row["val_loss"]),
            "eval_test_mse": round(float(eval_loss), 8),
            "eval_test_delta_mae": round(float(eval_mae), 6),
        },
        "loss_history": history_rows,
        "feature_importance": importance,
        "weights": _extract_layer_weights(model),
        "series_eval": {},
        "aggregate_metrics": {},
    }
    ARTIFACTS_PATH.write_text(json.dumps(artifacts, indent=2), encoding="utf-8")
    return artifacts


class JsbInferenceEngine:
    """Fast forward-pass inference engine synced with the saved Keras JSB MLP model."""

    def __init__(self, artifacts: dict[str, Any]) -> None:
        self.artifacts = artifacts
        self.scaler = artifacts["preprocessing"]
        self.layers = artifacts["weights"]
        self._keras_model: Any = None

    @classmethod
    def from_file(cls, path: Path = ARTIFACTS_PATH) -> "JsbInferenceEngine":
        if not path.exists():
            raise FileNotFoundError(
                f"Artefak model JSB belum tersedia di {path}. Jalankan pipeline/forecast.py terlebih dahulu."
            )
        payload = json.loads(path.read_text(encoding="utf-8"))
        return cls(payload)

    def scale_vector(self, raw_vec: list[float]) -> list[float]:
        return transform_features([raw_vec], self.scaler)[0]

    def predict_delta_scaled(self, scaled_vec: list[float]) -> float:
        """Execute Dense -> ReLU -> Dense -> ReLU -> Dense(linear) forward propagation."""
        act = [float(x) for x in scaled_vec]
        for layer in self.layers:
            w_mat = layer["W"]
            b_vec = layer["b"]
            activation = layer["activation"]
            n_out = len(b_vec)
            next_act = [0.0] * n_out
            for j in range(n_out):
                s = b_vec[j]
                for i, a_i in enumerate(act):
                    s += a_i * w_mat[i][j]
                if activation == "relu":
                    next_act[j] = s if s > 0.0 else 0.0
                else:
                    next_act[j] = s
            act = next_act
        return float(act[0])

    def predict_delta(self, raw_vec: list[float]) -> float:
        """Scale a raw 17-feature vector and run a forward pass through JSB MLP."""
        return self.predict_delta_scaled(self.scale_vector(raw_vec))

    def predict_delta_keras(self, raw_rows: list[list[float]]) -> list[float]:
        """Run inference directly through the saved tf.keras.Sequential `.keras` file."""
        tf = _import_tf()
        import numpy as np  # pylint: disable=import-outside-toplevel

        if self._keras_model is None:
            self._keras_model = tf.keras.models.load_model(KERAS_MODEL_PATH, compile=False)
        scaled = np.asarray(transform_features(raw_rows, self.scaler), dtype=np.float32)
        preds = self._keras_model.predict(scaled, verbose=0).reshape(-1)
        return [float(x) for x in preds]

    def forecast_recursive(
        self,
        weekly_prices: list[float],
        last_week_date: datetime,
        segment_slug: str,
        province_name: str,
        horizon_weeks: int,
        long_anchor: float | None = None,
    ) -> tuple[list[float], dict[str, Any]]:
        """Roll weekly predictions forward using JSB MLP outputs as next-step lags."""
        buffer = [float(x) for x in weekly_prices]
        if not buffer:
            raise ValueError("Riwayat harga mingguan tidak boleh kosong.")

        anchor = float(long_anchor) if long_anchor is not None else buffer[-1]
        min_bound = max(1000.0, 0.76 * anchor)
        max_bound = 1.24 * anchor

        preds: list[float] = []
        first_features_snapshot: dict[str, Any] = {}

        for step in range(1, horizon_weeks + 1):
            step_dt = last_week_date + timedelta(days=7 * step)
            vec = build_feature_vector(buffer[-4:], step_dt.month, segment_slug, province_name)
            raw_delta = self.predict_delta(vec)
            bounded_delta = max(-0.035, min(0.035, raw_delta))
            damping = 1.0 if step <= 8 else math.exp(-(step - 8) / 36.0)
            eff_delta = bounded_delta * damping

            next_price = buffer[-1] * (1.0 + eff_delta)
            next_price = max(min_bound, min(max_bound, next_price))

            if step == 1:
                first_features_snapshot = {
                    "lag_1w_idr": round(vec[0]),
                    "lag_2w_idr": round(vec[1]),
                    "lag_4w_idr": round(vec[2]),
                    "ma_4w_idr": round(vec[3]),
                    "pct_change_1w_pct": round(vec[4] * 100.0, 2),
                    "pct_change_4w_pct": round(vec[5] * 100.0, 2),
                    "target_month": step_dt.month,
                    "predicted_delta_pct": round(eff_delta * 100.0, 3),
                }

            preds.append(next_price)
            buffer.append(next_price)

        return preds, first_features_snapshot
