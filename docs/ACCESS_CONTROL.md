# Owner and Viewer access

BillsOS has two signed-in roles:

- **Owner** can view and change all BillsOS data.
- **Viewer** can view the dashboard and calendar and run Assistant queries. Viewer requests cannot save bills, completion status, calendar edits, or cross-device sync state.

## Railway variables

Set these secret variables on the BillsOS Railway service:

- `BILLS_OWNER_USERNAME` — Owner login name (defaults to `ryan` if omitted)
- `BILLS_OWNER_PASSWORD` — Owner password
- `BILLS_VIEWER_USERNAME` — Viewer login name (defaults to `viewer` if omitted)
- `BILLS_VIEWER_PASSWORD` — Viewer password
- `BILLS_SESSION_SECRET` — a long random value used only to sign session cookies

For a safe transition, existing `BILLS_USER`, `BILLS_PASS`, `BILLS_TEMP_USER`, `BILLS_TEMP_PASS`, and `SESSION_SECRET` values are accepted as legacy aliases for the matching variables above. Credentials are read only from the environment and must never be committed.

If either password or the session secret is absent, BillsOS shows a setup-required response and does not grant dashboard access. `/api/session` lists only the missing variable names; it never returns secret values.

The session cookie is HTTP-only, secure, same-site, signed, and expires after 30 days. Changing a role's password invalidates that role's existing sessions. `GET /api/session` reports the signed-in role, and `GET` or `POST /logout` clears the session.
