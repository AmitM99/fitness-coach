# Garmin MCP — local, read-only

> **Not in use as of 5 Oct 2026.** Garmin's Cloudflare bot protection blocked
> every login strategy here (429 by client fingerprint, then a 403 challenge —
> see cyberjunky/python-garminconnect#444). We switched to the hosted connector
> at `https://missingmcp.com/garmin/mcp` instead, and unregistered this server
> so its tool names would not collide with the hosted one's.
>
> Everything below still works if Garmin's blocking eases. To bring it back:
>
> ```bash
> claude mcp add garmin -s user -- \
>   ~/Claude/FitnessCoach/tools/garmin-mcp/.venv/bin/python \
>   ~/Claude/FitnessCoach/tools/garmin-mcp/server.py
> ```
>
> To delete it for good: `rm -rf ~/Claude/FitnessCoach/tools/garmin-mcp`

Lets Claude read your Garmin Connect data (sleep, HRV, resting heart rate,
training readiness, activities) directly, so the weekly review can see recovery
and not just the sets you logged.

Everything runs on this Mac. No server, no third-party service, no account
anywhere. Your data goes Garmin → this Mac → the review you asked for.

## Why this and not a hosted connector

A hosted Garmin gateway needs your Garmin **password** stored on someone else's
machine, because Garmin has no OAuth for individuals. Revoking it means changing
your password. This runs locally instead: you log in once, and only the
resulting OAuth tokens are kept, in `~/.garminconnect` with mode 0600.

## Setup — once

```bash
cd ~/Claude/FitnessCoach/tools/garmin-mcp
./.venv/bin/python login.py
```

It asks for your Garmin email and password. The password is handed straight to
Garmin's login endpoint and never written to disk. If you have MFA on, it will
prompt for the code.

Then restart Claude Code so it picks the server up.

Re-run `login.py` only if the tools start reporting that the tokens failed —
roughly once a year, or whenever you change your Garmin password.

## Revoking

```bash
rm -rf ~/.garminconnect
```

That is the whole revocation story. Nothing else holds a credential.

## Tools

| Tool | What it returns |
| --- | --- |
| `garmin_status` | Whether the connection works, and whose account it is |
| `garmin_sleep(days)` | Hours, stages, sleep score per night |
| `garmin_hrv(days)` | Overnight HRV, with Garmin's balanced/low status |
| `garmin_activities(days, type)` | Distance, pace, avg/max HR, elevation |
| `garmin_readiness(days)` | Training readiness, resting HR, recovery hours |
| `garmin_week_summary(days)` | All of the above folded into one payload |

Every tool is a GET. There is no code here that writes to Garmin, uploads a
workout, or deletes anything.

## Known limits

- HRV needs about three weeks of nightly wear before Garmin reports a baseline,
  so expect `null` until then.
- A day the watch was off the wrist comes back `null` rather than zero. That is
  deliberate — a missing night is not a bad night.
- `garminconnect` talks to Garmin's mobile app endpoints, which are not a
  published API. They can change without notice. If a tool starts failing,
  `./.venv/bin/pip install -U garminconnect` is the first thing to try.
- This does not replace the CSV import in the app. The app's own cardio data
  stays in IndexedDB on your phone; this server is how Claude reads recovery
  context when writing a review.
