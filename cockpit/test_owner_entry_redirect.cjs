// Q-20260926-018: Verify that the owner entrypoint never silently opens the stale public archive.
// No network, private credentials, source mutation or external services required.
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(match,'entrypoint redirect script must be present');
const cases=[
  ['default owner cockpit','','','./app.html'],
  ['owner query + pairing migration','?device=123','#migrate=test','./app.html?device=123#migrate=test'],
  ['explicit historical archive','?view=status','','./status.html'],
  ['archive deep link','?view=status','#q018','./status.html#q018'],
  ['hash deep link','','#pair=example','./app.html#pair=example'],
];
for(const [name,search,hash,expected] of cases){
  let next=null;
  vm.runInNewContext(match[1],{
    URLSearchParams,
    location:{search,hash,replace(target){next=target;}}
  },{timeout:500});
  assert.equal(next,expected,name);
  console.log('PASS '+name);
}
console.log('5/5 OWNER ENTRY REGRESSIONS PASS; deployment and paired-device acceptance separately required');
