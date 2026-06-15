#!/usr/bin/env python3
"""Generate public website statistics from Airtable source tables."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests


AIRTABLE_API_ROOT = "https://api.airtable.com/v0"
REQUEST_TIMEOUT = 30
MAX_REQUEST_ATTEMPTS = 5
RETRY_BACKOFF_SECONDS = (2, 4, 8, 16)
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATS_PATH = Path("biohpc/stats.json")


@dataclass(frozen=True)
class Metric:
    section: str
    key: str
    table: str
    formula_env: str | None = None
    default_formula: str | None = None


USER_TOTAL_REGISTERED_FORMULA = (
    "OR("
    'LOWER({Account Status}) = "active",'
    'LOWER({Account Status}) = "inactive",'
    'LOWER({Account Status}) = "disabled",'
    'LOWER({Account Status}) = "suspended",'
    'LOWER({Account Status}) = "deactivated",'
    'LOWER({Account Status}) = "closed"'
    ")"
)
USER_ACTIVE_FORMULA = 'LOWER({Account Status}) = "active"'

METRICS: tuple[Metric, ...] = (
    Metric(
        "users",
        "registered",
        "Users",
        "AIRTABLE_TOTAL_USERS_REGISTERED_FORMULA",
        USER_TOTAL_REGISTERED_FORMULA,
    ),
    Metric(
        "users",
        "active",
        "Users",
        "AIRTABLE_ACTIVE_USERS_FORMULA",
        USER_ACTIVE_FORMULA,
    ),
    Metric(
        "users",
        "approved",
        "Users",
        "AIRTABLE_APPROVED_USERS_FORMULA",
        USER_ACTIVE_FORMULA,
    ),
    Metric(
        "users",
        "pending_requests",
        "Users",
        "AIRTABLE_PENDING_USER_REQUESTS_FORMULA",
        'LOWER({Account Status}) = "pending pi approval"',
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
        "active": 0,
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


def is_retryable_response(response: requests.Response) -> bool:
    return response.status_code == 429 or 500 <= response.status_code <= 599


def warn_retry(table_name: str, attempt: int, delay: int, reason: str) -> None:
    print(
        f"Warning: Airtable request for table '{table_name}' failed on attempt "
        f"{attempt}/{MAX_REQUEST_ATTEMPTS}: {reason}. Retrying in {delay}s.",
        file=sys.stderr,
    )


def get_airtable_page(
    session: requests.Session,
    url: str,
    params: dict[str, str | int],
    table_name: str,
) -> requests.Response:
    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        try:
            response = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            if attempt == MAX_REQUEST_ATTEMPTS:
                raise AirtableError(f"Failed to fetch Airtable table '{table_name}': {exc}") from exc

            delay = RETRY_BACKOFF_SECONDS[attempt - 1]
            warn_retry(table_name, attempt, delay, str(exc))
            time.sleep(delay)
            continue

        if response.status_code == 200:
            return response

        if is_retryable_response(response) and attempt < MAX_REQUEST_ATTEMPTS:
            delay = RETRY_BACKOFF_SECONDS[attempt - 1]
            warn_retry(table_name, attempt, delay, f"HTTP {response.status_code}")
            time.sleep(delay)
            continue

        raise AirtableError(
            f"Airtable API returned HTTP {response.status_code} for table '{table_name}': "
            f"{response.text}"
        )

    raise AirtableError(f"Failed to fetch Airtable table '{table_name}' after {MAX_REQUEST_ATTEMPTS} attempts.")


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
        response = get_airtable_page(session, url, params, table_name)

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


def get_metric_formula(metric: Metric) -> str | None:
    if not metric.formula_env:
        return None

    formula = os.environ.get(metric.formula_env, "").strip()
    if formula:
        return formula

    return metric.default_formula


def empty_stats() -> dict[str, Any]:
    return json.loads(json.dumps(STATS_TEMPLATE))


def get_output_path() -> Path:
    configured_path = os.environ.get("STATS_OUTPUT_PATH", "").strip()
    output_path = Path(configured_path) if configured_path else DEFAULT_STATS_PATH
    if not output_path.is_absolute():
        output_path = REPO_ROOT / output_path
    return output_path


def get_display_path(path: Path) -> Path:
    try:
        return path.relative_to(REPO_ROOT)
    except ValueError:
        return path


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

    updated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {"updated": updated, **stats}


def main() -> int:
    output_path = get_output_path()
    try:
        stats = build_stats()
        write_json_atomically(output_path, stats)
    except (AirtableError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {get_display_path(output_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
