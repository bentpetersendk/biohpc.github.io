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
    table_env: str | None = None
    formula_env: str | None = None
    default_formula: str | None = None
    fallback_field: str | None = None
    fallback_values: tuple[str, ...] = ()


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
PI_PENDING_FORMULA = '{PI Registration Status} = "Pending Verification"'
USER_ACCESS_REQUESTS_IN_PROGRESS_FORMULA = (
    "OR("
    'LOWER({Status}) = "pending pi approval",'
    'LOWER({Status}) = "approved - pending provisioning"'
    ")"
)

METRICS: tuple[Metric, ...] = (
    Metric(
        "users",
        "registered",
        "Users",
        None,
        "AIRTABLE_TOTAL_USERS_REGISTERED_FORMULA",
        USER_TOTAL_REGISTERED_FORMULA,
    ),
    Metric(
        "users",
        "active",
        "Users",
        None,
        "AIRTABLE_ACTIVE_USERS_FORMULA",
        USER_ACTIVE_FORMULA,
    ),
    Metric(
        "users",
        "approved",
        "Users",
        None,
        "AIRTABLE_APPROVED_USERS_FORMULA",
        USER_ACTIVE_FORMULA,
    ),
    Metric(
        "users",
        "pending_requests",
        "Access Requests",
        "AIRTABLE_ACCESS_REQUESTS_TABLE",
        "AIRTABLE_PENDING_USER_REQUESTS_FORMULA",
        USER_ACCESS_REQUESTS_IN_PROGRESS_FORMULA,
        "Status",
        ("Pending PI Approval", "Approved - Pending Provisioning"),
    ),
    Metric("pis", "registered", "PIs"),
    Metric(
        "pis",
        "pending_requests",
        "PIs",
        None,
        "AIRTABLE_PENDING_PI_REQUESTS_FORMULA",
        PI_PENDING_FORMULA,
        "PI Registration Status",
        ("Pending Verification",),
    ),
    Metric("projects", "total", "Projects"),
    Metric(
        "projects",
        "ordered",
        "Projects",
        None,
        "AIRTABLE_ORDERED_PROJECTS_FORMULA",
        'LOWER({Project Status}) = "ordered"',
    ),
    Metric(
        "projects",
        "active",
        "Projects",
        None,
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


def fetch_table_records(
    session: requests.Session,
    base_id: str,
    table_name: str,
    view_name: str | None = None,
) -> list[dict[str, Any]]:
    encoded_table = quote(table_name, safe="")
    url = f"{AIRTABLE_API_ROOT}/{base_id}/{encoded_table}"
    params: dict[str, str | int] = {"pageSize": 100}
    if view_name:
        params["view"] = view_name

    all_records: list[dict[str, Any]] = []
    while True:
        response = get_airtable_page(session, url, params, table_name)

        try:
            payload: dict[str, Any] = response.json()
        except ValueError as exc:
            raise AirtableError(f"Airtable returned invalid JSON for table '{table_name}'.") from exc

        records = payload.get("records")
        if not isinstance(records, list):
            raise AirtableError(f"Airtable response for table '{table_name}' did not include records.")

        all_records.extend(record for record in records if isinstance(record, dict))

        offset = payload.get("offset")
        if not offset:
            return all_records
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


def get_metric_table(metric: Metric) -> str:
    if not metric.table_env:
        return metric.table

    return os.environ.get(metric.table_env, "").strip() or metric.table


def has_metric_formula_override(metric: Metric) -> bool:
    if not metric.formula_env:
        return False
    return bool(os.environ.get(metric.formula_env, "").strip())


def describe_formula(formula: str | None) -> str:
    return formula if formula else "<none>"


def log_metric_count(metric: Metric, table_name: str, formula: str | None, count: int) -> None:
    metric_name = f"{metric.section}.{metric.key}"
    print(
        f"Metric {metric_name}: table='{table_name}', "
        f"formula={describe_formula(formula)}, count={count}",
        file=sys.stderr,
    )


def normalize_airtable_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value.strip()]
    if isinstance(value, list):
        values: list[str] = []
        for item in value:
            values.extend(normalize_airtable_values(item))
        return values
    if isinstance(value, dict):
        for key in ("name", "text", "value"):
            nested = value.get(key)
            if nested is not None:
                return normalize_airtable_values(nested)
        return []
    return [str(value).strip()]


def count_records_by_field_values(
    session: requests.Session,
    base_id: str,
    table_name: str,
    view_name: str | None,
    field_name: str,
    expected_values: tuple[str, ...],
) -> tuple[int, dict[str, int]]:
    expected = {value.casefold() for value in expected_values}
    distribution: dict[str, int] = {}
    count = 0

    for record in fetch_table_records(session, base_id, table_name, view_name):
        fields = record.get("fields", {})
        if not isinstance(fields, dict):
            continue

        values = normalize_airtable_values(fields.get(field_name))
        if not values:
            distribution["<blank>"] = distribution.get("<blank>", 0) + 1
            continue

        normalized_values = {value.casefold() for value in values}
        if expected.intersection(normalized_values):
            count += 1

        for value in values:
            label = value or "<blank>"
            distribution[label] = distribution.get(label, 0) + 1

    return count, distribution


def log_field_distribution(metric: Metric, distribution: dict[str, int]) -> None:
    metric_name = f"{metric.section}.{metric.key}"
    values = ", ".join(f"{value}={count}" for value, count in sorted(distribution.items()))
    print(
        f"Metric {metric_name}: fallback field='{metric.fallback_field}', "
        f"status distribution={values or '<none>'}",
        file=sys.stderr,
    )


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
        formula = get_metric_formula(metric)
        table_name = get_metric_table(metric)
        count = fetch_table_count(
            session,
            base_id,
            table_name,
            view_name,
            formula,
        )
        log_metric_count(metric, table_name, formula, count)
        if count == 0 and metric.fallback_field and metric.fallback_values and not has_metric_formula_override(metric):
            fallback_count, distribution = count_records_by_field_values(
                session,
                base_id,
                table_name,
                view_name,
                metric.fallback_field,
                metric.fallback_values,
            )
            log_field_distribution(metric, distribution)
            print(
                f"Metric {metric.section}.{metric.key}: using fallback count={fallback_count}",
                file=sys.stderr,
            )
            count = fallback_count
        stats[metric.section][metric.key] = count

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
