
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg',active=new WeakMap(),txt=x=>String(x??''),pid=x=>Number.isInteger(Number(x))&&Number(x)>0?Number(x):null;
function canon(p){return{id:'c:'+txt(p?.person_id||p?.child_person_id||p?.parent_person_id),pid:pid(p?.person_id||p?.child_person_id||p?.parent_person_id),name:txt(p?.display_name_ar||p?.name||p?.label_first||'Unresolved'),year:txt(p?.birth_year||p?.birth_date||'').slice(0,4),status:'Source-linked'}}
function buildCanonical(d){
 const nodes=new Map(),edges=[],self=canon(d.person||{});self.gen=0;self.root=true;nodes.set(self.id,self);
 function link(p,depth,from,type,uncertain=false){
  if(!p)return '';
  let n=canon(p);
  if(!n.pid){n.id='u:'+from+':'+type+':'+txt(p.label_first);n.name=txt([p.label_first,p.label_family].filter(Boolean).join(' ')||'Unresolved');uncertain=true}
  if(!nodes.has(n.id))nodes.set(n.id,{...n,gen:depth,uncertain});
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
 instance.name.textContent=n.name;instance.detail.textContent=[n.year,n.status,n.uncertain?'Unverified candidate':'Source-linked','Generation offset '+n.gen].filter(Boolean).join(' · ');
 instance.open.disabled=!n.pid;
 instance.noteInput.value=instance.notes[nid]||'';
 if(move){const p=instance.box.positions.get(nid);if(p){instance.offset.x=instance.box.width/2-p.x*instance.offset.z;instance.offset.y=instance.box.height/2-p.y*instance.offset.z;transform(instance)}}
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
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height);
 const group=element('g',{class:'jev-viewport'});instance.group=group;svg.appendChild(group);
 for(const e of graph.edges){const a=box.positions.get(e.from),b=box.positions.get(e.to);if(!a||!b)continue;
 const line=element('path',{class:'jev-edge'+(e.uncertain?' research':''),d:'M'+a.x+' '+(a.y+29)+' C'+a.x+' '+((a.y+b.y)/2)+' '+b.x+' '+((a.y+b.y)/2)+' '+b.x+' '+(b.y-29)});
 group.appendChild(line)}
 for(const n of graph.nodes){const p=box.positions.get(n.id);if(!p)continue;
 const gr=element('g',{class:'jev-node'+(n.root?' root':'')+(n.uncertain?' research':''),transform:'translate('+(p.x-77)+','+(p.y-32)+')',tabindex:0,role:'button','aria-label':n.name,'data-node':n.id});
 gr.appendChild(element('rect',{width:154,height:64,rx:13}));
 const t=element('text',{x:12,y:26});t.textContent=n.name.length>21?n.name.slice(0,20)+'…':n.name;gr.appendChild(t);
 const sub=element('text',{x:12,y:48,class:'jev-secondary'});sub.textContent=[n.year,n.uncertain?'◇ RESEARCH':'● SOURCE'].filter(Boolean).join(' · ');gr.appendChild(sub);group.appendChild(gr)}
 instance.offset={x:0,y:0,z:instance.showAll?1:1.12};transform(instance);focusNode(instance,graph.focus,true);
 instance.count.textContent=graph.nodes.length+' visible of '+full.nodes.length+' people · '+graph.edges.length+' links'+(instance.showAll?' · full tree':' · focused branch');
 instance.disclaimer.textContent=graph.research?'Private research assertions, not automatically verified kinship.':'Canonical family evidence; dashed amber links are unverified or unresolved.';
}
function download(data,mime,name){
 const u=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
function mount(host,data,options={}){
 if(!host)return;
 host.querySelector('.jev-shell')?.remove();
 const root=document.createElement('div');root.className='jev-shell';
 root.innerHTML='<div class="jev-head"><div><div class="jev-kicker">JEV · PRIVATE FAMILY GRAPH</div><div class="jev-brand">Family universe</div><div class="jev-head-sub" data-count></div></div><div class="jev-root-menu"><button type="button" data-mode="canonical" class="active">Civil graph</button><button type="button" data-mode="research" hidden>Research Atlas</button></div></div>'+
 '<div class="jev-toolbar"><button data-act="home">⌂ Home</button><button data-act="all">Full tree</button><button data-act="branch">Expand branch</button><button data-act="in">＋</button><button data-act="out">−</button><button data-act="fit">Fit</button><button data-act="print">Print</button><button data-act="download">Export SVG</button><button data-act="more">+ Generations</button></div>'+
 '<input class="jev-search" type="search" placeholder="Search a person or branch…" aria-label="Find person in JEV tree">'+
 '<div class="jev-stage"><svg class="jev-svg" aria-label="JEV interactive relationship map"></svg></div><div class="jev-legend"><span><i></i> Source-linked</span><span class="unverified"><i></i> Unverified</span><span>Tap a person to inspect</span></div>'+
 '<div class="jev-inspector"><b data-name>Choose a person</b><div class="meta" data-detail></div><div class="actions"><button data-act="focus">Focus branch</button><button data-act="open">Open dossier</button></div></div>'+
 '<div class="jev-options"><details><summary>Research notes / options</summary><div class="inside"><p class="tiny">Notes are temporary on this device, not a change to official records.</p><textarea data-notes placeholder="Research note…"></textarea><div class="actions"><button data-act="save">Save session note</button><button data-act="queue">Queue source verification</button><button data-act="export">Export notes</button></div></div></details></div>'+
 '<div class="jev-notice" data-disclaimer></div>';
 host.prepend(root);
 let notes={};try{notes=JSON.parse(sessionStorage.getItem('jev_private_notes')||'{}')}catch{}
 const i={root,data,options,atlas:options.atlas||null,mode:'canonical',researchFocus:'dany',selected:null,notes,svg:root.querySelector('svg'),name:root.querySelector('[data-name]'),detail:root.querySelector('[data-detail]'),count:root.querySelector('[data-count]'),open:root.querySelector('[data-act="open"]'),noteInput:root.querySelector('[data-notes]'),disclaimer:root.querySelector('[data-disclaimer]'),offset:{x:0,y:0,z:1},showAll:false,focusDepth:1,branchFocus:null};
 active.set(host,i);
 root.addEventListener('click',async e=>{
 const node=e.target.closest('[data-node]');if(node){focusNode(i,node.dataset.node);return}
 const mode=e.target.closest('[data-mode]');if(mode){if(mode.dataset.mode==='research'&&!i.atlas)return;i.mode=mode.dataset.mode;
  root.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===mode));render(i);return}
 const act=e.target.closest('[data-act]')?.dataset.act;if(!act)return;
 if(act==='in'||act==='out'){i.offset.z=Math.max(.25,Math.min(4,i.offset.z*(act==='in'?1.3:.77)));transform(i)}
 if(act==='fit'){i.offset={x:0,y:0,z:1};transform(i)}
 if(act==='all'){i.showAll=!i.showAll;i.focusDepth=1;render(i);root.querySelector('[data-act="all"]').textContent=i.showAll?'Focus branch':'Full tree'}
 if(act==='branch'){i.showAll=false;i.branchFocus=i.selected;i.focusDepth=Math.min(3,(i.focusDepth||1)+1);root.querySelector('[data-act="all"]').textContent='Full tree';render(i)}
 if(act==='home'){i.showAll=false;i.focusDepth=1;i.branchFocus=null;render(i);root.querySelector('[data-act="all"]').textContent='Full tree'}
 if(act==='print'){const old={...i.offset};i.offset={x:0,y:0,z:1};transform(i);window.addEventListener('afterprint',()=>{i.offset=old;transform(i)},{once:true});window.print()}
 if(act==='download'){const clone=i.svg.cloneNode(true),g=clone.querySelector('.jev-viewport');if(g)g.removeAttribute('transform');const style=element('style');style.textContent='.jev-node rect{fill:#e8f6f6;stroke:#527e83;stroke-width:2}.jev-node.root rect{fill:#b8f6ed;stroke:#068980;stroke-width:3}.jev-node.research rect{fill:#fbf2df;stroke:#a27d38;stroke-dasharray:5 5}.jev-node text{fill:#123540;font:700 12px system-ui}.jev-node .jev-secondary{font:10px system-ui;fill:#506c73}.jev-edge{fill:none;stroke:#477b85;stroke-width:2}.jev-edge.research{stroke:#ab8245;stroke-dasharray:6 5}';clone.insertBefore(style,clone.firstChild);download(new XMLSerializer().serializeToString(clone),'image/svg+xml','JEV_private_tree.svg')}
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
 root.addEventListener('keydown',e=>{const n=e.target.closest('[data-node]');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();focusNode(i,n.dataset.node)}});
 root.querySelector('.jev-search').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase().trim();for(const n of root.querySelectorAll('[data-node]')){const v=i.graph.nodes.find(x=>x.id===n.dataset.node);n.classList.toggle('dimmed',!!q&&!v?.name.toLocaleLowerCase().includes(q))}if(q){const first=(i.fullGraph?.nodes||i.graph.nodes).find(x=>x.name.toLocaleLowerCase().includes(q));if(first){i.branchFocus=first.id;i.showAll=false;i.focusDepth=1;render(i);focusNode(i,first.id)}}});
 let drag=null;
 i.svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-node]'))return;drag={x:e.clientX,y:e.clientY,ox:i.offset.x,oy:i.offset.y};i.svg.setPointerCapture(e.pointerId)});
 i.svg.addEventListener('pointermove',e=>{if(!drag)return;const b=i.svg.getBoundingClientRect();i.offset.x=drag.ox+(e.clientX-drag.x)*i.box.width/b.width;i.offset.y=drag.oy+(e.clientY-drag.y)*i.box.height/b.height;transform(i)});
 for(const ev of ['pointerup','pointercancel'])i.svg.addEventListener(ev,()=>drag=null);
 i.svg.addEventListener('wheel',e=>{e.preventDefault();i.offset.z=Math.max(.25,Math.min(4,i.offset.z*(e.deltaY<0?1.1:.91)));transform(i)},{passive:false});
 setAtlas(host,options.atlas||null,false);render(i);return i;
}
function setAtlas(host,atlas,refresh=true){const i=active.get(host);if(!i)return;i.atlas=atlas;const button=i.root.querySelector('[data-mode="research"]');button.hidden=!atlas?.persons?.length;if(refresh&&i.mode==='research')render(i)}
window.JEV={mount,setAtlas,buildCanonical,buildResearch,ready:true};
})();
