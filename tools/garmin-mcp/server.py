#!/usr/bin/env python3
"""A small, read-only MCP server over Garmin Connect.

Deliberately narrow: every tool here is a GET. Nothing in this file writes to
Garmin, uploads a workout, or deletes anything, so the worst case if something
goes wrong is a failed read.

Auth comes from the OAuth tokens that login.py stored in ~/.garminconnect.
If those are missing or stale, every tool returns a clear message telling you
to run login.py again rather than silently returning nothing.

Dates are YYYY-MM-DD and interpreted in local time.
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any

from garminconnect import Garmin
from mcp.server.mcpserver import MCPServer

TOKENSTORE = os.path.expanduser("~/.garminconnect")

mcp = MCPServer("garmin", instructions="Read-only access to this user's Garmin Connect data.")

_client: Garmin | None = None


class NotLoggedIn(RuntimeError):
    pass


def client() -> Garmin:
    """Return a logged-in client, reusing one across calls.

    garminconnect refreshes the bearer token by itself as long as the stored
    refresh token is still valid, so this normally does no network I/O.
    """
    global _client
    if _client is not None:
        return _client

    if not os.path.isdir(TOKENSTORE):
        raise NotLoggedIn(
            f"No Garmin tokens found at {TOKENSTORE}. "
            "Run `./.venv/bin/python login.py` in tools/garmin-mcp first."
        )

    g = Garmin()
    try:
        g.login(tokenstore=TOKENSTORE)
    except Exception as err:
        raise NotLoggedIn(
            f"Stored Garmin tokens did not work ({err}). "
            "Run `./.venv/bin/python login.py` again."
        ) from err

    _client = g
    return g


def _days_back(days: int) -> list[str]:
    today = date.today()
    return [(today - timedelta(days=i)).isoformat() for i in range(days)]


def _safe(fn, *args) -> Any:
    """Call a Garmin getter, turning an upstream failure into None.

    A missing day is normal — the watch was off the wrist, or the metric needs
    more nights before Garmin will report it. Returning None keeps one gap from
    blanking a whole week.
    """
    try:
        return fn(*args)
    except Exception:
        return None


def _round(value: Any, digits: int = 1) -> Any:
    return round(value, digits) if isinstance(value, (int, float)) else None


# --------------------------------------------------------------------------
# Tools
# --------------------------------------------------------------------------


@mcp.tool()
def garmin_status() -> dict:
    """Check whether the Garmin connection is working, and who it belongs to."""
    try:
        g = client()
    except NotLoggedIn as err:
        return {"connected": False, "reason": str(err)}
    return {
        "connected": True,
        "account": _safe(g.get_full_name) or "(unknown)",
        "tokenstore": TOKENSTORE,
        "access": "read-only",
    }


@mcp.tool()
def garmin_sleep(days: int = 7) -> dict:
    """Sleep for the last N days: hours, stages, and sleep score.

    Use this to see whether a hard training week was actually recovered from.
    """
    try:
        g = client()
    except NotLoggedIn as err:
        return {"error": str(err)}

    out = []
    for day in _days_back(days):
        raw = _safe(g.get_sleep_data, day)
        dto = (raw or {}).get("dailySleepDTO") or {}
        seconds = dto.get("sleepTimeSeconds")
        if not seconds:
            out.append({"date": day, "slept": None})
            continue
        scores = dto.get("sleepScores") or {}
        overall = scores.get("overall") or {}
        out.append({
            "date": day,
            "hours": _round(seconds / 3600, 2),
            "deep_min": _round((dto.get("deepSleepSeconds") or 0) / 60, 0),
            "rem_min": _round((dto.get("remSleepSeconds") or 0) / 60, 0),
            "light_min": _round((dto.get("lightSleepSeconds") or 0) / 60, 0),
            "awake_min": _round((dto.get("awakeSleepSeconds") or 0) / 60, 0),
            "score": overall.get("value"),
            "quality": overall.get("qualifierKey"),
        })

    nights = [d["hours"] for d in out if d.get("hours")]
    return {
        "days": out,
        "nights_recorded": len(nights),
        "avg_hours": _round(sum(nights) / len(nights), 2) if nights else None,
    }


@mcp.tool()
def garmin_hrv(days: int = 7) -> dict:
    """Overnight HRV for the last N days, with Garmin's balanced/low status.

    HRV trending down across a week alongside rising training load is the
    clearest early sign of under-recovery.
    """
    try:
        g = client()
    except NotLoggedIn as err:
        return {"error": str(err)}

    out = []
    for day in _days_back(days):
        raw = _safe(g.get_hrv_data, day)
        summary = (raw or {}).get("hrvSummary") or {}
        out.append({
            "date": day,
            "avg_ms": summary.get("lastNightAvg"),
            "high_ms": summary.get("lastNight5MinHigh"),
            "status": summary.get("status"),
            "baseline_low": (summary.get("baseline") or {}).get("lowUpper"),
            "baseline_high": (summary.get("baseline") or {}).get("balancedUpper"),
        })

    values = [d["avg_ms"] for d in out if d.get("avg_ms")]
    return {
        "days": out,
        "avg_ms": _round(sum(values) / len(values), 1) if values else None,
        "note": "HRV needs ~3 weeks of nightly wear before Garmin reports a baseline.",
    }


@mcp.tool()
def garmin_activities(days: int = 14, activity_type: str | None = None) -> dict:
    """Recorded activities in the last N days — distance, pace, heart rate.

    activity_type filters to e.g. "running", "cycling", "strength_training".
    """
    try:
        g = client()
    except NotLoggedIn as err:
        return {"error": str(err)}

    end = date.today()
    start = end - timedelta(days=days)
    raw = _safe(g.get_activities_by_date, start.isoformat(), end.isoformat(), activity_type) or []

    out = []
    for a in raw:
        distance_m = a.get("distance") or 0
        duration_s = a.get("duration") or 0
        pace = None
        if distance_m > 100 and duration_s:
            sec_per_km = duration_s / (distance_m / 1000)
            pace = f"{int(sec_per_km // 60)}:{int(sec_per_km % 60):02d}/km"
        out.append({
            "date": (a.get("startTimeLocal") or "")[:10],
            "name": a.get("activityName"),
            "type": ((a.get("activityType") or {}).get("typeKey")),
            "km": _round(distance_m / 1000, 2) if distance_m else None,
            "minutes": _round(duration_s / 60, 1) if duration_s else None,
            "pace": pace,
            "avg_hr": a.get("averageHR"),
            "max_hr": a.get("maxHR"),
            "calories": a.get("calories"),
            "elevation_m": _round(a.get("elevationGain"), 0),
        })

    runs = [a for a in out if a["type"] and "running" in a["type"]]
    return {
        "activities": out,
        "count": len(out),
        "running_km": _round(sum(r["km"] or 0 for r in runs), 2),
    }


@mcp.tool()
def garmin_readiness(days: int = 7) -> dict:
    """Training readiness, resting heart rate and Body Battery for the last N days."""
    try:
        g = client()
    except NotLoggedIn as err:
        return {"error": str(err)}

    out = []
    for day in _days_back(days):
        readiness = _safe(g.get_training_readiness, day) or []
        first = readiness[0] if isinstance(readiness, list) and readiness else {}
        rhr = _safe(g.get_rhr_day, day) or {}
        rhr_value = None
        metrics = (rhr.get("allMetrics") or {}).get("metricsMap") or {}
        series = metrics.get("WELLNESS_RESTING_HEART_RATE") or []
        if series:
            rhr_value = series[0].get("value")

        out.append({
            "date": day,
            "readiness": first.get("score"),
            "readiness_label": first.get("level"),
            "resting_hr": rhr_value,
            "sleep_score": first.get("sleepScore"),
            "recovery_hours": first.get("recoveryTime"),
        })

    return {"days": out}


@mcp.tool()
def garmin_week_summary(days: int = 7) -> dict:
    """One combined recovery + training picture for the last N days.

    This is the tool to call when writing the weekly review: it folds sleep,
    HRV, resting HR and running volume into a single payload so the review
    does not have to stitch four separate calls together.
    """
    try:
        client()
    except NotLoggedIn as err:
        return {"error": str(err)}

    sleep = garmin_sleep(days)
    hrv = garmin_hrv(days)
    readiness = garmin_readiness(days)
    activities = garmin_activities(days)

    rhr = [d["resting_hr"] for d in readiness.get("days", []) if d.get("resting_hr")]
    scores = [d["readiness"] for d in readiness.get("days", []) if d.get("readiness")]

    return {
        "window_days": days,
        "sleep_avg_hours": sleep.get("avg_hours"),
        "nights_recorded": sleep.get("nights_recorded"),
        "hrv_avg_ms": hrv.get("avg_ms"),
        "hrv_status_latest": next(
            (d["status"] for d in hrv.get("days", []) if d.get("status")), None
        ),
        "resting_hr_avg": _round(sum(rhr) / len(rhr), 1) if rhr else None,
        "readiness_avg": _round(sum(scores) / len(scores), 0) if scores else None,
        "running_km": activities.get("running_km"),
        "sessions": activities.get("count"),
        "detail": {
            "sleep": sleep.get("days"),
            "hrv": hrv.get("days"),
            "readiness": readiness.get("days"),
            "activities": activities.get("activities"),
        },
    }


if __name__ == "__main__":
    mcp.run()
