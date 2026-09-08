# free-tier-data

Structured dataset of **32 cloud/SaaS free tiers** — limits, units, and official source URLs. Maintained by [FreeTierWatch](https://guillemmontejo.github.io/freetierwatch/), which checks the official pricing pages daily and tracks changes.

## Usage

```js
const data = require('free-tier-data');

const workers = data.services.find(s => s.id === 'cloudflare-workers');
console.log(workers.free_tier);
// [{ metric: 'requests', limit: 100000, unit: 'requests/day' }, ...]
```

Each service entry:

```json
{
  "id": "cloudflare-workers",
  "name": "Cloudflare Workers",
  "category": "compute",
  "free_tier": [{ "metric": "requests", "limit": 100000, "unit": "requests/day" }],
  "source_url": "https://..."
}
```

## Honesty rules

- Only limits visible on the official pricing/docs page are included.
- Trials and credit-based offers are excluded — permanent free tiers only.
- Every entry links its `source_url`.

## Freshness

The dataset is rebuilt from daily snapshots of official pricing pages. New versions are published when the data substantively changes. Live view, change log, and RSS feed: [FreeTierWatch](https://guillemmontejo.github.io/freetierwatch/) · [GitHub](https://github.com/guillemmontejo/freetierwatch).

## License

Data: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · Code: MIT
