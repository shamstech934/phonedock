#!/usr/bin/env python3
"""PhoneDock free phone-spec enrichment tool.

Uses a free/unofficial phone-spec API only as an import aid. It never writes to
MongoDB directly. Every match is written to a review CSV first.

Examples:
  python scripts/enrich_phone_specs.py --input phonedock-missing-specs-all.csv --limit 50
  python scripts/enrich_phone_specs.py --input phonedock-missing-specs-all.csv --limit 50 --apply-confident
  python scripts/enrich_phone_specs.py --input phonedock-missing-specs-all.csv --offline-cache .cache/phone-specs

The default API is the open-source azharimm phone-specs-api. Because it is an
unofficial service, responses are cached and failures are non-destructive.
"""
from __future__ import annotations

import argparse
import csv
import difflib
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

DEFAULT_API = "https://api-mobilespecs.azharimm.dev"
USER_AGENT = "PhoneDock-Data-Enricher/1.0 (+admin import tool)"
OUTPUT_FIELDS = ["Display", "Chipset", "RAM", "Storage", "Battery", "Main Camera", "5G"]


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(clean(v) for v in value if clean(v))
    if isinstance(value, dict):
        return "; ".join(f"{k}: {clean(v)}" for k, v in value.items() if clean(v))
    return re.sub(r"\s+", " ", str(value)).strip()


