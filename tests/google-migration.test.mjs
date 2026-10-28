import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import { createGoogleRequestGuard } from '../src/lib/google-request-guard.ts';
import { parseGoogleRoadRoute, fetchGoogleRoadRoute, GoogleRoutingConfigurationError } from '../src/lib/google-routes.ts';
const example = () => ({routes:[{distanceMeters:3441,duration:'540.25s',polyline:{geoJsonLinestring:{type:'LineString',coordinates:[[7.4243,9.0767],[7.4447,9.0663]]}}}]});
function moduleAt(path,dependencies={}) { const url=new URL(`../${path}`,import.meta.url), m=new Module(url.pathname), base=Module.createRequire(url);m.require=(id)=>id in dependencies?dependencies[id]:base(id);m._compile(ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,url.pathname);return m.exports; }
test('Google route metrics preserve units and GeoJSON longitude/latitude order',()=>{assert.deepEqual(parseGoogleRoadRoute(example()),{distanceMeters:3441,durationSeconds:540,points:[{lng:7.4243,lat:9.0767},{lng:7.4447,lat:9.0663}]});});
test('missing, malformed, and unroutable Google responses never become zero-distance fares',()=>{
 for(const data of [null,{}, {routes:[]},{routes:[{}]}])assert.throws(()=>parseGoogleRoadRoute(data));
 for(const bad of [NaN,-1,'3441']){const data=example();data.routes[0].distanceMeters=bad;assert.throws(()=>parseGoogleRoadRoute(data));}
 for(const duration of ['540','-2s','NaNs']){const data=example();data.routes[0].duration=duration;assert.throws(()=>parseGoogleRoadRoute(data));}
 const bad=example();bad.routes[0].polyline.geoJsonLinestring.coordinates[0]=[190,9];assert.throws(()=>parseGoogleRoadRoute(bad));
});
test('server routing uses the private key in headers and requests real road geometry',async()=>{
 let captured;const route=await fetchGoogleRoadRoute([{lat:9,lng:7},{lat:9.1,lng:7.1},{lat:9.2,lng:7.2}],{GOOGLE_MAPS_SERVER_API_KEY:'server-test',GOOGLE_MAPS_BROWSER_API_KEY:'browser-test'},async(url,options)=>{captured={url,options};return Response.json(example());});
 assert.equal(route.distanceMeters,3441);assert.equal(captured.options.headers['X-Goog-Api-Key'],'server-test');assert.ok(!captured.url.includes('server-test'));const body=JSON.parse(captured.options.body);assert.equal(body.polylineEncoding,'GEO_JSON_LINESTRING');assert.equal(body.intermediates.length,1);assert.equal(body.routingPreference,'TRAFFIC_UNAWARE');
});
test('routing configuration and upstream failures are explicit',async()=>{
 await assert.rejects(fetchGoogleRoadRoute([{lat:9,lng:7},{lat:10,lng:8}],{}),GoogleRoutingConfigurationError);
 await assert.rejects(fetchGoogleRoadRoute([{lat:9,lng:7},{lat:10,lng:8}],{GOOGLE_MAPS_SERVER_API_KEY:'test'},async()=>Response.json({}, {status:403})),/unavailable/);
});
test('public runtime configuration never exposes the server key',async()=>{
 const oldBrowser=process.env.GOOGLE_MAPS_BROWSER_API_KEY, oldServer=process.env.GOOGLE_MAPS_SERVER_API_KEY, oldPublic=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
 try {process.env.GOOGLE_MAPS_BROWSER_API_KEY='browser-test';process.env.GOOGLE_MAPS_SERVER_API_KEY='server-private';const {GET}=moduleAt('src/app/api/maps/config/route.ts');const response=GET();assert.deepEqual(await response.json(),{provider:'google',configured:true,apiKey:'browser-test'});assert.equal(response.headers.get('Cache-Control'),'no-store');delete process.env.GOOGLE_MAPS_BROWSER_API_KEY;delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;assert.equal(GET().status,503);}
 finally {for(const [name,value] of [['GOOGLE_MAPS_BROWSER_API_KEY',oldBrowser],['GOOGLE_MAPS_SERVER_API_KEY',oldServer],['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',oldPublic]])if(value===undefined)delete process.env[name];else process.env[name]=value;}
});
test('the backend compatibility gateway returns Google distances in its existing route shape',async()=>{
 let called=0;const {GET}=moduleAt('src/app/api/routing/route/v1/driving/[coordinates]/route.ts',{'@/lib/google-request-guard':{guardGoogleRequest:()=>null},'@/lib/google-routes':{fetchGoogleRoadRoute:async()=>{called++;return parseGoogleRoadRoute(example());},GoogleRoutingConfigurationError},'@/lib/transport-locations':{validCoordinates:(p)=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180}});
 const response=await GET(new Request('http://localhost/api/routing/route/v1/driving/7.4243,9.0767;7.4447,9.0663?geometries=geojson'),{params:Promise.resolve({coordinates:'7.4243,9.0767;7.4447,9.0663'})});const data=await response.json();assert.equal(data.code,'Ok');assert.equal(data.provider,'google');assert.equal(data.routes[0].distance,3441);assert.equal(data.routes[0].duration,540);assert.deepEqual(data.routes[0].geometry.coordinates[0],[7.4243,9.0767]);
 const invalid=await GET(new Request('http://localhost/?geometries=geojson'),{params:Promise.resolve({coordinates:'invalid'})});assert.equal(invalid.status,400);assert.equal(called,1);
});

