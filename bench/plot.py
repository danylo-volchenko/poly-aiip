#!/usr/bin/env python3
"""Build lab-3 benchmark figures from bench/results.json."""

import argparse
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

BLUE = "#0072b2"
GREEN = "#009e73"
ORANGE = "#e69f00"
RED = "#d55e00"
GRID = "#d9d9d9"


def load_cases(path):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    grouped = {}
    for case in data["cases"]:
        grouped.setdefault(case["id"], []).append(case)
    return data, grouped


def fit(xs, ys):
    xs = np.asarray(xs, dtype=float)
    ys = np.asarray(ys, dtype=float)
    slope, intercept = np.polyfit(xs, ys, 1)
    pred = slope * xs + intercept
    ss_res = float(np.sum((ys - pred) ** 2))
    ss_tot = float(np.sum((ys - ys.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot else 1.0
    return slope, intercept, r2


def style(ax):
    ax.grid(True, color=GRID, linewidth=0.7, alpha=0.9)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.tick_params(labelsize=9)


def series(case, key):
    xs = [c["params"][key] for c in case]
    mean = np.array([c["mean"] for c in case])
    lo = mean - np.array([c["min"] for c in case])
    hi = np.array([c["max"] for c in case]) - mean
    return np.array(xs, dtype=float), mean, np.vstack([lo, hi])


def figure_inference(case, out):
    xs, mean, err = series(case, "n")
    slope, intercept, r2 = fit(xs, mean)
    fig, ax = plt.subplots(figsize=(6.3, 3.55))
    ax.errorbar(xs / 1000.0, mean, yerr=err, fmt="o", color=BLUE,
                ecolor=BLUE, elinewidth=1, capsize=2.5, markersize=4.5,
                label="Середнє (мін–макс)")
    grid = np.linspace(xs.min(), xs.max(), 200)
    ax.plot(grid / 1000.0, slope * grid + intercept, color=RED,
            linewidth=1.3, label="Лінійна апроксимація")
    ax.set_xlabel("Довжина послідовності N, тис. значень БПМ", fontsize=10)
    ax.set_ylabel("Час прогнозу, мс", fontsize=10)
    ax.set_ylim(bottom=0)
    ax.annotate(f"t = {slope * 1000:.2f} мкс × N\nR² = {r2:.5f}",
                xy=(0.04, 0.93), xycoords="axes fraction", va="top",
                fontsize=9, color="#333333")
    ax.legend(frameon=False, fontsize=8.5, loc="lower right")
    style(ax)
    fig.tight_layout()
    fig.savefig(out, dpi=200)
    plt.close(fig)


def figure_eval_train(evaluation, training, out):
    fig, axes = plt.subplots(1, 2, figsize=(6.3, 3.35))
    panels = [
        (axes[0], evaluation, "samples", "Оцінювання", BLUE),
        (axes[1], training, "samples", "Навчання", GREEN),
    ]
    for ax, case, key, name, color in panels:
        xs, mean, err = series(case, key)
        slope, intercept, r2 = fit(xs, mean)
        ax.errorbar(xs / 1000.0, mean, yerr=err, fmt="o", color=color,
                    ecolor=color, elinewidth=1, capsize=2.5, markersize=4)
        grid = np.linspace(xs.min(), xs.max(), 200)
        ax.plot(grid / 1000.0, slope * grid + intercept, color=RED,
                linewidth=1.2)
        ax.set_title(name, fontsize=10)
        ax.set_xlabel("Вибірка S, тис. зразків", fontsize=9)
        ax.set_ylabel("Час, мс", fontsize=9)
        ax.set_ylim(bottom=0)
        ax.annotate(f"{slope * 1000:.1f} мкс/зразок\nR² = {r2:.4f}",
                    xy=(0.04, 0.93), xycoords="axes fraction", va="top",
                    fontsize=8, color="#333333")
        style(ax)
    fig.tight_layout()
    fig.savefig(out, dpi=200)
    plt.close(fig)


def figure_k_epochs(kcase, epochs, out):
    fig, axes = plt.subplots(1, 2, figsize=(6.3, 3.35))
    ax = axes[0]
    xs, mean, err = series(kcase, "k")
    slope, intercept, r2 = fit(xs, mean)
    ax.errorbar(xs, mean, yerr=err, fmt="o", color=ORANGE, ecolor=ORANGE,
                elinewidth=1, capsize=2.5, markersize=4.5)
    grid = np.linspace(xs.min(), xs.max(), 200)
    ax.plot(grid, slope * grid + intercept, color=RED, linewidth=1.1,
            linestyle="--")
    ax.set_xlabel("Ширина вікна K, значень БПМ", fontsize=9)
    ax.set_ylabel("Час, мс", fontsize=9)
    ax.set_ylim(0, 320)
    ax.annotate(f"{slope:.2f} мс на K\nR² = {r2:.3f}",
                xy=(0.04, 0.93), xycoords="axes fraction", va="top",
                fontsize=8, color="#333333")
    style(ax)

    ax = axes[1]
    xs, mean, err = series(epochs, "epochs")
    slope, intercept, r2 = fit(xs, mean)
    ax.errorbar(xs, mean, yerr=err, fmt="o", color=GREEN, ecolor=GREEN,
                elinewidth=1, capsize=2.5, markersize=4.5)
    grid = np.linspace(xs.min(), xs.max(), 200)
    ax.plot(grid, slope * grid + intercept, color=RED, linewidth=1.2)
    ax.set_xlabel("Кількість епох E", fontsize=9)
    ax.set_ylabel("Час, мс", fontsize=9)
    ax.set_ylim(bottom=0)
    ax.annotate(f"{slope:.1f} мс/епоха\nR² = {r2:.4f}",
                xy=(0.04, 0.93), xycoords="axes fraction", va="top",
                fontsize=8, color="#333333")
    style(ax)
    fig.tight_layout()
    fig.savefig(out, dpi=200)
    plt.close(fig)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", default=os.path.join(here, "results.json"))
    parser.add_argument("--out", default=os.path.join(here, "figures"))
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    _, cases = load_cases(args.results)
    figure_inference(cases["inference"], os.path.join(args.out, "fig-inference.png"))
    figure_eval_train(cases["evaluation"], cases["training"],
                      os.path.join(args.out, "fig-eval-train.png"))
    figure_k_epochs(cases["window-k"], cases["epochs"],
                    os.path.join(args.out, "fig-k-epochs.png"))
    print("wrote figures to", args.out)


if __name__ == "__main__":
    main()
