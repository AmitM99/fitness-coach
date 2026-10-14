#!/usr/bin/env python3
"""One-time Garmin Connect login.

Run this yourself from a terminal. It asks for your Garmin email and password,
hands them straight to Garmin's own login endpoint, and keeps only the OAuth
tokens that come back. Your password is never written to disk and never leaves
this process.

    ./.venv/bin/python login.py

Re-run it only if the tokens stop working (roughly once a year, or after you
change your Garmin password).
"""

import getpass
import os
import re
import sys

from garminconnect import Garmin

TOKENSTORE = os.path.expanduser("~/.garminconnect")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def ask_email() -> str | None:
    """Prompt until the address is plausible, or the user gives up.

    Garmin rate-limits failed logins by client fingerprint, not just by IP, so a
    typo is expensive: it can lock you out for a while. Validating here means a
    bad address never costs an attempt. A Hebrew keyboard layout is the usual
    culprit, so that case gets its own message.
    """
    for _ in range(3):
        raw = input("Garmin email: ").strip()
        if not raw:
            return None
        if any("֐" <= ch <= "׿" for ch in raw):
            print("  That contains Hebrew letters — switch the keyboard to English and retype.\n")
            continue
        if not EMAIL_RE.match(raw):
            print(f"  '{raw}' does not look like an email address. Try again.\n")
            continue
        return raw
    print("Too many bad attempts — aborted.")
    return None


def main() -> int:
    print("Garmin Connect login")
    print("Tokens will be stored in", TOKENSTORE)
    print("Your password is not stored anywhere.\n")

    email = ask_email()
    if not email:
        print("No email given — aborted.")
        return 1

    password = getpass.getpass("Garmin password (not shown): ")
    if not password:
        print("No password given — aborted.")
        return 1

    # Garmin asks for a one-time code when MFA is on; this is prompted for
    # interactively and, like the password, is never persisted.
    client = Garmin(email=email, password=password, return_on_mfa=False)

    try:
        client.login()
    except Exception as err:  # the library raises several distinct error types
        text = str(err)
        print(f"\nLogin failed: {text}")
        if "429" in text or "403" in text or "Cloudflare" in text:
            print(
                "\nThis is Garmin's bot protection, not your password.\n"
                "It rate-limits by client fingerprint, so retrying straight away\n"
                "will hit the same wall. Wait 30-60 minutes and run this again."
            )
        else:
            print("If you use multi-factor auth, make sure you entered the code in time.")
        return 1

    client.garth.dump(TOKENSTORE)
    os.chmod(TOKENSTORE, 0o700)

    try:
        name = client.get_full_name()
    except Exception:
        name = "(name unavailable)"

    print(f"\nLogged in as {name}.")
    print(f"Tokens saved to {TOKENSTORE} — you can close this window.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
