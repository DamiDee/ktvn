import test from "node:test";
import assert from "node:assert/strict";
import { createAbujaCityLoader, normalizeCityNames } from "../src/lib/abuja-cities.ts";
const place = (name, extra = {}) => ({ name, countryCode: "NG", adminCode1: "11", fcl: "P", ...extra });
const result = (geonames, totalResultsCount = geonames.length) => Response.json({ geonames, totalResultsCount });

test("no provider username means an honest local list and zero upstream requests", async () => {
  const load = createAbujaCityLoader("", async () => { throw new Error("Must not call upstream"); });
  const data = await load();
  assert.equal(data.source, "local"); assert.equal(data.providerComplete, false);
  for (const name of ["Lugbe", "Kubwa", "Wuse", "Gwagwalada"]) assert.ok(data.cities.includes(name));
});
test("FCT lookup pages, filters other territories, deduplicates and coalesces callers", async () => {
  const calls = [];
  const load = createAbujaCityLoader("fixture-account", async (url) => {
    calls.push(url);
    assert.equal(url.hostname, "secure.geonames.org");
    assert.equal(url.searchParams.get("country"), "NG");
    assert.equal(url.searchParams.get("adminCode1"), "11");
    assert.equal(url.searchParams.get("featureClass"), "P");
    return url.searchParams.get("startRow") === "0"
      ? result([place("Test FCT Town"), place("Outside FCT", { adminCode1: "other" })], 4)
      : result([place(" lugbe "), place("Outside Nigeria", { countryCode: "XX" })], 4);
  });
  const [a, b] = await Promise.all([load(), load()]);
  assert.deepEqual(a, b); assert.equal(calls.length, 2); assert.equal(a.providerComplete, true);
  assert.ok(a.cities.includes("Test FCT Town")); assert.ok(!a.cities.includes("Outside FCT")); assert.ok(!a.cities.includes("Outside Nigeria"));
  assert.equal(a.cities.filter(n => n.toLowerCase() === "lugbe").length, 1);
  await load(); assert.equal(calls.length, 2);
});
test("rate limits, broken JSON, empty and malformed responses keep registration usable", async () => {
  for (const response of [new Response("limited", { status: 429 }), new Response("not json"), Response.json({ status: { value: 19 } }), result([]), Response.json({ geonames: null })]) {
    const load = createAbujaCityLoader("fixture-account", async () => response);
    const data = await load(); assert.equal(data.source, "local"); assert.ok(data.cities.length > 0);
  }
});
test("provider outage keeps a previously loaded catalogue and marks coverage incomplete", async () => {
  let time = 0, fail = false;
  const load = createAbujaCityLoader("fixture-account", async () => { if (fail) throw new Error("offline"); return result([place("Saved Town")]); }, () => time);
  await load(); fail = true; time = 86_400_001;
  const data = await load(); assert.ok(data.cities.includes("Saved Town")); assert.equal(data.providerComplete, false);
});
test("pagination has a hard request bound even when a provider repeats a tiny page", async () => {
  let calls = 0;
  const load = createAbujaCityLoader("fixture-account", async () => { calls++; return result([place("Repeated")], 50_000); });
  const data = await load(); assert.equal(calls, 6); assert.equal(data.providerComplete, false);
});
test("location strings are trimmed, bounded and safe to render as plain text", () => {
  assert.deepEqual(normalizeCityNames([" Wuse ", "wuse", "", "<script>", null, 9, "A".repeat(101), "Kubwa"]), ["Kubwa", "Wuse"]);
});
