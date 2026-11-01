const $=s=>document.querySelector(s);function displayText(v){return String(v??'')}const esc=v=>displayText(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ask=$('#ask'),result=$('#result'),content=$('#content'),subject=$('#subject'),actions=$('#actions');let activeLane='overview';let current=null,currentLabel='',currentDossier=null,lastNumeric=null,lastNoMatchQuery='',candidateContext=null,navStack=[],busy=false,propertyEpoch=0,propertyWebTimer=null,propertyWebController=null,personWebEpoch=0,personWebTimer=null,personWebController=null,familyDepth=3,dossierEpoch=0,dossierPromise=null,dossierPromisePerson=null,personPreviewById=new Map();
const R2_STABLE_ENTRY='https://libanroots.github.io/reality-v2/';
async function api(path,params={}){
 const u=path+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
 let r;
 try{r=await fetch(u,{cache:'no-store',credentials:'same-origin'})}
 catch(e){const x=new Error('Connection interrupted. Open R2 from the stable entry address to reconnect.');x.reconnect=true;throw x}
 const raw=await r.text();
 let data;
 try{data=JSON.parse(raw)}catch(e){
  const tunnelError=r.status===530||r.status===502||/Cloudflare Tunnel error|Error 1033|unable to resolve it/i.test(raw);
  const x=new Error(tunnelError?'The mobile tunnel was interrupted. Reconnect through the stable R2 address.':'R2 temporarily returned an invalid response (HTTP '+r.status+').');
  x.reconnect=tunnelError||r.status>=500;throw x
 }
 if(!r.ok){const x=new Error(String(data.detail||data.error||('HTTP '+r.status)).slice(0,240));x.reconnect=r.status===530||r.status===502||r.status===503;throw x}
 return data
}
function setResult(t,s=''){result.innerHTML='<div class="title">'+esc(t)+'</div>'+(s?'<div class="muted">'+esc(s)+'</div>':'')}

function backControlHtml(){return navStack.length?'<div class="back-shell"><button class="action alt" data-nav-back="1" aria-label="Back to previous investigation state">← Back</button><span class="soft-note">Previous decision preserved</span></div>':''}
function stripBackControls(html){return String(html||'').replace(/<div class="back-shell">[\s\S]*?<\/div>/g,'')}
function setActions(extra=''){actions.innerHTML=(navStack.length?backControlHtml():'')+stripBackControls(extra)}
function snapshotView(label=''){return{label,subject:subject.innerHTML,result:result.innerHTML,actions:actions.innerHTML,content:content.innerHTML,current,currentLabel,currentDossier,lastNumeric,lastNoMatchQuery,candidateContext,familyDepth,scrollY:window.scrollY}}
function pushView(label=''){navStack.push(snapshotView(label));if(navStack.length>18)navStack.shift();persistState()}
function restorePrevious(){cancelDossierLoad();const s=navStack.pop();if(!s)return;cancelPropertyWeb();cancelPersonResearch();current=s.current;currentLabel=s.currentLabel;currentDossier=s.currentDossier;lastNumeric=s.lastNumeric;lastNoMatchQuery=s.lastNoMatchQuery;candidateContext=s.candidateContext;familyDepth=s.familyDepth;subject.innerHTML=s.subject;result.innerHTML=s.result;setActions(s.actions||'');content.innerHTML=s.content;setTimeout(()=>window.scrollTo(0,s.scrollY||0),0);persistState();void rehydrateRestoredCivilSnapshot()}

const STATE_KEY='samerai_reality_state_v7';try{sessionStorage.removeItem('samerai_reality_state_v6')}catch(e){}
function persistState(){
  // Save only bounded navigation hints. The full private dossier and large
  // rendered histories are retrieved from the owner gateway, not copied into
  // a multi-megabyte browser session blob every time the DOM changes.
  try{
    const lean=x=>({...x,currentDossier:null,candidateContext:null});
    const snap=lean(snapshotView('autosave'));
    let stack=navStack.slice(-3).map(lean);
    let payload={savedAt:Date.now(),stack,snap};
    let raw=JSON.stringify(payload);
    if(raw.length>180000){
      stack=stack.map(x=>({...x,content:'',actions:'',subject:'',result:'',currentDossier:null}));
      payload.stack=stack;
      raw=JSON.stringify(payload);
    }
    if(raw.length>180000){
      payload.snap={...snap,content:'',subject:'',actions:'',result:'',candidateContext:null};
      raw=JSON.stringify(payload);
    }
    if(raw.length<=180000)sessionStorage.setItem(STATE_KEY,raw);
  }catch(e){}
}
function restoreSavedState(){try{const raw=sessionStorage.getItem(STATE_KEY);if(!raw)return false;const p=JSON.parse(raw);if(!p?.savedAt||Date.now()-p.savedAt>21600000){sessionStorage.removeItem(STATE_KEY);return false}const s=p.snap||{};navStack=Array.isArray(p.stack)?p.stack:[];current=s.current??null;currentLabel=s.currentLabel||'';currentDossier=s.currentDossier||null;lastNumeric=s.lastNumeric||null;lastNoMatchQuery=s.lastNoMatchQuery||'';candidateContext=s.candidateContext||null;familyDepth=s.familyDepth||3;subject.innerHTML=s.subject||'';result.innerHTML=s.result||result.innerHTML;setActions(s.actions||'');content.innerHTML=s.content||'';setTimeout(()=>window.scrollTo(0,Number(s.scrollY||0)),50);return true}catch(e){return false}}
let _touchStartY=0;document.addEventListener('touchstart',e=>{if(e.touches?.length)_touchStartY=e.touches[0].clientY},{passive:true});document.addEventListener('touchmove',e=>{if(window.scrollY<=0&&e.touches?.length&&e.touches[0].clientY>_touchStartY+8)e.preventDefault()},{passive:false});
function cancelPropertyWeb(){if(propertyWebTimer){clearTimeout(propertyWebTimer);propertyWebTimer=null}if(propertyWebController){try{propertyWebController.abort()}catch{}propertyWebController=null}}
function cancelPersonResearch(){personWebEpoch++;if(personWebTimer){clearTimeout(personWebTimer);personWebTimer=null}if(personWebController){try{personWebController.abort()}catch{}personWebController=null}}
function badge(t,c=''){return '<span class="badge '+c+'">'+esc(t)+'</span>'}
function item(t,s=''){return '<div class="item"><b>'+esc(t)+'</b>'+(s?'<div class="muted">'+esc(s)+'</div>':'')+'</div>'}
function fmt(n){return Number(n||0).toLocaleString()}
function chips(xs){return '<div class="trait-wrap">'+(xs||[]).map(x=>'<span class="trait-chip">'+esc(x)+'</span>').join('')+'</div>'}
function addressClass(s){s=String(s||'');if(s.includes('HOUSEHOLD'))return'addr-home';if(s.includes('VEHICLE'))return'addr-vehicle';if(s.includes('PROPERTY_RECORD'))return'addr-property';if(s.includes('BUSINESS'))return'addr-business';if(s.includes('BROKERAGE'))return'addr-brokerage';if(s.includes('DOCUMENT'))return'addr-document';return'addr-candidate'}
function addressCard(a){const s=a.state||a.address_class||'CANDIDATE_LOCATION';const label={HOUSEHOLD_OR_CONTACT_EVIDENCE:'Household / contact',VEHICLE_REGISTRATION_ADDRESS:'Vehicle-registration',PROPERTY_RECORD_LOCATION:'Property-record',BUSINESS_ADDRESS:'Business',BROKERAGE_PROPERTY_LOCATION:'Review brokerage',DOCUMENT_ADDRESS:'Document',CANDIDATE_LOCATION:'Candidate'}[s]||s;return '<div class="address-card '+addressClass(s)+'"><b>'+esc(a.address||a.label||'Address')+'</b><div class="tiny">'+esc(label)+(a.source_types?.length?' · '+esc(a.source_types.join(', ')):'')+'</div></div>'}
function civilStatusSignalHtml(d){const p=d.person||{},f=d.family||{},origin=(f.origin_households||[])[0]||null,marital=f.marital_households||[],pr=String(p.register_no||'').trim(),or=String(origin?.register_no||'').trim(),same=!!(pr&&or&&pr===or),changed=!!(pr&&or&&pr!==or);let title='Civil-status / register signal',state='Register history unresolved',detail='No defensible register-transition interpretation is available from this snapshot.';if(same){state='Natal-register continuity detected';detail='Current canonical register '+pr+' matches the resolved origin-family register. This is compatible with remaining on, or later returning to, the natal register. It does not by itself prove never-married, divorced, widowed or currently single.'}else if(changed){state='Register transition detected';detail='Current canonical register '+pr+' differs from the resolved origin-family register '+or+'. This is a household/civil-status transition signal that requires spouse, marriage, divorce/widowhood and later-register evidence before interpretation.'}else if(pr){state='Current register '+pr;detail='Origin-family register is not resolved strongly enough for a continuity/transition comparison.'}if(marital.length)detail+=' '+marital.length+' post-marital family union(s) are separately resolved and should be reviewed alongside the register signal.';return '<div class="card"><div class="section-kicker">'+title+'</div><div class="title">'+esc(state)+'</div><div class="muted">'+esc(detail)+'</div>'+(origin?'<div class="trait-wrap"><span class="trait-chip">Current '+esc(pr||'—')+'</span><span class="trait-chip">Origin '+esc(or||'—')+'</span><span class="trait-chip">'+esc(marital.length?marital.length+' post-marital union(s)':'post-marital unresolved')+'</span></div>':'')+'</div>'}

function characterHtml(d){const i=d.interpretation||{},c=i.character||{},n=i.numerology||{},cy=n.long_cycles||{},res=n.resonance||{};if(c.status!=='AVAILABLE')return '<div class="card"><div class="section-kicker">Symbolic insights</div><div class="notice">A complete DOB is required for the date-based symbolic layer.</div></div>';const p=cy.current_pinnacle||{},ch=cy.challenges||[],ageRange=p.age_to==null?(p.age_from!=null?p.age_from+'+':'—'):[p.age_from,p.age_to].filter(x=>x!=null).join('–');return '<div class="card insight-hero"><div class="row"><div><div class="section-kicker">Symbolic insights · evidence weight 0</div><div class="title">'+esc(c.headline||'Interpretation')+'</div></div>'+badge('NON-EVIDENTIARY','warn')+'</div><div class="soft-note">Astrology/numerology are shown as an interpretive lens only. They never alter identity, kinship, ownership or factual confidence.</div><div class="metrics symbolic-metrics"><div class="metric"><b>'+esc(n.life_path?.value??'—')+'</b><span>Life Path · '+esc(c.life_path_theme||'')+'</span></div><div class="metric"><b>'+esc(n.birthday?.value??'—')+'</b><span>Birthday · '+esc(c.birthday_theme||'')+'</span></div><div class="metric"><b>'+esc(n.attitude?.value??'—')+'</b><span>Attitude / Sun · '+esc(c.attitude_theme||'')+'</span></div><div class="metric"><b>'+esc(n.personal_year?.value??'—')+'</b><span>Personal Year '+esc(n.personal_year?.year??'')+'</span></div><div class="metric"><b>'+esc(n.personal_month?.value??'—')+'</b><span>Personal Month · '+esc(n.personal_month?.theme||'')+'</span></div><div class="metric"><b>'+esc(p.value??'—')+'</b><span>Pinnacle #'+esc(p.index??'—')+' · '+esc(ageRange)+'</span></div></div><div class="insight-grid"><div class="insight"><b>Responds to</b>'+esc((c.likes||[]).join(' · '))+'</div><div class="insight"><b>May resist</b>'+esc((c.dislikes||[]).join(' · '))+'</div><div class="insight"><b>Communication</b>'+esc(c.communication_style||'')+'</div><div class="insight"><b>Decision style</b>'+esc(c.decision_style||'')+'</div></div></div><details><summary>Deep symbolic profile · traits, relationships & pressure</summary><div class="inside">'+chips(c.traits)+'<div class="insight-grid"><div class="insight"><b>Relationship style</b>'+esc(c.relationship_style||'')+'</div><div class="insight"><b>Under pressure</b>'+esc(c.under_pressure||'')+'</div></div></div></details><details><summary>Advanced numerology cycles</summary><div class="inside">'+item('Current Pinnacle',p.value!=null?('#'+p.index+' · '+p.value+' · '+(p.theme||'')+' · ages '+ageRange):'Unavailable')+item('Pinnacle sequence',(cy.pinnacles||[]).map(x=>'#'+x.index+' '+x.value+' ('+x.age_from+'–'+(x.age_to??'life')+')').join(' · '))+item('Challenge sequence',ch.map(x=>'#'+x.index+' '+x.value+' · '+x.theme).join(' | '))+item('Resonance numbers',(res.symbolic_resonance_numbers||[]).join(' · ')||'Unavailable')+item('Current cycle focus',(res.current_cycle_focus||[]).filter(Boolean).join(' + ')||'Unavailable')+'<div class="soft-note">Symbolic timing motifs only; no factual luck score or event prediction is claimed.</div></div></details>'}

function dynamicsHtml(d){const h=d.household_dynamics||{},sum=h.compatibility_summary||{},ranked=sum.ranked||[];if(!ranked.length)return '<div class="card"><div class="section-kicker">Household compatibility</div><div class="muted">Not enough resolved DOB evidence for a household comparison.</div></div>';const top=ranked[0],bottom=ranked[ranked.length-1];const renderRows=(rows)=>((rows||[]).map(x=>{const p=x.person||{},dy=x.dynamic||{},cp=x.profile?.character||{},num=x.profile?.numerology||{};return '<div class="candidate compact-candidate"><div class="entity-lane-title"><b>'+esc(p.name||'Household member')+' · '+esc(String(x.role||'').replaceAll('_',' '))+'</b>'+(dy.compatibility_index!=null?badge(dy.compatibility_index+' · '+(dy.compatibility_band||''),dy.compatibility_index>=68?'good':dy.compatibility_index<50?'warn':''):'')+'</div><div class="tiny">'+esc(cp.headline||'DOB incomplete')+(num.attitude?.value!=null?' · Attitude '+esc(num.attitude.value):'')+(num.personal_year?.value!=null?' · PY '+esc(num.personal_year.value):'')+'</div>'+(dy.status==='AVAILABLE'?'<div class="soft-note"><b>Complement:</b> '+esc(dy.complement||'')+'<br><b>Friction:</b> '+esc(dy.friction||'')+'<br><b>Approach:</b> '+esc(dy.communication||'')+'</div>':'<div class="muted">DOB incomplete.</div>')+'</div>'}).join(''));return '<div class="card"><div class="row"><div><div class="section-kicker">Household symbolic compatibility</div><div class="title">Relationship matrix</div></div>'+badge(ranked.length+' comparisons')+'</div><div class="soft-note">'+esc(sum.note||'Symbolic comparison only.')+'</div><div class="compat-list">'+ranked.slice(0,6).map(x=>'<div class="compat-row"><span>'+esc((x.person||{}).name||'Member')+'</span><div class="compat-track"><i style="width:'+Math.max(8,Math.min(100,Number(x.compatibility_index||0)))+'%"></i></div><b>'+esc(x.compatibility_index)+'</b></div>').join('')+'</div>'+item('Highest symbolic alignment',(top.person||{}).name+' · '+top.compatibility_index)+item('Highest symbolic contrast',(bottom.person||{}).name+' · '+bottom.compatibility_index)+'</div><details><summary>Origin / pre-marital dynamics · '+fmt((h.origin_pre_marital||[]).length)+'</summary><div class="inside">'+renderRows(h.origin_pre_marital)+'</div></details><details><summary>Adult / post-marital dynamics · '+fmt((h.post_marital||[]).length)+'</summary><div class="inside">'+((h.post_marital||[]).length?renderRows(h.post_marital):'<div class="muted">No resolved post-marital members with enough DOB evidence.</div>')+'</div></details>'}

/* Canonical formatting is presentation-only. Original source variants remain inspectable. */
function phoneKey(v){
 let s=String(v??'').replace(/\D/g,'');
 if(s.startsWith('00961'))s=s.slice(5);
 else if(s.startsWith('961')&&s.length>=10)s=s.slice(3);
 if(s.length===8&&s.startsWith('0'))s=s.slice(1);
 if(s.length===7)return '0'+s;
 return s;
}
function normalizedPhoneGroups(rows){
 const groups=new Map();
 for(const r of rows||[]){
  const key=phoneKey(r.phone);
  if(!key)continue;
  let x=groups.get(key);
  if(!x){x={key,phone:key,people:[],states:[],variants:[],shared:false,rawCount:0};groups.set(key,x)}
  x.rawCount++;
  if(r.phone&&!x.variants.includes(String(r.phone)))x.variants.push(String(r.phone));
  x.shared=!!(x.shared||r.shared);
  for(const state of r.states||[])if(!x.states.includes(state))x.states.push(state);
  for(const p of r.people||[]){
   const identity=String(p.person_id||p.name||'')+'|'+String(p.role||'');
   if(!x.people.some(z=>z._key===identity))x.people.push({...p,_key:identity});
  }
 }
 for(const x of groups.values())x.shared=x.shared||new Set(x.people.map(p=>String(p.person_id||p.name))).size>1;
 return [...groups.values()];
}
function phoneIsSelf(x,pid){return x.people.some(p=>Number(p.person_id)===pid&&p.role==='SELF')}
function phoneQuality(x){return x.shared?'SHARED / MULTIPLE PEOPLE':'SOURCE-LINKED CANDIDATE'}
function phoneEvidenceCard(x,pid){
 const other=x.people.filter(p=>Number(p.person_id)!==pid);
 const title='<div class="row"><b class="phone-number">'+esc(x.phone)+'</b>'+badge(x.shared?'SHARED':'CANDIDATE',x.shared?'warn':'')+'</div>';
 const rel=other.length?'<div class="muted">Also recorded with: '+esc(other.map(p=>[p.name,p.role].filter(Boolean).join(' · ')).join(' | '))+'</div>':'';
 const original=x.variants.length>1?'<div class="tiny">Source variants: '+esc(x.variants.join(' / '))+'</div>':'';
 return '<div class="candidate phone-item">'+title+rel+'<div class="tiny">'+esc(phoneQuality(x))+' · ownership/current subscriber unverified</div>'+original+'</div>';
}
async function loadR2OverviewContactEvidence(pid){
 const element=$('[data-overview-other-phones]');if(!element||!pid)return;
 try{
  const d=await api('/reality-api/contact-leads/'+pid);
  if(!element.isConnected||Number(current)!==Number(pid))return;
  const count=(d.candidates||[]).length;
  element.querySelector('b').textContent=String(count);
  element.querySelector('span').textContent='historical / candidate contact numbers';
  if(count){
   const btn=document.createElement('button');btn.type='button';btn.className='action alt';btn.dataset.lane='phones';
   btn.textContent='Inspect '+count+' historical / candidate contact'+(count===1?'':'s')+' with evidence';
   element.closest('.card')?.appendChild(btn);
  }
 }catch(e){
  if(element.isConnected){element.querySelector('b').textContent='!';element.querySelector('span').textContent='additional contact lookup unavailable'}
 }
}
async function loadR2EvidencePhoneAddendum(pid){
 const el=$('#r2EvidencePhoneAddendum');if(!el||!pid)return;
 try{
  const data=await api('/reality-api/contact-leads/'+pid);
  if(!el.isConnected||Number(current)!==Number(pid))return;
  const n=(data.candidates||[]).length;
  el.innerHTML='<div class="section-kicker">Additional historical registry contacts</div><div class="title">'+n+' candidate number'+(n===1?'':'s')+' in other private sources</div>'+
  '<p class="soft-note">These are separate from the direct canonical phone count above. Historic vehicle-registration contacts are not proof of today’s subscriber.</p>'+
  '<div class="actions"><button class="action" data-lane="phones">Inspect source and contact candidates</button></div>';
 }catch(e){if(el.isConnected)el.innerHTML='<div class="notice error">Other contact-source review unavailable: '+esc(e.message||'connection failure')+'</div>'}
}
async function loadR2ContactResearch(pid){
 const target=$('#r2ContactResearch');if(!target||!pid)return;
 try{
  const res=await api('/reality-api/contact-leads/'+pid);
  if(!target.isConnected||Number(current)!==Number(pid))return;
  const rows=res.candidates||[];
  const evidence=rows.reduce((n,r)=>n+(r.source_observations||[]).length,0);
  const stats=$('.phone-metrics');if(stats&&stats.isConnected){
   stats.querySelector('[data-historical-leads]')?.remove();
   stats.insertAdjacentHTML('beforeend','<div class="metric" data-historical-leads><b>'+rows.length+'</b><span>additional historical / candidate contacts</span></div>');
  }
  const card=r=>{
   const linked=(r.source_observations||[]).some(x=>x.source_class==='SOURCE_LINKED');
   const vehicle=(r.source_observations||[]).some(x=>String(x.source_class||'').includes('VEHICLE'));
   const kind=vehicle?'Vehicle registration contact · historical':linked?'Person-linked source observation':'Unverified source/name candidate';
   const source=r.source_observations||[];
   return '<div class="candidate r2-contact-lead"><div class="row"><div><div class="tiny">'+kind+'</div><b class="phone-number">'+esc(r.phone)+'</b></div>'+badge('UNVERIFIED CURRENT','warn')+'</div>'+
   '<div class="tiny">Source observations: '+esc(source.map(x=>[x.source_dataset,x.vehicle_plate&&('Plate '+x.vehicle_plate),x.source_status].filter(Boolean).join(' · ')).join(' | '))+'</div>'+
   '<div class="actions"><button type="button" class="action alt" data-phone-copy="'+esc(r.phone)+'">Copy historical lead</button></div></div>';
  };
  target.innerHTML='<div class="section-kicker">Additional historical phone evidence · private</div><div class="title">'+rows.length+' distinct candidate(s)</div><p class="soft-note">'+evidence+' source observation(s) from private indexes and registry records. Some are candidates; none establishes current subscriber ownership.</p>'+
    (rows.length?rows.map(card).join(''):'<div class="notice">No additional source-linked candidate found for this exact identity. Contact investigation remains unresolved.</div>')+
    '<div class="actions"><button class="action alt" data-phone-case="'+pid+'">Create a contact verification case</button></div><div class="tiny" id="r2ContactCaseStatus"></div>';
 }catch(e){if(target.isConnected)target.innerHTML='<div class="notice error">Historical phone-source lookup unavailable: '+esc(e.message||'connection failed')+'</div>'}
}
document.addEventListener('click',async e=>{
 const copy=e.target.closest('[data-phone-copy]');
 if(copy){try{await navigator.clipboard.writeText(copy.dataset.phoneCopy);copy.textContent='Copied'}catch{copy.textContent='Copy unavailable'}return}
 const btn=e.target.closest('[data-phone-case]');if(!btn)return;
 const pid=Number(btn.dataset.phoneCase),status=$('#r2ContactCaseStatus');
 if(!pid||!status)return;btn.disabled=true;status.textContent='Saving a verification task…';
 try{
  const res=await fetch('/reality-api/investigations/track',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({query:'JEV contact research: person '+pid,kind:'CONTACT_VERIFICATION',state:'OPEN_RESEARCH',person_id:pid,person_label:currentLabel,next_action:'Check source attachments and verify current contact use; no household or namesake assignment.'})});
  if(!res.ok)throw Error('Case service unavailable');status.textContent='Saved in your existing private research cases, not promoted as a verified number.';
 }catch(err){status.textContent='Not saved: '+String(err.message||err)}finally{btn.disabled=false}
});
function subjectPhonesHtml(d){
 const groups=normalizedPhoneGroups(d.household_phone_directory||[]);
 const pid=Number(d.person?.person_id||current);
 const directly=groups.filter(x=>phoneIsSelf(x,pid));
 const shared=directly.filter(x=>x.shared),candidates=directly.filter(x=>!x.shared);
 const household=groups.filter(x=>!phoneIsSelf(x,pid));
 const stats='<div class="metrics phone-metrics"><div class="metric"><b>'+directly.length+'</b><span>canonical direct links</span></div><div class="metric"><b>'+shared.length+'</b><span>shared / household</span></div><div class="metric"><b>'+candidates.length+'</b><span>single-person candidates</span></div></div>';
 const intro='<div class="card phone-summary"><div class="row"><div><div class="section-kicker">Contact intelligence</div><div class="title">Phones · canonical evidence</div></div>'+badge('NOT VERIFIED AS CURRENT','warn')+'</div>'+stats+'<p class="soft-note">Repeated spellings with/without Lebanon’s leading zero are combined. No number here is automatically confirmed as the person’s current phone.</p></div>';
 const sh=shared.length?'<details open class="phone-group"><summary>Shared numbers · '+shared.length+'</summary><div class="inside">'+shared.map(x=>phoneEvidenceCard(x,pid)).join('')+'</div></details>':'';
 const ca=candidates.length?'<details class="phone-group"><summary>Other person-linked candidates · '+candidates.length+'</summary><div class="inside">'+candidates.map(x=>phoneEvidenceCard(x,pid)).join('')+'</div></details>':'';
 const ho=household.length?'<details class="phone-group secondary-results"><summary>Other household/relative numbers · '+household.length+'</summary><div class="inside"><div class="soft-note">Linked to other household records, not established as the subject’s own numbers.</div>'+household.map(x=>phoneEvidenceCard(x,pid)).join('')+'</div></details>':'';
 const quarantined=(d.evidence?.phones||[]).filter(x=>String(x.state||'').toUpperCase()==='QUARANTINED'||String(x.shape||'').includes('INVALID'));
 const excluded=quarantined.length?'<div class="card"><div class="section-kicker">Excluded / unusable evidence</div><div class="title">'+quarantined.length+' quarantined observation(s)</div><p class="soft-note">These source records were rejected as ambiguous, invalid or unsupported. They cannot be used to contact this person. Raw values are withheld from the outreach panel.</p></div>':'';
 const empty=!directly.length?'<div class="card"><div class="muted">No canonical phone association in this dossier. Historical person-linked candidates are researched separately below. '+(quarantined.length?'Some raw observations were excluded.':'No direct evidence was recovered.')+'</div><div class="actions"><button class="action alt" data-lane="evidence">Inspect other evidence</button><button class="action alt" data-lane="research">Research sources</button></div></div>':'';
 return intro+sh+ca+ho+excluded+empty+'<div class="card" id="r2ContactResearch"><div class="section-kicker">Private phone evidence sources</div><div class="loading">Checking historical phone-reference indexes…</div></div>';
}
function householdPhonesHtml(d){
 const rows=normalizedPhoneGroups(d.household_phone_directory||[]);
 const pid=Number(d.person?.person_id||current);
 return '<div class="card"><div class="section-kicker">Household phone directory · normalized</div><div class="title">'+rows.length+' unique phone observations</div><div class="soft-note">Source formats are preserved for audit. Shared numbers do not prove individual subscriber ownership.</div>'+rows.map(x=>phoneEvidenceCard(x,pid)).join('')+'</div>';
}