def normalize_name(value: str) -> str:
    value = value.lower().replace("&", " and ")
    value = re.sub(r"\b(5g|4g|lte|dual sim|single sim|global|international|edition)\b", " ", value)
    value = re.sub(r"\b(\d+)\s*(gb|tb)\b", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def storage_tokens(value: str) -> set[str]:
    return set(re.findall(r"\b\d+\s*(?:gb|tb)\b", value.lower().replace(" ", "")))


def similarity(target: str, candidate: str) -> float:
    a, b = normalize_name(target), normalize_name(candidate)
    if not a or not b:
        return 0.0
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    a_tokens, b_tokens = set(a.split()), set(b.split())
    token_score = len(a_tokens & b_tokens) / max(1, len(a_tokens | b_tokens))
    return round((ratio * 0.65) + (token_score * 0.35), 4)


def get_path(obj: Any, *paths: str) -> Any:
    for path in paths:
        cur = obj
        ok = True
        for part in path.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok and clean(cur):
            return cur
    return ""


def flatten_specs(payload: dict[str, Any]) -> dict[str, str]:
    # API versions have used both structured dictionaries and GSMArena-style
    # section arrays. Convert either shape into a lower-case searchable map.
    flat: dict[str, str] = {}

    def walk(node: Any, prefix: str = "") -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                p = f"{prefix}.{key}" if prefix else str(key)
                if isinstance(value, (dict, list)):
                    walk(value, p)
                elif clean(value):
                    flat[p.lower()] = clean(value)
        elif isinstance(node, list):
            for i, value in enumerate(node):
                if isinstance(value, dict):
                    title = clean(value.get("title") or value.get("key") or value.get("name"))
                    val = value.get("specs") or value.get("value") or value.get("val")
                    if title and clean(val):
                        flat[f"{prefix}.{title}".lower()] = clean(val)
                    walk(value, f"{prefix}.{i}")
                else:
                    walk(value, f"{prefix}.{i}")

    walk(payload)
    return flat


def pick(flat: dict[str, str], keywords: Iterable[str], reject: Iterable[str] = ()) -> str:
    keys = list(flat.keys())
    for keyword in keywords:
        pattern = keyword.lower()
        for key in keys:
            if pattern in key and not any(r.lower() in key for r in reject):
                value = flat[key]
                if value:
                    return value
    return ""


def map_spec_fields(payload: dict[str, Any]) -> dict[str, str]:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    flat = flatten_specs(data)

    display = clean(get_path(data, "specifications.display", "specs.display", "display")) or pick(
        flat, ["display.type", "display.size", "display"], ["resolution", "protection"]
    )
    chipset = clean(get_path(data, "specifications.platform.chipset", "specs.platform.chipset", "chipset")) or pick(
        flat, ["platform.chipset", "chipset", "processor"]
    )
    ram = clean(get_path(data, "specifications.memory.ram", "specs.memory.ram", "ram")) or pick(
        flat, ["memory.ram", ".ram"], ["camera"]
    )
    storage = clean(get_path(data, "specifications.memory.internal", "specs.memory.internal", "storage")) or pick(
        flat, ["memory.internal", "internal", "storage"]
    )
    battery = clean(get_path(data, "specifications.battery.type", "specs.battery.type", "battery")) or pick(
        flat, ["battery.type", "battery"]
    )
    camera = clean(get_path(data, "specifications.main_camera", "specs.main_camera", "main_camera")) or pick(
        flat, ["main camera", "main_camera", "camera.single", "camera.dual", "camera.triple", "camera.quad"], ["selfie"]
    )
    network = clean(get_path(data, "specifications.network.technology", "specs.network.technology", "network")) or pick(
        flat, ["network.technology", "technology", "network"]
    )
    five_g = "Yes" if re.search(r"\b5g\b", network, re.I) else ("No" if network else "")

    return {
        "Display": display,
        "Chipset": chipset,
        "RAM": ram,
        "Storage": storage,
        "Battery": battery,
        "Main Camera": camera,
        "5G": five_g,
    }


@dataclass
class ApiClient:
    base_url: str
    cache_dir: Path
    timeout: int = 25
    delay: float = 0.8
    offline: bool = False

    def _cache_file(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{digest}.json"

    def get_json(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        query = urllib.parse.urlencode(params or {})
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}" + (f"?{query}" if query else "")
        cache_file = self._cache_file(url)
        if cache_file.exists():
            return json.loads(cache_file.read_text(encoding="utf-8"))
        if self.offline:
            raise RuntimeError(f"Not cached: {url}")

        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:300]
            raise RuntimeError(f"API HTTP {exc.code}: {body}") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"API request failed: {exc}") from exc

        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(max(0.0, self.delay))
        return payload

    def search(self, query: str) -> list[dict[str, Any]]:
        attempts = [("v2/search", {"query": query}), ("search", {"query": query})]
        last_error: Exception | None = None
        for path, params in attempts:
            try:
                payload = self.get_json(path, params)
                data = payload.get("data", payload)
                if isinstance(data, dict):
                    for key in ("phones", "results", "items"):
                        if isinstance(data.get(key), list):
                            return [x for x in data[key] if isinstance(x, dict)]
                if isinstance(data, list):
                    return [x for x in data if isinstance(x, dict)]
            except Exception as exc:  # try legacy endpoint next
                last_error = exc
        if last_error:
            raise last_error
        return []

    def details(self, slug: str) -> dict[str, Any]:
        attempts = [f"v2/{slug}", slug]
        last_error: Exception | None = None
        for path in attempts:
            try:
                return self.get_json(path)
            except Exception as exc:
                last_error = exc
        if last_error:
            raise last_error
        return {}


def candidate_name(item: dict[str, Any]) -> str:
    return clean(item.get("phone_name") or item.get("name") or item.get("model") or item.get("title"))


def candidate_slug(item: dict[str, Any]) -> str:
    return clean(item.get("slug") or item.get("detail") or item.get("phone_slug") or item.get("id")).strip("/")


