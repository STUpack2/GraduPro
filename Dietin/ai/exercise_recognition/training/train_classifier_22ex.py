from __future__ import annotations

import argparse
import json
import platform
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.callbacks import (
    CSVLogger,
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau,
)
from tensorflow.keras.layers import (
    LSTM,
    BatchNormalization,
    Bidirectional,
    Dense,
    Dropout,
    Input,
)
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.utils import to_categorical

WINDOW_SIZE = 45
FEATURE_COUNT = 140
NUM_CLASSES = 22
RANDOM_STATE = 42
DEFAULT_CLASSES = [
    "barbell_biceps_curl",
    "bench_press",
    "chest_fly_machine",
    "deadlift",
    "decline_bench_press",
    "hammer_curl",
    "hip_thrust",
    "incline_bench_press",
    "lat_pulldown",
    "lateral_raise",
    "leg_extension",
    "leg_raises",
    "plank",
    "pull_up",
    "push_up",
    "romanian_deadlift",
    "russian_twist",
    "shoulder_press",
    "squat",
    "t_bar_row",
    "tricep_dips",
    "tricep_pushdown",
]

PROJECT_ROOT = Path(__file__).resolve().parent
MODULE_ROOT = PROJECT_ROOT.parent
import sys as _sys
if str(MODULE_ROOT) not in _sys.path:
    _sys.path.insert(0, str(MODULE_ROOT))
    _sys.path.insert(0, str(MODULE_ROOT / "inference"))
from config import (  # noqa: E402
    DATASET_WINDOWS_DIR,
    DATASET_METADATA_DIR,
    MODELS_DIR,
    ARTIFACTS_DIR,
)

DEFAULT_DATASET_DIR = DATASET_WINDOWS_DIR / "win45_angles"
DEFAULT_METADATA_CLASSES = DATASET_METADATA_DIR / "classes.json"
DEFAULT_MODEL_DIR = MODELS_DIR
DEFAULT_ARTIFACTS_DIR = ARTIFACTS_DIR


