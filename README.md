# FreeTierWatch

**Structured, machine-readable free-tier limits for 32 dev & AI services — with daily automated change monitoring.**

Free-tier limits change quietly: Fly.io killed its free tier, PlanetScale killed theirs, Render trimmed hours. Lists like free-for.dev are prose, community-updated, and record quota changes weeks late (≈4 quota-update commits in 14 months). FreeTierWatch is the opposite: one structured JSON, an automated daily diff of every provider's official pricing/limits page, and a change feed.

## Use it

| What | Where |
|------|-------|
| Structured dataset | [`data/freetiers.json`](data/freetiers.json) |
| Raw JSON (for scripts/apps) | `https://raw.githubusercontent.com/guillemmontejo/freetierwatch/main/data/freetiers.json` |
| Change log | [`data/changes.json`](data/changes.json) |
| RSS alerts | [`feed.xml`](https://guillemmontejo.github.io/freetierwatch/data/feed.xml) (subscribe in any RSS reader) |
| Website | https://guillemmontejo.github.io/freetierwatch/ |

```js
// consume at runtime, no key needed
const tiers = await fetch('https://raw.githubusercontent.com/guillemmontejo/freetierwatch/main/data/freetiers.json').then(r => r.json())
```

Dated change history = this repo's git log on `data/freetiers.json` — every quota edit is a commit with a date and source.

## How it works

A GitHub Actions cron (`.github/workflows/watch.yml`, daily 06:17 UTC) runs `scripts/watch.js`:

1. Fetches each service's official pricing/limits page (`source_url` in the dataset).
2. Converts to text, diffs against the last snapshot (`snapshots/`).
3. Records digit-bearing changed lines to `data/changes.json` + regenerates the RSS feed.
4. Commits. Flagged changes are then reviewed and folded into `freetiers.json` with the source quoted.

Zero dependencies, zero infra cost. `node scripts/selftest.js` checks the diff logic.

## Data schema

```json
{
  "id": "cloudflare-workers",
  "name": "Cloudflare Workers",
  "category": "compute",
  "free_tier": [
    {"metric": "requests", "limit": 100000, "unit": "requests/day"}
  ],
  "source_url": "https://developers.cloudflare.com/workers/platform/pricing/",
  "js_rendered": false,
  "verified": "2026-09-08"
}
```

`limit: -1` = unlimited. `"no_free_tier": true` = service has no free tier (that's data too).

## Want email/Slack alerts?

👍 the pinned issue — enough interest and we build it.

## License

Data: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — use it, credit FreeTierWatch. Code: MIT.
