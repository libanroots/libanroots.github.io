
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg',active=new WeakMap(),txt=x=>String(x??''),pid=x=>Number.isInteger(Number(x))&&Number(x)>0?Number(x):null;
function canon(p){return{id:'c:'+txt(p?.person_id||p?.child_person_id||p?.parent_person_id),pid:pid(p?.person_id||p?.child_person_id||p?.parent_person_id),name:txt(p?.display_name_ar||p?.name||p?.label_first||'Unresolved'),year:txt(p?.birth_year||p?.birth_date||'').slice(0,4),status:'Source-linked'}}
function buildCanonical(d){
 const nodes=new Map(),edges=[],self=canon(d.person||{});self.gen=0;self.root=true;self.relation='SUBJECT';nodes.set(self.id,self);
 function link(p,depth,from,type,uncertain=false){
  if(!p)return '';
  let n=canon(p);
  if(!n.pid){n.id='u:'+from+':'+type+':'+txt(p.label_first);n.name=txt([p.label_first,p.label_family].filter(Boolean).join(' ')||'Unresolved');uncertain=true}
  if(!nodes.has(n.id))nodes.set(n.id,{...n,gen:depth,uncertain,relation:type});
  if(from)edges.push({from,to:n.id,type,uncertain});
  return n.id;
 }
 const seen=new Set();
 function up(tree,child,depth){
  if(!tree||depth< -12)return;
  for(const item of tree.parents||[]){
   const k=link(item.node?.person,depth,child,item.role||'PARENT',item.status!=='promoted');
   if(k&&!seen.has(k)){seen.add(k);up(item.node,k,depth-1)}
  }
  for(const item of tree.unresolved_parent_labels||[])link(item,depth,child,item.role||'PARENT',true);
 }
 const f=d.family||{};up(f.ancestry,self.id,-1);
 for(const h of f.origin_households||[])for(const c of h.children||[])if(pid(c.child_person_id)!==self.pid)link(c,0,self.id,'SIBLING',h.status!=='promoted');
 for(const a of f.recovered_siblings||[])link(a.person||a,0,self.id,'SIBLING LEAD',true);
 for(const h of f.marital_households||[])for(const c of h.parents||[])if(pid(c.parent_person_id)!==self.pid)link(c,0,self.id,'SPOUSE / CO-PARENT',h.status!=='promoted');
 function down(items,parent,depth){if(depth>12)return;for(const x of items||[]){const k=link(x.person||x,depth,parent,'CHILD');if(k)down(x.children,k,depth+1)}}
 down(f.descendants,self.id,1);
 for(const a of f.recovered_children||[])link(a.person||a,1,self.id,'CHILD LEAD',true);
 return{nodes:[...nodes.values()].slice(0,260),edges,focus:self.id,research:false};
}
function buildResearch(atlas,focus){
 const people=atlas?.persons||[],links=atlas?.edges||[],peopleById=new Map(people.map(p=>[txt(p.id),p]));
 const start=peopleById.has(txt(focus))?txt(focus):peopleById.has('dany')?'dany':txt(people[0]?.id);
 const adjacent=new Map();
 for(const e of links){for(const [a,b] of [[txt(e.f),txt(e.t)],[txt(e.t),txt(e.f)]]){if(!adjacent.has(a))adjacent.set(a,[]);adjacent.get(a).push(b)}}
 const depths=new Map([[start,0]]),q=[start];
 while(q.length&&depths.size<160){let k=q.shift(),d=depths.get(k);if(d>=5)continue;for(const other of adjacent.get(k)||[])if(peopleById.has(other)&&!depths.has(other)){depths.set(other,d+1);q.push(other)}}
 return{nodes:[...depths].map(([k,d])=>{const p=peopleById.get(k)||{};return{id:'r:'+k,key:k,name:txt(p.n||k),gen:d,uncertain:p.status!=='DOCUMENTED_AS_STATED',status:txt(p.status||'RESEARCH'),year:txt(p.b||'').slice(0,4),root:k===start,pid:null}}),
 edges:links.filter(e=>depths.has(txt(e.f))&&depths.has(txt(e.t))).map(e=>({from:'r:'+txt(e.f),to:'r:'+txt(e.t),type:txt(e.k),uncertain:e.status!=='DOCUMENTED_AS_STATED'})),focus:'r:'+start,research:true};
}
function element(tag,attributes){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attributes||{}))el.setAttribute(k,txt(v));return el}
function layout(graph){
 const rows=new Map();for(const n of graph.nodes){if(!rows.has(n.gen))rows.set(n.gen,[]);rows.get(n.gen).push(n)}
 const generations=[...rows.keys()].sort((a,b)=>a-b),max=Math.max(1,...[...rows.values()].map(r=>r.length)),width=Math.max(440,(max+1)*176),height=(generations.length+1)*135;
 const positions=new Map();
 generations.forEach((g,index)=>{const row=rows.get(g);row.sort((a,b)=>Number(!!b.root)-Number(!!a.root)||a.name.localeCompare(b.name));row.forEach((n,j)=>positions.set(n.id,{x:width/2+(j-(row.length-1)/2)*176,y:72+index*135}))});
 return{positions,width,height};
}
function transform(instance){instance.group.setAttribute('transform','translate('+instance.offset.x+' '+instance.offset.y+') scale('+instance.offset.z+')')}
function focusNode(instance,nid,move=true){
 const n=instance.graph.nodes.find(x=>x.id===nid);if(!n)return;
 instance.selected=nid;
 for(const el of instance.svg.querySelectorAll('.jev-node'))el.classList.toggle('selected',el.dataset.node===nid);
 instance.name.textContent=n.name;instance.detail.textContent=[n.relation||n.status,n.year,n.uncertain?'Research / needs corroboration':'Source-linked','Generation '+(n.gen>0?'+':'')+n.gen].filter(Boolean).join(' · ');
 instance.open.disabled=!n.pid;
 const hint=instance.root.querySelector('[data-jev-selected]');if(hint)hint.innerHTML='<strong>'+txt(n.name).replace(/[&<>]/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[k]))+'</strong><span>'+txt(n.relation||n.status||'').replace(/[&<>]/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[k]))+' · '+(n.pid?'Tap to open person dossier':'Unresolved or research-only identity')+'</span>';
 instance.noteInput.value=instance.notes[nid]||'';
 if(move){const p=instance.box.positions.get(nid);if(p){instance.offset.x=195-p.x*instance.offset.z;instance.offset.y=210-p.y*instance.offset.z;transform(instance)}}
}
function render(instance){
 const full=instance.mode==='research'&&instance.atlas?buildResearch(instance.atlas,instance.researchFocus):buildCanonical(instance.data);
 instance.fullGraph=full;
 let graph=full;
 if(!instance.showAll){
  const root=instance.branchFocus&&full.nodes.some(n=>n.id===instance.branchFocus)?instance.branchFocus:full.focus;
  const visible=new Set([root]);let frontier=new Set([root]);
  const depth=Math.max(1,Math.min(3,instance.focusDepth||1));
  for(let step=0;step<depth;step++){
   const next=new Set();
   for(const e of full.edges){if(frontier.has(e.from)&&!visible.has(e.to))next.add(e.to);
     if(frontier.has(e.to)&&!visible.has(e.from))next.add(e.from);}
   for(const id of next)visible.add(id);frontier=next;
  }
  graph={...full,nodes:full.nodes.filter(n=>visible.has(n.id)),edges:full.edges.filter(e=>visible.has(e.from)&&visible.has(e.to)),focus:root};
 }
 instance.graph=graph;const box=layout(graph);instance.box=box;const svg=instance.svg;
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 390 420');
 const group=element('g',{class:'jev-viewport'});instance.group=group;svg.appendChild(group);
 for(const e of graph.edges){const a=box.positions.get(e.from),b=box.positions.get(e.to);if(!a||!b)continue;
 const line=element('path',{class:'jev-edge'+(e.uncertain?' research':''),d:'M'+a.x+' '+(a.y+29)+' C'+a.x+' '+((a.y+b.y)/2)+' '+b.x+' '+((a.y+b.y)/2)+' '+b.x+' '+(b.y-29)});
 group.appendChild(line)}
 for(const n of graph.nodes){const p=box.positions.get(n.id);if(!p)continue;
 const gr=element('g',{class:'jev-node'+(n.root?' root':'')+(n.uncertain?' research':''),transform:'translate('+(p.x-77)+','+(p.y-32)+')',tabindex:0,role:'button','aria-label':n.name,'data-node':n.id});
 gr.appendChild(element('rect',{width:154,height:64,rx:13}));
 const t=element('text',{x:12,y:26});t.textContent=n.name.length>21?n.name.slice(0,20)+'…':n.name;gr.appendChild(t);
 const sub=element('text',{x:12,y:48,class:'jev-secondary'});sub.textContent=[n.year,n.root?'SUBJECT':n.relation||(!n.uncertain?'RELATED':'RESEARCH')].filter(Boolean).join(' · ');gr.appendChild(sub);group.appendChild(gr)}
 const bounds=graph.nodes.map(n=>box.positions.get(n.id)).filter(Boolean);
 const minX=Math.min(...bounds.map(p=>p.x-82)),maxX=Math.max(...bounds.map(p=>p.x+82)),minY=Math.min(...bounds.map(p=>p.y-37)),maxY=Math.max(...bounds.map(p=>p.y+37));
 // Full graph is a navigable canvas, NOT a microscopic fit-to-screen thumbnail.
 const fitZoom=Math.min(.98,350/Math.max(1,maxX-minX),355/Math.max(1,maxY-minY));
 const z=instance.showAll?1.08:Math.max(.78,fitZoom);
 const target=box.positions.get(graph.focus)||{x:(minX+maxX)/2,y:(minY+maxY)/2};
 instance.offset={x:195-target.x*z,y:220-target.y*z,z};transform(instance);focusNode(instance,graph.focus,false);
 const directory=instance.root.querySelector('[data-jev-directory]');
 if(directory){directory.hidden=!instance.showAll;directory.innerHTML=instance.showAll?'<div class="jev-directory-title">All '+graph.nodes.length+' people · tap a name to open or center</div><div class="jev-directory-list">'+graph.nodes.map(n=>'<button type="button" data-person-entry="'+n.id.replace(/"/g,'&quot;')+'"><b>'+txt(n.name).replace(/[&<>]/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[k]))+'</b><small>'+txt(n.relation||n.status||'').replace(/[&<>]/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[k]))+'</small></button>').join('')+'</div>':''}

 instance.count.textContent=graph.nodes.length+' visible of '+full.nodes.length+' people · '+graph.edges.length+' links'+(instance.showAll?' · full tree':' · focused branch');
 instance.disclaimer.textContent=graph.research?'Private research assertions, not automatically verified kinship.':'Canonical family evidence; dashed amber links are unverified or unresolved.';
}
function download(data,mime,name){
 const u=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
}

function printTree(i,paper='A3'){
 if(!i?.svg||!i.box)return;
 const clone=i.svg.cloneNode(true),v=clone.querySelector('.jev-viewport');
 const width=Math.max(390,Number(i.box.width)||390),height=Math.max(420,Number(i.box.height)||420);
 clone.setAttribute('viewBox','0 0 '+width+' '+height);
 clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));
 clone.setAttribute('xmlns',NS);
 if(v)v.removeAttribute('transform');
 const style=element('style');
 style.textContent='.jev-node rect{fill:#f3faf9;stroke:#527e83;stroke-width:2}.jev-node.root rect{fill:#b8f6ed;stroke:#068980;stroke-width:3}.jev-node.research rect{fill:#fbf2df;stroke:#a27d38;stroke-dasharray:5 5}.jev-node text{fill:#123540;font:700 12px system-ui}.jev-node .jev-secondary{font:10px system-ui;fill:#506c73}.jev-edge{fill:none;stroke:#477b85;stroke-width:2}.jev-edge.research{stroke:#ab8245;stroke-dasharray:6 5}';
 clone.insertBefore(style,clone.firstChild);
 const escapeHtml=x=>String(x||'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
 const title=escapeHtml(i.data?.person?.display_name_ar||'Family tree');
 const pageSize=paper==='A4'?'A4 landscape':'A3 landscape';
 const graphHeight=paper==='A4'?'145mm':'230mm';
 const popup=window.open('','_blank','width=1150,height=800');
 if(!popup){i.disclaimer.textContent='Enable popups to print the family tree, or use Export SVG.';return}
 popup.opener=null;
 const html='<!doctype html><html><head><meta charset="utf-8"><title>'+title+' · JEV '+paper+'</title><style>@page{size:'+pageSize+';margin:11mm}html,body{font:12px system-ui;color:#163643;background:#fff;margin:0}h1{font-size:18px;margin:0 0 5px}.meta{font-size:10px;color:#63767c;margin-bottom:8px}.page{padding:4mm}svg{display:block;width:100%;height:auto;max-height:'+graphHeight+';object-fit:contain}footer{font-size:10px;color:#52676e;margin-top:10px;border-top:1px solid #d9e4e5;padding-top:6px}@media print{.page{padding:0}svg{max-height:'+graphHeight+';}}</style></head><body><div class="page"><h1>'+title+'</h1><div class="meta">Family relationship graph · printed '+new Date().toLocaleDateString()+' · '+paper+' landscape</div>'+new XMLSerializer().serializeToString(clone)+'<footer>Source-linked and unverified relationships must be distinguished. Historical graph, not proof of civil or current ownership status.</footer></div></body></html>';
 popup.document.open();popup.document.write(html);popup.document.close();
 popup.onload=()=>{popup.focus();popup.print()};
}
function mount(host,data,options={}){
 if(!host)return;
 host.querySelector('.jev-shell')?.remove();
 const root=document.createElement('div');root.className='jev-shell';
 root.innerHTML='<div class="jev-head"><div><div class="jev-kicker">JEV · PRIVATE FAMILY GRAPH</div><div class="jev-brand">Family universe</div><div class="jev-head-sub" data-count></div></div><div class="jev-root-menu"><button type="button" data-mode="canonical" class="active">Civil graph</button><button type="button" data-mode="research" hidden>Research Atlas</button></div></div>'+
 '<div class="jev-toolbar"><button data-act="home">Focus person</button><button data-act="all">Full tree</button><button data-act="branch">Branch</button><button data-act="fit">Fit</button><button data-act="print">Print A3</button><button data-act="download">Export SVG</button></div>'+ 
 '<details class="jev-advanced"><summary>More graph controls</summary><div class="jev-toolbar"><button data-act="in">Zoom in</button><button data-act="out">Zoom out</button><button data-act="more">Explore generations</button><button data-act="print-a4">Print A4</button></div></details>'+
 '<input class="jev-search" type="search" placeholder="Search a person or branch…" aria-label="Find person in JEV tree">'+
 '<div class="jev-selected" data-jev-selected aria-live="polite">Tap any person to see their identity and open the linked dossier.</div><div class="jev-directory" data-jev-directory hidden></div>'+ 
 '<div class="jev-stage"><svg class="jev-svg" aria-label="JEV interactive relationship map"></svg></div><div class="jev-legend"><span><i></i> Source-linked</span><span class="unverified"><i></i> Unverified</span><span>Pinch to zoom · Drag to pan · Tap a person</span></div>'+
 '<div class="jev-inspector"><b data-name>Choose a person</b><div class="meta" data-detail></div><div class="actions"><button data-act="focus">Focus branch</button><button data-act="open">Open dossier</button></div></div>'+
 '<div class="jev-options"><details><summary>Research notes / options</summary><div class="inside"><p class="tiny">Notes are temporary on this device, not a change to official records.</p><textarea data-notes placeholder="Research note…"></textarea><div class="actions"><button data-act="save">Save session note</button><button data-act="queue">Queue source verification</button><button data-act="export">Export notes</button></div></div></details></div>'+
 '<div class="jev-notice" data-disclaimer></div>';
 host.prepend(root);
 let notes={};try{notes=JSON.parse(sessionStorage.getItem('jev_private_notes')||'{}')}catch{}
 const i={root,data,options,atlas:options.atlas||null,mode:'canonical',researchFocus:'dany',selected:null,notes,svg:root.querySelector('svg'),name:root.querySelector('[data-name]'),detail:root.querySelector('[data-detail]'),count:root.querySelector('[data-count]'),open:root.querySelector('[data-act="open"]'),noteInput:root.querySelector('[data-notes]'),disclaimer:root.querySelector('[data-disclaimer]'),offset:{x:0,y:0,z:1},showAll:false,focusDepth:1,branchFocus:null};
 active.set(host,i);
 root.addEventListener('click',async e=>{
 const node=e.target.closest('[data-node]');if(node){const n=i.graph.nodes.find(x=>x.id===node.dataset.node);focusNode(i,node.dataset.node);if(n?.pid&&i.options.onOpen){i.options.onOpen(n.pid)}else{i.showAll=false;i.branchFocus=n?.id;i.focusDepth=1;render(i)}return}
 const entry=e.target.closest('[data-person-entry]');if(entry){const n=i.fullGraph?.nodes.find(x=>x.id===entry.dataset.personEntry);if(n?.pid&&i.options.onOpen){i.options.onOpen(n.pid)}else if(n){i.showAll=false;i.branchFocus=n.id;i.focusDepth=1;render(i)}return}
 const mode=e.target.closest('[data-mode]');if(mode){if(mode.dataset.mode==='research'&&!i.atlas)return;i.mode=mode.dataset.mode;
  root.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===mode));render(i);return}
 const act=e.target.closest('[data-act]')?.dataset.act;if(!act)return;
 if(act==='in'||act==='out'){i.offset.z=Math.max(.25,Math.min(4,i.offset.z*(act==='in'?1.3:.77)));transform(i)}
 if(act==='fit'){const z=Math.min(.95,350/Math.max(i.box.width,1),355/Math.max(i.box.height,1));i.offset={x:195-i.box.width*z/2,y:210-i.box.height*z/2,z};transform(i);i.disclaimer.textContent='Fit shows a small overview; tap + to read a name or select one from the directory above.'}
 if(act==='all'){i.showAll=!i.showAll;i.focusDepth=1;render(i);root.querySelector('[data-act="all"]').textContent=i.showAll?'Focus branch':'Full tree'}
 if(act==='branch'){i.showAll=false;i.branchFocus=i.selected;i.focusDepth=Math.min(3,(i.focusDepth||1)+1);root.querySelector('[data-act="all"]').textContent='Full tree';render(i)}
 if(act==='home'){i.showAll=false;i.focusDepth=1;i.branchFocus=null;render(i);root.querySelector('[data-act="all"]').textContent='Full tree'}
 if(act==='print')printTree(i,'A3');
 if(act==='print-a4')printTree(i,'A4');
 if(act==='download'){const clone=i.svg.cloneNode(true),g=clone.querySelector('.jev-viewport');clone.setAttribute('viewBox','0 0 '+i.box.width+' '+i.box.height);clone.setAttribute('width',i.box.width);clone.setAttribute('height',i.box.height);clone.setAttribute('xmlns',NS);if(g)g.removeAttribute('transform');const style=element('style');style.textContent='.jev-node rect{fill:#e8f6f6;stroke:#527e83;stroke-width:2}.jev-node.root rect{fill:#b8f6ed;stroke:#068980;stroke-width:3}.jev-node.research rect{fill:#fbf2df;stroke:#a27d38;stroke-dasharray:5 5}.jev-node text{fill:#123540;font:700 12px system-ui}.jev-node .jev-secondary{font:10px system-ui;fill:#506c73}.jev-edge{fill:none;stroke:#477b85;stroke-width:2}.jev-edge.research{stroke:#ab8245;stroke-dasharray:6 5}';clone.insertBefore(style,clone.firstChild);download(new XMLSerializer().serializeToString(clone),'image/svg+xml','JEV_private_tree.svg')}
 if(act==='focus'){const n=i.graph.nodes.find(x=>x.id===i.selected);if(!n)return;i.branchFocus=n.id;i.focusDepth=1;i.showAll=false;if(i.mode==='research'&&n.key)i.researchFocus=n.key;render(i)}
 if(act==='open'){const n=i.graph.nodes.find(x=>x.id===i.selected);if(n?.pid&&i.options.onOpen)i.options.onOpen(n.pid)}
 if(act==='more'){if(i.options.onExpand)i.options.onExpand();else i.disclaimer.textContent='More generations require a protected source query.'}
 if(act==='save'){i.notes[i.selected]=i.noteInput.value.slice(0,2000);try{sessionStorage.setItem('jev_private_notes',JSON.stringify(i.notes))}catch{}i.disclaimer.textContent='Session note saved locally, official data unchanged.'}
 if(act==='queue'){
  const note=i.noteInput.value.trim();if(!note){i.disclaimer.textContent='Add the source or missing relation before queuing.';return}
  const personId=Number(i.data?.person?.person_id||0),label=i.graph?.nodes?.find(x=>x.id===i.selected)?.name||'Unresolved branch';
  i.disclaimer.textContent='Saving to your private case authority…';
  try{
   const res=await fetch('/reality-api/investigations/track',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:'JEV family research: '+personId+' / '+i.selected,kind:'FAMILY_LEAD',state:'OPEN_RESEARCH',person_id:personId||null,person_label:label,next_action:note.slice(0,280)})});
   if(!res.ok)throw Error('Private case service unavailable');
   i.disclaimer.textContent='Verification task saved privately. No genealogical record was promoted or modified.';
  }catch(err){i.disclaimer.textContent='Not saved: '+String(err.message||err)}
 }
 if(act==='export')download(JSON.stringify({kind:'PRIVATE_JEV_NOTES',notes:i.notes},null,2),'application/json','JEV_private_notes.json');
 });
 root.addEventListener('keydown',e=>{const n=e.target.closest('[data-node]');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();n.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
 root.querySelector('.jev-search').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase().trim();for(const n of root.querySelectorAll('[data-node]')){const v=i.graph.nodes.find(x=>x.id===n.dataset.node);n.classList.toggle('dimmed',!!q&&!v?.name.toLocaleLowerCase().includes(q))}if(q){const first=(i.fullGraph?.nodes||i.graph.nodes).find(x=>x.name.toLocaleLowerCase().includes(q));if(first){i.branchFocus=first.id;i.showAll=false;i.focusDepth=1;render(i);focusNode(i,first.id)}}});
 const activePointers=new Map();
 let drag=null,pinch=null;
 const localPoint=e=>{const b=i.svg.getBoundingClientRect();return{x:(e.clientX-b.left)*390/Math.max(1,b.width),y:(e.clientY-b.top)*420/Math.max(1,b.height)}};
 const zoomAround=(x,y,factor)=>{
  const oldZ=i.offset.z,wx=(x-i.offset.x)/oldZ,wy=(y-i.offset.y)/oldZ;
  const z=Math.max(.25,Math.min(6,oldZ*factor));
  i.offset.z=z;i.offset.x=x-wx*z;i.offset.y=y-wy*z;transform(i);
 };
 i.svg.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')e.preventDefault();
  const p=localPoint(e),node=!!e.target.closest('[data-node]');
  activePointers.set(e.pointerId,p);
  if(activePointers.size===2){
   const [a,b]=[...activePointers.values()],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
   pinch={dist:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),z:i.offset.z,wx:(cx-i.offset.x)/i.offset.z,wy:(cy-i.offset.y)/i.offset.z};
   drag=null;
  }else if(activePointers.size===1&&!node){
   drag={id:e.pointerId,x:p.x,y:p.y,ox:i.offset.x,oy:i.offset.y};
  }
  if(!node||activePointers.size>=2){try{i.svg.setPointerCapture(e.pointerId)}catch(_){}}
 });
 i.svg.addEventListener('pointermove',e=>{
  if(!activePointers.has(e.pointerId))return;
  const p=localPoint(e);activePointers.set(e.pointerId,p);
  if(pinch&&activePointers.size>=2){
   const [a,b]=[...activePointers.values()],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
   const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),z=Math.max(.25,Math.min(6,pinch.z*d/pinch.dist));
   i.offset.z=z;i.offset.x=cx-pinch.wx*z;i.offset.y=cy-pinch.wy*z;transform(i);
  }else if(drag?.id===e.pointerId){
   i.offset.x=drag.ox+p.x-drag.x;i.offset.y=drag.oy+p.y-drag.y;transform(i);
  }
 });
 function releasePointer(e){
  activePointers.delete(e.pointerId);
  if(activePointers.size<2)pinch=null;
  if(activePointers.size===1){
   const [id,p]=activePointers.entries().next().value;
   drag={id,x:p.x,y:p.y,ox:i.offset.x,oy:i.offset.y};
  }else drag=null;
  try{if(i.svg.hasPointerCapture(e.pointerId))i.svg.releasePointerCapture(e.pointerId)}catch(_){}
 }
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])i.svg.addEventListener(ev,releasePointer);
 i.svg.addEventListener('wheel',e=>{e.preventDefault();const p=localPoint(e);zoomAround(p.x,p.y,e.deltaY<0?1.13:.885)},{passive:false});
 setAtlas(host,options.atlas||null,false);render(i);return i;
}
function setAtlas(host,atlas,refresh=true){const i=active.get(host);if(!i)return;i.atlas=atlas;const button=i.root.querySelector('[data-mode="research"]');button.hidden=!atlas?.persons?.length;if(refresh&&i.mode==='research')render(i)}
function snapshot(host){
 const i=active.get(host);if(!i)return null;
 return {version:1,mode:i.mode,showAll:!!i.showAll,focusDepth:Number(i.focusDepth||1),
  branchFocus:i.branchFocus||null,selected:i.selected||null,researchFocus:i.researchFocus||'dany',
  offset:{x:Number(i.offset.x||0),y:Number(i.offset.y||0),z:Number(i.offset.z||1)}};
}
function restore(host,state){
 const i=active.get(host);if(!i||!state||state.version!==1)return false;
 i.mode=state.mode==='research'&&i.atlas?'research':'canonical';
 i.showAll=!!state.showAll;
 i.focusDepth=Math.min(3,Math.max(1,Number(state.focusDepth||1)));
 i.branchFocus=String(state.branchFocus||'')||null;
 i.researchFocus=String(state.researchFocus||'dany');
 i.root.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===i.mode));
 render(i);
 i.root.querySelector('[data-act="all"]').textContent=i.showAll?'Focus branch':'Full tree';
 if(state.selected&&i.graph.nodes.some(n=>n.id===state.selected))focusNode(i,state.selected,false);
 const v=state.offset;
 if(v&&[v.x,v.y,v.z].every(Number.isFinite)&&v.z>=.25&&v.z<=4){
  i.offset={x:v.x,y:v.y,z:v.z};transform(i);
 }
 return true;
}
window.JEV={mount,setAtlas,snapshot,restore,getDossier:host=>active.get(host)?.data||null,buildCanonical,buildResearch,ready:true};
})();
