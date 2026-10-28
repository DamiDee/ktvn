import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import * as directory from '../src/features/admin/accounts/account-directory.ts';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const key of ['window','document','Node','HTMLElement','Event','MouseEvent']) globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const h=React.createElement;
function load(path, dependencies={}) {
  const file=new URL(`../src/${path}`,import.meta.url), module=new Module(file.pathname), baseRequire=Module.createRequire(file);
  module.require=(name)=>name in dependencies?dependencies[name]:baseRequire(name);
  module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file.pathname);
  return module.exports;
}
const Link=({href,children,...props})=>h('a',{href,...props},children);
function Button({children,loading,loadingLabel,variant,size,icon,block,...props}) {return h('button',{type:'button',...props,disabled:props.disabled||loading},loading?loadingLabel:children);}
const Select=({label,options,...props})=>h('label',null,label,h('select',props,options.map((o)=>h('option',{key:o.value,value:o.value,disabled:o.disabled},o.label))));
const Input=({label,...props})=>h('label',null,label,h('input',props));
const ui={
 '@/components/ui/button':{Button}, '@/components/ui/input':{Select,Input},
 '@/components/ui/badge':{StatusChip:({children})=>h('span',null,children)},
 '@/components/ui/states':{EmptyState:({title})=>h('p',null,title),ErrorState:({title})=>h('p',null,title)},
 '@/components/ui/modal':{Modal:({open,title,children})=>open?h('section',{role:'dialog'},h('h2',null,title),children):null,ConfirmDialog:({open,title,onConfirm,confirmLabel,loading})=>open?h('section',{role:'dialog'},h('h2',null,title),h(Button,{onClick:onConfirm,disabled:loading},confirmLabel)):null},
};
const users=[
 {id:'self',first_name:'Sam',last_name:'Admin',email:'sam@example.test',username:'sam',phone:'08012345678',address:'Jabi',city:'Jabi',country:'Nigeria',role:'Admin',is_active:true,is_identity_verified:true,created_at:'2026-10-28T08:00:00Z'},
 {id:'driver',first_name:'Ada',last_name:'Driver',email:'ada@example.test',username:'ada',phone:'08023456789',address:'Lake Road',city:'Jabi',country:'Nigeria',role:'Driver',is_active:true,is_identity_verified:true,created_at:'2026-10-28T08:00:00Z'},
 {id:'root',first_name:'Rita',last_name:'Root',email:'rita@example.test',role:'Root',is_active:true,is_identity_verified:true,created_at:'2026-10-25T08:00:00Z'},
];
let cleanup=async()=>{};
afterEach(async()=>{await cleanup();document.body.replaceChildren();});
async function mount(element){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(element));cleanup=async()=>{await act(async()=>root.unmount());host.remove();};return host;}
async function click(button){assert.ok(button);await act(async()=>button.click());}
const findButton=(host,text)=>[...host.querySelectorAll('button')].find((b)=>b.textContent===text);

test('registration choice leads to the passenger form and the separate driver application', async()=>{
 const {RegistrationChoice}=load('features/auth/registration-choice.tsx',{'next/link':{default:Link}});
 const html=renderToStaticMarkup(h(RegistrationChoice));
 assert.match(html,/href="\/signup\?role=passenger"/);assert.match(html,/href="\/driver\/apply"/);
 const Page=load('app/(auth)/signup/page.tsx',{
  '@/components/layout/auth-shell':{AuthShell:({children})=>h('div',null,children)},
  '@/features/auth/signup-form':{SignUpForm:()=>h('p',null,'Passenger form')},
  '@/features/auth/registration-choice':{RegistrationChoice},
  'next/navigation':{redirect:(url)=>{throw new Error(`redirect:${url}`);}},
 }).default;
 assert.match(renderToStaticMarkup(await Page({searchParams:Promise.resolve({})})),/How would you like to join/);
 assert.match(renderToStaticMarkup(await Page({searchParams:Promise.resolve({role:'passenger'})})),/Passenger form/);
 assert.match(renderToStaticMarkup(await Page({searchParams:Promise.resolve({role:'root'})})),/How would you like to join/);
 await assert.rejects(Page({searchParams:Promise.resolve({role:'driver'})}),/redirect:\/driver\/apply/);
});