class LearningRateLogger(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        optimizer = self.model.optimizer
        learning_rate = optimizer.learning_rate
        if callable(learning_rate):
            learning_rate = learning_rate(optimizer.iterations)
        logs["learning_rate"] = float(tf.keras.backend.get_value(learning_rate))


def load_class_names(
    metadata_path: Path | None = DEFAULT_METADATA_CLASSES,
) -> List[str]:
    if metadata_path and metadata_path.exists():
        with metadata_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if "id_to_class" in data:
            return [
                data["id_to_class"][str(idx)] for idx in range(len(data["id_to_class"]))
            ]
        if "class_to_id" in data:
            return [
                name
                for name, _ in sorted(
                    data["class_to_id"].items(), key=lambda item: item[1]
                )
            ]
    return DEFAULT_CLASSES.copy()


def make_label_encoder(
    class_names: List[str], existing_path: Path | None = None
) -> LabelEncoder:
    if existing_path and existing_path.exists():
        encoder = joblib.load(existing_path)
        loaded_classes = [str(label) for label in encoder.classes_]
        if loaded_classes != class_names:
            raise ValueError(
                "Existing label encoder class order does not match expected 22-class order.\n"
                f"Expected: {class_names}\nLoaded:   {loaded_classes}"
            )
        return encoder

    encoder = LabelEncoder()
    encoder.classes_ = np.asarray(class_names, dtype=object)
    return encoder


def load_windows(
    dataset_dir: Path, class_names: List[str]
) -> Tuple[np.ndarray, np.ndarray, Dict[str, int], Dict[str, object]]:
    sequences: List[np.ndarray] = []
    labels: List[int] = []
    distribution = {class_name: 0 for class_name in class_names}
    corrupted_samples: List[Dict[str, object]] = []
    total_arrays = 0
    total_candidate_windows = 0

    for class_index, class_name in enumerate(class_names):
        class_dir = dataset_dir / class_name
        if not class_dir.exists():
            corrupted_samples.append(
                {"path": str(class_dir), "reason": "missing_class_directory"}
            )
            continue

        for npy_path in sorted(class_dir.glob("*.npy")):
            total_arrays += 1
            try:
                arr = np.load(npy_path)
            except Exception as exc:
                corrupted_samples.append(
                    {"path": str(npy_path), "reason": f"load_error: {exc}"}
                )
                continue

            if arr.size == 0:
                corrupted_samples.append(
                    {
                        "path": str(npy_path),
                        "reason": "empty_array",
                        "shape": list(arr.shape),
                    }
                )
                continue

            if arr.shape == (WINDOW_SIZE, FEATURE_COUNT):
                arr = arr.reshape(1, WINDOW_SIZE, FEATURE_COUNT)
            elif arr.ndim != 3 or arr.shape[1:] != (WINDOW_SIZE, FEATURE_COUNT):
                corrupted_samples.append(
                    {
                        "path": str(npy_path),
                        "reason": "invalid_shape",
                        "shape": list(arr.shape),
                    }
                )
                continue

            for window_index, window in enumerate(arr):
                total_candidate_windows += 1
                if window.shape != (WINDOW_SIZE, FEATURE_COUNT):
                    corrupted_samples.append(
                        {
                            "path": str(npy_path),
                            "window_index": window_index,
                            "reason": "invalid_window_shape",
                            "shape": list(window.shape),
                        }
                    )
                    continue
                if not np.isfinite(window).all():
                    corrupted_samples.append(
                        {
                            "path": str(npy_path),
                            "window_index": window_index,
                            "reason": "nan_or_inf",
                        }
                    )
                    continue

                sequences.append(window.astype(np.float32))
                labels.append(class_index)
                distribution[class_name] += 1

    if not sequences:
        raise RuntimeError(f"No valid windows found in {dataset_dir}")

    X = np.asarray(sequences, dtype=np.float32)
    y = np.asarray(labels, dtype=np.int64)
    validation_summary = {
        "dataset_dir": str(dataset_dir),
        "total_arrays_loaded": total_arrays,
        "total_candidate_windows": total_candidate_windows,
        "valid_windows": int(len(X)),
        "removed_windows_or_arrays": len(corrupted_samples),
        "corrupted_samples": corrupted_samples,
    }
    return X, y, distribution, validation_summary


def stratified_split(X: np.ndarray, y: np.ndarray):
    X_train, X_temp, y_train, y_temp = train_test_split(
        X,
        y,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=y,
        shuffle=True,
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp,
        y_temp,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=y_temp,
        shuffle=True,
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


def scale_windows(
    X_train: np.ndarray,
    X_val: np.ndarray,
    X_test: np.ndarray,
    scaler_path: Path | None = None,
):
    if scaler_path and scaler_path.exists():
        scaler = joblib.load(scaler_path)
        scaler_source = str(scaler_path)
    else:
        scaler = StandardScaler()
        scaler.fit(X_train.reshape(-1, FEATURE_COUNT))
        scaler_source = "fitted_on_training_split"

    def transform(X: np.ndarray) -> np.ndarray:
        scaled = scaler.transform(X.reshape(-1, FEATURE_COUNT))
        return scaled.reshape(-1, WINDOW_SIZE, FEATURE_COUNT).astype(np.float32)

    return (
        transform(X_train),
        transform(X_val),
        transform(X_test),
        scaler,
        scaler_source,
    )


def build_model() -> Model:
    inputs = Input(shape=(WINDOW_SIZE, FEATURE_COUNT))
    x = Bidirectional(
        LSTM(
            128,
            return_sequences=True,
            dropout=0.3,
            recurrent_dropout=0.2,
        )
    )(inputs)
    x = BatchNormalization()(x)
    x = Bidirectional(
        LSTM(
            64,
            return_sequences=False,
            dropout=0.3,
            recurrent_dropout=0.2,
        )
    )(x)
    x = BatchNormalization()(x)
    x = Dense(128, activation="relu")(x)
    x = Dropout(0.4)(x)
    x = Dense(64, activation="relu")(x)
    x = Dropout(0.3)(x)
    outputs = Dense(NUM_CLASSES, activation="softmax")(x)

    model = Model(
        inputs=inputs, outputs=outputs, name="exercise_classifier_22ex_bilstm"
    )
    model.compile(
        optimizer=Adam(learning_rate=1e-4),
        loss="categorical_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(
                k=5, name="top_k_categorical_accuracy"
            ),
        ],
    )
    return model


def compute_weights(
    y_train: np.ndarray, class_names: List[str]
) -> Tuple[Dict[int, float], Dict[str, object]]:
    classes = np.arange(len(class_names))
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
    class_weight = {
        int(index): float(weight) for index, weight in zip(classes, weights)
    }
    weight_report = {
        "class_weight_by_index": class_weight,
        "class_weight_by_label": {
            class_names[index]: float(weight) for index, weight in zip(classes, weights)
        },
    }
    return class_weight, weight_report