def choose_candidate(brand: str, model: str, items: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, float]:
    target = f"{brand} {model}"
    ranked: list[tuple[float, dict[str, Any]]] = []
    model_storage = storage_tokens(model)
    for item in items:
        name = candidate_name(item)
        if not name:
            continue
        score = similarity(target, name)
        if brand.lower() in name.lower():
            score += 0.06
        candidate_storage = storage_tokens(name)
        if model_storage and candidate_storage and model_storage != candidate_storage:
            score -= 0.08
        ranked.append((score, item))
    if not ranked:
        return None, 0.0
    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked[0][1], round(min(1.0, ranked[0][0]), 4)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row")
        return list(reader.fieldnames), [dict(row) for row in reader]


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich PhoneDock missing-spec CSV using a cached free API workflow")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("phonedock-specs-enriched.csv"))
    parser.add_argument("--review-output", type=Path, default=Path("phonedock-specs-review.csv"))
    parser.add_argument("--cache", type=Path, default=Path(".cache/phone-specs-api"))
    parser.add_argument("--api-base", default=DEFAULT_API)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--min-score", type=float, default=0.74)
    parser.add_argument("--apply-confident", action="store_true", help="Fill fields automatically only for high-confidence matches")
    parser.add_argument("--offline-cache", action="store_true", help="Do not make network requests; use cached JSON only")
    parser.add_argument("--delay", type=float, default=0.8)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    fields, rows = read_csv(args.input)
    required = {"Phone ID", "Brand", "Model"}
    missing = required - set(fields)
    if missing:
        raise ValueError(f"Input CSV is missing columns: {', '.join(sorted(missing))}")

    review_fields = fields + [f for f in OUTPUT_FIELDS if f not in fields] + [
        "Matched Phone", "Match Score", "Source Provider", "Source URL", "Enrichment Status", "Enrichment Note"
    ]
    output_fields = fields + [f for f in OUTPUT_FIELDS if f not in fields] + [
        "Spec Source", "Spec Match Score", "Spec Verified At"
    ]

    client = ApiClient(args.api_base, args.cache, delay=args.delay, offline=args.offline_cache)
    selected = rows[args.start : args.start + args.limit]
    review_rows: list[dict[str, str]] = []
    applied = 0

    print(f"Processing {len(selected)} records (start={args.start}, limit={args.limit})")
    for index, row in enumerate(selected, start=args.start + 1):
        brand, model = clean(row.get("Brand")), clean(row.get("Model"))
        review = dict(row)
        try:
            items = client.search(f"{brand} {model}")
            match, score = choose_candidate(brand, model, items)
            if not match:
                raise RuntimeError("No candidate returned")
            matched_name = candidate_name(match)
            slug = candidate_slug(match)
            if not slug:
                raise RuntimeError("Candidate has no detail slug")
            details = client.details(slug)
            mapped = map_spec_fields(details)
            filled_count = sum(1 for value in mapped.values() if value)
            confident = score >= args.min_score and filled_count >= 3

            review.update(mapped)
            review.update({
                "Matched Phone": matched_name,
                "Match Score": f"{score:.3f}",
                "Source Provider": "azharimm/phone-specs-api",
                "Source URL": f"{args.api_base.rstrip('/')}/{slug}",
                "Enrichment Status": "ready-for-review" if confident else "manual-review",
                "Enrichment Note": f"{filled_count}/7 fields found; API is unofficial, verify before production import.",
            })

            if args.apply_confident and confident:
                target = rows[index - 1]
                for field, value in mapped.items():
                    if value and not clean(target.get(field)):
                        target[field] = value
                target["Data Confidence"] = "api-review"
                target["Spec Source"] = f"{args.api_base.rstrip('/')}/{slug}"
                target["Spec Match Score"] = f"{score:.3f}"
                target["Spec Verified At"] = datetime.now(timezone.utc).isoformat()
                applied += 1
            print(f"[{index}] {brand} {model}: {matched_name} ({score:.3f}) — {filled_count}/7")
        except Exception as exc:
            review.update({
                "Matched Phone": "", "Match Score": "", "Source Provider": "azharimm/phone-specs-api",
                "Source URL": "", "Enrichment Status": "not-found", "Enrichment Note": str(exc)[:500],
            })
            print(f"[{index}] {brand} {model}: FAILED — {exc}", file=sys.stderr)
        review_rows.append(review)

    write_csv(args.review_output, review_fields, review_rows)
    write_csv(args.output, output_fields, rows)
    print(f"\nReview CSV: {args.review_output}")
    print(f"Updated CSV: {args.output}")
    print(f"Auto-applied confident matches: {applied}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Cancelled", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"Fatal: {exc}", file=sys.stderr)
        raise SystemExit(1)
