import test from "node:test";
import assert from "node:assert/strict";
import { createOsrmClient, RoutingConfigurationError } from "../src/lib/osrm-client.ts";
const coords = "7.4246,9.0721;7.4728,9.0647";
const env = { NODE_ENV: "production", ROUTING_API_BASE_URL: "https://primary.test/routing", ROUTING_FALLBACK_API_BASE_URL: "https://backup.test/routing" };
const good = () => Response.json({ code: "Ok", routes: [{ geometry: { type: "LineString", coordinates: [[7.4246,9.0721],[7.45,9.07],[7.4728,9.0647]] }, distance: 7601.3, duration: 516.2 }] });

test("healthy primary returns validated road geometry without contacting backup", async () => {
  const calls=[];
  const client=createOsrmClient(async (url,init)=>{calls.push(url);assert.ok(init.signal);assert.equal(init.next.revalidate,600);return good();});
  const route=await client(coords,env);
  assert.equal(calls.length,1);assert.ok(calls[0].startsWith(env.ROUTING_API_BASE_URL));
  assert.equal(route.points.length,3);assert.equal(route.distanceMeters,7601);
});
for (const [label, fail] of [
  ["network failure",()=>{throw new TypeError("fetch failed");}],
  ["timeout",()=>{throw new DOMException("timeout","TimeoutError");}],
  ["upstream 503",()=>new Response("unavailable",{status:503})],
  ["upstream rate limit",()=>new Response("busy",{status:429})],
  ["malformed geometry",()=>Response.json({code:"Ok",routes:[{}]})],
]) test(`${label} uses the configured backup and returns its real road route`,async()=>{
  const calls=[];const client=createOsrmClient(async url=>{calls.push(url);return url.startsWith(env.ROUTING_API_BASE_URL)?fail():good();});
  assert.equal((await client(coords,env)).durationSeconds,516);
  assert.equal(calls.length,2);assert.ok(calls[1].startsWith(env.ROUTING_FALLBACK_API_BASE_URL));
});

test("unhealthy primary is skipped for 30 seconds, then retried and recovered",async()=>{
  let now=1000,healthy=false;const calls=[];
  const client=createOsrmClient(async url=>{calls.push(url);if(url.startsWith(env.ROUTING_API_BASE_URL)&&!healthy)throw Error();return good();},()=>now);
  await client(coords,env);assert.equal(calls.length,2);
  await client(coords,env);assert.equal(calls.length,3);assert.ok(calls[2].startsWith(env.ROUTING_FALLBACK_API_BASE_URL));
  now+=30001;healthy=true;
  await client(coords,env);assert.equal(calls.length,4);assert.ok(calls[3].startsWith(env.ROUTING_API_BASE_URL));
});

for(const response of [()=>Response.json({code:"NoRoute",routes:[]}),()=>Response.json({code:"NoSegment"},{status:400}),()=>new Response("bad request",{status:422})]){
  test("coverage and client errors do not contact backup or poison primary health",async()=>{
    const calls=[];let first=true;
    const client=createOsrmClient(async url=>{calls.push(url);if(first){first=false;return response();}return good();});
    await assert.rejects(client(coords,env));
    assert.equal(calls.length,1);
    await client(coords,env);assert.ok(calls[1].startsWith(env.ROUTING_API_BASE_URL));
  });
}
test("production public demo URLs and missing primary fail closed before network calls",async()=>{
  let calls=0;const client=createOsrmClient(async()=>{calls++;return good();});
  for(const config of [{NODE_ENV:"production"},{...env,ROUTING_API_BASE_URL:"not a URL"},{...env,ROUTING_API_BASE_URL:"https://router.project-osrm.org."},{...env,ROUTING_API_BASE_URL:"https://router.project-osrm.org"},{...env,ROUTING_FALLBACK_API_BASE_URL:"https://routing.openstreetmap.de/routed-car"},{...env,ROUTING_FALLBACK_API_BASE_URL:"https://user:password@backup.test"}])await assert.rejects(client(coords,config),RoutingConfigurationError);
  assert.equal(calls,0);
});
test("exhausted services fail without inventing geometry, repeated calls respect cooldown",async()=>{
  let calls=0;const client=createOsrmClient(async()=>{calls++;throw Error();});
  await assert.rejects(client(coords,env),/unavailable/);assert.equal(calls,2);
  await assert.rejects(client(coords,env),/unavailable/);assert.equal(calls,2);
});
test("same configured primary and backup are attempted only once",async()=>{
  let calls=0;const client=createOsrmClient(async()=>{calls++;throw Error();});
  await assert.rejects(client(coords,{...env,ROUTING_FALLBACK_API_BASE_URL:env.ROUTING_API_BASE_URL}));assert.equal(calls,1);
});