function webCard(r){const cat=(r.category||'OTHER_PUBLIC').replaceAll('_',' '),meta=[r.published,r.author].filter(Boolean).join(' · '),summary=String(r.evidence_summary||r.snippet||r.text||'').replace(/\s+/g,' ').trim();return '<div class="candidate web">'+badge(cat,'')+'<b style="display:block;margin-top:7px">'+esc(r.title||'Public result')+'</b>'+(meta?'<div class="tiny">'+esc(meta)+'</div>':'')+(summary?'<div class="muted">'+esc(summary.slice(0,260))+(summary.length>260?'…':'')+'</div>':'')+(r.relevance_score!=null?'<div class="tiny">Relevance '+esc(r.relevance_score)+'</div>':'')+(r.url?'<a href="'+esc(r.url)+'" target="_blank" rel="noreferrer">Open source</a>':'')+'</div>'}

function webGroupedHtml(w){const rows=w?.results||[],runs=w?.runs||[],failures=w?.failures||[];if(!rows.length){const passed=runs.filter(x=>String(x.status||'').toUpperCase()==='PASS').length,failed=Math.max(failures.length,runs.filter(x=>String(x.status||'').toUpperCase()==='ERROR').length);return '<div class="card research-brief"><div class="section-kicker">Research brief</div><div class="title">'+(passed?'No public identity candidates surfaced':'Research providers unavailable / incomplete')+'</div><div class="metrics"><div class="metric"><b>'+fmt(passed)+'</b><span>search arms completed</span></div><div class="metric"><b>'+fmt(failed)+'</b><span>arm failures</span></div></div><div class="soft-note">'+(passed?'The completed public-search arms returned no defensible identity candidates. This is not proof that no public information exists.':'The public-search layer did not complete enough arms to support a negative conclusion. The private dossier remains intact; retry Deep Research later.')+'</div></div>'};const bridged=rows.filter(x=>(x.category||'')!=='POSSIBLE_NAMESAKE'&&String(x.identity_relevance||'').toUpperCase()!=='LOW_NAMESAKE'),namesakes=rows.filter(x=>!bridged.includes(x)),order=['OFFICIAL_PUBLIC','PROFESSIONAL','BUSINESS_COMPANY','REAL_ESTATE','NEWS_MEDIA','SOCIAL_PUBLIC','OTHER_PUBLIC'];const sorted=[...bridged].sort((a,b)=>Number(b.relevance_score||0)-Number(a.relevance_score||0));let html='<div class="card research-brief"><div class="row"><div><div class="section-kicker">Research brief</div><div class="title">'+(bridged.length?'Public candidate evidence surfaced':'No strong public identity bridge yet')+'</div></div>'+badge(bridged.length?'CANDIDATE EVIDENCE':'NAMESAKES ONLY',bridged.length?'':'warn')+'</div><div class="metrics"><div class="metric"><b>'+fmt(bridged.length)+'</b><span>identity-relevant candidates</span></div><div class="metric"><b>'+fmt(namesakes.length)+'</b><span>possible namesakes</span></div><div class="metric"><b>'+fmt(runs.length)+'</b><span>search arms</span></div><div class="metric"><b>'+fmt(failures.length)+'</b><span>arm failures</span></div></div><div class="soft-note">'+(bridged.length?'Review the strongest candidates below. Nothing auto-merges into the canonical person.':'The search returned name-similar pages, but none crossed the identity-relevance threshold. They stay isolated rather than contaminating the dossier.')+'</div></div>';if(sorted.length)html+='<div class="card"><div class="section-kicker">Top candidate findings</div>'+sorted.slice(0,5).map(webCard).join('')+'</div>';const counts=order.map(cat=>[cat,bridged.filter(x=>(x.category||'OTHER_PUBLIC')===cat)]).filter(x=>x[1].length);if(counts.length)html+='<details><summary>Browse categorized candidate sources · '+bridged.length+'</summary><div class="inside">'+counts.map(([cat,rr])=>'<details class="web-category"><summary>'+esc(cat.replaceAll('_',' '))+' · '+rr.length+'</summary><div class="inside">'+rr.map(webCard).join('')+'</div></details>').join('')+'</div></details>';if(namesakes.length)html+='<details><summary>Possible namesakes / low identity relevance · '+namesakes.length+'</summary><div class="inside"><div class="notice">These pages share name tokens but lack a strong identity bridge. They are intentionally separated from the person dossier.</div>'+namesakes.map(webCard).join('')+'</div></details>';return html}
function dedupeAddresses(rows){const seen=new Set(),out=[];for(const a of (rows||[])){const k=String(a.address||a.label||'').replace(/\s+/g,' ').trim()+'|'+String(a.state||a.address_class||'');if(!k||seen.has(k))continue;seen.add(k);out.push(a)}return out}
function isAddressArtifact(a){const s=String(a?.address||a?.label||'').replace(/\s+/g,' ').trim();if(!s||/^[-_.\s]+$/.test(s))return true;const toks=s.toLowerCase().split(/\s+/).filter(Boolean);if(toks.length===2&&toks[0]===toks[1]&&toks[0].length<=12)return true;if(/^(mic\d*|gsm|touch|alfa|unknown|n\/?a|null|none)$/i.test(s))return true;return false}
function classifiedAddresses(rows){return dedupeAddresses(rows).filter(a=>!isAddressArtifact(a))}
function addressArtifacts(rows){return dedupeAddresses(rows).filter(isAddressArtifact)}
function addressLaneHtml(rows){const aa=classifiedAddresses(rows),raw=addressArtifacts(rows),groups={};for(const a of aa){const k=a.state||a.address_class||'CANDIDATE_LOCATION';(groups[k]||(groups[k]=[])).push(a)}const cards=Object.entries(groups).map(([k,v])=>'<div class="metric"><b>'+v.length+'</b><span>'+esc({HOUSEHOLD_OR_CONTACT_EVIDENCE:'Household/contact',VEHICLE_REGISTRATION_ADDRESS:'Vehicle registration',PROPERTY_RECORD_LOCATION:'Property record',BUSINESS_ADDRESS:'Business',BROKERAGE_PROPERTY_LOCATION:'Review brokerage',DOCUMENT_ADDRESS:'Document'}[k]||k)+'</span></div>').join('');const primary=aa.slice(0,6),rest=aa.slice(6);return '<div class="card"><div class="section-kicker">Address intelligence</div><div class="metrics">'+cards+'</div><div class="soft-note">Address classes stay separate; repeated exact strings are deduplicated. Obvious source/operator artifacts are quarantined below rather than presented as locations.</div>'+primary.map(addressCard).join('')+'</div>'+(rest.length?'<details><summary>More address evidence · '+rest.length+'</summary><div class="inside">'+rest.map(addressCard).join('')+'</div></details>':'')+(raw.length?'<details class="secondary-results"><summary>Raw address/source artifacts · '+raw.length+'</summary><div class="inside">'+raw.map(a=>item(a.address||a.label||'Raw artifact',a.state||a.address_class||'UNCLASSIFIED')).join('')+'</div></details>':'')}

const POP2012_GOVERNORATE=Object.freeze({'1':'البقاع','2':'بيروت','3':'جبل لبنان','4':'النبطية','5':'الشمال','6':'الجنوب'});
function civilRegionLabel(p){const c=String(p?.region_no??'').trim();return c&&Object.hasOwn(POP2012_GOVERNORATE,c)?'Governorate '+POP2012_GOVERNORATE[c]+' ('+c+')':c?'Region code '+c+' (unresolved)':''}
function recordedAge(v){const s=String(v||'').replace(/[^0-9]/g,'');if(s.length!==8)return'';const y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6,8),dt=new Date(y,m-1,d),n=new Date();if(y<1850||y>n.getFullYear()||dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return'';return 'Age '+(n.getFullYear()-y-((n.getMonth()+1<m||n.getMonth()+1===m&&n.getDate()<d)?1:0))+' (recorded DOB)'}
function civilHeaderSummary(history){
 if(!history)return 'Civil-register detail: loading verified source';
 const r=history.registry_reference_fields||{};
 const labels=r['2012_classification_descriptions']||[];
 const groups=r['direct_taifa_labels']||[];
 const tc=r['2012_taifa_codes_from_fine_table']||[];
 const classLabel=labels.length===1?'2012 registered classification '+labels[0]:'2012 registered classification: '+(labels.length?'conflicting source labels':'unresolved');
 const groupLabel=groups.length===1?'TAIFA '+groups[0]:'TAIFA code '+(tc.join(', ')||'unknown')+' (unmapped)';
 return classLabel+' · '+groupLabel+' · historical registry, not current beliefs';
}
function personLine(p,history=null){return [p.birth_date?'DOB '+p.birth_date:p.birth_year?'Born '+p.birth_year:'',recordedAge(p.birth_date),p.father?'Father '+p.father:'',p.mother_first?'Mother '+p.mother_first+' '+(p.mother_last||''):'',p.register_no?'Sejel '+p.register_no:'',civilRegionLabel(p),civilHeaderSummary(history)].filter(Boolean).join(' · ')}

function portalNavHtml(){const lanes=[['overview','⌂','Overview'],['family','♧','Family'],['evidence','◫','Assets'],['web','⌕','Research'],['report','▤','Report']];return '<div class="card portal-shell"><div class="portalnav" role="navigation" aria-label="Person dossier sections">'+lanes.map((x,i)=>'<button class="'+(i===0?'primary':'')+'" data-lane="'+x[0]+'" aria-label="'+x[2]+'"><span class="nav-icon">'+x[1]+'</span><span>'+x[2]+'</span></button>').join('')+'</div></div>'}
function showSubject(p){const changed=Number(current)!==Number(p.person_id);current=p.person_id;currentLabel=p.display_name_ar||('Person '+p.person_id);candidateContext=null;if(changed){cancelPersonResearch();cancelDossierLoad();familyDepth=3;currentDossier=null;activeLane='overview'}subject.innerHTML='<div class="card hero"><div class="section-kicker">Current subject</div><div class="row"><div><div class="title">'+esc(currentLabel)+'</div><div class="muted">'+esc(personLine(p))+'</div></div>'+badge('IDENTITY INDEX','good')+'</div></div>';setActions(portalNavHtml())}
function updateCivilSubject(d){
 if(!d?.person||Number(current)!==Number(d.person.person_id))return;
 const node=subject.querySelector('.card.hero .muted');
 if(node)node.textContent=personLine(d.person,d.civil_registry_history);
}
function candidateCard(c){const reason=c.match_reason?'<div class="soft-note">'+esc(c.match_reason)+'</div>':'',mode=String(c.match_mode||'').replaceAll('_',' '),score=Number(c.match_score_pct||0);return '<div class="candidate"><div class="entity-lane-title"><b>'+esc(c.display_name_ar||c.person_id)+'</b><span>'+badge('Name match: '+mode,'')+'</span></div><div class="muted">'+esc(personLine(c))+'</div>'+reason+'<div class="actions"><button class="action" data-person="'+Number(c.person_id)+'">Open this person</button><button class="action alt" data-person-phones="'+Number(c.person_id)+'">Phone evidence</button></div></div>'}

function plateEvidenceHtml(r){
 const a=r.anchor||{},obs=a.observations||[],cs=r.candidates||[],grouped=[];
 for(const o of obs){
    const key=[o.actual_nb,o.code_desc,o.make,o.type_desc,o.prod_date,o.registration_no,o.first_name,o.last_name,o.chassis,o.color].join('|');
    let g=grouped.find(x=>x.key===key);
    if(!g){g={key,row:o,sources:[]};grouped.push(g)}
    if(o.source_id&&!g.sources.includes(o.source_id))g.sources.push(o.source_id)
 }
 const detail=(label,value)=>value!==null&&value!==undefined&&String(value).trim()!==''?item(label,String(value)):'';
 const why=(cs[0]?.anchor_reasons||[]).map(x=>String(x).replaceAll('_',' ').toLowerCase()).join(' · ');
 let html='<div class="card"><div class="row"><div><div class="section-kicker">Private historical registry</div><div class="title">Vehicle / plate details</div></div>'+badge(grouped.length+' observations')+'</div>'+
    '<div class="notice warn">Historical registration and contact evidence, not proof of current owner, current phone subscriber or vehicle status.</div>';
 if((r.anchor||{}).observations_more)html+='<div class="soft-note">Additional historical observations are indexed but not displayed in this first result. Refine the exact plate code to narrow them.</div>';
 if(!grouped.length)html+='<div class="notice">No vehicle records found for this exact plate/code. A plate number may have several series; choose the correct one.</div>';
 for(const g of grouped){
    const o=g.row||{},plate=[o.code_desc,o.actual_nb].filter(Boolean).join(' '),
       model=[o.make,o.type_desc].filter(Boolean).join(' · ');
    const rawPhone=String(o.phone_digits||'').replace(/\D/g,'');
    const phone=(rawPhone.length>=7 && new Set(rawPhone).size>1)?rawPhone:null;
    html+='<div class="candidate vehicle-detail"><div class="entity-lane-title"><b>'+esc(plate||'Plate unknown')+'</b>'+badge(o.source_period==='2026'?'2026 SOURCE':'HISTORICAL SOURCE')+'</div>'+
      '<div class="title">'+esc(model||'Make / model unavailable')+'</div>'+
      '<div class="trait-wrap">'+[o.color&&('Color: '+o.color),o.prod_date&&('Model/year: '+o.prod_date),o.use_desc&&('Use: '+o.use_desc)].filter(Boolean).map(x=>'<span class="trait-chip">'+esc(x)+'</span>').join('')+'</div>'+
      (phone?'<div class="soft-note"><b>Registry phone:</b> <a href="tel:'+esc(phone)+'">'+esc(phone)+'</a><div class="tiny">Recorded contact in this source, not a verified current phone owner.</div></div>':'<div class="tiny">No usable phone recorded for this vehicle observation.</div>')+
      '<div class="muted">'+esc([o.first_name,o.last_name].filter(Boolean).join(' '))+'</div>'+
      '<details class="secondary-results"><summary>Full vehicle and registration fields</summary><div class="inside">'+
      detail('Make',o.make)+detail('Model / type',o.type_desc)+detail('Color',o.color)+
      detail('Production / model date',o.prod_date)+detail('First circulation',o.first_circulation)+
      detail('Acquisition date',o.acquisition_date)+detail('Registration number',o.registration_no)+
      detail('Use / category',o.use_desc)+detail('Chassis / VIN',o.chassis)+detail('Engine ID',o.engine)+
      detail('Recorded out-of-service flag',o.out_of_service)+
      detail('Registered owner name',[o.first_name,o.last_name].filter(Boolean).join(' '))+
      detail('Mother as registered',o.mother_name)+detail('Recorded age',o.owner_age)+
      detail('Birthplace',o.birth_place)+detail('Registration address',o.address)+
      detail('Historical registry phone',phone)+detail('Source IDs',g.sources.join(', '))+
      '</div></details>'+
      '<div class="tiny">Original historical observations: '+esc(g.sources.join(', ')||'registry')+'</div></div>';
 }
 if(why)html+='<div class="notice"><b>Why the candidate matches:</b> '+esc(why)+'</div>';
 return html+'</div>';
}
async function renderPlateDeep(r){const cs=r.candidates||[],header=plateEvidenceHtml(r);if(cs.length===1&&Number(cs[0].match_score_pct||0)>=99){const p=cs[0];setResult('Resolving plate to person…',(r.message||'')+' Expanding the uniquely corroborated person automatically.');content.innerHTML=header+'<div class="loading">Building the connected person dossier…</div>';const d=await api('/reality-api/dossier/'+p.person_id,{refresh:'false',include_web:'false'});showSubject(d.person);renderDossier(d);content.insertAdjacentHTML('afterbegin',header);setResult('Plate dossier ready',[((r.anchor||{}).plate_code||''),((r.anchor||{}).plate_number||''),'→',d.person?.display_name_ar||p.display_name_ar].filter(Boolean).join(' '));return}renderCandidates(cs,r.message);content.insertAdjacentHTML('afterbegin',header)}
function discriminatorQuestion(rows){if(!rows||rows.length<2)return'';const fields=new Set();for(const c of rows.slice(0,12)){if(c.father)fields.add('father');if(c.mother_first)fields.add('mother');if(c.birth_year||c.birth_date)fields.add('birth year');if(c.register_no)fields.add('Sejel');if(c.birth_place)fields.add('birthplace')}return 'Several canonical people fit this clue. Tell me '+[...fields].slice(0,4).join(', ')+' or tap the correct person.'}
function renderCandidates(rows,msg){current=null;currentLabel='';currentDossier=null;subject.innerHTML='';rows=rows||[];candidateContext={query:(msg||''),rows:[...rows],createdAt:Date.now()};setActions();const dq=discriminatorQuestion(rows),scores=rows.map(x=>Number(x.match_score_pct||0)),top=scores.length?Math.max(...scores):0;const compound=rows.filter(x=>x.family_match_type==='COMPOUND_FAMILY_SUFFIX');const direct=rows.filter(x=>x.family_match_type!=='COMPOUND_FAMILY_SUFFIX');const strongest=direct.filter(x=>Number(x.match_score_pct||0)>=top-0.5);const directShow=strongest.slice(0,3);const compoundShow=compound.slice(0,3);const shown=new Set([...directShow,...compoundShow].map(x=>x.person_id));const rest=rows.filter(x=>!shown.has(x.person_id));setResult(rows.length>1?'Several canonical people fit this clue':'Canonical candidate found',dq||msg||'Review the evidence before opening the person.');let html='<div class="card"><div class="section-kicker">Identity resolution</div>'+(dq?'<div class="notice">'+esc(dq)+'</div>':'')+directShow.map(candidateCard).join('')+'</div>';if(compoundShow.length)html+='<div class="card"><div class="section-kicker">Compound surname candidates</div><div class="soft-note">These people match because the surname you typed can be the suffix of a longer Lebanese family name. They stay visible so a common short surname cannot hide them.</div>'+compoundShow.map(candidateCard).join('')+'</div>';if(rest.length)html+='<details class="secondary-results"><summary>More candidates · '+rest.length+'</summary><div class="inside"><div class="soft-note">Lower-ranked exact-family, transliteration, nickname or additional compound-family candidates are preserved here without crowding the primary screen.</div>'+rest.map(candidateCard).join('')+'</div></details>';content.innerHTML=html}
function familyBox(p,cls='',role=''){if(!p)return'';const clickable=p.person_id?' clickable':'';return '<div class="personbox '+cls+clickable+'"'+(p.person_id?' data-person="'+Number(p.person_id)+'"':'')+'>'+(role?'<span class="relation-tag">'+esc(role)+'</span>':'')+'<b>'+esc(p.display_name_ar||((p.first||'')+' '+(p.family||'')))+'</b><div class="tiny">'+esc([p.birth_year||String(p.birth_date||'').slice(0,4),p.register_no?'Sejel '+p.register_no:'',p.region_no?civilRegionLabel(p):''].filter(Boolean).join(' · '))+'</div></div>'}
function unresolvedFamilyBox(x,role){if(!x)return'';
 const name=[x.label_first,x.label_family].filter(Boolean).join(' '),a=x.parent_candidates||[],
 total=x.candidate_count_live??x.candidate_count_minimum??x.candidate_count??0;
 const recovered=x.recovered_maternal_evidence||null;
 const info=recovered?'<div class="soft-note"><b>Mother’s recorded name recovered from '+esc(String(recovered.witness_count))+' concordant sibling records.</b> '+esc(recovered.source||'Canonical family evidence')+'. This is a derived parent-name label; the mother’s canonical person ID is not yet established.</div>':'<div class="tiny">Parent identity not verified · '+esc(String(total))+' compatible candidates. Historical source period unknown.</div>';
 const one=c=>'<div class="tiny"><b>'+esc(c.display_name_ar||'Candidate')+'</b> · '+esc(String(c.birth_year||'?'))+' · Sejil '+esc(String(c.register_no||'?'))+' <button class="inline-link" data-person="'+Number(c.person_id)+'">Open person</button><div class="soft-note">'+esc((c.evidence_reasons||[]).join(' · '))+'</div></div>';
 const main=recovered?'<div class="tiny">Source-linked sibling witnesses: '+esc((recovered.witness_person_ids||[]).join(', '))+'</div>':a.length?'<div class="soft-note"><b>Leading research candidate, NOT a verified parent</b></div>'+one(a[0])+(a.length>1?'<details class="secondary-results"><summary>Compare '+(a.length-1)+' alternative candidates</summary><div class="inside">'+a.slice(1).map(one).join('')+'</div></details>':''):'<div class="tiny">No defensible identity match in the current indexed source.</div>';
 const staged=x.national_unpromoted_research||{};
 const national=(staged.candidate_count>0)?'<details class="secondary-results"><summary>National research leads · '+esc(staged.candidate_count)+' (unverified)</summary><div class="inside"><div class="tiny">Candidates from the nationwide unpromoted evidence scan. Names, age and Sejil are clues, NOT proven parents.</div>'+(staged.candidates||[]).map(z=>'<div class="candidate"><b>'+esc(z.display_name_ar||z.person_id)+'</b><div class="tiny">'+esc([z.birth_year&&('Born '+z.birth_year),z.register_no&&('Sejil '+z.register_no),z.same_recorded_register&&'Same recorded register',z.shared_historical_phone_observation&&'Historical phone corroboration'].filter(Boolean).join(' · '))+'</div><button class="inline-link" data-person="'+Number(z.person_id)+'">Review person</button></div>').join('')+'</div></details>':'';
 return '<div class="personbox unresolvedbox"><span class="relation-tag">'+esc(role)+'</span><b>'+esc(name||'Unresolved')+'</b>'+info+main+national+'</div>'}