test('map loading uses the hosting runtime key even when the browser build has no key', async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;let options,fetches=0;
 try {globalThis.window={};globalThis.fetch=async(url)=>{assert.equal(url,'/api/maps/config');fetches++;return Response.json({provider:'google',configured:true,apiKey:'runtime-test'});};
 const {loadGoogleLibrary}=moduleAt('src/features/paid-rides/maps/google-maps-loader.ts',{'../config':{GOOGLE_MAPS_API_KEY:''},'@googlemaps/js-api-loader':{setOptions:(o)=>{options=o;},importLibrary:async(name)=>({name})}});
 await Promise.all([loadGoogleLibrary('maps'),loadGoogleLibrary('places')]);assert.equal(options.key,'runtime-test');assert.equal(fetches,1);
 } finally {globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
test('missing hosting configuration can be corrected and retried without an OpenStreetMap fallback', async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;let enabled=false;
 try {globalThis.window={};globalThis.fetch=async()=>enabled?Response.json({apiKey:'fixed-runtime'}):Response.json({configured:false},{status:503});
 const {loadGoogleLibrary}=moduleAt('src/features/paid-rides/maps/google-maps-loader.ts',{'../config':{GOOGLE_MAPS_API_KEY:''},'@googlemaps/js-api-loader':{setOptions(){},importLibrary:async()=>({loaded:true})}});
 await assert.rejects(loadGoogleLibrary('maps'),/hosting server/);enabled=true;assert.deepEqual(await loadGoogleLibrary('maps'),{loaded:true});
 } finally {globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});

test('billable proxy requests reject cross-site callers and respect a bounded request window',()=>{
 let now=0;const guard=createGoogleRequestGuard(()=>now,2);const request=()=>new Request('https://app.freebus.cloud/api/route-distance',{headers:{'x-real-ip':'test-ip'}});
 assert.equal(guard(new Request('https://app.freebus.cloud/api/route-distance',{headers:{origin:'https://other.example'}})).status,403);
 assert.equal(guard(new Request('http://localhost:4000/api/route-distance',{headers:{origin:'https://app.freebus.cloud',host:'app.freebus.cloud','x-forwarded-proto':'https','x-real-ip':'proxy-client'}})),null);
 assert.equal(guard(request()),null);assert.equal(guard(request()),null);assert.equal(guard(request()).status,429);now=60000;assert.equal(guard(request()),null);
});