function managementFixture(role='Admin'){
 const requests=[];let invalidations=0;
 const {AdminUsers}=load('features/free-buses/admin-users.tsx',{
  ...ui,
  '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{invalidations++;}})},
  '@/components/layout/app-shell':{PageHeader:({title})=>h('h1',null,title)},
  '@/components/ui/route-loader':{PageLoader:()=>null},
  '@/services/freebus-api':{freebusRequest:async(path,options)=>{requests.push({path,...options});}},
  '@/lib/freebus-contract':{isOversight:(value)=>value==='Admin'||value==='Root'},
  './live-queries':{useLiveQuery:()=>({data:users})},
  './live-shell':{useLiveUser:()=>({...users[0],role})},
  '@/components/ui/city-picker':{CityPicker:()=>null}, './passenger-strikes':{PassengerStrikes:()=>null},
  '@/features/admin/accounts/accounts-table':{AccountsTable:({users,onManage,onCreate})=>h('div',null,users.map((u)=>h('button',{key:u.id,onClick:()=>onManage(u)},`Manage ${u.id}`)),h('button',{onClick:onCreate},'Create account'))},
  '@/features/admin/accounts/account-details':{AccountDetails:({user})=>h('p',null,user.email)},
 });
 return {AdminUsers,requests,invalidations:()=>invalidations};
}
test('Paid Rides preserves self-account and Admin/Root management safeguards',async()=>{
 const f=managementFixture();const host=await mount(h(f.AdminUsers,{workspace:'paid-rides'}));
 await click(findButton(host,'Manage self'));
 assert.equal(host.querySelector('select').disabled,true);assert.equal(findButton(host,'Deactivate').disabled,true);assert.equal(findButton(host,'Delete').disabled,true);
 await cleanup();
 const next=await mount(h(f.AdminUsers,{workspace:'paid-rides'}));await click(findButton(next,'Manage root'));
 assert.equal(next.querySelector('select').disabled,true);assert.equal(findButton(next,'Deactivate').disabled,true);
 assert.equal(f.requests.length,0);
});
test('account actions require confirmation and use the existing platform endpoint',async()=>{
 const f=managementFixture();const host=await mount(h(f.AdminUsers,{workspace:'paid-rides'}));
 await click(findButton(host,'Manage driver'));assert.equal(findButton(host,'Deactivate').disabled,false);
 const selector=host.querySelector('select');assert.equal(selector.querySelector('option[value=Root]').disabled,true);
 await click(findButton(host,'Deactivate'));assert.equal(f.requests.length,0);
 assert.match(host.textContent,/Deactivate Ada Driver/);
 await click(findButton(host,'Deactivate'));
 assert.equal(f.requests[0].path,'users/driver/deactivate');assert.equal(f.requests[0].method,'PATCH');assert.equal(f.invalidations(),2);
});
test('Root can manage another oversight account but cannot modify their own account',async()=>{
 const f=managementFixture('Root');const host=await mount(h(f.AdminUsers,{workspace:'paid-rides'}));
 await click(findButton(host,'Manage root'));assert.equal(host.querySelector('select').disabled,false);assert.equal(findButton(host,'Deactivate').disabled,false);
 assert.equal(host.querySelector('option[value=Root]').disabled,false);
 await cleanup();
 const own=await mount(h(f.AdminUsers,{workspace:'paid-rides'}));await click(findButton(own,'Manage self'));assert.equal(own.querySelector('select').disabled,true);assert.equal(findButton(own,'Deactivate').disabled,true);
});

test('table controls filter records and clear back to the full directory',async()=>{
 const {AccountsTable}=load('features/admin/accounts/accounts-table.tsx',{
  ...ui,'./account-directory':directory,
  '@/lib/account-display':{displayPhone:(v)=>v??'—'},
  '@/components/ui/records-table':{RecordsTable:({rows,columns,action})=>h('div',null,action,h('table',null,h('tbody',null,rows.map((row)=>h('tr',{key:row.id},columns.map((col)=>h('td',{key:col.id},col.cell(row))))))))},
 });
 const host=await mount(h(AccountsTable,{users,paid:true,currentUserId:'self',onCreate(){},onManage(){}}));
 assert.equal(host.querySelectorAll('tbody tr').length,3);
 const role=[...host.querySelectorAll('label')].find((label)=>label.textContent.startsWith('Role')).querySelector('select');
 await act(async()=>{role.value='Driver';role.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(host.querySelectorAll('tbody tr').length,1);assert.match(host.querySelector('tbody').textContent,/Ada Driver/);
 await click(findButton(host,'Clear filters'));assert.equal(host.querySelectorAll('tbody tr').length,3);
});