def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def plot_training_curves(history: Dict[str, List[float]], model_dir: Path) -> None:
    epochs = range(1, len(history.get("loss", [])) + 1)

    plt.figure(figsize=(9, 6))
    plt.plot(epochs, history.get("accuracy", []), label="train_accuracy")
    plt.plot(epochs, history.get("val_accuracy", []), label="val_accuracy")
    plt.title("Training and Validation Accuracy")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(model_dir / "accuracy_curve.png", dpi=180)
    plt.close()

    plt.figure(figsize=(9, 6))
    plt.plot(epochs, history.get("loss", []), label="train_loss")
    plt.plot(epochs, history.get("val_loss", []), label="val_loss")
    plt.title("Training and Validation Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(model_dir / "loss_curve.png", dpi=180)
    plt.close()

    learning_rates = history.get("learning_rate", []) or history.get("lr", [])
    plt.figure(figsize=(9, 6))
    plt.plot(epochs[: len(learning_rates)], learning_rates, label="learning_rate")
    plt.title("Learning Rate Schedule")
    plt.xlabel("Epoch")
    plt.ylabel("Learning Rate")
    plt.yscale("log")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(model_dir / "learning_rate_curve.png", dpi=180)
    plt.close()


def plot_confusion_matrices(
    y_true: np.ndarray, y_pred: np.ndarray, class_names: List[str], model_dir: Path
) -> None:
    raw_cm = confusion_matrix(y_true, y_pred, labels=np.arange(len(class_names)))
    normalized_cm = raw_cm.astype(np.float32) / np.maximum(
        raw_cm.sum(axis=1, keepdims=True), 1
    )

    save_json(model_dir / "confusion_matrix_raw.json", raw_cm.tolist())
    save_json(model_dir / "confusion_matrix_normalized.json", normalized_cm.tolist())

    fig, axes = plt.subplots(1, 2, figsize=(26, 11))
    for ax, matrix, title, fmt in [
        (axes[0], raw_cm, "Raw Confusion Matrix", "d"),
        (axes[1], normalized_cm, "Normalized Confusion Matrix", ".2f"),
    ]:
        image = ax.imshow(matrix, interpolation="nearest", cmap="Blues")
        ax.figure.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
        ax.set_title(title)
        ax.set_xlabel("Predicted label")
        ax.set_ylabel("True label")
        ax.set_xticks(np.arange(len(class_names)))
        ax.set_yticks(np.arange(len(class_names)))
        ax.set_xticklabels(class_names, rotation=90, fontsize=8)
        ax.set_yticklabels(class_names, fontsize=8)

        threshold = matrix.max() / 2.0 if matrix.size else 0
        for i in range(matrix.shape[0]):
            for j in range(matrix.shape[1]):
                value = matrix[i, j]
                ax.text(
                    j,
                    i,
                    format(value, fmt),
                    ha="center",
                    va="center",
                    color="white" if value > threshold else "black",
                    fontsize=6,
                )

    fig.tight_layout()
    fig.savefig(model_dir / "confusion_matrix.png", dpi=180)
    plt.close(fig)

    for filename, matrix, title, fmt in [
        ("confusion_matrix_raw.png", raw_cm, "Raw Confusion Matrix", "d"),
        (
            "confusion_matrix_normalized.png",
            normalized_cm,
            "Normalized Confusion Matrix",
            ".2f",
        ),
    ]:
        plt.figure(figsize=(13, 11))
        plt.imshow(matrix, interpolation="nearest", cmap="Blues")
        plt.colorbar(fraction=0.046, pad=0.04)
        plt.title(title)
        plt.xlabel("Predicted label")
        plt.ylabel("True label")
        plt.xticks(np.arange(len(class_names)), class_names, rotation=90, fontsize=8)
        plt.yticks(np.arange(len(class_names)), class_names, fontsize=8)
        plt.tight_layout()
        plt.savefig(model_dir / filename, dpi=180)
        plt.close()


def write_training_report(
    model_dir: Path, metadata: Dict[str, object], classification_text: str
) -> None:
    distribution = metadata["class_distribution"]
    weights = metadata["class_weights"]["class_weight_by_label"]
    lines = [
        "# 22-Exercise BiLSTM Training Report",
        "",
        f"Generated: {metadata['generated_at']}",
        "",
        "## Dataset Summary",
        "",
        f"- Dataset: `{metadata['dataset_dir']}`",
        f"- Total valid samples: {metadata['total_samples']}",
        f"- Window shape: ({metadata['window_size']}, {metadata['feature_count']})",
        f"- Classes: {metadata['num_classes']}",
        f"- Train / Val / Test: {metadata['train_samples']} / {metadata['val_samples']} / {metadata['test_samples']}",
        "",
        "## Class Distribution",
        "",
        "| Class | Samples | Weight |",
        "|---|---:|---:|",
    ]
    for class_name, count in distribution.items():
        lines.append(f"| {class_name} | {count} | {weights[class_name]:.6f} |")

    lines.extend(
        [
            "",
            "## Test Metrics",
            "",
            f"- Test loss: {metadata['test_metrics']['loss']:.6f}",
            f"- Test accuracy: {metadata['test_metrics']['accuracy']:.6f}",
            f"- Test top-5 accuracy: {metadata['test_metrics']['top_k_categorical_accuracy']:.6f}",
            "",
            "## Classification Report",
            "",
            "```text",
            classification_text.strip(),
            "```",
            "",
            "## Artifacts",
            "",
        ]
    )
    for artifact_name, artifact_path in metadata["artifacts"].items():
        lines.append(f"- `{artifact_name}`: `{artifact_path}`")

    (model_dir / "training_report.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train 22-exercise BiLSTM classifier on win45_angles windows."
    )
    parser.add_argument("--dataset-dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument(
        "--metadata-classes", type=Path, default=DEFAULT_METADATA_CLASSES
    )
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--existing-scaler", type=Path, default=None)
    parser.add_argument("--existing-label-encoder", type=Path, default=None)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument(
        "--quick-test", action="store_true", help="Run 2 epochs for smoke testing only."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_dir = args.model_dir
    model_dir.mkdir(parents=True, exist_ok=True)

    epochs = 2 if args.quick_test else args.epochs
    batch_size = args.batch_size

    np.random.seed(RANDOM_STATE)
    tf.random.set_seed(RANDOM_STATE)

    class_names = load_class_names(args.metadata_classes)
    if class_names != DEFAULT_CLASSES:
        print("Using class order from metadata:", class_names)
    if len(class_names) != NUM_CLASSES:
        raise ValueError(f"Expected {NUM_CLASSES} classes, found {len(class_names)}.")

    label_encoder = make_label_encoder(class_names, args.existing_label_encoder)

    X, y, class_distribution, validation_summary = load_windows(
        args.dataset_dir, class_names
    )
    print("\nDataset summary")
    print("---------------")
    print(f"Total valid samples: {len(X)}")
    print(f"Feature shape: {X.shape[1:]}")
    print("Samples per class:")
    print(json.dumps(class_distribution, indent=2))
    print(
        f"Removed/corrupted samples: {validation_summary['removed_windows_or_arrays']}"
    )

    if X.shape[1:] != (WINDOW_SIZE, FEATURE_COUNT):
        raise ValueError(
            f"Expected X shape (*,{WINDOW_SIZE},{FEATURE_COUNT}), got {X.shape}."
        )

    X_train, X_val, X_test, y_train, y_val, y_test = stratified_split(X, y)
    X_train, X_val, X_test, scaler, scaler_source = scale_windows(
        X_train,
        X_val,
        X_test,
        args.existing_scaler,
    )

    y_train_cat = to_categorical(y_train, num_classes=NUM_CLASSES)
    y_val_cat = to_categorical(y_val, num_classes=NUM_CLASSES)
    y_test_cat = to_categorical(y_test, num_classes=NUM_CLASSES)

    class_weight, class_weight_report = compute_weights(y_train, class_names)
    print("\nClass weights")
    print("-------------")
    print(json.dumps(class_weight_report["class_weight_by_label"], indent=2))

    model_path = model_dir / "exercise_classifier_22ex.keras"
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, verbose=1),
        ModelCheckpoint(
            model_path, monitor="val_accuracy", save_best_only=True, verbose=1
        ),
        LearningRateLogger(),
        CSVLogger(model_dir / "training_log.csv"),
    ]

    model = build_model()
    model.summary()
    history_obj = model.fit(
        X_train,
        y_train_cat,
        validation_data=(X_val, y_val_cat),
        epochs=epochs,
        batch_size=batch_size,
        shuffle=True,
        class_weight=class_weight,
        callbacks=callbacks,
        verbose=1,
    )

    # Save the best-restored model explicitly in case val_accuracy never improved on epoch 1.
    model.save(model_path)
    joblib.dump(scaler, model_dir / "feature_scaler_angles.pkl")
    joblib.dump(label_encoder, model_dir / "label_encoder.pkl")

    test_values = model.evaluate(X_test, y_test_cat, batch_size=batch_size, verbose=0)
    metric_names = model.metrics_names
    test_metrics = {
        name: float(value) for name, value in zip(metric_names, test_values)
    }
    if "compile_metrics" in test_metrics and len(test_values) >= 3:
        test_metrics = {
            "loss": float(test_values[0]),
            "accuracy": float(test_values[1]),
            "top_k_categorical_accuracy": float(test_values[2]),
        }

    y_prob = model.predict(X_test, batch_size=batch_size, verbose=0)
    y_pred = np.argmax(y_prob, axis=1)
    classification_text = classification_report(
        y_test,
        y_pred,
        labels=np.arange(NUM_CLASSES),
        target_names=class_names,
        digits=4,
        zero_division=0,
    )
    (model_dir / "classification_report.txt").write_text(
        classification_text, encoding="utf-8"
    )

    history = {
        key: [float(value) for value in values]
        for key, values in history_obj.history.items()
    }
    save_json(model_dir / "training_history.json", history)
    save_json(model_dir / "class_weights.json", class_weight_report)
    save_json(model_dir / "class_distribution.json", class_distribution)
    save_json(model_dir / "data_validation_summary.json", validation_summary)
    plot_training_curves(history, model_dir)
    plot_confusion_matrices(y_test, y_pred, class_names, model_dir)

    metadata = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "dataset_dir": str(args.dataset_dir),
        "window_size": WINDOW_SIZE,
        "feature_count": FEATURE_COUNT,
        "num_classes": NUM_CLASSES,
        "classes": class_names,
        "architecture": "BiLSTM",
        "epochs": args.epochs,
        "epochs_completed": len(history.get("loss", [])),
        "batch_size": batch_size,
        "random_state": RANDOM_STATE,
        "split": {
            "train": 0.70,
            "validation": 0.15,
            "test": 0.15,
            "strategy": "stratified",
        },
        "total_samples": int(len(X)),
        "train_samples": int(len(X_train)),
        "val_samples": int(len(X_val)),
        "test_samples": int(len(X_test)),
        "class_distribution": class_distribution,
        "train_class_distribution": {
            class_names[i]: int(count) for i, count in sorted(Counter(y_train).items())
        },
        "val_class_distribution": {
            class_names[i]: int(count) for i, count in sorted(Counter(y_val).items())
        },
        "test_class_distribution": {
            class_names[i]: int(count) for i, count in sorted(Counter(y_test).items())
        },
        "class_weights": class_weight_report,
        "scaler": {
            "type": "StandardScaler",
            "source": scaler_source,
            "fit_shape": "(train_samples * 45, 140)",
        },
        "test_metrics": test_metrics,
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "tensorflow": tf.__version__,
        },
        "artifacts": {
            "model": str(model_path),
            "scaler": str(model_dir / "feature_scaler_angles.pkl"),
            "label_encoder": str(model_dir / "label_encoder.pkl"),
            "class_weights": str(model_dir / "class_weights.json"),
            "class_distribution": str(model_dir / "class_distribution.json"),
            "training_metadata": str(model_dir / "training_metadata.json"),
            "classification_report": str(model_dir / "classification_report.txt"),
            "confusion_matrix": str(model_dir / "confusion_matrix.png"),
            "accuracy_curve": str(model_dir / "accuracy_curve.png"),
            "loss_curve": str(model_dir / "loss_curve.png"),
            "learning_rate_curve": str(model_dir / "learning_rate_curve.png"),
            "training_log": str(model_dir / "training_log.csv"),
        },
    }
    save_json(model_dir / "training_metadata.json", metadata)
    write_training_report(model_dir, metadata, classification_text)

    print("\nTraining complete")
    print("-----------------")
    print(json.dumps(test_metrics, indent=2))
    print(f"Artifacts saved to: {model_dir}")


if __name__ == "__main__":
    main()