function parentEdge(node,role){return (node?.parents||[]).find(x=>String(x.role||'').toLowerCase()===role)}
function unresolvedEdge(node,role){return (node?.unresolved_parent_labels||[]).find(x=>String(x.role||'').toLowerCase()===role)}

function coupleHtml(node,label){if(!node)return'';const fe=parentEdge(node,'father'),me=parentEdge(node,'mother'),fu=unresolvedEdge(node,'father'),mu=unresolvedEdge(node,'mother'),ll=String(label||'').toLowerCase(),cls=ll.includes('father')?' paternal-branch':ll.includes('mother')?' maternal-branch':'';if(!fe&&!me&&!fu&&!mu)return'';return '<div class="lineage-card'+cls+'"><div class="lineage-label">'+esc(label)+'</div><div class="couple-grid">'+(fe?familyBox(fe.node?.person,'','Father'):fu?unresolvedFamilyBox(fu,'Father'):'<div class="personbox unresolvedbox"><span class="relation-tag">Father</span><b>Unresolved</b></div>')+(me?familyBox(me.node?.person,'','Mother'):mu?unresolvedFamilyBox(mu,'Mother'):'<div class="personbox unresolvedbox"><span class="relation-tag">Mother</span><b>Unresolved</b></div>')+'</div></div>'}
function ancestorGenerationHtml(root,depth){if(!root||depth<1)return'';if(depth===1)return '<div class="family-generation"><h4>Generation -1 · Parents</h4>'+coupleHtml(root,'Parents')+'</div>';let frontier=[{node:root,path:'Subject'}];for(let level=1;level<depth;level++){const next=[];for(const x of frontier){for(const e of (x.node?.parents||[])){if(e.node)next.push({node:e.node,path:x.path+' → '+(e.role==='father'?'Father':'Mother')})}}frontier=next;if(!frontier.length)break}if(!frontier.length)return'';const cards=frontier.map(x=>coupleHtml(x.node,x.path+' branch')).filter(Boolean).join('');return cards?'<div class="family-generation"><h4>Generation -'+depth+'</h4><div class="lineage-grid">'+cards+'</div></div>':''}

function lineageBranchPanel(root,role,depth){
  const paternal=role==='father', edge=parentEdge(root,role), title=paternal?'PATERNAL · Father’s ancestry':'MATERNAL · Mother’s ancestry';
  let html='<details class="lineage-side '+(paternal?'paternal-branch':'maternal-branch')+'" open><summary>'+title+'</summary><div class="inside"><div class="soft-note">Start with the '+(paternal?'father':'mother')+' above; each level below traces ONLY this side of the family. Blue is paternal, purple is maternal. Dashed/amber nodes remain unverified.</div>';
  if(!edge?.node){return html+'<div class="notice warn">No verified or defensibly resolved '+(paternal?'paternal':'maternal')+' parent ID. Further ancestry cannot be asserted from a name alone.</div></div></details>'}
  let frontier=[{node:edge.node,path:paternal?'Father':'Mother'}],shown=0;
  for(let generation=2;generation<=depth;generation++){
    const cards=frontier.map(x=>coupleHtml(x.node,x.path)).filter(Boolean);
    if(!cards.length)break;
    html+='<section class="branch-level"><h5>Generation −'+generation+' · '+(generation===2?'Grandparents':generation===3?'Great-grandparents':'Ancestors')+'</h5><div class="branch-cards">'+cards.join('')+'</div></section>';
    const next=[];
    for(const x of frontier){for(const e of (x.node?.parents||[])){if(e.node)next.push({node:e.node,path:x.path+' → '+(e.role==='father'?'Father':'Mother')})}}
    frontier=next;shown++;
  }
  if(!shown)html+='<div class="soft-note">No additional identified ancestors currently available on this branch. Expansion never manufactures missing links.</div>';
  return html+'</div></details>';
}

function collectDescendants(rows,maxDepth,depth=1,out=[]){if(depth>maxDepth)return out;const persons=[];for(const n of (rows||[])){if(n.person)persons.push(n.person);collectDescendants(n.children||[],maxDepth,depth+1,out)}if(persons.length)out.push({depth,row:persons});return out}
function countFamilyVisible(d){const f=d.family||{},origin=(f.origin_households||[])[0];let n=1+(origin?.children||[]).length+(f.recovered_siblings||[]).length+(f.recovered_children||[]).length;const walk=x=>{for(const e of (x?.parents||[])){if(e.node?.person)n++;walk(e.node)}};walk(f.ancestry||{});const down=collectDescendants(f.descendants||[],familyDepth);for(const g of down)n+=g.row.length;return n}
function mountJEVFamily(d){const host=$('#familyStandalone');if(!host||!window.JEV)return;const existing=host.innerHTML;host.innerHTML='<details class="secondary-results" id="jevSourceAudit"><summary>Detailed source audit and legacy genealogy</summary><div class="inside">'+existing+'</div></details>';window.JEV.mount(host,d,{atlas:privateAtlasCache,onOpen:(personId)=>{pushView('JEV person focus');openPerson(personId)},onExpand:()=>{familyDepth=Math.min(12,Number(familyDepth||4)+2);currentDossier=null;renderPortalLane('family')}})}
function renderFamily(d){currentDossier=d;content.innerHTML='<div class="card"><div class="section-kicker">JEV family intelligence</div><div class="title">Interactive family universe</div><div class="soft-note">Tap, focus, search, expand or print. Documentary evidence remains separate from research hypotheses.</div><div id="familyStandalone"></div></div>';renderFamilyInto(d,$('#familyStandalone'));mountJEVFamily(d);if(isPrivateAtlasSubject(d.person))loadPrivateAtlas()}

let privateAtlasCache=null,privateAtlasSelected='dany';
function isPrivateAtlasSubject(p){
 const name=String(p?.display_name_ar||'');
 const dob=String(p?.birth_date||'').replace(/\D/g,'');
 return name.includes('داني')&&name.includes('موسى')&&(dob==='19740101'||String(p?.register_no||'')==='245'||(!dob&&!p?.register_no));
}
async function loadPrivateAtlas(){
 const wrapper=$('#familyStandalone');if(!wrapper)return;
 let slot=$('#privateAtlasSlot');
 if(!slot){const container=wrapper.querySelector('#jevSourceAudit .inside')||wrapper;container.insertAdjacentHTML('afterbegin','<div class="card" id="privateAtlasSlot"><div class="section-kicker">Independent private family research</div><div class="loading">Loading the separately audited family source…</div></div>');slot=$('#privateAtlasSlot')}
 try{if(!privateAtlasCache)privateAtlasCache=await api('/reality-api/private-family-atlas');if(window.JEV){if(wrapper.querySelector('.jev-shell'))window.JEV.setAtlas(wrapper,privateAtlasCache);else{window.JEV.mount(wrapper,{person:{person_id:current,display_name_ar:currentLabel},family:{}},{atlas:privateAtlasCache,onOpen:(id)=>{pushView('JEV focus');openPerson(id)}});wrapper.querySelector('[data-mode="research"]')?.click()}}renderPrivateAtlas()}catch(e){slot.innerHTML='<div class="card"><div class="notice error">Private family research source unavailable: '+esc(e.message)+'</div></div>'}
}
function renderPrivateAtlas(){
 const d=privateAtlasCache,slot=$('#privateAtlasSlot');if(!slot||!d)return;
 const persons=d.persons||[],links=d.edges||[],homes=d.households||[];
 const map=new Map(persons.map(x=>[String(x.id),x]));
 const selected=map.get(String(privateAtlasSelected))||map.get('dany')||persons[0];
 if(!selected)return;
 privateAtlasSelected=String(selected.id);
 const related=links.filter(e=>String(e.f)===privateAtlasSelected||String(e.t)===privateAtlasSelected);
 const linkCard=e=>{
   const other=String(e.f)===privateAtlasSelected?e.t:e.f,q=map.get(String(other));
   const state=String(e.status||'LEAD_ONLY'),uncertain=!['DOCUMENTED_AS_STATED'].includes(state);
   return '<div class="candidate" style="border-left:4px solid '+(uncertain?'#bd894d':'#51b9c5')+'"><div class="tiny">'+esc(e.k||'relationship')+' · '+esc(state.replaceAll('_',' '))+'</div>'+
    '<b>'+esc(q?.n||other||'Unresolved')+'</b>'+
    '<div class="actions"><button type="button" class="action alt" data-atlas-node="'+esc(String(other))+'">Explore branch →</button></div></div>';
 };
 const status=String(selected.status||'RESEARCH_LABEL');
 const meta=[selected.b,selected.rel,selected.role].filter(Boolean).map(esc).join(' · ');
 const peopleList=persons.map(p=>'<button class="action alt" style="margin:4px;max-width:100%;white-space:normal;text-align:left" data-atlas-node="'+esc(String(p.id))+'">'+esc(p.n||p.id)+'</button>').join('');
 slot.innerHTML='<div class="section-kicker">Private Moussa–Shbaro Family Atlas · separate research source</div>'+
 '<div class="title">Explore family connections</div><div class="notice warn">These research assertions were documented privately, but they have NOT all been promoted into the canonical civil graph. Blue shows documented-as-stated; amber marks unverified, disputed or candidate links. No source phone or vehicle entries exist in this Atlas.</div>'+
 '<div class="metrics"><div class="metric"><b>'+Number(d.counts?.people||persons.length)+'</b><span>person entries</span></div><div class="metric"><b>'+Number(d.counts?.households||homes.length)+'</b><span>households</span></div><div class="metric"><b>'+Number(d.counts?.edges||links.length)+'</b><span>research relationships</span></div><div class="metric"><b>'+Number(d.counts?.issues||0)+'</b><span>open issues</span></div></div>'+
 '<div class="card"><div class="section-kicker">Selected research person</div><div class="title">'+esc(selected.n||selected.id)+'</div><div class="tiny">'+esc(meta||status)+'</div><div class="muted">'+esc(status.replaceAll('_',' '))+'</div><div class="actions">'+
 '<button type="button" class="action alt" data-atlas-node="dany">Return to Danny</button>'+
 '<button type="button" class="action" data-atlas-search="'+esc(selected.n||'')+'">Check canonical identity →</button></div></div>'+
 '<div class="section-kicker">Related branches · '+related.length+'</div>'+
 (related.length?related.map(linkCard).join(''):'<div class="notice">No direct link in this research snapshot. This is not proof of no family relationship.</div>')+
 '<details class="secondary-results"><summary>Browse all '+persons.length+' research people</summary><div class="inside">'+peopleList+'</div></details>'+
 '<details class="secondary-results"><summary>Browse '+homes.length+' research households</summary><div class="inside">'+homes.map(h=>'<div class="candidate"><b>'+esc(h.name||h.id)+'</b><div class="tiny">'+esc([h.partner,h.notes].filter(Boolean).join(' · ').slice(0,160))+'</div></div>').join('')+'</div></details>';
}
document.addEventListener('click',e=>{
 const node=e.target.closest('[data-atlas-node]');
 if(node){privateAtlasSelected=node.dataset.atlasNode;renderPrivateAtlas();return}
 const search=e.target.closest('[data-atlas-search]');
 if(search){pushView('private family atlas before canonical identity investigation');investigate(search.dataset.atlasSearch);return}
});
function recoveredSiblingHtml(rs){const p=rs.person||{},shift=!!rs.register_shift_signal;return '<div class="personbox '+(shift?'register-shift ':'')+(p.person_id?'clickable':'')+'"'+(p.person_id?' data-person="'+Number(p.person_id)+'"':'')+'><span class="relation-tag">'+esc(shift?'Register-shift sibling candidate':'Sibling candidate')+'</span><b>'+esc(p.display_name_ar||'Candidate sibling')+'</b><div class="tiny">'+esc([p.birth_year||String(p.birth_date||'').slice(0,4),p.register_no?'Sejel '+p.register_no:'',p.region_no?civilRegionLabel(p):''].filter(Boolean).join(' · '))+'</div><div class="soft-note">'+esc((rs.reason||[]).join(' · '))+'</div></div>'}
function recoveredChildHtml(rc){const p=rc.person||{},shift=!!rc.register_shift_signal;return '<div class="personbox '+(shift?'register-shift ':'')+(p.person_id?'clickable':'')+'"'+(p.person_id?' data-person="'+Number(p.person_id)+'"':'')+'><span class="relation-tag">'+esc(shift?'Register-shift child candidate':'Child candidate')+'</span><b>'+esc(p.display_name_ar||'Candidate child')+'</b><div class="tiny">'+esc([p.birth_year||String(p.birth_date||'').slice(0,4),p.register_no?'Sejel '+p.register_no:'',p.region_no?civilRegionLabel(p):''].filter(Boolean).join(' · '))+'</div><div class="soft-note">'+esc((rc.reason||[]).join(' · '))+'</div></div>'}
function renderFamilyInto(d,el){if(!el)return;currentDossier=d;const f=d.family||{},origin=(f.origin_households||[])[0],marital=f.marital_households||[],siblings=(origin?.children||[]).filter(x=>Number(x.child_person_id)!==Number(d.person.person_id)),recovered=f.recovered_siblings||[],recoveredChildren=f.recovered_children||[],down=collectDescendants(f.descendants||[],familyDepth);let html='<div class="familytree">';
html+=ancestorGenerationHtml(f.ancestry||{},1);html+='<div class="family-branch-panels">'+lineageBranchPanel(f.ancestry||{},'father',familyDepth)+lineageBranchPanel(f.ancestry||{},'mother',familyDepth)+'</div>';
html+='<div class="family-connector"><span></span></div><div class="family-generation family-origin"><h4>Origin family · same generation</h4><div class="soft-note">The highlighted card is the current subject. Solid sibling cards come from the promoted origin union; amber cards are recovered across parent-signature / Sejel-transition evidence.</div><div class="generation-row">'+siblings.map(x=>familyBox({...x,person_id:x.child_person_id},'known-sibling','Sibling')).join('')+familyBox(d.person,'subjectbox','Subject')+recovered.map(recoveredSiblingHtml).join('')+'</div></div>';
if(marital.length){html+='<div class="family-connector"><span></span></div><div class="family-generation family-adult"><h4>Post-marital / adult household</h4>';for(const u of marital){const others=(u.parents||[]).filter(x=>Number(x.parent_person_id)!==Number(d.person.person_id)).map(x=>({person_id:x.parent_person_id,display_name_ar:x.display_name_ar||[x.label_first,x.label_family].filter(Boolean).join(' '),birth_year:x.birth_year,register_no:x.register_no,region_no:x.region_no}));html+='<div class="lineage-card"><div class="lineage-label">Union</div><div class="couple-grid">'+familyBox(d.person,'subjectbox','Subject')+(others.length?others.map(x=>familyBox(x,'','Spouse / co-parent')).join(''):'<div class="personbox unresolvedbox"><span class="relation-tag">Spouse / co-parent</span><b>Unresolved</b></div>')+'</div></div>'}html+='</div>'}
if(recoveredChildren.length)html+='<div class="family-connector candidate-line"><span></span></div><div class="family-generation family-recovered-children"><h4>Recovered child candidates · parent signature / Sejel transition</h4><div class="notice">These people match the same father + mother + natal-family signature but sit in a different Sejel/region or household. This is a recovery signal, not automatic proof of marriage. A separate promoted adult household strengthens the transition clue.</div><div class="sibling-grid">'+recoveredChildren.map(recoveredChildHtml).join('')+'</div></div>';
for(const g of down){html+='<div class="family-connector"><span></span></div><div class="family-generation family-descendants"><h4>Generation +'+g.depth+' · Descendants</h4><div class="sibling-grid">'+g.row.map(x=>familyBox(x,'','Descendant')).join('')+'</div></div>'}
html+='</div><div class="family-controls"><button class="action" data-family-expand="1">Explore 2 more generations</button><button class="action alt" data-family-collapse="1">Collapse to 3 generations</button><button class="action alt" data-family-pdf="1">PDF / Share tree</button></div><div class="soft-note">Current search depth: '+familyDepth+'. Expand unresolved branches increases both ancestry and descendant depth and reruns register-transition recovery. A larger depth only counts as success when new defensible people are found.</div>'+item('Origin / pre-marital household',origin?'Resolved union · '+(origin.child_count||0)+' promoted child record(s) · confidence '+origin.confidence:'Unresolved - active gap')+item('Recovered sibling candidates',recovered.length?recovered.length+' candidate(s) from normalized parent signature + age plausibility':'None surfaced')+item('Recovered child candidates',recoveredChildren.length?recoveredChildren.length+' candidate(s) across Sejel/region transitions':'None surfaced')+item('Post-marital household',marital.length?marital.length+' resolved family union(s)':'Unresolved - active gap, not “none”');
el.innerHTML=html}

