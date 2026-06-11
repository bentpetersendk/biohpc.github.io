#!/usr/bin/env python3
"""Generate public website statistics from Airtable source tables."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests


AIRTABLE_API_ROOT = "https://api.airtable.com/v0"
REQUEST_TIMEOUT = 30
REPO_ROOT = Path(__file__).resolve().parents[1]
STATS_PATH = REPO_ROOT / "stats.json"


@dataclass(frozen=True)
class Metric:
    section: str
    key: str
    table: str
    formula_env: str | None = None
    default_formula: str | None = None


METRICS: tuple[Metric, ...] = (
    Metric("users", "registered", "Users"),
    Metric(
        "users",
        "approved",
        "Users",
        "AIRTABLE_APPROVED_USERS_FORMULA",
        'LOWER({Account Status}) = "active"',
    ),
    Metric(
        "users",
        "pending_requests",
        "User Access Requests",
        "AIRTABLE_PENDING_USER_REQUESTS_FORMULA",
        'LOWER({Status}) = "pending pi approval"',
    ),
    Metric("pis", "registered", "PIs"),
    Metric(
        "pis",
        "approved",
        "PIs",
        "AIRTABLE_APPROVED_PIS_FORMULA",
        'LOWER({PI Registration Status}) = "approved"',
    ),
    Metric(
        "pis",
        "pending_requests",
        "PI Approval Requests",
        "AIRTABLE_PENDING_PI_REQUESTS_FORMULA",
        "{PI Approval Decision} = BLANK()",
    ),
    Metric("projects", "total", "Projects"),
    Metric(
        "projects",
        "ordered",
        "Projects",
        "AIRTABLE_ORDERED_PROJECTS_FORMULA",
        'LOWER({Project Status}) = "ordered"',
    ),
    Metric(
        "projects",
        "active",
        "Projects",
        "AIRTABLE_ACTIVE_PROJECTS_FORMULA",
        'LOWER({Project Status}) = "active"',
    ),
    Metric("research_groups", "total", "Research Groups"),
)

STATS_TEMPLATE: dict[str, Any] = {
    "users": {
        "registered": 0,
        "approved": 0,
        "pending_requests": 0,
    },
    "pis": {
        "registered": 0,
        "approved": 0,
        "pending_requests": 0,
    },
    "projects": {
        "total": 0,
        "ordered": 0,
        "active": 0,
    },
    "research_groups": {
        "total": 0,
    },
}


class AirtableError(RuntimeError):
    """Raised when Airtable data cannot be fetched."""


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise AirtableError(f"Missing required environment variable: {name}")
    return value


def fetch_table_count(
    session: requests.Session,
    base_id: str,
    table_name: str,
    view_name: str | None = None,
    filter_formula: str | None = None,
) -> int:
    encoded_table = quote(table_name, safe="")
    url = f"{AIRTABLE_API_ROOT}/{base_id}/{encoded_table}"
    params: dict[str, str | int] = {"pageSize": 100}
    if view_name:
        params["view"] = view_name
    if filter_formula:
        params["filterByFormula"] = filter_formula

    count = 0
    while True:
        try:
            response = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            raise AirtableError(f"Failed to fetch Airtable table '{table_name}': {exc}") from exc

        if response.status_code != 200:
            raise AirtableError(
                f"Airtable API returned HTTP {response.status_code} for table '{table_name}': "
                f"{response.text}"
            )

        try:
            payload: dict[str, Any] = response.json()
        except ValueError as exc:
            raise AirtableError(f"Airtable returned invalid JSON for table '{table_name}'.") from exc

        records = payload.get("records")
        if not isinstance(records, list):
            raise AirtableError(f"Airtable response for table '{table_name}' did not include records.")

        count += len(records)

        offset = payload.get("offset")
        if not offset:
            return count
        params["offset"] = str(offset)


def write_json_atomically(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(data, indent=2) + "\n"
    tmp_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            "w",
            delete=False,
            dir=path.parent,
            encoding="utf-8",
        ) as tmp_file:
            tmp_file.write(serialized)
            tmp_path = Path(tmp_file.name)

        tmp_path.replace(path)
    except OSError:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


def read_existing_stats(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None

    try:
        with path.open("r", encoding="utf-8") as stats_file:
            payload = json.load(stats_file)
    except (OSError, ValueError):
        return None

    return payload if isinstance(payload, dict) else None


def metrics_are_unchanged(new_stats: dict[str, Any], existing_stats: dict[str, Any] | None) -> bool:
    if not existing_stats:
        return False

    return strip_updated(existing_stats) == strip_updated(new_stats)


def strip_updated(stats: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in stats.items() if key != "updated"}


def get_metric_formula(metric: Metric) -> str | None:
    if not metric.formula_env:
        return None

    formula = os.environ.get(metric.formula_env, "").strip()
    if formula:
        return formula

    return metric.default_formula


def empty_stats() -> dict[str, Any]:
    return json.loads(json.dumps(STATS_TEMPLATE))


def build_stats() -> dict[str, Any]:
    token = require_env("AIRTABLE_TOKEN")
    base_id = require_env("AIRTABLE_BASE_ID")
    view_name = os.environ.get("AIRTABLE_VIEW", "").strip() or None

    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {token}"})

    stats = empty_stats()
    for metric in METRICS:
        stats[metric.section][metric.key] = fetch_table_count(
            session,
            base_id,
            metric.table,
            view_name,
            get_metric_formula(metric),
        )

    existing_stats = read_existing_stats(STATS_PATH)
    if metrics_are_unchanged(stats, existing_stats) and existing_stats.get("updated"):
        updated = existing_stats.get("updated")
    else:
        updated = datetime.now(timezone.utc).isoformat(timespec="seconds")

    return {"updated": updated, **stats}


def main() -> int:
    try:
        stats = build_stats()
        write_json_atomically(STATS_PATH, stats)
    except (AirtableError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {STATS_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
