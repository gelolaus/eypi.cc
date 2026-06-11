# Subdomain redirects

After the suite merge, `tix.eypi.cc` and `forms.eypi.cc` no longer host apps.
This tiny Worker 301-redirects them into the unified `eypi.cc` suite so existing
links keep working.

| From | To |
|------|----|
| `forms.eypi.cc/*` | `https://eypi.cc/forms` |
| `tix.eypi.cc/<slug>` (shared public ticket link) | `https://eypi.cc/event/<slug>` |
| `tix.eypi.cc/` and deeper management paths | `https://eypi.cc/events` |

## Deploy

```bash
cd redirects
npm i -D wrangler
npx wrangler deploy
```

The routes in `wrangler.jsonc` attach this Worker to both subdomains on the
`eypi.cc` zone. Once deployed, retire the old `tix.eypi.cc` / `forms.eypi.cc`
app deployments (or let these routes take precedence).