function renderAssetsInto(d,el){if(!el)return;currentDossier=d;const ev=d.evidence||{},q=(ev.phones||[]).filter(x=>x.state==='QUARANTINED'),vehicles=ev.vehicles||[],addresses=ev.addresses||[];el.innerHTML=householdPhonesHtml(d)+'<div class="card"><div class="section-kicker">Vehicle intelligence</div>'+(vehicles.length?vehicles.map(v=>'<div class="candidate"><b>'+esc([v.prod_date,v.make,v.model].filter(Boolean).join(' '))+'</b><div class="muted">'+esc([v.plate&&('Plate '+v.plate),v.acquisition_date&&('Observed acquisition '+v.acquisition_date),v.registration_no&&('Register '+v.registration_no),v.state,v.ownership_temporality].filter(Boolean).join(' · '))+'</div></div>').join(''):'<div class="muted">No connected vehicle observations.</div>')+'</div><div class="card"><div class="section-kicker">Address intelligence</div><div class="soft-note">Colors separate household/contact, vehicle-registration, property-record, business, document, Review brokerage and candidate locations.</div>'+addresses.map(addressCard).join('')+'</div>'+(q.length?'<details><summary>Quarantined phone artifacts · '+q.length+'</summary><div class="inside">'+q.map(x=>item(x.raw,x.shape)).join('')+'</div></details>':'')}
function cancelDossierLoad(){dossierEpoch++;dossierPromise=null;dossierPromisePerson=null}
async function ensureCurrentDossier(){if(currentDossier&&Number(currentDossier.person?.person_id)===Number(current))return currentDossier;if(!current)return null;if(dossierPromise&&Number(dossierPromisePerson)===Number(current))return await dossierPromise;const pid=current,epoch=++dossierEpoch,p=api('/reality-api/dossier/'+pid,{refresh:'false',include_web:'false'});dossierPromise=p;dossierPromisePerson=pid;try{const d=await p;if(epoch===dossierEpoch&&Number(current)===Number(pid)){currentDossier=d;updateCivilSubject(d)}return d}finally{if(epoch===dossierEpoch){dossierPromise=null;dossierPromisePerson=null}}}
function beginDossierLoad(pid,refresh=false){const epoch=++dossierEpoch,p=api('/reality-api/dossier/'+pid,{refresh:refresh?'true':'false',include_web:'false'});dossierPromise=p;dossierPromisePerson=Number(pid);p.then(d=>{if(epoch!==dossierEpoch||Number(current)!==Number(pid))return d;currentDossier=d;updateCivilSubject(d);if(activeLane==='overview')renderDossier(d);return d}).catch(e=>{if(epoch===dossierEpoch&&Number(current)===Number(pid)){setResult('Private dossier incomplete',currentLabel);content.innerHTML='<div class=\"notice error\">'+esc(e.message)+'</div>'}}).finally(()=>{if(epoch===dossierEpoch){dossierPromise=null;dossierPromisePerson=null}});return p}
function candidateRefinementIntent(q){if(!candidateContext?.rows?.length)return false;const s=String(q||'').trim().toLowerCase();if(!s)return false;if(/\b(new subject|new search|start over|reset)\b/.test(s))return false;return /\b(which|one|has|have|had|with|without|father|mother|born|birth|age|sejel|register|phone|mobile|number|car|vehicle|porsche|bmw|mercedes|toyota|audi|range rover|land rover|ferrari|cadillac|address|property|lot|owner|owns|from|lives|living)\b/.test(s)||/^\d{4}$/.test(s)}
async function loadCandidateDossiers(rows){const out=[];for(let i=0;i<rows.length;i+=4){const batch=rows.slice(i,i+4);const got=await Promise.all(batch.map(async c=>{try{return{c,d:await api('/reality-api/dossier/'+c.person_id,{refresh:'false',include_web:'false'})}}catch(e){return{c,d:null,error:e.message}}}));out.push(...got)}return out}
function digitsOnly(v){return String(v||'').replace(/\D/g,'')}
async function refineCandidateContext(q){const original=candidateContext,rows=[...(original?.rows||[])];if(!rows.length)return false;pushView('candidate set before refinement');setResult('Refining the current candidate set…',q);setActions();content.innerHTML='<div class="loading">Testing this clue against the existing candidates. I am not starting a new name search.</div>';const low=String(q).toLowerCase();let matched=[],reason='';
const year=(low.match(/\b(19\d{2}|20\d{2})\b/)||[])[1];if(year&&( /born|birth|year|age/.test(low)||/^\d{4}$/.test(low))){matched=rows.filter(x=>String(x.birth_year||String(x.birth_date||'').slice(0,4))===year);reason='birth year '+year}
if(!matched.length){const sm=(low.match(/\bsejel\s*#?\s*([\w/-]+)/i)||low.match(/\bregister\s*#?\s*([\w/-]+)/i));if(sm){matched=rows.filter(x=>String(x.register_no||'').toLowerCase()===sm[1].toLowerCase());reason='Sejel/register '+sm[1]}}
if(!matched.length){const fm=String(q).match(/\bfather(?:\s+is)?\s+([A-Za-zÀ-ÿ'’-]+|[\u0600-\u06ff]+)/i);if(fm&&original.query){const toks=String(original.query).trim().split(/\s+/);if(toks.length>=2){try{const rr=await api('/graph-api/resolve',{q:[toks[0],fm[1],toks[toks.length-1]].join(' '),limit:40});const ids=new Set((rr.candidates||[]).map(x=>Number(x.person_id)));matched=rows.filter(x=>ids.has(Number(x.person_id)));reason='father clue '+fm[1]}catch{}}}}
const phone=digitsOnly(q);const vehicleAliases={porsche:['porsche','porshe'],bmw:['bmw'],mercedes:['mercedes','مرسيدس'],toyota:['toyota','تويوتا'],audi:['audi'],ferrari:['ferrari'],cadillac:['cadillac'],lexus:['lexus'],nissan:['nissan','نيسان'],renault:['renault','رونو'],peugeot:['peugeot','بيجو'],volkswagen:['volkswagen','vw'],ford:['ford'],chevrolet:['chevrolet'],kia:['kia'],hyundai:['hyundai'],['range rover']:['range rover'],['land rover']:['land rover','لاند روفر']};const vehicleWord=Object.keys(vehicleAliases).find(x=>low.includes(x));const needsEvidence=!matched.length&&(vehicleWord||(/\b(phone|mobile|number)\b/.test(low)&&phone.length>=7)||/\b(address|property|lot|owner|owns|car|vehicle)\b/.test(low));
if(needsEvidence&&vehicleWord){try{const vr=await api('/graph-api/refine/vehicle',{person_ids:rows.map(x=>x.person_id).join(','),q});const ids=new Set((vr.matches||[]).map(x=>Number(x.person?.person_id)));matched=rows.filter(x=>ids.has(Number(x.person_id)));reason=(matched.length?'vehicle registry corroboration · ':'no vehicle registry corroboration · ')+q}catch(e){reason='vehicle registry refinement unavailable · '+e.message}}
if(needsEvidence&&!vehicleWord){const ds=await loadCandidateDossiers(rows);for(const x of ds){if(!x.d)continue;let ok=false;if(phone.length>=7){const p7=phone.slice(-7);ok=(x.d.household_phone_directory||[]).some(p=>digitsOnly(p.phone).endsWith(p7));reason='phone evidence '+phone}else{const stop=new Set(['which','one','has','have','had','with','without','the','this','that','car','vehicle','property','owner','owns','address','lot','show','me','who']);const terms=low.split(/[^a-z0-9\u0600-\u06ff]+/).filter(x=>x.length>=3&&!stop.has(x));const hay=JSON.stringify({addresses:x.d.evidence?.addresses||[],review:x.d.evidence?.review_records||[],phones:x.d.household_phone_directory||[]}).toLowerCase();ok=terms.length&&terms.every(t=>hay.includes(t));reason=terms.length?'connected evidence matches '+terms.join(', '):'connected evidence'}if(ok)matched.push(x.c)}}
if(!matched.length){candidateContext=original;setResult('No candidate is corroborated by that clue','The current candidate set is preserved. Give me another clue or go back.');setActions();content.innerHTML='<div class="card"><div class="notice">I tested <b>'+esc(q)+'</b> against the current '+rows.length+' candidates and did not find a defensible match. I did not switch to unrelated names.</div><details><summary>Keep the original candidates · '+rows.length+'</summary><div class="inside">'+rows.slice(0,12).map(candidateCard).join('')+'</div></details></div>';return true}
candidateContext={query:original.query,rows:matched,createdAt:Date.now(),refinement:q};renderCandidates(matched,'Refined from the existing candidate set · '+reason);candidateContext.query=original.query;candidateContext.refinement=q;setResult(matched.length===1?'One candidate matches your added clue':matched.length+' candidates match your added clue',reason);return true}


function directPhoneCount(d){const pid=Number(d.person?.person_id||current);return normalizedPhoneGroups(d.household_phone_directory||[]).filter(x=>phoneIsSelf(x,pid)).length}
function evidenceCounts(d){const ev=d.evidence||{};return{phones:directPhoneCount(d),householdPhones:normalizedPhoneGroups(d.household_phone_directory||[]).length,vehicles:(ev.vehicles||[]).length,addresses:classifiedAddresses(ev.addresses||[]).length,addressArtifacts:addressArtifacts(ev.addresses||[]).length,review:(ev.review_records||[]).length,documents:(ev.documents||[]).length}}
function discoveryRadarHtml(d){const f=d.family||{},ev=d.evidence||{},c=evidenceCounts(d),rec=f.recovered_siblings||[],mar=f.marital_households||[],web=(d.public_web?.results||[]);const leads=[];if(rec.length)leads.push({p:'HIGH',t:rec.length+' register-shift sibling candidate'+(rec.length>1?'s':''),s:'Parent signature + age plausibility surfaced a branch worth reviewing.',lane:'family'});if(!mar.length)leads.push({p:'HIGH',t:'Post-marital household unresolved',s:'Do not infer none; search spouse/co-parent, children and register transitions.',lane:'family'});if(!c.phones)leads.push({p:'MEDIUM',t:'No direct phone confirmed',s:'Household numbers may exist, but none is promoted as this person’s direct number.',lane:'phones'});if(!web.length)leads.push({p:'MEDIUM',t:'Deep Research not run',s:'Public evidence is still an unexplored branch for this dossier.',lane:'web'});if(c.review)leads.push({p:'INFO',t:c.review+' Review.Properties record'+(c.review>1?'s':''),s:'Brokerage evidence exists and remains separate from ownership/residence.',lane:'property'});if(!c.documents)leads.push({p:'INFO',t:'No directly connected documents',s:'Document linkage remains an active evidence gap, not proof of absence.',lane:'documents'});return '<div class="card radar-card"><div class="row"><div><div class="section-kicker">Discovery radar</div><div class="title">Best next leads</div></div>'+badge(leads.length+' open lead'+(leads.length===1?'':'s'))+'</div><div class="soft-note">Prioritized unresolved branches and evidence opportunities. This is an exploration guide, not a certainty score.</div><div class="radar-list">'+leads.slice(0,5).map(x=>'<button class="radar-item" data-lane="'+x.lane+'"><span class="radar-priority '+x.p.toLowerCase()+'">'+x.p+'</span><span><b>'+esc(x.t)+'</b><small>'+esc(x.s)+'</small></span><span class="chev">›</span></button>').join('')+'</div></div>'}
function civilHistoryHtml(d){
 const h=d.civil_registry_history;
 if(!h)return '<div class="card"><div class="section-kicker">Civil register reconciliation</div><div class="muted">Reference data not yet loaded.</div></div>';
 const c=h.historical_civil_classification||{},g=h.governorate||{},old=h.legacy_2005||{};
 const type=(h.status||'HOLD').replaceAll('_',' ');
 const s=old.status||'HOLD';
 let lines=[];
 if(g.name_ar)lines.push(item('Governorate / المحافظة',g.name_ar+' · 2012 source lookup'));
 if(c.label&&c.status==='RECORDED_2012_REFERENCE_ONLY')
   lines.push(item('2012 registered classification',c.label+' · historical civil entry; not a claim about current personal belief'));
 else lines.push(item('2012 registered classification','Unresolved code or conflicting source entries'));
 if(s==='PASS_STRICT_HISTORICAL_2005_MATCH'){
   lines.push(item('2005 sex as recorded',old.recorded_sex||'Unresolved source value'));
   lines.push(item('2005 source link','Exact name + father + register + birth + governorate; unique historical match'));
 }else lines.push(item('2005 cross-register link','Not yet verified · '+s.replaceAll('_',' ')));
 const rr=h.registry_reference_fields||{};
 const joined=xs=>(Array.isArray(xs)&&xs.length?xs.join(' · '):'Unresolved');
 lines.push(item('2012 original classification code(s)',joined(rr['2012_classification_codes'])));
 lines.push(item('2012 original register descriptions',joined(rr['2012_classification_descriptions'])+' · historical source'));
 lines.push(item('2012 TAIFA code(s) in fine dictionary',joined(rr['2012_taifa_codes_from_fine_table'])));
 lines.push(item('TAIFA reference relationship',String(rr.taifa_relationship_status||'UNRESOLVED')));
 const cc=rr.exact_label_coarse_candidates||[];
 if(cc.length)lines.push(item('67-entry TAIFA candidate(s)',cc.map(x=>'code '+x.code+' · '+x.label).join(' | ')+' · matching written labels; not a verified key'));
 lines.push(item('2012 registered birthplace',joined(rr['2012_birthplace_ar'])));
 lines.push(item('2012 source register number(s)',joined(rr['2012_register_numbers'])));
 const oldr=rr['2005_recorded_source_fields']||null;
 if(oldr){
  lines.push(item('2005 source sex',oldr.recorded_sex||'Unresolved'));
  lines.push(item('2005 source classification field',oldr.recorded_dine||'Unresolved'));
  lines.push(item('2005 registered governorate / caza / town',[oldr.governorate,oldr.caza,oldr.town].filter(Boolean).join(' · ')));
  lines.push(item('2005 historical register',oldr.register_no||'Unresolved'));
 }else lines.push(item('Older register details','No unambiguous 2005 source match'));
 lines.push(item('Electoral rolls','Electoral voting location is not established by civil register alone'));
 const keys=Object.keys(h.disagreements||{});
 if(keys.length)lines.push(item('Conflicting fields',keys.join(', ')+' · held for evidence review'));
 const gap=Object.keys(h.candidate_gap_fills||{});
 if(gap.length)lines.push(item('Candidate missing-field recovery',gap.join(', ')+' · NOT automatically promoted'));
 return '<div class="card"><div class="section-kicker">Civil register reconciliation · سجلات</div>'+
 '<div class="row"><div class="title">Consolidated source evidence</div>'+badge(esc(type),keys.length?'warn':'good')+'</div>'+
 '<div class="soft-note">Older and newer entries are retained separately; historical classification is never used to infer kinship or personal beliefs.</div>'+
 lines.join('')+
 '<div class="soft-note">2012 matched source row(s): '+esc(h['2012_observations']??0)+' · Source references preserved, no original سجل overwritten.</div></div>';
}

function registryOverviewHtml(d){
 const h=d.civil_registry_history||{},p=d.person||{},r=h.registry_reference_fields||{};
 const labels=r['2012_classification_descriptions']||[];
 const group=r['exact_label_coarse_candidates']||[];
 const old=r['2005_recorded_source_fields']||null;
 const label=labels.length===1?labels[0]:(labels.length?'Historical source conflict':'Not resolved');
 const locality=old?[old.governorate,old.caza,old.town].filter(Boolean).join(' · '):(h.governorate?.name_ar||'Unresolved');
 const years=h.source_years||[];
 return '<div class="card registry-brief"><div class="row"><div><div class="section-kicker">Civil record at a glance</div><div class="title">السجل · Source-backed identity</div></div>'+badge('2012'+(old?' + 2005':''),'good')+'</div>'+
 '<div class="identity-grid">'+
 item('DOB · سجل',[(p.birth_date||p.birth_year||'Unresolved'),p.register_no?'#'+p.register_no:''].filter(Boolean).join(' · '))+
 item('Father / Mother',[p.father||'—',[p.mother_first,p.mother_last].filter(Boolean).join(' ')].join(' / '))+
 item('Historical registered classification',label+' · 2012 source')+
 item('Registration locality',locality||'Unresolved')+
 '</div><div class="soft-note">Historical registration is not a statement of current faith, residence or voting choice. Original numerical codes remain available below.</div>'+
 '<details class="registry-details"><summary>Full source audit · religion, طائفة, sex, codes, geography</summary><div class="inside">'+civilHistoryHtml(d)+'</div></details></div>';
}
function snapshotHtml(d){
 const ev=d.evidence||{},f=d.family||{},c=evidenceCounts(d);
 const origin=(f.origin_households||[])[0],rec=f.recovered_siblings||[];
 const siblings=Math.max(0,Number(origin?.child_count||0)-1),leads=rec.length;
 const research=(d.public_web?.results||[]).length;
 const phoneGroups=normalizedPhoneGroups(d.household_phone_directory||[]);
 const pid=Number(d.person?.person_id||current);
 const shared=phoneGroups.filter(x=>phoneIsSelf(x,pid)&&x.shared).length;
 const overview='<div class="card command-card"><div class="row"><div><div class="section-kicker">Investigation overview</div><div class="title">Identity, connections & evidence</div></div>'+badge('SOURCE-TRACKED','good')+'</div>'+
 '<div class="metrics snapshot-metrics">'+
 '<div class="metric"><b>'+fmt(siblings)+'</b><span>registered sibling records</span></div>'+
 '<div class="metric"><b>'+fmt(leads)+'</b><span>sibling leads to review</span></div>'+
 '<div class="metric"><b>'+fmt(c.phones)+'</b><span>canonical direct phone links</span></div>'+
 '<div class="metric" data-overview-other-phones><b>…</b><span>additional historical / candidate contacts</span></div>'+
 '<div class="metric"><b>'+fmt(c.vehicles)+'</b><span>historic vehicle observations</span></div>'+
 '<div class="metric"><b>'+fmt(c.addresses)+'</b><span>address observations</span></div>'+
 '</div><div class="soft-note">Evidence counts are not proof of current ownership, current phone use or blood relationship.</div></div>';
 const priority='<div class="card"><div class="section-kicker">Investigation priorities</div><div class="row"><b>'+leads+' sibling lead(s) · '+(f.marital_households||[]).length+' adult household(s)</b>'+badge(research?'PUBLIC EVIDENCE':'WEB NOT RUN','warn')+'</div>'+
 '<div class="quick-grid"><button data-lane="family">Explore family<span>Parents and sibling candidates</span></button>'+
 '<button data-lane="phones">Contact evidence<span>Source-linked phone candidates</span></button>'+
 '<button data-lane="web">Research<span>Public evidence, separately sourced</span></button>'+
 '<button data-lane="report">Full report<span>Export complete dossier</span></button></div></div>';
 const extra='<details class="secondary-results"><summary>Other investigation leads and civil-status interpretation</summary><div class="inside">'+discoveryRadarHtml(d)+civilStatusSignalHtml(d)+'</div></details>';
 const contact='<details class="secondary-results"><summary>Phone details · '+c.phones+' unique person-linked leads'+(shared?' · '+shared+' shared':'')+'</summary><div class="inside">'+subjectPhonesHtml(d)+'</div></details>';
 const advanced='<details class="secondary-results"><summary>Advanced tools · Y-Graph, symbolic insights and relationship finder</summary><div class="inside"><div class="quick-grid">'+
 '<button data-lane="relationship">Relationship finder<span>Source-backed paths</span></button>'+
 '<button data-lane="graph">Y-Graph<span>Network and family</span></button>'+
 '<button data-lane="character">Symbolic insights<span>Non-evidentiary only</span></button>'+
 '</div></div></details>';
 return overview+registryOverviewHtml(d)+priority+contact+extra+advanced;
}

function evidenceCenterHtml(d){const ev=d.evidence||{},c=evidenceCounts(d),phones=d.household_phone_directory||[],vv=ev.vehicles||[],aa=classifiedAddresses(ev.addresses||[]);return '<div class="card"><div class="row"><div><div class="section-kicker">Evidence center</div><div class="title">Connected evidence</div></div>'+badge('SOURCE-SEPARATED','good')+'</div><div class="metrics"><div class="metric"><b>'+fmt(c.phones)+'</b><span>canonical direct phone links</span></div><div class="metric"><b>'+fmt(c.householdPhones)+'</b><span>household numbers</span></div><div class="metric"><b>'+fmt(c.vehicles)+'</b><span>vehicles</span></div><div class="metric"><b>'+fmt(c.addresses)+'</b><span>addresses</span></div><div class="metric"><b>'+fmt(c.review)+'</b><span>Review records</span></div><div class="metric"><b>'+fmt(c.documents)+'</b><span>documents</span></div></div><div class="quick-grid evidence-grid"><button data-lane="phones">Phones<span>Direct first, household separate</span></button><button data-lane="vehicles">Vehicles<span>Historical observations</span></button><button data-lane="addresses">Addresses<span>Classified by evidence type</span></button><button data-lane="property">Property / Review<span>Ownership ≠ brokerage</span></button><button data-lane="documents">Documents<span>Connected documentary evidence</span></button><button data-lane="graph">Y-Graph<span>See evidence relationships</span></button></div></div>'+(phones.length?'<div class="card"><div class="section-kicker">Contact preview</div>'+phones.slice(0,3).map(x=>item(x.phone,(x.people||[]).map(p=>[p.name,p.role].filter(Boolean).join(' · ')).join(' | '))).join('')+(phones.length>3?'<button class="inline-link" data-lane="phones">See all phone evidence →</button>':'')+'</div>':'')+(vv.length?'<div class="card"><div class="section-kicker">Vehicle preview</div>'+vv.slice(0,3).map(v=>item([v.prod_date,v.make,v.model].filter(Boolean).join(' '),[v.plate,v.acquisition_date&&('Observed '+v.acquisition_date),v.ownership_temporality].filter(Boolean).join(' · '))).join('')+(vv.length>3?'<button class="inline-link" data-lane="vehicles">See all vehicles →</button>':'')+'</div>':'')+(aa.length?'<div class="card"><div class="section-kicker">Address preview</div>'+aa.slice(0,3).map(addressCard).join('')+(aa.length>3?'<button class="inline-link" data-lane="addresses">See all address evidence →</button>':'')+'</div>':'')}
function researchCenterHtml(d){const web=d.public_web||{},has=(web.results||[]).length,ran=has||(web.runs||[]).length||(web.failures||[]).length||web.status||web.completed_at;const label=has?'CAPTURED':ran?'RUN COMPLETE':'NOT RUN';return '<div class="card"><div class="row"><div><div class="section-kicker">Deep Research</div><div class="title">Public intelligence brief</div></div>'+badge(label,has?'good':ran?'':'warn')+'</div><div class="soft-note">Exact identity, professional, business, real estate, news and public-social arms. Public evidence never auto-merges into the private canonical identity.</div>'+(!has?'<div class="actions"><button class="action" data-run-web="1">'+(ran?'Retry Deep Research':'Run Deep Research')+'</button></div>':'')+'</div><div id="personWebSlot">'+webGroupedHtml(web)+'</div>'}
function renderDossier(d){currentDossier=d;showSubject(d.person||{person_id:current,display_name_ar:currentLabel});currentDossier=d;updateCivilSubject(d);setResult('Investigation workspace',currentLabel+' · choose a direction or add another clue');setActions(portalNavHtml());content.innerHTML=snapshotHtml(d);setActiveLane('overview');void loadR2OverviewContactEvidence(Number(current))}
async function buildDossier(refresh=false){if(!current)return;setResult('Building dossier…',currentLabel);content.innerHTML='<div class="loading">Connecting family, phones, vehicles, addresses, property, documents and interpretation…</div>';const d=await api('/reality-api/dossier/'+current,{refresh:refresh?'true':'false',include_web:'false'});renderDossier(d);return d}

function setActiveLane(view){activeLane=view;for(const b of document.querySelectorAll('[data-lane]'))b.classList.toggle('primary',b.dataset.lane===view)}

function relationshipFinderHtml(){return '<div class="card command-card"><div class="section-kicker">Relationship Finder</div><div class="title">How is '+esc(currentLabel)+' connected?</div><div class="soft-note">Enter another person. SAMERAI checks the historical Sejil, natal family and marriage-linked household. Every failed or ambiguous test remains in the repair queue.</div><div class="relationship-composer"><input id="relationshipTarget" autocomplete="off" placeholder="Name of the other person"><button class="action" data-rel-run="1">Find connection</button><button class="action alt" data-rel-queue="1">Unresolved cases</button></div></div><div id="relationshipResult"><div class="card"><div class="muted">Examples: “Ziad Zakka”, “Tareq Saad”, or a full Arabic name. Ambiguous targets stay candidates until you choose one.</div></div></div>'}

function relationshipPathHtml(ans,targetLabel=''){
 const p=ans?.route||[],rels=ans?.edges||[],c=ans?.case||{};
 if(!p.length)return '<div class="card"><div class="notice warn">No evidence-backed relationship path was found within this search. This is an open research case, not evidence that these people are unrelated.</div>'+item('Saved case',c.case_key||'Not recorded')+item('Next investigation',c.next_action||'Reconcile identities, parental labels and historical Sejil')+'</div>';
 const status=String(ans.result||''),isOpen=(ans.candidate_bridges||0)>0;
 let h='<div class="card"><div class="row"><div><div class="section-kicker">Evidence-aware Relationship Finder</div><div class="title">'+esc(currentLabel)+' ↔ '+esc(targetLabel||p[p.length-1]?.person?.display_name_ar||'target')+'</div></div>'+badge((ans.hops||0)+' links',isOpen?'warn':'good')+'</div>';
 h+='<div class="soft-note">'+(isOpen?'Relationship path recovered with '+esc(ans.candidate_bridges)+' uncorroborated candidate bridge(s). Evidence review stays open.':'Family relationship path recovered using promoted and corroborated derived edges. No birth, marriage or divorce certificate is claimed.')+'</div>';
 if(ans.interpretation?.summary)h+='<div class="notice">'+esc(ans.interpretation.summary)+'</div>';
 h+='<div class="relationship-path">';
 for(let i=0;i<p.length;i++){
    const n=p[i]||{},person=n.person||{},edge=rels[i-1]||{},kind=String(edge.kind||''),reason=kind==='PROMOTED_PARENT_EDGE'?(edge.parent_role||'Parent/child'):(kind==='DERIVED_FULL_SIBLING_FROM_PROMOTED_PARENTS'?'Siblings · shared promoted parents':kind==='DERIVED_SIBLING_FROM_CONCORDANT_MATERNAL_WITNESSES'?'Siblings · '+(edge.witness_count||'multiple')+' matching maternal records':kind==='DERIVED_SIBLING_WITH_MARITAL_REGISTER_CORROBORATION'?'Siblings · natal parents and marital-register household':'Same recorded parents · verification queued');
    if(i>0)h+='<div class="relationship-edge"><span>'+esc(reason)+'</span><small>'+esc(edge.evidence_state||'CANDIDATE')+'</small></div>';
    h+='<button class="relationship-node" data-person="'+Number(n.id)+'"><span class="relation-tag">'+esc(i===0?'Start':i===p.length-1?'Target':'Link '+i)+'</span><b>'+esc(person.display_name_ar||n.id)+'</b></button>';
 }
 h+='</div><div class="tiny">Source: canonical Lebanon Identity Graph + derived register evidence · '+esc(status.replaceAll('_',' '))+' · no canonical merge</div>';
 if(c.case_key)h+=item('Persistent test record',c.case_key+' · '+(c.state||'')+' · attempts '+(c.attempts||1));
 return h+'</div>';
}
async function openRelationshipQueue(){
 try{
   const z=await api('/reality-api/relationship-queue',{limit:35,open_only:'true'});
   const slot=$('#relationshipResult');
   if(slot)slot.innerHTML='<div class="card"><div class="row"><div class="title">Unresolved relationship test queue</div>'+badge((z.open_cases||0)+' open')+'</div><div class="soft-note">Cases persist on BOSSPC. An absent graph path is a missing evidence link, not proof of no family relation.</div>'+
     (z.cases||[]).map(x=>'<div class="candidate"><b>'+esc(x.target_label||x.target_query||x.target_person_id||'Unknown target')+'</b><div class="tiny">'+esc(x.case_key)+' · '+esc(x.state)+' · attempts '+fmt(x.attempts)+'</div><div class="muted">'+esc(x.next_action||'')+'</div></div>').join('')+'</div>';
 }catch(e){const slot=$('#relationshipResult');if(slot)slot.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
}
async function openRelationshipTarget(pid,label=''){
 if(!current)return;
 const slot=$('#relationshipResult');if(slot)slot.innerHTML='<div class="loading">Tracing canonical, natal and marital-register evidence...</div>';
 try{
    const ans=await api('/reality-api/relationship',{start:current,target:pid,max_hops:10});
    if(slot)slot.innerHTML=relationshipPathHtml(ans,label);
    setResult(ans.route?'Evidence-aware relationship found':'Relationship research case saved',
      ans.route?(currentLabel+' ↔ '+(label||ans.route.at(-1)?.person?.display_name_ar||pid)):'Not linked yet; added to persistent reconciliation queue');
 }catch(e){if(slot)slot.innerHTML='<div class="notice error">'+esc(e.message)+'</div>';setResult('Relationship search failed',e.message)}
}
async function runRelationshipFinder(){
 if(!current)return;
 const input=$('#relationshipTarget'),q=String(input?.value||'').trim();if(!q)return;
 const slot=$('#relationshipResult');if(slot)slot.innerHTML='<div class="loading">Searching composite names, father, mother and register evidence...</div>';
 try{
   const r=await api('/reality-api/relationship-targets',{q,start:current,limit:20}),rows=r.candidates||[];
   if(!rows.length){
      if(slot)slot.innerHTML='<div class="card"><div class="notice warn">No exact target was resolved; case saved for compound-name/Sejil reconciliation. This is not an unrelated-person conclusion.</div>'+item('Case ID',r.test_case?.case_key||'')+'</div>';return;
   }
   if(rows.length===1){await openRelationshipTarget(rows[0].person_id,rows[0].display_name_ar);return}
   if(slot)slot.innerHTML='<div class="card"><div class="section-kicker">Select exact person · '+rows.length+' candidates</div>'+
     '<div class="soft-note">Different first/father/family compositions are included. Choose the correct identity rather than merging namesakes.</div>'+
     rows.map(c=>'<div class="candidate"><b>'+esc(c.display_name_ar||c.person_id)+'</b><div class="muted">'+esc(personLine(c))+'</div>'+(c.relationship_rank>0?'<div class="soft-note"><b>Family path · '+esc(c.relation_hops||'?')+' connections</b> · '+esc(c.relation_evidence_status||'')+'</div>':'<div class="tiny">No evidenced path within search bounds; not proof of no relationship.</div>')+'<button class="action" data-rel-target="'+Number(c.person_id)+'" data-rel-label="'+esc(c.display_name_ar||('Person '+c.person_id))+'">Test this identity</button></div>').join('')+'</div>';
 }catch(e){if(slot)slot.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
}

function finalReportHtml(d){const p=d.person||{},ev=d.evidence||{},f=d.family||{},origin=(f.origin_households||[])[0],marital=f.marital_households||[],recovered=f.recovered_siblings||[],c=evidenceCounts(d),chars=d.interpretation?.character||{},web=d.public_web||{},bridged=(web.results||[]).filter(x=>(x.category||'')!=='POSSIBLE_NAMESAKE'),gaps=[];if(!marital.length)gaps.push('Post-marital household unresolved');if(!c.phones)gaps.push('No direct phone confirmed');if(!c.documents)gaps.push('No directly connected documents');if(!(web.results||[]).length)gaps.push('Deep Research not yet run');return '<div class="card report-cover"><div class="section-kicker">SAMERAI Reality · executive dossier</div><div class="title">'+esc(p.display_name_ar||currentLabel)+'</div><div class="muted">'+esc(personLine(p))+'</div><div class="trait-wrap">'+badge('IDENTITY INDEX','good')+badge('READ-ONLY CORE')+'</div></div><div class="card"><div class="section-kicker">Executive snapshot</div><div class="metrics"><div class="metric"><b>'+fmt((origin?.child_count||0)+recovered.length)+'</b><span>known/recovered siblings</span></div><div class="metric"><b>'+fmt(c.phones)+'</b><span>unique phone leads</span></div><div class="metric"><b>'+fmt(c.vehicles)+'</b><span>vehicles</span></div><div class="metric"><b>'+fmt(c.addresses)+'</b><span>addresses</span></div><div class="metric"><b>'+fmt(c.documents)+'</b><span>documents</span></div><div class="metric"><b>'+fmt(bridged.length)+'</b><span>public candidates</span></div></div></div>'+civilStatusSignalHtml(d)+'<div class="card"><div class="section-kicker">Family findings</div>'+item('Origin household',origin?'Resolved · '+(origin.child_count||0)+' promoted child record(s) · confidence '+origin.confidence:'Unresolved')+item('Recovered sibling candidates',recovered.length?recovered.length+' parent-signature / register-transition candidate(s)':'None surfaced')+item('Post-marital household',marital.length?marital.length+' resolved union(s)':'Unresolved · do not infer none')+'</div><div class="card"><div class="section-kicker">Evidence summary</div>'+item('Contacts',c.phones+' direct · '+c.householdPhones+' household phone observations')+item('Vehicles',c.vehicles+' historical/current-state observations; current ownership never assumed without later proof')+item('Addresses',c.addresses+' deduplicated classified address evidence items')+item('Property / Review',c.review+' Review brokerage record(s); brokerage is not ownership/residence')+item('Documents',c.documents+' directly connected document(s)')+'</div><div class="card"><div class="section-kicker">Research status</div>'+item('Public candidates',fmt(bridged.length))+item('Possible namesakes',fmt((web.results||[]).length-bridged.length))+item('Policy','Public evidence remains candidate-only until independently bridged')+'</div>'+(chars.status==='AVAILABLE'?'<div class="card"><div class="section-kicker">Symbolic snapshot · evidence weight 0</div><b>'+esc(chars.headline||'')+'</b>'+chips((chars.traits||[]).slice(0,6))+'</div>':'')+'<div class="card"><div class="section-kicker">Open investigation gaps</div>'+(gaps.length?gaps.map(x=>item(x)).join(''):'<div class="muted">No major gaps flagged by this executive summary.</div>')+'</div><div class="card"><div class="actions"><button class="action" data-print-report="1">Print / Save PDF</button><button class="action alt" data-lane="family">Open family map</button><button class="action alt" data-lane="evidence">Open evidence</button></div></div>'}


function householdReportTargets(d){
 const f=d.family||{}, currentId=Number(d.person?.person_id||0), byId=new Map();
 const add=(v,role,certainty)=>{const id=Number(v);if(!Number.isInteger(id)||id<=0||id===currentId||byId.has(id))return;byId.set(id,{id,role,certainty})};
 for(const e of (f.ancestry?.parents||[]))add(e.node?.person?.person_id,(e.role==='father'?'Father':'Mother'),e.status==='promoted'?'LINKED':'DERIVED_OR_CANDIDATE');
 for(const c of (f.origin_households||[]).flatMap(u=>u.children||[]))add(c.child_person_id||c.person_id,'Origin household member','PROMOTED_HOUSEHOLD_RECORD');
 for(const r of (f.recovered_siblings||[]))add(r.person?.person_id,'Recovered sibling lead','UNVERIFIED_CANDIDATE');
 for(const u of (f.marital_households||[]))for(const p of (u.parents||[]))add(p.parent_person_id,'Recorded spouse / co-parent','HOUSEHOLD_RECORD');
 for(const r of (f.recovered_children||[]))add(r.person?.person_id,'Recovered child lead','UNVERIFIED_CANDIDATE');
 for(const node of (f.descendants||[]))add(node.person?.person_id,'Linked descendant','FAMILY_GRAPH');
 return [...byId.values()];
}
function memberEvidenceHtml(record){
 const x=record.dossier||{},p=x.person||{},ev=x.evidence||{},id=Number(p.person_id||record.id);
 const contacts=(x.household_phone_directory||[]).filter(a=>(a.people||[]).some(v=>Number(v.person_id)===id && v.role==='SELF'));
 const vehicles=ev.vehicles||[],addresses=classifiedAddresses(ev.addresses||[]);
 return '<div class="card household-person"><div class="row"><div><div class="section-kicker">'+esc(record.role||'Related household')+'</div><div class="title">'+esc(p.display_name_ar||'Recorded person')+'</div></div>'+badge(record.certainty||'EVIDENCE','warn')+'</div><div class="soft-note">'+esc(personLine(p))+'</div>'+
 '<h4>Phones · '+contacts.length+'</h4>'+(contacts.length?contacts.map(q=>item(q.phone||q.raw||'Recorded phone',[q.state,q.source_type].filter(Boolean).join(' · '))).join(''):'<div class="muted">No directly attributed number in this dossier snapshot.</div>')+
 '<h4>Vehicles · '+vehicles.length+'</h4>'+(vehicles.length?vehicles.map(v=>item([v.make,v.model,v.prod_date].filter(Boolean).join(' ')||'Vehicle',[v.plate,v.registration_no,v.state,v.ownership_temporality].filter(Boolean).join(' · '))).join(''):'<div class="muted">No linked vehicle observation.</div>')+
 '<h4>Addresses · '+addresses.length+'</h4>'+(addresses.length?addresses.map(addressCard).join(''):'<div class="muted">No classified address observation.</div>')+'</div>';
}
function householdEvidenceReportHtml(d){
 const all=householdReportTargets(d),saved=d.household_report_expansion||[],complete=saved.filter(x=>x.status==='PASS'),failed=saved.filter(x=>x.status!=='PASS'),remaining=all.filter(x=>!saved.some(y=>Number(y.id)===x.id));
 let html='<div class="card"><div class="section-kicker">Cross-household evidence · '+complete.length+'/'+all.length+' linked identities loaded</div><div class="soft-note">Each member is separately queried by canonical person ID. Candidate relationships stay marked as candidates. These observations never become automatic proof of household membership, phone subscription, title or current vehicle ownership.</div>';
 if(remaining.length)html+='<div class="actions"><button class="action" data-report-expand-household="1">Load next '+Math.min(6,remaining.length)+' related member dossiers</button></div>';
 if(!all.length)html+='<div class="muted">No additional individually linked family members in the current graph.</div>';
 if(failed.length)html+='<div class="notice warn">'+failed.length+' member lookup(s) incomplete; retry by expanding again after availability recovers.</div>';
 html+='<div id="reportHouseholdStatus" class="soft-note"></div></div>';
 return html+complete.map(memberEvidenceHtml).join('');
}
async function expandHouseholdReport(){
 if(!current||!currentDossier)return;
 const d=currentDossier,pid=Number(current);
 const targets=householdReportTargets(d).filter(x=>!(d.household_report_expansion||[]).some(y=>Number(y.id)===x.id)).slice(0,6);
 if(!targets.length){setResult('Household expansion complete','All currently linked direct members have been checked; unknown relatives cannot be invented.');return}
 const loaded=d.household_report_expansion||(d.household_report_expansion=[]);
 let done=0;const slot=document.querySelector('#reportHouseholdStatus');
 for(const target of targets){
  if(Number(current)!==pid)return;
  if(slot)slot.textContent='Loading household record '+(++done)+' of '+targets.length+' (read-only, private).';
  try{
   const result=await api('/reality-api/dossier/'+target.id,{refresh:'false',include_web:'false'});
   if(Number(current)!==pid)return;
   if(Number(result.person?.person_id)!==target.id)throw Error('PERSON_ID_MISMATCH');
   loaded.push({...target,status:'PASS',dossier:{person:result.person,evidence:result.evidence,household_phone_directory:result.household_phone_directory}});
  }catch(e){loaded.push({...target,status:'HOLD',reason:String(e.message).slice(0,130)})}
 }
 if(Number(current)!==pid)return;
 content.innerHTML=comprehensiveReportHtml(d);setActiveLane('report');
 setResult('Household evidence expanded',loaded.filter(x=>x.status==='PASS').length+' linked member dossier(s) loaded; other records remain separately attributed.');
}
async function completeReportWeb(){
 const pid=Number(current);await deepWeb();
 if(Number(current)!==pid||!currentDossier)return;
 if((currentDossier.public_web?.runs||[]).length||(currentDossier.public_web?.results||[]).length){
  content.innerHTML=comprehensiveReportHtml(currentDossier);
  setActiveLane('report');
  setResult('Comprehensive report updated','Public candidates filtered by both first and family name; nothing auto-merged.');
 }
}

function comprehensiveReportHtml(d){
 const p=d.person||{}, ev=d.evidence||{}, f=d.family||{}, web=d.public_web||{}, counts=evidenceCounts(d);
 const ts=new Date().toLocaleString(), tree=document.createElement('div');
 // The same family evidence used by the interactive map, not a decorative mockup.
 renderFamilyInto(d,tree);
 tree.querySelectorAll('.family-controls').forEach(x=>x.remove());
 const assets=document.createElement('div');renderAssetsInto(d,assets);
 const docs=(ev.documents||[]),rr=(ev.review_records||[]),recovered=(f.recovered_siblings||[]);
 const cover='<div class="card report-cover"><div class="section-kicker">SAMERAI Reality · comprehensive private dossier</div><div class="title">'+esc(p.display_name_ar||currentLabel)+'</div><div class="muted">'+esc(personLine(p))+'</div><div class="soft-note">Generated '+esc(ts)+' · Sources: authorized internal indexes and separately labeled public candidate evidence · Personal data remains in the private owner session</div></div>';
 const executive='<div class="card"><div class="section-kicker">Executive findings</div><div class="metrics"><div class="metric"><b>'+fmt(counts.householdPhones)+'</b><span>household phone evidence</span></div><div class="metric"><b>'+fmt(counts.vehicles)+'</b><span>vehicle observations</span></div><div class="metric"><b>'+fmt(counts.addresses)+'</b><span>classified addresses</span></div><div class="metric"><b>'+fmt(recovered.length)+'</b><span>unverified sibling leads</span></div></div><div class="soft-note">Historical observations are NOT automatic proof of current ownership, occupancy, relationship or phone subscriber. Register-shift leads are not promoted parentage.</div></div>';
 const family='<section class="report-chapter"><h2>1. Family atlas · father and mother separately</h2><div class="soft-note">The two ancestral branches are presented separately. Verified links and unresolved candidate evidence retain different styling. Select a person in the interactive Family tab to investigate their own branch.</div>'+tree.innerHTML+'</section>';
 const assetsHtml='<section class="report-chapter"><h2>2. Household phones, vehicles and addresses</h2><div class="soft-note">Direct contacts and shared-household observations are distinguished. Vehicles and addresses are historical/source-labeled records, not assumed current personal assets.</div>'+assets.innerHTML+'</section>';
 const documents='<section class="report-chapter"><h2>3. Connected documents and property evidence</h2><div class="card"><div class="section-kicker">Documents · '+docs.length+'</div>'+(docs.length?docs.map(x=>item(x.label||x.filename||x.id||'Document',[x.source,x.state,x.date].filter(Boolean).join(' · '))).join(''):'<div class="soft-note">No directly linked documents in this snapshot. This is a coverage gap, not proof that documents do not exist.</div>')+'</div><div class="card"><div class="section-kicker">Review / property observations · '+rr.length+'</div><div class="soft-note">A broker listing or contact does not prove property title.</div>'+(rr.length?rr.map(x=>item(x.label||x.reference||x.type||'Observation',[x.location,x.address,x.state].filter(Boolean).join(' · '))).join(''):'No directly linked brokerage/property evidence.')+'</div></section>';
 const internet='<section class="report-chapter"><h2>4. Deep public research</h2><div class="soft-note">Search is anchored on the person’s FIRST and FAMILY names. Matching a first name alone is rejected. Even an anchored result remains a candidate until identity is independently corroborated.</div>'+(web.results?.length||web.runs?.length?webGroupedHtml(web):'<div class="card"><div class="notice warn">Deep Research has NOT been run for this subject. Use Research → Run Deep Research, then reopen Report to incorporate findings.</div></div>')+(web.excluded_namesakes?'<div class="soft-note">'+fmt(web.excluded_namesakes)+' surname-mismatched results excluded from the dossier.</div>':'')+'</section>';
 const signal='<section class="report-chapter"><h2>5. Civil-status interpretation and outstanding verification</h2>'+civilStatusSignalHtml(d)+'<div class="card">'+item('Parentage','Only canonical/corroborated linked parents are treated as resolved. Unmatched labels remain open.')+item('Registers','Register changes are investigative signals, NOT automatic proof of marital status.')+item('Surname search','Unrelated first-name or surname-only results are excluded; no web hit is promoted into the identity graph.')+item('Sources','Person/contact/vehicle/municipality/brokerage/public web are provenance-separated, with historical temporality preserved.')+'</div></section>';
 return cover+executive+'<div class="card"><div class="actions"><button class="action" data-print-report="1">Print complete PDF</button><button class="action alt" data-lane="family">Expand family atlas</button><button class="action alt" data-report-expand-household="1">Load household evidence</button><button class="action alt" data-report-web="1">Run Deep Research & refresh report</button></div></div>'+family+assetsHtml+'<section class="report-chapter"><h2>2B. Individually linked household members</h2>'+householdEvidenceReportHtml(d)+'</section>'+documents+internet+signal;
}

function printFinalReport(){if(!currentDossier)return;const html=comprehensiveReportHtml(currentDossier);const w=window.open('','_blank');if(!w){window.print();return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(currentLabel)+' - SAMERAI Report</title><style>body{font-family:Arial,"Noto Sans Arabic",sans-serif;color:#102b38;background:#fff;padding:26px;max-width:1100px;margin:auto}.card{border:1px solid #d9e5e8;border-radius:16px;padding:15px;margin:0 0 12px}.section-kicker{text-transform:uppercase;letter-spacing:.07em;font-size:11px;font-weight:800;color:#258b86}.title{font-size:24px;font-weight:800;margin:5px 0}.muted,.soft-note{color:#667;font-size:12px}.item{border-top:1px solid #edf1f2;padding:8px 0}.trait-wrap{display:flex;gap:6px;flex-wrap:wrap}.trait-chip{border:1px solid #d7e7e7;border-radius:999px;padding:5px 8px;font-size:11px}.address-card{border:1px solid #dfe7e9;border-radius:12px;padding:9px;margin:6px 0}.actions{display:none}.family-branch-panels{display:grid;grid-template-columns:1fr 1fr;gap:14px}.lineage-side{border:1px solid #d9e5e8;border-radius:14px;overflow:visible;padding:5px}.lineage-side summary{font-weight:800}.branch-cards{display:grid;gap:8px}.couple-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.personbox{border:1px solid #dae6e7;border-radius:12px;padding:8px;overflow-wrap:anywhere}.family-generation{border:1px solid #dce6e8;border-radius:14px;padding:12px;margin:10px 0}.report-chapter{break-before:page;margin:18px 0}.report-chapter h2{font-size:20px;color:#0b3547}.card,.personbox,.lineage-card,.branch-level{break-inside:avoid}a{overflow-wrap:anywhere}@media print{body{padding:0}}</style></head><body>'+html+'<script>setTimeout(()=>window.print(),300)<\/script></body></html>');w.document.close()}

async function renderPortalLane(view){if(!current)return;setActiveLane(view);if(view==='graph'){await renderHumanYGraph();return}if(view==='relationship'){setResult('Relationship Finder',currentLabel+' · choose another person; current subject is preserved');content.innerHTML=relationshipFinderHtml();return}const lanePerson=current;
if(view==='family'&&!isPrivateAtlasSubject({display_name_ar:currentLabel})){
 const expectedPid=Number(lanePerson),expectedDepth=Number(familyDepth);
 setResult('JEV · family universe',currentLabel+' · loading source-backed branches');
 content.innerHTML='<div class="card"><div class="section-kicker">JEV family intelligence</div><div class="loading">Loading the canonical family graph…</div></div>';
 const fullPromise=ensureCurrentDossier().catch(()=>null);
 const valid=()=>Number(current)===expectedPid&&activeLane==='family'&&Number(familyDepth)===expectedDepth;
 try{
  const live=await api('/reality-api/family/'+expectedPid,{up:expectedDepth,down:expectedDepth});
  if(!valid())return;
  const preview={person:live.person,family:live.family,evidence:{},household_phone_directory:[]};
  renderFamily(preview);setActiveLane('family');currentDossier=null;
  fullPromise.then(d=>{if(!d||!valid())return;d.family=live.family;renderFamily(d);setActiveLane('family')}).catch(()=>{});
 }catch(err){
  const d=await fullPromise;if(!valid())return;
  if(d){renderFamily(d);setActiveLane('family')}
  else{setResult('JEV family source unavailable',currentLabel);content.innerHTML='<div class="notice error">Family graph could not be loaded: '+esc(err.message||err)+'</div>'}
 }
 return;
}
if(view==='family'&&isPrivateAtlasSubject({display_name_ar:currentLabel})){
 setResult('Family intelligence',currentLabel+' · canonical family and separate private research');
 content.innerHTML='<div class="card"><div class="section-kicker">Family intelligence</div><div class="title">Private research & canonical evidence</div><div class="soft-note">Separate private research can be explored now, while the source-backed canonical dossier loads.</div><div id="familyStandalone"></div></div>';
 await loadPrivateAtlas();
 if(Number(current)!==Number(lanePerson)||activeLane!=='family')return;
 try{
  const familyDossier=await ensureCurrentDossier();
  if(Number(current)===Number(lanePerson)&&activeLane==='family'&&familyDossier){renderFamily(familyDossier);setActiveLane('family')}
 }catch(e){if(Number(current)===Number(lanePerson))setResult('Family research available · canonical dossier not ready',String(e.message||'').slice(0,150))}
 return;
}
const d=await ensureCurrentDossier();if(!d||activeLane!==view||Number(current)!==Number(lanePerson))return;
if(view==='overview'){setResult('Snapshot',currentLabel+' · investigation command center');content.innerHTML=snapshotHtml(d);setActiveLane('overview');void loadR2OverviewContactEvidence(Number(current));return}
if(view==='family'){if(Number(current)!==Number(lanePerson)||activeLane!=='family')return;renderFamily(d);setActiveLane('family');return}
if(view==='evidence'){setResult('Evidence center',currentLabel+' · connected evidence, source-separated');content.innerHTML=evidenceCenterHtml(d)+'<div id="r2EvidencePhoneAddendum" class="card"><div class="loading">Checking additional historical contact evidence…</div></div>';setActiveLane('evidence');void loadR2EvidencePhoneAddendum(Number(current));return}
if(view==='phones'){setResult('Contact intelligence',currentLabel+' · canonical & historical observations kept separate');content.innerHTML=subjectPhonesHtml(d);void loadR2ContactResearch(Number(current));return}
if(view==='vehicles'){const vv=d.evidence?.vehicles||[];setResult('Vehicle intelligence',currentLabel+' · historical observations');content.innerHTML='<div class="card"><div class="section-kicker">Vehicles</div><div class="notice warn">Historical observations are not automatically current ownership.</div>'+((vv.length)?vv.map(v=>'<div class="candidate"><b>'+esc([v.prod_date,v.make,v.model].filter(Boolean).join(' '))+'</b><div class="muted">'+esc([v.plate&&('Plate '+v.plate),v.acquisition_date&&('Observed '+v.acquisition_date),v.registration_no&&('Register '+v.registration_no),v.state,v.ownership_temporality].filter(Boolean).join(' · '))+'</div></div>').join(''):'<div class="muted">No connected vehicle observations.</div>')+'</div>';return}
if(view==='addresses'){setResult('Address intelligence',currentLabel+' · summarized by evidence class');content.innerHTML=addressLaneHtml(d.evidence?.addresses||[]);return}
if(view==='property'){const ev=d.evidence||{},rr=ev.review_records||[],pa=(ev.addresses||[]).filter(x=>['PROPERTY_RECORD_LOCATION','BROKERAGE_PROPERTY_LOCATION'].includes(x.state));setResult('Property & Review evidence',currentLabel+' · ownership evidence stays separate from brokerage evidence');content.innerHTML='<div class="card"><div class="section-kicker">Property-record evidence</div>'+((pa.length)?pa.map(addressCard).join(''):'<div class="muted">No connected property-record address evidence.</div>')+'</div><details><summary>Review.Properties private evidence · '+rr.length+'</summary><div class="inside"><div class="notice">Brokerage/lead evidence only; never treated as residence or ownership without independent proof.</div>'+((rr.length)?rr.map(x=>item(x.label||x.reference||x.type,[x.location,x.address,x.state].filter(Boolean).join(' · '))).join(''):'<div class="muted">No connected Review evidence.</div>')+'</div></details>';return}
if(view==='documents'){const dd=d.evidence?.documents||[];setResult('Documents',currentLabel+' · connected documentary evidence');content.innerHTML='<div class="card"><div class="section-kicker">Documents</div>'+(dd.length?dd.slice(0,8).map(x=>item(x.label||x.filename||x.id||'Document')).join(''):'<div class="muted">No directly connected documents in this snapshot.</div>')+'</div>'+(dd.length>8?'<details><summary>More documents · '+(dd.length-8)+'</summary><div class="inside">'+dd.slice(8).map(x=>item(x.label||x.filename||x.id||'Document')).join('')+'</div></details>':'');return}
if(view==='character'){setResult('Symbolic insights',currentLabel+' · deep date-based interpretation, evidence weight 0');content.innerHTML=characterHtml(d)+dynamicsHtml(d);return}
if(view==='web'){setResult('Research brief',currentLabel+' · public candidate evidence, no auto-merge');content.innerHTML=researchCenterHtml(d);setActiveLane('web');return}
if(view==='report'){setResult('Final report',currentLabel+' · executive dossier ready for review or PDF');content.innerHTML=comprehensiveReportHtml(d);setActiveLane('report');return}
}
async function expandFamily(){if(!current)return;const expectedPid=Number(current);const before=currentDossier?countFamilyVisible(currentDossier):0;const oldDepth=familyDepth;familyDepth=Math.min(12,familyDepth+2);setResult('Sweeping unresolved family branches…','Depth '+oldDepth+' → '+familyDepth+' · rerunning ancestry, descendants and register-transition recovery.');try{const x=await api('/reality-api/family/'+expectedPid,{up:familyDepth,down:familyDepth});if(Number(current)!==expectedPid||activeLane!=='family')return;if(!currentDossier)currentDossier={person:x.person};currentDossier.person=x.person;currentDossier.family=x.family;const after=countFamilyVisible(currentDossier);const el=$('#familySlot')||$('#familyStandalone')||$('#yFamily');if(activeLane==='family')renderFamily(currentDossier);else if(el)renderFamilyInto(currentDossier,el);else renderFamily(currentDossier);setResult(after>before?'Family branches expanded':'No additional defensible family node found',after>before?('Added '+(after-before)+' visible family node(s). Current depth '+familyDepth+'.'):'The branch sweep completed through depth '+familyDepth+' and refreshed register-transition recovery, but no additional defensible person was found.')}catch(e){familyDepth=oldDepth;setResult('Family expansion stopped',e.message)}}
function collapseFamily(){familyDepth=3;if(!currentDossier)return;const el=$('#familySlot')||$('#familyStandalone')||$('#yFamily');if(activeLane==='family')renderFamily(currentDossier);else if(el)renderFamilyInto(currentDossier,el);else renderFamily(currentDossier);setResult('Family view collapsed','Showing the first 3 useful generations. The deeper evidence remains preserved.')}
function printFamilyTree(){if(!currentDossier)return;const d=currentDossier;const box=document.createElement('div');renderFamilyInto(d,box);box.querySelectorAll('.family-controls').forEach(x=>x.remove());const w=window.open('','_blank');if(!w)return;w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(currentLabel)+' - Family Tree</title><style>body{font-family:Arial,"Noto Sans Arabic",sans-serif;color:#102b38;padding:24px}h1{margin:0 0 4px}.note{color:#667;font-size:12px}.familytree{text-align:center}.familyrow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px}.personbox{border:1px solid #ccdce0;border-radius:14px;padding:10px 14px;min-width:150px}.subjectbox{border:2px solid #22bdb6;background:#e9fbf9}.tiny{font-size:11px;color:#667}.item{border-top:1px solid #e6ecee;padding:9px 0}@media print{button{display:none}}</style></head><body><h1>'+esc(currentLabel)+'</h1><div class="note">SAMERAI Reality · family evidence · depth '+familyDepth+' · generated '+new Date().toLocaleString()+'</div>'+box.innerHTML+'<script>setTimeout(()=>window.print(),350)<\/script></body></html>');w.document.close()}

async function renderHumanYGraph(){if(!current)return;const keep=current,keepLabel=currentLabel;setResult('Building Y-Graph…','Family-first view with evidence lanes; dense network remains expert-only.');const d=await api('/reality-api/dossier/'+keep,{refresh:'false'});showSubject(d.person);const ev=d.evidence||{};content.innerHTML='<div class="card"><b>Human Y-Graph</b><div class="muted">Ancestry → current person → origin household / spouse / descendants. Evidence stays in separate lanes.</div><div id="yFamily"></div></div><details open><summary>Phones & addresses</summary><div class="inside" id="yAssets"></div></details><details><summary>Properties / Review evidence · '+fmt((ev.review_records||[]).length)+'</summary><div class="inside"><div class="notice">Review locations are brokerage evidence, not assumed residence or ownership.</div>'+(ev.review_records||[]).slice(0,30).map(x=>item(x.label||x.reference||x.type,x.location||x.address||x.state||'')).join('')+'</div></details><details><summary>Documents · '+fmt((ev.documents||[]).length)+'</summary><div class="inside">'+(ev.documents||[]).slice(0,30).map(x=>item(x.label||x.filename||x.id||'Document')).join('')+'</div></details><details><summary>Expert network view</summary><div class="inside"><iframe id="graphFrame" src="./graph.html?embedded=1&person='+keep+'" title="Expert YiGraph network"></iframe></div></details>';renderFamilyInto(d,$('#yFamily'));renderAssetsInto(d,$('#yAssets'));current=keep;currentLabel=keepLabel;setResult('Y-Graph',keepLabel+' · family-first human view')}

function personWebNameFilter(w,fullName){
  const norm=v=>String(v||'').toLowerCase().normalize('NFKC')
      .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا')
      .replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  const tokens=norm(fullName).split(' ').filter(x=>x.length>=2);
  if(tokens.length<2)return {...w,identity_filter:'INSUFFICIENT_NAME_ANCHOR',results:[],excluded_namesakes:(w?.results||[]).length};
  const first=tokens[0],family=tokens[tokens.length-1], variants=new Set([family]);
  if(family==='abdallah'||family==='abdullah')variants.add(family==='abdallah'?'abdullah':'abdallah');
  const accepted=[],excluded=[];
  for(const entry of (w?.results||[])){
    const text=norm([entry.title,entry.highlights,entry.evidence_summary].filter(Boolean).join(' '));
    const words=text.split(' ');
    const matchingPair=words.some((word,i)=>word===first&&words.some((other,j)=>variants.has(other)&&Math.abs(i-j)<=4));
    // First and family must appear near each other as one name, not in
    // different sentences about unrelated people. These are still candidates.
    if(matchingPair){
      accepted.push({...entry,identity_relevance:'NAME_ANCHORED_CANDIDATE',identity_bridge_required:true,
        category:entry.category==='POSSIBLE_NAMESAKE'?'OTHER_PUBLIC':entry.category});
    } else excluded.push(entry);
  }
  return {...w,results:accepted,count:accepted.length,excluded_namesakes:excluded.length,
    identity_filter:'FIRST_AND_FAMILY_MANDATORY',identity_filter_name:fullName,canonical_merge:false};
}

async function deepWeb(){if(!current)return;cancelPersonResearch();const epoch=++personWebEpoch,pid=Number(current),p=currentDossier?.person||{},q=[currentLabel,'Lebanon'].filter(Boolean).join(' ');personWebController=new AbortController();const signal=personWebController.signal;let researchTimedOut=false;const researchTimeout=setTimeout(()=>{researchTimedOut=true;try{personWebController?.abort()}catch{}},75000);setResult('Deep research running…','Six public-web arms: exact identity, professional, business, real estate, news and public social. No result auto-merges.');const slot=$('#personWebSlot');if(slot)slot.innerHTML='<div class="loading">Researching and categorizing public evidence…</div>';else content.innerHTML='<div class="loading">Researching and categorizing public evidence…</div>';try{const u='/reality-api/internet?'+new URLSearchParams({q,limit:50,mode:'deep'});const rr=await fetch(u,{cache:'no-store',credentials:'same-origin',signal});const t=await rr.text();let d;try{d=JSON.parse(t)}catch{d={detail:t}}if(!rr.ok)throw Error(d.detail||d.error||('HTTP '+rr.status));if(signal.aborted||epoch!==personWebEpoch||Number(current)!==pid)return;d=personWebNameFilter(d,currentLabel);if(currentDossier){currentDossier.public_web=d;content.innerHTML=researchCenterHtml(currentDossier);setActiveLane('web')}else{const html='<div class="notice">'+badge('PUBLIC CANDIDATES ONLY','warn')+badge('NO AUTO-MERGE')+' '+fmt(d.count||0)+' deduplicated result(s) from '+fmt((d.runs||[]).length)+' search arms.</div>'+webGroupedHtml(d);content.innerHTML='<div class="card">'+html+'</div>'}setResult('Deep research complete',fmt(d.count||0)+' categorized public candidates · '+fmt((d.runs||[]).length)+' search arms.')}catch(e){if(e.name==='AbortError'&&!researchTimedOut)return;const msg=researchTimedOut?'Public research exceeded 75 seconds. The private dossier is preserved; retry when providers respond faster.':e.message;const live=$('#personWebSlot');if(live)live.innerHTML='<div class="card research-brief"><div class="section-kicker">Research brief</div><div class="title">Research incomplete</div><div class="notice warn">'+esc(msg)+'</div><div class="actions"><button class="action" data-run-web="1">Retry Deep Research</button></div></div>';else content.innerHTML='<div class="notice error">'+esc(msg)+'</div>';setResult('Deep research incomplete',msg)}finally{clearTimeout(researchTimeout);if(epoch===personWebEpoch)personWebController=null}}
function deepPersonCard(x){const p=x.person||{},ph=x.phones||[],vv=x.vehicles||[],aa=x.addresses||[],anc=x.ancestry||[],mar=x.marital_households||[];const strong=ph.filter(z=>z.state==='STRONG').length,cand=ph.filter(z=>z.state==='CANDIDATE').length;return '<div class="candidate"><b>'+esc(p.display_name_ar||('Person '+p.person_id))+'</b><div class="muted">'+esc([p.birth_date&&('DOB '+p.birth_date),p.father&&('Father '+p.father),p.mother_first&&('Mother '+p.mother_first),p.register_no&&('Sejel '+p.register_no)].filter(Boolean).join(' · '))+'</div><div class="tiny">Municipality role: '+esc((x.roles||[]).join(', '))+' · ancestry '+anc.length+' nodes · '+strong+' strong phone(s) · '+cand+' candidate phone(s) · '+vv.length+' vehicle observation(s) · '+aa.length+' address evidence item(s) · '+mar.length+' post-marital union(s)</div><button class="action" data-person="'+esc(p.person_id)+'">Open full person dossier</button></div>'}
function quickPersonEvidenceHtml(x){if(!x)return'';const p=x.person||{},ph=x.phones||[],vv=x.vehicles||[],aa=x.addresses||[],anc=x.ancestry||[];return '<div class="card"><div class="section-kicker">Immediate extracted evidence</div><div class="title">'+esc(p.display_name_ar||'Person')+'</div><div class="soft-note">This is the evidence already extracted from the parcel investigation. The full private dossier continues loading in the background.</div>'+item('Municipality role',(x.roles||[]).join(', ')||'Resolved person')+item('Family / ancestry',anc.length+' ancestry node(s) already extracted')+item('Phones',ph.length?ph.slice(0,6).map(v=>[v.normalized||v.raw,v.state].filter(Boolean).join(' · ')).join(' | '):'No connected phone in the parcel expansion')+item('Vehicles',vv.length?vv.slice(0,5).map(v=>[v.prod_date,v.make,v.model,v.plate].filter(Boolean).join(' ')).join(' | '):'No connected vehicle in the parcel expansion')+item('Addresses',aa.length?aa.slice(0,5).map(a=>a.address||a.label||'Address').join(' | '):'No connected address in the parcel expansion')+'<div class="loading">Loading full family, evidence and report lanes…</div></div>'}
function resolutionCard(x){const cs=x.candidates||[],detail=cs.slice(0,4).map(c=>[c.display_name_ar,c.birth_date,c.father,c.register_no].filter(Boolean).join(' · ')).join(' | ');return '<div class="candidate"><b>'+esc(x.label)+'</b>'+badge(x.state,x.state==='UNIQUE_EXACT_PERSON'?'good':'warn')+'<div class="muted">'+esc(x.municipality_role||'')+(detail?' · '+esc(detail):'')+'</div>'+(x.relational_clues?.length?'<div class="tiny">Relationship clue: '+esc(x.relational_clues.join(' ↔ '))+'</div>':'')+(x.embedded_person_clues?.length?'<div class="tiny">Embedded person clue: '+esc(x.embedded_person_clues.join(', '))+'</div>':'')+'</div>'}
function renderDeepParcel(d){const p=d.parcel||{},z=d.zoning||{},m=d.municipality||{},ms=m.summary||{},id=d.identity_expansion||{},people=d.people||[],docs=(d.documents||{}).results||[],review=d.review_brokerage_candidates||[],market=d.market_context||{},web=d.public_web||{},states=id.state_counts||{},rn=d.resolution_note||{};personPreviewById=new Map(people.filter(x=>x?.person?.person_id).map(x=>[Number(x.person.person_id),x]));current=null;currentLabel='';subject.innerHTML='';setActions();setResult('Deep property dossier ready',(d.lot_uid||'')+' · '+fmt(d.coverage_count)+' source domains · '+fmt(people.length)+' uniquely resolved people · '+fmt((d.unresolved_gaps||[]).length)+' unresolved/candidate branches.');let html='<div class="card"><b>Property intelligence dossier</b><div class="metrics"><div class="metric"><b>'+esc(p.official_area_sqm??'—')+'</b><span>official m²</span></div><div class="metric"><b>'+esc(z.final_zone||p.final_zone||'—')+'</b><span>zone</span></div><div class="metric"><b>'+fmt(ms.record_count)+'</b><span>municipality records</span></div><div class="metric"><b>'+fmt(ms.distinct_owner_count)+'</b><span>owner labels</span></div><div class="metric"><b>'+fmt(ms.distinct_taxpayer_count)+'</b><span>taxpayer/occupant labels</span></div><div class="metric"><b>'+fmt(people.length)+'</b><span>unique exact people</span></div></div></div>';
if(rn.mode==='FUZZY_LOCATION_DISAMBIGUATION')html+='<div class="notice warn"><b>Clue interpretation:</b> '+esc(rn.original_query)+' → '+esc(rn.interpreted_location)+' ('+Math.round((rn.score||0)*100)+'% phonetic/fuzzy score). Lot number existed in multiple districts; alternatives remain preserved: '+esc((rn.alternatives||[]).map(x=>x.district+' '+Math.round((x.score||0)*100)+'%').join(' · '))+'</div>';
html+='<div class="card"><b>Physical + planning</b>'+item('Canonical parcel',d.lot_uid)+item('Street evidence',((m.records||[]).find(x=>x.street_address_ar)||{}).street_address_ar||'—')+item('Geometry',p.geometry_status||'—')+item('Surface coefficient',z.surface_coefficient??'—')+item('Total exploitation coefficient',z.total_exploitation_coefficient??'—')+item('Use mix',fmt((m.usage_distribution||{}).Residential||0)+' residential · '+fmt((m.usage_distribution||{})['Non-residential']||0)+' non-residential')+item('Municipality evidence window',[ms.earliest_statement_from,ms.latest_statement_reference].filter(Boolean).join(' → '))+'</div>';
html+='<details open><summary>Identity expansion · '+fmt(people.length)+' exact people</summary><div class="inside"><div class="metrics"><div class="metric"><b>'+fmt(states.UNIQUE_EXACT_PERSON||0)+'</b><span>exact labels</span></div><div class="metric"><b>'+fmt(states.AMBIGUOUS_PERSON||0)+'</b><span>ambiguous</span></div><div class="metric"><b>'+fmt(states.SINGLE_NONEXACT_CANDIDATE||0)+'</b><span>non-exact candidates</span></div><div class="metric"><b>'+fmt(states.UNRESOLVED||0)+'</b><span>unresolved</span></div><div class="metric"><b>'+fmt(states.ORGANIZATION_OR_COLLECTIVE||0)+'</b><span>collectives</span></div></div><div class="notice">Only uniquely resolved exact people are expanded automatically. Ambiguous and non-exact labels remain outside canonical identity.</div>'+people.map(deepPersonCard).join('')+'</div></details>';
html+='<details><summary>All municipality owner labels · '+fmt((id.owners||[]).length)+'</summary><div class="inside">'+(id.owners||[]).map(resolutionCard).join('')+'</div></details>';
html+='<details><summary>All taxpayer / occupant labels · '+fmt((id.taxpayers||[]).length)+'</summary><div class="inside">'+(id.taxpayers||[]).map(resolutionCard).join('')+'</div></details>';
html+='<details><summary>Municipality unit history · '+fmt((m.records||[]).length)+'</summary><div class="inside"><div class="notice">Historical Beirut Municipality tax evidence, not a current Land Registry title certificate.</div>'+(m.records||[]).map(r=>item([r.floor_en,r.apartment_number&&('Apt '+r.apartment_number),r.used_as_en].filter(Boolean).join(' · '),[r.owner_name_ar&&('Owner: '+r.owner_name_ar),r.taxpayer_name_ar&&('Taxpayer/occupant: '+r.taxpayer_name_ar),r.situation_en,r.statement_from].filter(Boolean).join(' · '))).join('')+'</div></details>';
html+='<details><summary>Phones, vehicles, addresses & family evidence</summary><div class="inside">'+people.map(x=>{const p=x.person||{};return '<div class="card"><b>'+esc(p.display_name_ar||'Person')+'</b><div class="tiny">Ancestry</div>'+(x.ancestry||[]).map(a=>item(('Generation -'+a.depth+' · '+(a.name||'Unresolved')), [a.dob,a.sejel&&('Sejel '+a.sejel),a.state].filter(Boolean).join(' · '))).join('')+'<div class="tiny">Phones</div>'+(x.phones||[]).map(v=>item(v.normalized||v.raw||'Phone',v.state||'')).join('')+'<div class="tiny">Vehicles</div>'+(x.vehicles||[]).map(v=>item([v.prod_date,v.make,v.model].filter(Boolean).join(' '),[v.plate,v.acquisition_date,v.state,v.ownership_temporality].filter(Boolean).join(' · '))).join('')+'<div class="tiny">Addresses</div>'+(x.addresses||[]).slice(0,12).map(a=>item(a.address||a.label||'Address',a.state||a.classification||'')).join('')+'</div>'}).join('')+'</div></details>';
html+='<details><summary>Market context · HISTORICAL ONLY</summary><div class="inside"><div class="notice warn">Historical Review district context only. Not current market truth and not exact-lot comparables.</div>'+item('District',market.district||'—')+item('Historical listing corpus',fmt(market.listing_count||0)+' listings · '+fmt(market.sale_count||0)+' sale · '+fmt(market.rent_count||0)+' rent')+item('Historical median sale / m²',market.median_sale_price_per_sqm??'—')+item('Historical median rent / m²',market.median_rent_price_per_sqm??'—')+item('Latest corpus record',market.latest_record_date||'—')+'</div></details>';
html+='<details><summary>Documents · '+docs.length+'</summary><div class="inside">'+(docs.length?docs.map(x=>item(x.filename||x.path||x.document_uid,[x.context,x.confidence].filter(Boolean).join(' · '))).join(''):'<div class="notice">No explicit internal LOT fact matched this parcel number.</div>')+'</div></details>';
html+='<details><summary>Review brokerage evidence · '+review.length+'</summary><div class="inside"><div class="notice">Review records are brokerage/professional evidence only. They are not assumed residence or ownership.</div>'+(review.length?review.map(x=>item(x.reference||('Property '+x.property_id),[x.community,x.sub_community,x.street_name,x.price].filter(Boolean).join(' · '))).join(''):'No exact lot-number brokerage candidate.')+'</div></details>';
html+='<details open id="propertyWebBlock"><summary>Public web candidate evidence · expanding</summary><div class="inside" id="propertyWebSlot">'+badge('PUBLIC CANDIDATES ONLY','warn')+badge('NO AUTO-MERGE')+'<div class="loading">Parcel and uniquely resolved people are being researched in parallel. The internal dossier is already usable.</div></div></details>';
html+='<details><summary>Unresolved gaps · '+fmt((d.unresolved_gaps||[]).length)+' · NOT MISSING</summary><div class="inside"><div class="notice">These are active investigation gaps, not missing data claims.</div>'+(d.unresolved_gaps||[]).map(g=>item(g.label,[g.role,g.state,g.next_query].filter(Boolean).join(' · '))).join('')+'</div></details>';
html+='<div class="card"><b>System coverage</b>'+item('Domains consulted',(d.source_coverage||[]).join(' · '))+item('Expansion runtime',String(d.elapsed_s||'—')+' s')+'</div>';content.innerHTML=html}
async function expandPropertyWeb(d,epoch){
  const slot=$('#propertyWebSlot');if(!slot||epoch!==propertyEpoch)return;
  propertyWebController=new AbortController();const signal=propertyWebController.signal;
  const p=d.parcel||{},m=d.municipality||{},people=d.people||[];
  const street=((m.records||[]).find(x=>x.street_address_ar)||{}).street_address_ar||'';
  const pq=['Lot',p.lot_number,p.district?.replaceAll('_',' '),street,'Beirut Lebanon'].filter(Boolean).join(' ');
  const jobs=[{key:'parcel',label:'Parcel',q:pq,limit:16},...people.map(x=>{const pp=x.person||{},yr=String(pp.birth_date||pp.birth_year||'').slice(0,4);return{key:String(pp.person_id),label:pp.display_name_ar||'Person',q:[pp.display_name_ar,pp.father,yr,'Lebanon'].filter(Boolean).join(' '),limit:10}})];
  async function run(j){const u='/reality-api/internet?'+new URLSearchParams({q:j.q,limit:j.limit,mode:'deep'});const r=await fetch(u,{cache:'no-store',credentials:'same-origin',signal});const t=await r.text();let x;try{x=JSON.parse(t)}catch{x={detail:t}}if(!r.ok)throw Error(x.detail||x.error||('HTTP '+r.status));return x}
  const res=new Array(jobs.length);let next=0;
  async function worker(){while(next<jobs.length&&!signal.aborted){const i=next++;try{res[i]={status:'fulfilled',value:await run(jobs[i])}}catch(e){res[i]={status:'rejected',reason:e}}}}
  await Promise.all([worker(),worker()]);
  if(epoch!==propertyEpoch||signal.aborted||!$('#propertyWebSlot'))return;
  let total=0,html=badge('PUBLIC CANDIDATES ONLY','warn')+badge('NO AUTO-MERGE');
  res.forEach((r,i)=>{const j=jobs[i];if(r&&r.status==='fulfilled'){const w=r.value||{};total+=Number(w.count||0);html+='<div class="card"><b>'+esc(j.label)+'</b><div class="muted">'+fmt(w.count||0)+' deduplicated public candidate result(s) · '+fmt((w.runs||[]).length)+' search arms</div>'+(w.results||[]).slice(0,j.key==='parcel'?8:5).map(webCard).join('')+'</div>'}else if(r){html+='<div class="notice error">'+esc(j.label)+': public-web arm failed without affecting the internal dossier.</div>'}});
  $('#propertyWebSlot').innerHTML=html;const sm=$('#propertyWebBlock summary');if(sm)sm.textContent='Public web candidate evidence · '+fmt(total)+' result(s)';
}
function renderParcel(d){const p=d.parcel||{},m=d.municipality||{},z=d.zoning||{},owners=d.owner_names||[],docs=(d.documents||{}).results||[],review=d.review_brokerage_candidates||[];current=null;currentLabel='';subject.innerHTML='';setActions();setResult('Parcel resolved',(d.lot_uid||'')+' · expanding identities, families, assets, documents and public evidence…');content.innerHTML='<div class="card"><div class="metrics"><div class="metric"><b>'+esc(p.official_area_sqm??'—')+'</b><span>official m²</span></div><div class="metric"><b>'+esc(z.final_zone||p.final_zone||'—')+'</b><span>zone</span></div><div class="metric"><b>'+fmt((m.summary||{}).record_count)+'</b><span>municipality records</span></div><div class="metric"><b>'+fmt((m.summary||{}).distinct_owner_count)+'</b><span>owner labels</span></div></div><div class="loading">Select any municipality label below to investigate separately</div></div>'}
let parcelCase=null;
function parcelNavigation(view){
 const tabs=[['overview','⌂','Overview'],['map','▱','Map'],['municipality','▤','Municipality'],['people','♧','People'],['evidence','◫','Evidence']];
 return '<div class="card portal-shell"><div class="portalnav" role="navigation" aria-label="Parcel sections">'+tabs.map(x=>'<button type="button" data-parcel-lane="'+x[0]+'" class="'+(view===x[0]?'primary':'')+'"><span class="nav-icon">'+x[1]+'</span><span>'+x[2]+'</span></button>').join('')+'</div></div>';
}
function renderParcelPanel(view='overview'){
 const d=parcelCase;if(!d)return;setResult('Property investigation',String(d.lot_uid||'Parcel')+' · municipality and associated evidence');
 const m=d.municipality||{},r=m.records||[],owners=d.owner_names||[],tax=d.taxpayer_names||[],p=d.parcel||{},z=d.zoning||{};
 const label=(n,kind)=>'<div class="candidate"><div class="entity-lane-title"><b>'+esc(n)+'</b>'+badge(kind,'')+'</div><button type="button" class="action" data-muni-label="1" data-query="'+esc(n)+'">Investigate identity →</button></div>';
 const field=(n,v)=>item(n,v==null||v===''?'Not recorded':String(v));
 let body='<div class="card"><div class="section-kicker">BPC cadastral intelligence</div><div class="title">'+esc(d.lot_uid||'Resolved parcel')+'</div><div class="metrics">'+
 '<div class="metric"><b>'+esc(p.official_area_sqm??'—')+'</b><span>official m²</span></div>'+
 '<div class="metric"><b>'+esc(z.final_zone||p.final_zone||'—')+'</b><span>zoning</span></div>'+
 '<div class="metric"><b>'+fmt(r.length)+'</b><span>municipality entries</span></div>'+
 '<div class="metric"><b>'+fmt(owners.length)+'</b><span>historical owner labels</span></div></div></div>';
 if(view==='overview')body+='<div class="card"><div class="section-kicker">Property investigation</div><div class="title">Start with the municipal source</div><div class="quick-grid"><button data-parcel-lane="municipality">Municipality<span>Historical unit statements</span></button><button data-parcel-lane="people">Owner labels<span>Investigate individual identities</span></button><button data-parcel-lane="evidence">Evidence<span>Planning, documents and brokerage</span></button></div><div class="notice warn">Municipality tax labels are not current ownership certificates; contacts require independent verification.</div></div>'+
 '<div class="card"><b>Historical owner leads</b>'+owners.slice(0,5).map(n=>label(n,'Municipality')).join('')+'</div>';
 if(view==='map')body+='<div class="card" id="r2ParcelGeo"><div class="loading">Loading source-backed parcel polygon and map location…</div></div>';
 if(view==='municipality')body+='<div class="card"><div class="section-kicker">Municipality source</div><div class="title">'+r.length+' recorded unit statements</div><div class="soft-note">Historical ownership and taxpayer labels are preserved by unit and statement date, never presented as verified current title.</div>'+
 r.map((v,i)=>'<details class="secondary-results"><summary>Unit '+(i+1)+' · '+esc([v.floor_en,v.apartment_number,v.used_as_en].filter(Boolean).join(' · ')||'Recorded unit')+'</summary><div class="inside">'+
 field('Statement',v.statement_from)+field('Street',v.street_address_ar)+
 (v.owner_name_ar?label(v.owner_name_ar,'Owner label'):'')+(v.taxpayer_name_ar?label(v.taxpayer_name_ar,'Taxpayer / occupant'):'')+'</div></details>').join('')+'</div>';
 if(view==='people')body+='<div class="card"><div class="section-kicker">Identity investigation</div><div class="title">Historical owner labels · '+owners.length+'</div>'+owners.map(n=>label(n,'Owner label')).join('')+'</div>'+
 '<div class="card"><div class="title">Taxpayers / occupants · '+tax.length+'</div>'+tax.map(n=>label(n,'Taxpayer / occupant')).join('')+'</div>';
 if(view==='evidence'){const docs=d.documents?.results||[],leads=d.review_brokerage_candidates||[];
 body+='<div class="card"><div class="title">Cadastral & planning</div>'+field('Parcel',d.lot_uid)+field('Geometry',p.geometry_status)+field('Zoning surface coefficient',z.surface_coefficient)+field('Total exploitation coefficient',z.total_exploitation_coefficient)+'</div>'+
 '<div class="card"><div class="title">Document leads · '+docs.length+'</div><div class="soft-note">Lot-number-only matches may belong to another district.</div>'+docs.slice(0,30).map(v=>item(v.filename||v.file_id||'Document',v.fact_type||'')).join('')+'</div>'+
 '<div class="card"><div class="title">Brokerage records · '+leads.length+'</div>'+leads.slice(0,30).map(v=>item(v.title_en||v.reference||'Listing',[v.status,v.community].filter(Boolean).join(' · '))).join('')+'</div>';}
 content.innerHTML=body;
 setActions(parcelNavigation(view));
 if(view==='map')renderParcelGeoPanel(d);
}
async function renderParcelGeoPanel(d){
 const dest=$('#r2ParcelGeo');if(!dest||!d?.lot_uid)return;
 try{
  const g=await api('/reality-api/parcel-geoview/'+encodeURIComponent(d.lot_uid));
  if(!dest.isConnected||parcelCase?.lot_uid!==g.lot_uid)return;
  const centroid=g.centroid||{},lat=Number(centroid.lat),lon=Number(centroid.lon);
  const valid=Number.isFinite(lat)&&Number.isFinite(lon)&&lat>30&&lat<38&&lon>32&&lon<38;
  const goMap=valid?'https://www.google.com/maps/search/?api=1&query='+lat+','+lon:null;
  const goDirections=valid?'https://www.google.com/maps/dir/?api=1&destination='+lat+','+lon:null;
  const goStreet=g.street_view_url&&/^https:\/\/www\.google\.com\/maps\//.test(g.street_view_url)?g.street_view_url:null;
  const parts=g.geometry?.type==='Polygon'?[g.geometry.coordinates]:g.geometry?.type==='MultiPolygon'?g.geometry.coordinates:[];
  const rings=parts.map(x=>x?.[0]).filter(x=>Array.isArray(x)&&x.length>=4);
  const points=rings.flat().filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));
  let shape='<div class="notice warn">No certified parcel polygon available for this record.</div>',perimeter=null;
  if(points.length>=4){
   const xs=points.map(p=>Number(p[0])),ys=points.map(p=>Number(p[1]));
   const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   const mid=(minY+maxY)/2,cos=Math.cos(mid*Math.PI/180);
   const dx=Math.max((maxX-minX)*cos,1e-8),dy=Math.max(maxY-minY,1e-8),scale=Math.min(255/dx,175/dy);
   const xy=p=>[20+(Number(p[0])-minX)*cos*scale,195-(Number(p[1])-minY)*scale];
   const polys=rings.map(r=>'<polygon points="'+r.map(p=>xy(p).map(x=>x.toFixed(1)).join(',')).join(' ')+'" fill="#55d8cf22" stroke="#48c4bd" stroke-width="3" stroke-linejoin="round"></polygon>').join('');
   shape='<div style="background:#082734;border-radius:16px;overflow:hidden"><svg viewBox="0 0 300 215" role="img" aria-label="Source parcel boundary preview, north at top" style="display:block;width:100%;max-height:290px"><path d="M285 25v28m0-28l-7 10m7-10l7 10" stroke="#e6fcfc" stroke-width="2" fill="none"/><text x="285" y="19" fill="#e6fcfc" text-anchor="middle" font-size="11">N</text>'+polys+'</svg></div>';
   perimeter=rings.reduce((sum,ring)=>{let distance=0;for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1],rad=(Number(a[1])+Number(b[1]))*.5*Math.PI/180;
     const ex=(Number(b[0])-Number(a[0]))*111320*Math.cos(rad),ny=(Number(b[1])-Number(a[1]))*111132;
     distance+=Math.hypot(ex,ny);}return sum+distance},0);
  }
  const link=(url,text)=>url?'<a class="action" target="_blank" rel="noreferrer noopener" style="display:inline-block;text-decoration:none;margin:5px 6px 5px 0" href="'+esc(url)+'">'+esc(text)+'</a>':'';
  dest.innerHTML='<div class="section-kicker">BPC cadastral geometry · read-only</div><div class="title">'+esc(g.lot_uid)+'</div>'+
  '<div class="soft-note">This preview is generated from BPC parcel geometry, not a cadastral survey. No original geometry was edited.</div>'+shape+
  '<div class="metrics">'+
  '<div class="metric"><b>'+esc(g.official_area_sqm??'—')+'</b><span>recorded official m²</span></div>'+
  '<div class="metric"><b>'+esc(g.zone_code||'—')+'</b><span>zone</span></div>'+
  '<div class="metric"><b>'+(perimeter?perimeter.toFixed(1)+' m':'—')+'</b><span>approx. polygon perimeter</span></div>'+
  '<div class="metric"><b>'+esc(g.estimated_geometry_area_sqm?.toFixed?.(1)??'—')+'</b><span>derived polygon area, m²</span></div></div>'+
  '<div class="actions">'+link(goMap,'Map / Satellite')+link(goDirections,'Directions')+link(goStreet,'Street View')+'</div>'+
  '<div class="notice warn">Edge lengths and perimeter are geometric estimates. Verified boundary dimensions, road frontage and street widths require an authoritative CAD/survey source. Satellite and directions open the parcel centroid, not the full highlighted outline.</div>'+
  '<div class="tiny">Geometry state: '+esc(g.geometry_status||'unclassified')+' · Source: '+esc(g.source||'BPC')+'</div>';
 }catch(e){if(dest.isConnected)dest.innerHTML='<div class="notice error">Parcel geometry unavailable: '+esc(e.message||'unknown error')+'</div>'}
}
function renderMunicipalEvidence(d){parcelCase=d;renderParcelPanel('overview')}
async function propertyQuery(q){cancelPropertyWeb();const epoch=++propertyEpoch;setResult('Resolving parcel…',q);content.innerHTML='<div class="loading">Resolving lot, district, geometry and municipal evidence…</div>';const d=await api('/reality-api/parcel-search',{q,limit:60});if(d.kind==='PARCEL_DOSSIER'){renderParcel(d);renderMunicipalEvidence(d);return;const rn=d.resolution_note||{};content.insertAdjacentHTML('afterbegin','<div class="notice"><b>Clue interpretation:</b> '+esc(rn.original_query||q)+' → '+esc(d.lot_uid||'resolved parcel')+(rn.interpreted_location?' · '+esc(rn.interpreted_location):'')+'. Deep evidence expansion continues in the background.</div>');try{const deep=await api('/reality-api/parcel-search',{q,limit:60,deep:'true',include_web:'false'});if(deep.kind==='PARCEL_DEEP_DOSSIER'){renderDeepParcel(deep);propertyWebTimer=setTimeout(()=>{propertyWebTimer=null;if(epoch===propertyEpoch)expandPropertyWeb(deep,epoch)},1500);return}renderParcel(deep);return}catch(e){setResult('Parcel resolved · deep expansion incomplete',e.message);content.insertAdjacentHTML('beforeend','<div class="notice error">Deep expansion failed without losing the verified parcel result: '+esc(e.message)+'</div>');return}}current=null;currentLabel='';subject.innerHTML='';setActions();setResult('Choose the intended parcel',(d.count||0)+' parcel candidate(s).');const ranked=(d.ranked_candidates&&d.ranked_candidates.length)?d.ranked_candidates:(d.results||[]).map(r=>{const p=r.properties||{};return{lot_uid:p.lot_uid||r.id,district:p.district||'',score:null,area:p.official_area_sqm,zone:p.final_zone}});content.innerHTML='<div class="card">'+(d.message?'<div class="notice">'+esc(d.message)+'</div>':'<div class="notice">The lot number exists in more than one cadastral district. Choose the intended parcel; SAMERAI will not guess without a discriminating location clue.</div>')+ranked.map(x=>'<div class="candidate"><b>'+esc(x.lot_uid)+'</b><div class="muted">'+esc(x.district)+(x.area!=null?' · '+esc(x.area)+' m²':'')+(x.zone?' · Zone '+esc(x.zone):'')+(x.score!=null?' · clue match '+Math.round(x.score*100)+'%':'')+'</div><button class="action" data-query="Lot '+esc((x.lot_uid||'').split('-').pop())+' '+esc(x.district.replaceAll('_',' '))+'">Investigate this parcel</button></div>').join('')+'</div>'}
async function numeric(q){
current=null;currentLabel='';currentDossier=null;subject.innerHTML='';actions.innerHTML='';
const phoneAnchorPromise=[7,8].includes(q.length)?api('/graph-api/anchor/phone',{q}):Promise.resolve(null);
const parcelProbePromise=q.length<=6?api('/reality-api/parcel-search',{q:'Lot '+q,limit:60}).catch(()=>null):Promise.resolve(null);
const [o,cross,phoneAnchor,parcelProbe]=await Promise.all([api('/graph-api/anchor/number-options',{q,limit:40}),api('/reality-api/numeric-cross-domain',{q,limit:30}),phoneAnchorPromise,parcelProbePromise]);
const pl=o.plate_options||[],xd=cross.domains||{},xc=cross.counts||{},rawLen=q.length;
const allPhones=[];for(const x of [...(o.phone_options||[]),...(cross.phone_variants||[])]){const n=x.phone_digits;if(n&&!allPhones.some(y=>y.phone_digits===n))allPhones.push(x)}
const phonePrimary=allPhones.filter(x=>rawLen>=7&&(x.phone_digits===q||x.phone_digits?.endsWith(q.slice(-7))));
const phoneDerived=allPhones.filter(x=>rawLen>8&&x.phone_digits&&[7,8].includes(x.phone_digits.length));
const phoneSuffix=allPhones.filter(x=>!phonePrimary.includes(x)&&!phoneDerived.includes(x));
const phoneFormatOnly=!phonePrimary.length&&!phoneDerived.length&&[7,8].includes(rawLen);
const bpc=(xd.bpc||[]),propertyRows=[];for(const bucket of bpc)for(const r of (bucket.results||[])){const p=r.properties||{};if(!propertyRows.some(x=>(x.properties?.lot_uid||x.id)===(p.lot_uid||r.id)))propertyRows.push(r)}
if(!propertyRows.length&&parcelProbe){const pp=(parcelProbe.ranked_candidates&&parcelProbe.ranked_candidates.length)?parcelProbe.ranked_candidates:(parcelProbe.results||[]);for(const r of pp){const p=r.properties||r;if(!propertyRows.some(x=>(x.properties?.lot_uid||x.id)===(p.lot_uid||r.id)))propertyRows.push(r.properties?r:{id:p.lot_uid,properties:p})}}
const propertyHits=propertyRows.length||Number(xc.bpc||0),plateHits=pl.length,refs=Number(xc.foundry||0)+Number(xc.unified||0),docs=Number(xc.documents||0);
const meanings=[];if(propertyHits&&rawLen<=8)meanings.push({kind:'lot',label:'Property / lot number',level:'HIGH',count:propertyHits});
if(plateHits&&rawLen<=8)meanings.push({kind:'plate',label:'Vehicle plate number',level:'HIGH',count:plateHits});
if(phonePrimary.length&&[7,8].includes(rawLen))meanings.push({kind:'phone',label:'Lebanese phone number',level:'HIGH',count:phonePrimary.length});
else if(phoneDerived.length)meanings.push({kind:'phone',label:'Derived phone candidate',level:'MEDIUM',count:phoneDerived.length});
else if(phoneFormatOnly)meanings.push({kind:'phone',label:'Lebanese phone-format candidate',level:'MEDIUM',count:0});
if(!meanings.length&&(refs||docs))meanings.push({kind:'reference',label:'Structured reference / document number',level:'MEDIUM',count:refs+docs});
lastNumeric={q,o,cross,phoneAnchor,allPhones,phonePrimary,phoneDerived,phoneSuffix,phoneFormatOnly,propertyRows,pl};
if(meanings.length===1&&meanings[0].kind==='phone'&&phonePrimary.length){setResult('Interpreted as an exact Lebanese phone','The phone itself stays the anchor; names are evidence labels until independently resolved.');renderNumericDomain('phone');return}
const title=meanings.length?q+' has '+meanings.length+' likely interpretation'+(meanings.length===1?'':'s'):q+' is ambiguous';
setResult(title,'SAMERAI ranks plausible meanings first. Secondary suffix/reference matches stay collapsed until you ask for them.');
const choices=meanings.map(m=>{let desc='',examples='',button='';
if(m.kind==='lot'){const districts=[...new Set(propertyRows.map(r=>(r.properties||{}).district).filter(Boolean))];desc=m.count+' cadastral match(es)';examples=districts.slice(0,6).join(' · ');button='<button class="action" data-num-domain="lot">Explore lot matches</button>'}
if(m.kind==='plate'){const ex=[];for(const x of pl){const t=[x.plate_code&&('Code '+x.plate_code),x.make,x.type_desc,x.prod_date,x.color&&('Color '+x.color)].filter(Boolean).join(' · ');if(t&&!ex.includes(t))ex.push(t)}desc=m.count+' vehicle/plate candidate(s)';examples=ex.slice(0,4).join(' | ');button='<button class="action" data-num-domain="plate">Explore vehicles</button>'}
if(m.kind==='phone'){const rows=phonePrimary.length?phonePrimary:phoneDerived;desc=rows.length?rows.length+' indexed phone candidate(s)':'Phone-shaped Lebanese number · no indexed direct match yet';examples=rows.length?rows.slice(0,4).map(x=>x.phone_digits+(x.person_links?' · '+x.person_links+' canonical link(s)':'')).join(' | '):q;button='<button class="action" data-num-domain="phone">Explore phone evidence</button>'}
if(m.kind==='reference'){desc=(refs+docs)+' exact structured/document occurrence(s)';examples='Kept secondary unless you identify this as a reference.';button='<button class="action alt" data-num-domain="reference">Inspect references</button>'}
return '<div class="num-choice '+(m.level==='HIGH'?'high':'medium')+'"><span class="score">'+esc(m.level)+'</span><h3>'+esc(m.label)+'</h3><div class="muted">'+esc(desc)+'</div><div class="num-examples">'+esc(examples)+'</div>'+button+'</div>'}).join('');
let secondary='';
if(phoneSuffix.length||refs||docs){secondary='<details class="secondary-results"><summary>Secondary interpretations · '+fmt(phoneSuffix.length+refs+docs)+'</summary><div class="inside"><div class="notice">These are not presented as the answer. They are suffix, reference or incidental digit matches and require an explicit follow-up.</div>'+item('Phone suffix matches',phoneSuffix.length?fmt(phoneSuffix.length)+' numbers contain/end with '+q:'None')+item('Structured-data references',fmt(refs))+item('Document hits',fmt(docs))+'</div></details>'}
content.innerHTML='<div class="card"><div class="section-kicker">Clue interpretation</div><div class="title">'+esc(title)+'</div><div class="soft-note">A bare number is not a command to dump every matching row. Choose a likely meaning or add context such as “lot”, “plate”, “phone” or “reference”.</div></div><div class="num-summary">'+choices+'</div>'+secondary;
}
function cleanPhoneObservedLabel(v){let s=String(v||'').trim();if(!s)return'';s=s.split(/\bRef\.?\s*#/i)[0].trim();if(!s)return'';if(/^(magic|prepaid|mamouchte|unknown|n\/?a|null|none)$/i.test(s))return'';if(/\b(oger\s*liban|company|s\.?a\.?l\.?|sarl|bank|telecom|corporation|corp\.?|ltd\.?|inc\.?)\b/i.test(s))return'';if(/\b(apartment|property|for rent|for sale|sqm|cash|listing)\b/i.test(s))return'';if(s.length>90)return'';return s}
function renderNumericDomain(kind){if(!lastNumeric)return;const n=lastNumeric,q=n.q,cross=n.cross||{},xd=cross.domains||{};let html='<div class="card"><div class="row"><div><div class="section-kicker">Numeric clue '+esc(q)+'</div><div class="title">'+esc(kind==='lot'?'Property / lot matches':kind==='plate'?'Vehicle / plate matches':kind==='phone'?'Phone evidence':'Structured references')+'</div></div><button class="action alt" data-nav-back="1">← Back</button></div></div>';
if(kind==='lot'){propertyQuery('Lot '+q);return}
if(kind==='plate'){const rows=n.pl||[];html+='<div class="card"><div class="notice">Plate number alone is incomplete in Lebanon. Code/zone, make/model, owner label and acquisition evidence are shown so you can recognize the intended vehicle.</div>'+rows.map(x=>'<div class="candidate"><b>'+esc([x.plate_code&&('Code '+x.plate_code),x.plate_number].filter(Boolean).join(' '))+' · '+esc([x.make,x.type_desc,x.prod_date,x.color&&('Color '+x.color)].filter(Boolean).join(' · '))+'</b><div class="muted">'+esc([x.owner_label,x.latest_acquisition&&('Observed '+x.latest_acquisition),x.observations&&x.observations+' observation(s)'].filter(Boolean).join(' · '))+'</div><button class="action" data-query="plate '+esc([x.plate_number,x.plate_code].filter(Boolean).join(' '))+'">Investigate this vehicle</button></div>').join('')+'</div>'}
if(kind==='phone'){const rows=((n.phonePrimary?.length?n.phonePrimary:n.phoneDerived)||[]).length?((n.phonePrimary?.length?n.phonePrimary:n.phoneDerived)||[]):(n.phoneFormatOnly?[{phone_digits:q,observations:0,person_links:0,observed_names:[],format_only:true}]:[]),found=[...(xd.foundry||[]),...(xd.unified||[])],p7=digitsOnly(q).slice(-7),exact=found.filter(x=>digitsOnly(x.phone_text||x.contact||'').includes(p7));const seen=new Set(),obs=[];for(const x of exact){const key=[x.name||x.title,x.entity_type||x.type,x.location||x.address,x.dataset_key||x.source].join('|');if(seen.has(key))continue;seen.add(key);obs.push(x)}const personObs=obs.filter(x=>cleanPhoneObservedLabel(x.name||x.title)),rawObs=obs.filter(x=>!cleanPhoneObservedLabel(x.name||x.title));html+='<div class="card"><div class="section-kicker">Exact phone evidence</div><div class="notice">The phone is the anchor. Person-like source labels stay visible; system labels and raw artifacts stay collapsed. Similar names are never promoted into identities automatically.</div>'+rows.map(x=>{const labels=[...new Set((x.observed_names||[]).map(cleanPhoneObservedLabel).filter(Boolean))];return '<div class="candidate"><b>'+esc(x.phone_digits)+'</b><div class="muted">'+fmt(x.observations||0)+' indexed observation(s)'+(x.person_links?' · '+fmt(x.person_links)+' direct canonical link(s)':' · no direct canonical identity bridge')+'</div>'+(labels.length?'<div class="tiny"><b>Person-like observed labels:</b> '+esc(labels.join(' · '))+'</div>':'<div class="tiny">No person-like source label survives cleanup.</div>')+'</div>'}).join('')+(personObs.length?'<div class="section-kicker" style="margin-top:12px">Person-like source evidence</div>'+personObs.slice(0,6).map(x=>'<div class="candidate"><b>'+esc(cleanPhoneObservedLabel(x.name||x.title))+'</b><div class="muted">'+esc([x.entity_type||x.type,x.location||x.address,x.reference].filter(Boolean).join(' · '))+'</div><div class="tiny">'+esc(x.dataset_key||x.source||x.raw_table||'')+'</div></div>').join(''):'<div class="muted">No person-like source row surfaced in this index snapshot.</div>')+((rawObs.length||obs.length>personObs.length)?'<details class="secondary-results"><summary>Raw source artifacts · '+fmt(rawObs.length)+'</summary><div class="inside"><div class="soft-note">These rows contain the exact phone but are not treated as person identities.</div>'+rawObs.slice(0,20).map(x=>item(x.name||x.title||'Observed record',[x.entity_type||x.type,x.location||x.address,x.reference].filter(Boolean).join(' · '))).join('')+'</div></details>':'')+'</div>'}
if(kind==='reference'){const f=xd.foundry||[],u=xd.unified||[],docs=xd.documents||[];html+='<details open><summary>Structured-data occurrences · '+fmt(f.length+u.length)+'</summary><div class="inside"><div class="notice">These rows merely contain the digits. They are not assumed to describe the intended person/object.</div>'+f.slice(0,40).map(x=>item(x.name||x.reference||'Foundry record',[x.reference,x.location,x.phone_text].filter(Boolean).join(' · '))).join('')+u.slice(0,40).map(x=>item(x.title||x.reference||'Unified record',[x.reference,x.location,x.contact].filter(Boolean).join(' · '))).join('')+'</div></details><details><summary>Document occurrences · '+fmt(docs.length)+'</summary><div class="inside">'+docs.slice(0,40).map(x=>item(x.filename||x.path||x.document_uid,String(x.snippet||'').slice(0,260))).join('')+'</div></details>'}
if(kind==='phone'&&(n.phoneAnchor?.cards||[]).length){const pcs=n.phoneAnchor.cards||[];html+='<div class="card"><div class="section-kicker">Canonical candidates suggested by exact-phone source labels</div><div class="notice warn">The phone is still the anchor. A public/legacy short name such as Abed may expand to several full canonical عبد… names. These are candidates only until another clue such as father, mother, Sejel, DOB, address or vehicle corroborates one person.</div>'+pcs.slice(0,8).map(candidateCard).join('')+(pcs.length>8?'<div class="soft-note">'+esc(pcs.length-8)+' additional candidates preserved in the resolver.</div>':'')+'</div>'}
content.innerHTML=html}
async function recordInvestigation(query,kind,state,personId=null,label=''){
 try{
  const r=await fetch('/reality-api/investigations/track',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({query,kind,state,person_id:personId,person_label:label,
     next_action:state==='OPEN_RESEARCH'?'Compare names, Sejil and independent source records':
       state==='ERROR_RETRY'?'Retry source query after repairing upstream':'Resume evidence review and inspect linked data'})
  });
  if(r.ok && document.querySelector('#recentInvestigations'))void loadRecentInvestigations();
 }catch(e){}
}
async function loadRecentInvestigations(){
 const target=document.querySelector('#recentInvestigations');
 if(!target)return;
 try{
  const r=await api('/reality-api/investigations/recent',{limit:9});
  if(!Array.isArray(r.items)||!r.items.length){target.innerHTML='<div class="soft-note">Your first investigation will be saved here on BOSSPC.</div>';return}
  target.innerHTML=r.items.map(x=>'<button type="button" class="radar-item" data-reopen-query="'+esc(x.title)+'">'+
    '<span class="radar-priority info">RESUME</span><span><b>'+esc(x.title)+'</b><small>'+
    esc([x.state,x.result_kind,x.updated_at].filter(Boolean).join(' · '))+'</small></span><span class="chev">›</span></button>').join('');
 }catch(e){target.innerHTML='<div class="soft-note">Recent investigations are temporarily unavailable; existing records remain on BOSSPC.</div>'}
}
async function investigate(text){
if(busy)return;
const q=(text||ask.value).trim();if(!q)return;
let journalKind='OPEN_SEARCH',journalError=false;
const launcher=$('#quickStart');if(launcher)launcher.hidden=true;
cancelPropertyWeb();cancelPersonResearch();cancelDossierLoad();busy=true;ask.value='';
const phonePrefix=q.match(/^(?:phone|mobile|tel|telephone)\s*[:#]?\s*(\+?[0-9][0-9 ().+-]*)$/i);
const bare=(phonePrefix?phonePrefix[1]:q).replace(/[\s().+-]/g,'');
const isNumeric=/^\d{1,18}$/.test(bare);
const isProperty=/^(?:lot|parcel|estate|property)\s*#?\s*\d+/i.test(q);
try{
  if(candidateContext&&candidateRefinementIntent(q)){await refineCandidateContext(q);return}
  const contextual=!!current&&!isNumeric&&!isProperty&&/(his|her|their|him|this person|that person|family|tree|car|vehicle|phone|number|address|propert|document|show|list|give|profile|web|online|internet|character|trait|horoscope|numerology)/i.test(q);
  if(isNumeric){journalKind='NUMERIC_CLUE';pushView('before numeric clue');current=null;currentLabel='';currentDossier=null;candidateContext=null;subject.innerHTML='';setActions();setResult('Investigating…',q);content.innerHTML='<div class="loading">Resolving the clue before expanding evidence…</div>';await numeric(bare);setActions();return}
  if(isProperty){journalKind='PROPERTY_SEARCH';pushView('before property clue');current=null;currentLabel='';currentDossier=null;candidateContext=null;subject.innerHTML='';setActions();setResult('Investigating…',q);content.innerHTML='<div class="loading">Resolving the parcel before expanding evidence…</div>';await propertyQuery(q);setActions(actions.innerHTML);return}
  if(contextual&&current){
    const keep=current,keepLabel=currentLabel;
    pushView('before subject follow-up');
    if(/\b(phones?|phone numbers?|mobiles?|numbers?)\b/i.test(q)){await renderPortalLane('phones');setResult('Using selected subject',keepLabel+' · phone intelligence only');return}
    if(/\b(cars?|vehicles?)\b/i.test(q)){await renderPortalLane('vehicles');setResult('Using selected subject',keepLabel+' · vehicle intelligence');return}
    if(/\b(address|addresses|lives?|living|location)\b/i.test(q)){await renderPortalLane('addresses');setResult('Using selected subject',keepLabel+' · address intelligence');return}
    if(/\b(propert|properties|review|brokerage|owner|owns|lot)\b/i.test(q)){await renderPortalLane('property');setResult('Using selected subject',keepLabel+' · property / Review evidence');return}
    if(/\b(documents?|files?)\b/i.test(q)){await renderPortalLane('documents');setResult('Using selected subject',keepLabel+' · documents');return}
    if(/\b(character|traits?|horoscope|numerology|personality)\b/i.test(q)){await renderPortalLane('character');setResult('Using selected subject',keepLabel+' · interpretation layer');return}
    if(/\b(family|tree|parents?|siblings?|children|relatives?)\b/i.test(q)){await renderPortalLane('family');setResult('Using selected subject',keepLabel+' · family and households');return}
    if(/\b(web|online|internet|research)\b/i.test(q)){current=keep;currentLabel=keepLabel;await renderPortalLane('web');return}
  }
  if(!contextual){pushView('before new search');current=null;currentLabel='';currentDossier=null;candidateContext=null;subject.innerHTML='';actions.innerHTML=backControlHtml()}
  setResult('Investigating…',q);content.innerHTML='<div class="loading">Resolving the clue before expanding evidence…</div>';
  const params={q,include_review_private:'true'};if(contextual&&current)params.person_id=current;
  const r=await api('/graph-api/ask',params);journalKind=String(r.kind||'RESULT_AVAILABLE');
  if(r.kind==='PERSON_CANDIDATES'){renderCandidates(r.candidates||[],r.message);candidateContext.query=q;return}
  if(r.kind==='PERSON_GRAPH'){const p=r.selected||((r.graph?.nodes||[]).find(x=>x.type==='PERSON'&&x.person_id===r.graph.person_id)?.data)||{person_id:r.graph?.person_id,display_name_ar:''};showSubject(p);setResult('Subject resolved',currentLabel+' · private dossier loading in background');content.innerHTML='<div class=\"card\"><div class=\"section-kicker\">Identity locked</div><div class=\"title\">'+esc(currentLabel)+'</div><div class=\"loading\">Building family, phones, vehicles, addresses, property and documents without blocking the investigation…</div></div>';beginDossierLoad(p.person_id,false);return}
  if(r.kind==='PLATE_CANDIDATES'){await renderPlateDeep(r);return}
  if(r.kind==='PHONE_CANDIDATES'){setResult('Exact phone evidence','Phone identity remains unresolved until a direct bridge exists.');content.innerHTML='<div class="notice">Use the exact-phone path from the numeric clue screen. Similar names are not accepted as identity evidence.</div>';return}
  if(r.kind==='NO_MATCH'&&!isNumeric&&!isProperty){
    try {
      const aliases=await api('/reality-api/relationship-targets',{q,limit:15});
      if((aliases.candidates||[]).length){
        const candidates=(aliases.candidates||[]).map(p=>({...p,match_mode:'BILINGUAL_COMPOUND_SEARCH',match_score_pct:Math.min(99,Number(p.name_match_score||0)/3),match_reason:'Expanded compound Arabic/English name matching across first, father and family fields. Select the exact person.'}));
        renderCandidates(candidates,'Additional national-name matches recovered beyond the strict canonical search.');
        return;
      }
    }catch(e){/* Preserve original NO_MATCH UX if alias service is unavailable. */}
  }
  if(r.kind==='NO_MATCH'){current=null;currentLabel='';currentDossier=null;candidateContext=null;lastNoMatchQuery=q;subject.innerHTML='';setActions();setResult('No canonical match','I did not force an identity.');content.innerHTML='<div class="card"><div class="section-kicker">No canonical identity resolved</div><div class="title">'+esc(q)+'</div><div class="notice">Nothing in the canonical identity layer is strong enough to select. SAMERAI will not flood the screen with web namesakes automatically.</div><div class="actions"><button class="action" data-public-fallback="1">Search public web separately</button></div><div class="soft-note">Public-web results remain candidate evidence and will not merge into a person unless another identity bridge corroborates them.</div></div>';return}
  setResult(r.kind||'Result',r.message||'Result returned.');content.innerHTML='<div class="card"><pre>'+esc(JSON.stringify(r,null,2).slice(0,12000))+'</pre></div>'
}catch(e){journalError=true;setResult('Connection issue',e.message);content.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'+(e.reconnect?'<div class="actions"><a class="action" href="'+R2_STABLE_ENTRY+'" rel="noreferrer">Reconnect R2 securely</a></div>':'')}
finally{busy=false;void recordInvestigation(q,journalKind,journalError?'ERROR_RETRY':journalKind==='NO_MATCH'?'OPEN_RESEARCH':'RESULT_AVAILABLE',journalKind==='PERSON_GRAPH'?Number(current):null,currentLabel)}
}

async function publicFallbackSearch(){const q=lastNoMatchQuery;if(!q)return;setResult('Public research running…',q+' · canonical identity still unresolved');content.innerHTML='<div class="loading">Searching public sources without merging namesakes…</div>';try{const w=await api('/reality-api/internet',{q:q+' Lebanon',limit:30,mode:'deep'});content.innerHTML='<div class="card"><div class="section-kicker">Public candidate evidence</div><div class="notice">'+badge('PUBLIC CANDIDATES ONLY','warn')+' No canonical identity has been selected.</div>'+webGroupedHtml(w)+'</div>';setResult('Public research complete',fmt(w.count||0)+' candidate result(s) · still unmerged')}catch(e){content.innerHTML='<div class="notice error">'+esc(e.message)+'</div>';setResult('Public research incomplete',e.message)}}
async function openPersonPhones(pid){if(!Number.isInteger(pid)||pid<=0)return;await openPerson(pid);setResult('Phone evidence','Loading directly linked numbers for selected candidate');content.innerHTML='<div class="card"><div class="loading">Loading source-linked phone evidence...</div></div>';try{const d=await ensureCurrentDossier();if(!d||Number(current)!==pid)return;setResult('Phone intelligence',currentLabel+' · direct numbers first; household links separate');content.innerHTML=subjectPhonesHtml(d)}catch(e){if(Number(current)!==pid)return;content.innerHTML='<div class="card"><div class="notice error">Phone evidence could not be loaded. '+esc(e.message)+'</div></div>'}}
async function openPerson(pid,saveHistory=true){const launcher=$('#quickStart');if(launcher)launcher.hidden=true;if(saveHistory)pushView('candidate list before person');const preview=personPreviewById.get(Number(pid));const p=preview?.person||(candidateContext?.rows||[]).find(x=>Number(x.person_id)===Number(pid))||{person_id:Number(pid),display_name_ar:'Person '+pid};showSubject(p);setResult('Subject resolved',currentLabel+' · extracted evidence shown immediately; full dossier loading in background');content.innerHTML=preview?quickPersonEvidenceHtml(preview):'<div class=\"card\"><div class=\"section-kicker\">Identity locked</div><div class=\"title\">'+esc(currentLabel)+'</div><div class=\"loading\">Building the connected private dossier without blocking the investigation…</div></div>';beginDossierLoad(pid,false);return p}
async function loadEstate(){const e=$('#estate');e.classList.add('open');e.innerHTML='<div class="loading">Loading authorities…</div>';try{const d=await api('/reality-api/estate');const i=d.identity||{},v=d.evidence||{},l=d.liquid||{},w=d.internet||{};e.innerHTML='<div class="metrics"><div class="metric"><b>'+fmt(i.canonical_people)+'</b><span>canonical people</span></div><div class="metric"><b>'+fmt(i.relationship_edges)+'</b><span>relationship edges</span></div><div class="metric"><b>'+fmt(i.source_observation_links)+'</b><span>source observation links</span></div><div class="metric"><b>'+fmt(v.vehicle_records)+'</b><span>vehicle observations</span></div><div class="metric"><b>'+fmt(v.documents)+'</b><span>unique documents</span></div><div class="metric"><b>'+fmt(v.person_attachments_v1+v.person_attachments_v2)+'</b><span>person attachments (overlapping)</span></div><div class="metric"><b>'+fmt(l.connection_hypotheses)+'</b><span>liquid hypotheses</span></div><div class="metric"><b>'+fmt(w.results)+'</b><span>captured public-web results</span></div></div><div class="notice">These universes overlap. SAMERAI will not add them into a fake “total people” number.</div>'}catch(x){e.innerHTML='<div class="notice error">'+esc(x.message)+'</div>'}}
async function rehydrateRestoredCivilSnapshot(){
 const pid=Number(current);
 if(!Number.isInteger(pid)||pid<=0)return;
 try{
  const dossier=await ensureCurrentDossier();
  if(Number(current)!==pid||!dossier?.person)return;
  const subjectLine=subject.querySelector('.card.hero .muted');
  if(subjectLine)subjectLine.textContent=personLine(dossier.person,dossier.civil_registry_history);
  const hasSnapshot=[...content.querySelectorAll('.section-kicker')].some(e=>e.textContent?.trim()==='Investigation snapshot');
  if(hasSnapshot)renderDossier(dossier);
 }catch(e){/* Retain restored navigation when read-only dossier is not available. */}
}
const _restoredOnLoad=restoreSavedState();
void loadRecentInvestigations();
if(_restoredOnLoad&&$('#quickStart'))$('#quickStart').hidden=true;
if(_restoredOnLoad&&Number(current)>0)void rehydrateRestoredCivilSnapshot();
document.addEventListener('click',e=>{
 const resume=e.target.closest('[data-reopen-query]');if(resume){investigate(resume.dataset.reopenQuery||'');return}
 const quick=e.target.closest('[data-launch]');
 if(!quick)return;
 const mode=quick.dataset.launch;
 const prefix={person:'',plate:'plate ',phone:'',lot:'Lot '}[mode];
 if(prefix===undefined)return;
 const example={person:'Enter a Lebanese name (Arabic, English or French)',plate:'Enter plate number and optional code',phone:'Enter exact Lebanese phone number',lot:'Enter cadastral lot number and area'}[mode];
 ask.value=prefix;
 ask.placeholder=example;
 result.innerHTML='<div class="title">'+esc({person:'Person & family',plate:'Vehicle & registry',phone:'Phone evidence',lot:'Cadastral property'}[mode])+'</div><div class="muted">'+esc(example)+'. Results will retain source provenance and unresolved alternatives.</div>';
 ask.focus();
});
let _persistTimer=null;
const _schedulePersist=()=>{clearTimeout(_persistTimer);_persistTimer=setTimeout(persistState,1400)};
new MutationObserver(_schedulePersist).observe(document.querySelector('#appMain')||document.body,{subtree:false,childList:true});
window.addEventListener('scroll',_schedulePersist,{passive:true});
window.addEventListener('beforeunload',persistState);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistState()});
if(_restoredOnLoad){setTimeout(()=>{const n=document.createElement('div');n.className='soft-note';n.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:50;background:#0d3347;color:white;padding:8px 12px;border-radius:999px;box-shadow:0 8px 22px #0015;font-weight:750';n.textContent='Investigation restored';document.body.appendChild(n);setTimeout(()=>n.remove(),1800)},250)}
$('#go').onclick=()=>investigate();ask.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();investigate()}});document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='relationshipTarget'){e.preventDefault();runRelationshipFinder()}});$('#estateBtn').onclick=loadEstate;
document.addEventListener('click',e=>{const rr=e.target.closest('[data-rel-run]');if(rr){runRelationshipFinder();return}const rt=e.target.closest('[data-rel-target]');if(rt){openRelationshipTarget(Number(rt.dataset.relTarget),rt.dataset.relLabel||'');return}const pr=e.target.closest('[data-print-report]');if(pr){printFinalReport();return}const he=e.target.closest('[data-report-expand-household]');if(he){expandHouseholdReport();return}const wr=e.target.closest('[data-report-web]');if(wr){completeReportWeb();return}const fl=e.target.closest('[data-family-label]');if(fl){pushView('unresolved family label');candidateContext=null;investigate(fl.dataset.familyLabel);return}const nb=e.target.closest('[data-nav-back]');if(nb){restorePrevious();return}const pf=e.target.closest('[data-public-fallback]');if(pf){pushView('before public-web fallback');publicFallbackSearch();return}const nd=e.target.closest('[data-num-domain]');if(nd){pushView('numeric meanings');renderNumericDomain(nd.dataset.numDomain);setActions(actions.innerHTML);return}const lane=e.target.closest('[data-lane]');if(lane){pushView('portal lane '+lane.dataset.lane);renderPortalLane(lane.dataset.lane);return}const fx=e.target.closest('[data-family-expand]');if(fx){pushView('family before expansion');expandFamily();return}const fc=e.target.closest('[data-family-collapse]');if(fc){collapseFamily();return}const fp=e.target.closest('[data-family-pdf]');if(fp){printFamilyTree();return}const rw=e.target.closest('[data-run-web]');if(rw){deepWeb();return}const ph=e.target.closest('[data-person-phones]');if(ph){openPersonPhones(Number(ph.dataset.personPhones));return}const p=e.target.closest('[data-person]');if(p){openPerson(Number(p.dataset.person));return}const q=e.target.closest('[data-query]');if(q){if(q.dataset.muniLabel==='1')pushView('municipality records');investigate(q.dataset.query);return}const a=e.target.closest('[data-act]');if(!a||!current)return;const act=a.dataset.act;if(act==='dossier')buildDossier(false);if(act==='family')renderPortalLane('family');if(act==='assets')renderAssets(currentDossier);if(act==='web')deepWeb();if(act==='graph')renderHumanYGraph()});

document.addEventListener('click',e=>{if(e.target.closest('[data-rel-queue]'))openRelationshipQueue()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-parcel-lane]');if(b){renderParcelPanel(b.dataset.parcelLane||'overview');return}});

document.addEventListener('click',e=>{if(!e.target.closest('#r2HomeSamer'))return;const homeId=3266782;personPreviewById.set(homeId,{person:{person_id:homeId,display_name_ar:'سامر عصام عبدالله'}});openPerson(homeId);});
