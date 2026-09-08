#!/usr/bin/env node
// Smallest check that fails if the diff/strip logic breaks. Run: node scripts/selftest.js
const assert = require("node:assert");
const { htmlToLines, quotaDiff } = require("./watch.js");

const lines = htmlToLines("<html><script>var x=1;</script><p>100,000 requests/day</p><style>.a{}</style><div> Free &amp; open </div></html>");
assert.deepStrictEqual(lines, ["100,000 requests/day", "Free & open"]);

const d1 = quotaDiff(["100,000 requests/day", "About us"], ["50,000 requests/day", "About us team"]);
assert.deepStrictEqual(d1.added, ["50,000 requests/day"]);
assert.deepStrictEqual(d1.removed, ["100,000 requests/day"]);

const d2 = quotaDiff(["Same line 1"], ["Same line 1"]);
assert.deepStrictEqual(d2, { added: [], removed: [] });

console.log("selftest OK");
