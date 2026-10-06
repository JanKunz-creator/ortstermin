const STORAGE_KEY='wertaufnahme-v3';
let store=loadStore();
let activeProjectId=store.activeProjectId||null;
let currentView=activeProjectId?'object':'dashboard',currentBuilding=null,currentUnit=null;

function uid(){return Math.random().toString(36).slice(2,10)}
function freshProject(name='Neuer Auftrag'){return{id:'pr_'+uid(),name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),object:{},buildings:[]}}
function loadStore(){
  try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY));if(v&&Array.isArray(v.projects))return v}catch(e){}
  try{
    const old=JSON.parse(localStorage.getItem('wertaufnahme-v1'));
    if(old&&Array.isArray(old.buildings)){
      const p=freshProject(old.object?.objectAddress||'Übernommener Auftrag');p.object=old.object||{};p.buildings=old.buildings||[];
      const migrated={version:3,projects:[p],activeProjectId:p.id};localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated
    }
  }catch(e){}
  return{version:3,projects:[],activeProjectId:null}
}
function project(){return store.projects.find(p=>p.id===activeProjectId)||null}
function save(){const p=project();if(p)p.updatedAt=new Date().toISOString();store.activeProjectId=activeProjectId;localStorage.setItem(STORAGE_KEY,JSON.stringify(store));const s=document.getElementById('saveStatus');if(s)s.textContent='gespeichert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}
function esc(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function getObj(){const p=project();if(!p)return null;if(currentView==='object')return p.object;if(currentView==='buildings')return p.buildings.find(b=>b.id===currentBuilding)?.data;if(currentView==='units'){let b=p.buildings.find(b=>b.id===currentBuilding);return b?.units.find(u=>u.id===currentUnit)?.data}return null}
function setVal(key,val){const o=getObj();if(!o)return;o[key]=val;const p=project();if(currentView==='object'&&key==='objectAddress'&&String(val).trim()&&(/^Neuer Auftrag/.test(p.name)||!p.name))p.name=String(val).split('\n')[0].trim();save();renderTree()}
function renderField(f,o){const v=o?.[f.key]??(f.type==='multi'?[]:'');let html=`<div class="field"><label>${esc(f.label)}</label>`;if(f.type==='textarea')html+=`<textarea data-key="${f.key}">${esc(v)}</textarea>`;else if(['text','number','date','time'].includes(f.type))html+=`<input type="${f.type}" data-key="${f.key}" value="${esc(v)}">`;else{html+='<div class="choices">';for(const opt of f.options){const checked=f.type==='multi'?Array.isArray(v)&&v.includes(opt):v===opt;html+=`<label class="choice"><input type="${f.type==='multi'?'checkbox':'radio'}" data-key="${f.key}" value="${esc(opt)}" ${checked?'checked':''}><span>${esc(opt)}</span></label>`}html+='</div>'}if(f.help)html+=`<div class="hint">${esc(f.help)}</div>`;return html+'</div>'}
function bindInputs(){document.querySelectorAll('[data-key]').forEach(el=>{el.addEventListener('change',e=>{const key=e.target.dataset.key;if(e.target.type==='checkbox'){const o=getObj();let arr=Array.isArray(o[key])?[...o[key]]:[];if(e.target.checked&&!arr.includes(e.target.value))arr.push(e.target.value);if(!e.target.checked)arr=arr.filter(x=>x!==e.target.value);setVal(key,arr)}else setVal(key,e.target.value)});if(el.tagName==='TEXTAREA'||['text','number','date','time'].includes(el.type))el.addEventListener('input',e=>setVal(e.target.dataset.key,e.target.value))})}
function completeness(sections,data){let total=0,done=0;sections.forEach(s=>s.fields.forEach(f=>{total++;const v=data?.[f.key];if(Array.isArray(v)?v.length>0:String(v??'').trim()!=='')done++}));return total?Math.round(done/total*100):0}
function page(title,subtitle,sections,data,actions=''){const pct=completeness(sections,data||{});return `<div class="card hero"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><div class="progress"><span style="width:${pct}%"></span></div><div class="hint">${pct}% der Felder belegt</div></div><div class="actions">${actions}</div></div>`+sections.map(s=>`<section class="card section"><h2>${esc(s.title)}</h2><div class="grid">${s.fields.map(f=>renderField(f,data||{})).join('')}</div></section>`).join('')}
function scopeInfo(){const p=project();if(!p)return null;if(currentView==='object')return{type:'object',id:'object',title:'Fotos Objekt / Lage'};if(currentView==='buildings')return{type:'building',id:currentBuilding,title:'Fotos Gebäude'};if(currentView==='units')return{type:'unit',id:currentUnit,title:'Fotos Nutzungseinheit'};return null}
function photoShell(){const s=scopeInfo();if(!s)return'';return `<section class="card section" id="photoSection"><h2>${s.title}</h2><div class="photobar"><label class="btn primary photoadd">+ Foto aufnehmen / auswählen<input class="hidden" type="file" accept="image/*" capture="environment" multiple onchange="handlePhotos(this,'${s.type}','${s.id}')"></label><span class="hint">Fotos werden lokal auf diesem Gerät gespeichert und funktionieren auch offline.</span></div><div id="gallery" class="gallery"><div class="hint">Fotos werden geladen …</div></div></section>`}
async function refreshGallery(){const s=scopeInfo(),p=project(),g=document.getElementById('gallery');if(!s||!p||!g)return;try{const photos=await listPhotos(p.id,s.type,s.id);if(!photos.length){g.innerHTML='<div class="hint">Noch keine Fotos hinterlegt.</div>';return}g.innerHTML='';for(const ph of photos){const url=URL.createObjectURL(ph.blob),d=document.createElement('div');d.className='photoitem';d.innerHTML=`<img src="${url}" alt="Ortstermin Foto"><div class="photoinfo"><textarea placeholder="Bildnotiz" data-photo-note="${ph.id}">${esc(ph.note||'')}</textarea><div class="photoactions"><button class="tiny" data-delete-photo="${ph.id}">Löschen</button></div></div>`;g.appendChild(d);d.querySelector('[data-photo-note]').addEventListener('change',e=>updatePhotoNote(ph.id,e.target.value));d.querySelector('[data-delete-photo]').addEventListener('click',async()=>{if(confirm('Foto löschen?')){await deletePhoto(ph.id);refreshGallery()}})}}catch(e){g.innerHTML='<div class="hint">Fotospeicher konnte nicht geöffnet werden.</div>'}}
async function handlePhotos(inp,scopeType,scopeId){const p=project();if(!p)return;const files=[...(inp.files||[])];for(const f of files)await addPhoto(p.id,scopeType,scopeId,f,'');inp.value='';refreshGallery()}
function renderTree(){const t=document.getElementById('tree');if(!t)return;const p=project();if(!p){t.innerHTML='<div class="hint" style="padding:8px">Bitte einen Auftrag öffnen.</div>';return}let h=`<div class="treehead"><span>${esc(p.name)}</span><button class="tiny" onclick="goDashboard()">Aufträge</button></div><div class="treehead"><span>Objektstruktur</span><button class="tiny" onclick="addBuilding()">+ Gebäude</button></div>`;if(!p.buildings.length)h+='<div class="hint" style="padding:8px">Noch kein Gebäude angelegt.</div>';p.buildings.forEach((b,i)=>{h+=`<button class="treebtn ${currentView==='buildings'&&currentBuilding===b.id?'active':''}" onclick="openBuilding('${b.id}')">${esc(b.name||'Gebäude '+(i+1))}</button>`;b.units.forEach((u,j)=>h+=`<button class="treebtn treeunit ${currentView==='units'&&currentUnit===u.id?'active':''}" onclick="openUnit('${b.id}','${u.id}')">↳ ${esc(u.name||'Einheit '+(j+1))}</button>`);h+=`<div style="padding:0 10px 6px"><button class="tiny" onclick="addUnit('${b.id}')">+ Einheit</button></div>`});t.innerHTML=h}
function goDashboard(){activeProjectId=null;currentView='dashboard';currentBuilding=null;currentUnit=null;save();syncNav();render()}
function newProject(){const name=prompt('Auftragsbezeichnung oder Anschrift','Neuer Auftrag');if(name===null)return;const p=freshProject(name.trim()||'Neuer Auftrag');const nr=prompt('Aktenzeichen / Auftragsnummer (optional)','');if(nr!==null)p.fileNumber=nr.trim();const client=prompt('Auftraggeber (optional)','');if(client!==null)p.client=client.trim();store.projects.unshift(p);activeProjectId=p.id;currentView='object';save();syncNav();render()}
function openProject(id){activeProjectId=id;currentView='object';currentBuilding=null;currentUnit=null;save();syncNav();render()}
function renameProject(id){const p=store.projects.find(x=>x.id===id);if(!p)return;const n=prompt('Auftragsbezeichnung',p.name);if(n!==null&&n.trim()){p.name=n.trim();p.updatedAt=new Date().toISOString();save();render()}}
async function deleteProject(id){const p=store.projects.find(x=>x.id===id);if(!p||!confirm('Auftrag "'+p.name+'" mit allen Eingaben und Fotos löschen?'))return;await deleteProjectPhotos(id);store.projects=store.projects.filter(x=>x.id!==id);if(activeProjectId===id)activeProjectId=null;localStorage.setItem(STORAGE_KEY,JSON.stringify(store));currentView='dashboard';render()}
function renderDashboard(){const m=document.getElementById('main');let cards=store.projects.map(p=>{const address=(p.object?.objectAddress||'').split('\n')[0];const units=(p.buildings||[]).reduce((n,b)=>n+(b.units?.length||0),0);return`<div class="card projectcard"><div class="projecthead"><h3>${esc(p.name||address||'Ohne Bezeichnung')}</h3><span class="badge">${p.buildings?.length||0} Geb. · ${units} Einh.</span></div><div class="projectmeta">${esc(address||'Noch keine Anschrift')}</div><div class="projectmeta">${p.fileNumber?'Az.: '+esc(p.fileNumber):''}${p.client?' · '+esc(p.client):''}</div><div class="projectmeta">zuletzt: ${new Date(p.updatedAt||p.createdAt).toLocaleString('de-DE')}</div><div class="actions" style="margin-top:12px"><button class="btn primary" onclick="openProject('${p.id}')">Öffnen</button><button class="btn" onclick="renameProject('${p.id}')">Umbenennen</button><button class="btn danger" onclick="deleteProject('${p.id}')">Löschen</button></div></div>`}).join('');m.innerHTML=`<div class="card hero"><div><h1>Aufträge</h1><p>Mehrere Ortstermine getrennt verwalten. Jeder Auftrag hat eigene Gebäude, Einheiten und Fotos.</p></div><div class="actions"><button class="btn primary" onclick="newProject()">+ Neuer Auftrag</button></div></div><div class="projectgrid">${cards||'<div class="card empty">Noch keine Aufträge vorhanden.<br><br><button class="btn primary" onclick="newProject()">Ersten Auftrag anlegen</button></div>'}</div>`;renderTree()}
function addBuilding(){const p=project();if(!p)return;const n=p.buildings.length+1,b={id:uid(),name:'Gebäude '+n,data:{},units:[]};p.buildings.push(b);currentBuilding=b.id;currentView='buildings';save();syncNav();render()}
function addUnit(bid){const p=project(),b=p?.buildings.find(x=>x.id===bid);if(!b)return;const u={id:uid(),name:'Einheit '+(b.units.length+1),data:{}};b.units.push(u);currentBuilding=bid;currentUnit=u.id;currentView='units';save();syncNav();render()}
function duplicateUnit(bid,uidv){const b=project()?.buildings.find(x=>x.id===bid),u=b?.units.find(x=>x.id===uidv);if(!u)return;const copy={id:uid(),name:u.name+' Kopie',data:JSON.parse(JSON.stringify(u.data||{}))};b.units.push(copy);currentUnit=copy.id;currentBuilding=bid;currentView='units';save();render()}
function openBuilding(id){currentBuilding=id;currentView='buildings';syncNav();render()}
function openUnit(bid,uidv){currentBuilding=bid;currentUnit=uidv;currentView='units';syncNav();render()}
function renameBuilding(id){const b=project()?.buildings.find(x=>x.id===id);if(!b)return;const n=prompt('Bezeichnung des Gebäudes',b.name);if(n!==null&&n.trim()){b.name=n.trim();save();render()}}
function renameUnit(bid,uidv){const u=project()?.buildings.find(x=>x.id===bid)?.units.find(x=>x.id===uidv);if(!u)return;const n=prompt('Bezeichnung der Nutzungseinheit',u.name);if(n!==null&&n.trim()){u.name=n.trim();save();render()}}
function removeBuilding(id){const p=project();if(!p||!confirm('Gebäude inklusive aller Einheiten löschen?'))return;p.buildings=p.buildings.filter(x=>x.id!==id);currentBuilding=p.buildings[0]?.id||null;currentView=p.buildings.length?'buildings':'object';save();syncNav();render()}
function removeUnit(bid,uidv){if(!confirm('Diese Nutzungseinheit löschen?'))return;const b=project()?.buildings.find(x=>x.id===bid);if(!b)return;b.units=b.units.filter(x=>x.id!==uidv);currentUnit=b.units[0]?.id||null;currentView=currentUnit?'units':'buildings';save();syncNav();render()}
function render(){updateConnection();syncNav();if(currentView==='dashboard'||!project()){currentView='dashboard';renderDashboard();return}renderTree();const p=project(),m=document.getElementById('main');if(currentView==='object'){m.innerHTML=page('Objekt & Lage','Erfassungsbogen Teil 1 · Grund / Boden',p1,p.object,`<button class="btn" onclick="goDashboard()">← Aufträge</button>`)+photoShell()}else if(currentView==='buildings'){let b=p.buildings.find(x=>x.id===currentBuilding)||p.buildings[0];if(!b){m.innerHTML='<div class="card empty">Noch kein Gebäude vorhanden.<br><br><button class="btn primary" onclick="addBuilding()">Erstes Gebäude anlegen</button></div>';return}currentBuilding=b.id;const acts=`<button class="btn" onclick="renameBuilding('${b.id}')">Umbenennen</button><button class="btn primary" onclick="addUnit('${b.id}')">+ Einheit</button><button class="btn danger" onclick="removeBuilding('${b.id}')">Löschen</button>`;m.innerHTML=page(b.name,'Erfassungsbogen Teil 2 · Gebäudebeschreibung',p2,b.data,acts)+photoShell()}else if(currentView==='units'){let b=p.buildings.find(x=>x.id===currentBuilding),u=b?.units.find(x=>x.id===currentUnit);if(!u){m.innerHTML='<div class="card empty">Bitte zuerst eine Nutzungseinheit anlegen.</div>';return}const acts=`<button class="btn" onclick="renameUnit('${b.id}','${u.id}')">Umbenennen</button><button class="btn" onclick="duplicateUnit('${b.id}','${u.id}')">Duplizieren</button><button class="btn danger" onclick="removeUnit('${b.id}','${u.id}')">Löschen</button>`;m.innerHTML=page(u.name,`${b.name} · Erfassungsbogen Teil 3 · Ausstattung`,p3,u.data,acts)+photoShell()}else renderExport();bindInputs();refreshGallery()}
function flatten(prefix,obj,out){Object.entries(obj||{}).forEach(([k,v])=>out[prefix+k]=Array.isArray(v)?v.join(' | '):v)}
function rowsForCSV(){const p=project(),rows=[];let base={Ebene:'Objekt',Auftrag:p.name,Aktenzeichen:p.fileNumber||'',Auftraggeber:p.client||'',Gebäude:'',Einheit:''};flatten('Lage_',p.object,base);rows.push(base);p.buildings.forEach(b=>{let r={Ebene:'Gebäude',Auftrag:p.name,Aktenzeichen:p.fileNumber||'',Auftraggeber:p.client||'',Gebäude:b.name,Einheit:''};flatten('Gebäude_',b.data,r);rows.push(r);b.units.forEach(u=>{let q={Ebene:'Einheit',Auftrag:p.name,Aktenzeichen:p.fileNumber||'',Auftraggeber:p.client||'',Gebäude:b.name,Einheit:u.name};flatten('Einheit_',u.data,q);rows.push(q)})});return rows}
function toCSV(rows){const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return'\ufeff'+cols.map(q).join(';')+'\n'+rows.map(r=>cols.map(c=>q(r[c])).join(';')).join('\n')}
function safeName(s){return String(s||'Auftrag').replace(/[^a-z0-9äöüß_-]+/gi,'_').slice(0,60)}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
async function exportJSON(){const p=project();if(!p)return;const photos=await listProjectPhotos(p.id),photoData=[];for(const ph of photos)photoData.push({id:ph.id,scopeType:ph.scopeType,scopeId:ph.scopeId,name:ph.name,type:ph.type,createdAt:ph.createdAt,note:ph.note,dataURL:await blobToDataURL(ph.blob)});const bundle={format:'wertaufnahme-project-v3',exportedAt:new Date().toISOString(),project:p,photos:photoData};download(safeName(p.name)+'_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(bundle),'application/json')}
function exportCSV(){const p=project();if(p)download(safeName(p.name)+'_'+new Date().toISOString().slice(0,10)+'.csv',toCSV(rowsForCSV()),'text/csv;charset=utf-8')}
async function importJSON(inp){const f=inp.files?.[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const s=JSON.parse(r.result);let p,photos=[];if(s.format==='wertaufnahme-project-v3'&&s.project){p=s.project;photos=s.photos||[]}else if(Array.isArray(s.buildings)){p={...freshProject(s.object?.objectAddress||'Importierter Auftrag'),object:s.object||{},buildings:s.buildings||[]}}else throw new Error();p.id='pr_'+uid();p.name=(p.name||'Importierter Auftrag')+' (Import)';p.createdAt=new Date().toISOString();p.updatedAt=p.createdAt;store.projects.unshift(p);for(const ph of photos){if(!ph.dataURL)continue;const blob=dataURLToBlob(ph.dataURL);await addPhoto(p.id,ph.scopeType,ph.scopeId,new File([blob],ph.name||'Foto',{type:ph.type||blob.type}),ph.note||'')}activeProjectId=p.id;currentView='object';save();syncNav();render();alert('Auftrag wurde importiert.')}catch(e){alert('Die Projektdatei konnte nicht gelesen werden.')}};r.readAsText(f)}
function summaryHtml(){const p=project();let h=`<section class="card section"><h2>Objektstruktur</h2><p><strong>${esc(p.object.objectAddress||p.name)}</strong></p><p>${p.buildings.length} Gebäude · ${p.buildings.reduce((n,b)=>n+b.units.length,0)} Nutzungseinheiten</p></section>`;p.buildings.forEach(b=>{h+=`<section class="card section"><h2>${esc(b.name)}</h2><p><span class="badge">Gebäude ${completeness(p2,b.data)}%</span></p><p>${b.units.map(u=>`${esc(u.name)} (${completeness(p3,u.data)}%)`).join(' · ')||'Keine Einheiten'}</p></section>`});return h}
async function renderExport(){const m=document.getElementById('main'),p=project();const photoCount=(await listProjectPhotos(p.id)).length;m.innerHTML=`<div class="card hero"><div><h1>Export & Datensicherung</h1><p>Auftrag sichern oder für die Übertragung in die Gutachtensoftware ausgeben.</p></div></div>${summaryHtml()}<section class="card section"><h2>Ausgabe</h2><div class="actions"><button class="btn primary" onclick="exportJSON()">Projektdatei inkl. Fotos (.json)</button><button class="btn" onclick="exportCSV()">Tabellendatei (.csv)</button><button class="btn" onclick="window.print()">Druckansicht / PDF</button><label class="btn">Projekt importieren<input class="hidden" type="file" accept="application/json,.json" onchange="importJSON(this)"></label></div><div class="exportbox"><strong>${photoCount} Fotos</strong> sind diesem Auftrag lokal zugeordnet. Die Projektdatei sichert Eingaben und Fotos zusammen. CSV enthält die strukturierten Text- und Auswahlwerte.</div></section>`}
function syncNav(){document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView))}
function updateConnection(){const s=document.getElementById('saveStatus');if(!s)return;const c=navigator.onLine?'online':'offline';s.innerHTML=`<span class="${c}">${c==='online'?'Online':'Offline – lokale Erfassung aktiv'}</span>`}
document.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>{const target=b.dataset.view;if(target!=='dashboard'&&!project()){newProject();return}currentView=target;if(currentView==='buildings'&&!currentBuilding)currentBuilding=project()?.buildings[0]?.id||null;if(currentView==='units'&&!currentUnit){const b=project()?.buildings[0];currentBuilding=b?.id||null;currentUnit=b?.units[0]?.id||null}syncNav();render()}));
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();



function filledValue(v){
  if(Array.isArray(v)) return v.join(', ');
  return String(v??'').trim();
}
function pdfAddLine(doc,text,x,y,maxWidth=175,lineHeight=5){
  const lines=doc.splitTextToSize(String(text),maxWidth);
  for(const line of lines){
    if(y>282){doc.addPage();y=18}
    doc.text(line,x,y);y+=lineHeight;
  }
  return y;
}
function pdfAddSection(doc,title,sections,data,y){
  doc.setFont('helvetica','bold');doc.setFontSize(12);
  y=pdfAddLine(doc,title,15,y,180,6); y+=1;
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  for(const s of sections){
    const rows=s.fields.map(f=>[f.label,filledValue(data?.[f.key])]).filter(r=>r[1]);
    if(!rows.length) continue;
    if(y>270){doc.addPage();y=18}
    doc.setFont('helvetica','bold');doc.setFontSize(10);
    y=pdfAddLine(doc,s.title,15,y,180,5.5);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    for(const [label,val] of rows){
      if(y>278){doc.addPage();y=18}
      doc.setFont('helvetica','bold');doc.text(label+':',18,y);
      doc.setFont('helvetica','normal');
      const labelWidth=Math.min(62,doc.getTextWidth(label+':')+3);
      y=pdfAddLine(doc,val,18+labelWidth,y,174-labelWidth,4.7)+1;
    }
    y+=2;
  }
  return y;
}
function findPhotoPath(p,ph,index){
  const num=String(index+1).padStart(3,'0');
  if(ph.scopeType==='object') return `01_Objekt_Lage_${num}`;
  if(ph.scopeType==='building'){
    const b=p.buildings.find(x=>x.id===ph.scopeId);
    return `02_Gebaeude_${safeName(b?.name||'Unbekannt')}_${num}`;
  }
  if(ph.scopeType==='unit'){
    let bn='Unbekannt',un='Unbekannt';
    for(const b of p.buildings){
      const u=b.units.find(x=>x.id===ph.scopeId);
      if(u){bn=b.name;un=u.name;break}
    }
    return `03_Gebaeude_${safeName(bn)}_Einheit_${safeName(un)}_${num}`;
  }
  return `99_Sonstiges_${num}`;
}
function extForPhoto(ph){
  const t=(ph.type||ph.blob?.type||'').toLowerCase();
  if(t.includes('png')) return '.png';
  if(t.includes('heic')||t.includes('heif')) return '.heic';
  if(t.includes('webp')) return '.webp';
  return '.jpg';
}
async function buildPdfBlob(photoRows=[]){
  if(!window.jspdf?.jsPDF) throw new Error('PDF-Modul nicht geladen');
  const p=project(),doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('Ortstermin – Erfassungsbericht',15,18);
  doc.setFont('helvetica','normal');doc.setFontSize(10);
  let y=27;
  y=pdfAddLine(doc,'Auftrag: '+(p.name||''),15,y);
  if(p.fileNumber)y=pdfAddLine(doc,'Aktenzeichen: '+p.fileNumber,15,y);
  if(p.client)y=pdfAddLine(doc,'Auftraggeber: '+p.client,15,y);
  y=pdfAddLine(doc,'Export: '+new Date().toLocaleString('de-DE'),15,y)+4;
  y=pdfAddSection(doc,'1. Objekt & Lage',p1,p.object,y);
  p.buildings.forEach((b,i)=>{
    if(y>250){doc.addPage();y=18}
    y=pdfAddSection(doc,`2.${i+1} Gebäude: ${b.name}`,p2,b.data,y);
    b.units.forEach((u,j)=>{
      if(y>250){doc.addPage();y=18}
      y=pdfAddSection(doc,`3.${i+1}.${j+1} Nutzungseinheit: ${u.name}`,p3,u.data,y);
    });
  });
  if(photoRows.length){
    if(y>250){doc.addPage();y=18}
    doc.setFont('helvetica','bold');doc.setFontSize(12);y=pdfAddLine(doc,'Fotoliste',15,y,180,6)+2;
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    for(const r of photoRows){
      y=pdfAddLine(doc,r.filename+(r.note?' – '+r.note:''),18,y,174,4.7)+1;
    }
  }
  return doc.output('blob');
}
async function exportPdfOnly(){
  const p=project();if(!p)return;
  try{
    const photos=await listProjectPhotos(p.id);
    const counters={};
    const rows=photos.map(ph=>{
      const key=ph.scopeType+'|'+ph.scopeId;counters[key]=(counters[key]||0)+1;
      return{filename:findPhotoPath(p,ph,counters[key]-1)+extForPhoto(ph),note:ph.note||''}
    });
    const blob=await buildPdfBlob(rows);
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=safeName(p.name)+'_Ortstermin.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }catch(e){alert('PDF konnte nicht erstellt werden: '+e.message)}
}
async function exportPackage(){
  const p=project();if(!p)return;
  if(!window.JSZip){alert('ZIP-Modul ist noch nicht geladen. Bitte die App einmal mit Internet öffnen und neu laden.');return}
  try{
    const zip=new JSZip(),photos=await listProjectPhotos(p.id),counters={},rows=[];
    for(const ph of photos){
      const key=ph.scopeType+'|'+ph.scopeId;counters[key]=(counters[key]||0)+1;
      const filename=findPhotoPath(p,ph,counters[key]-1)+extForPhoto(ph);
      rows.push({filename,note:ph.note||''});
      zip.folder('Fotos').file(filename,ph.blob);
    }
    const pdfBlob=await buildPdfBlob(rows);
    zip.file(safeName(p.name)+'_Ortstermin.pdf',pdfBlob);
    if(rows.length){
      const index='Dateiname;Bildnotiz\n'+rows.map(r=>'"'+r.filename.replace(/"/g,'""')+'";"'+String(r.note||'').replace(/"/g,'""')+'"').join('\n');
      zip.folder('Fotos').file('Fotoliste.csv','\ufeff'+index);
    }
    const out=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');a.href=URL.createObjectURL(out);a.download=safeName(p.name)+'_Ortstermin.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2500);
  }catch(e){alert('Exportpaket konnte nicht erstellt werden: '+e.message)}
}
async function renderExport(){
  const m=document.getElementById('main'),p=project();const photoCount=(await listProjectPhotos(p.id)).length;
  m.innerHTML=`<div class="card hero"><div><h1>Export & Datensicherung</h1><p>Für die Gutachtenerstellung: PDF-Bericht und Fotos mit eindeutigen Dateinamen.</p></div></div>${summaryHtml()}<section class="card section"><h2>Empfohlener Export</h2><div class="actions"><button class="btn primary" onclick="exportPackage()">PDF + Fotos als ZIP</button><button class="btn" onclick="exportPdfOnly()">Nur PDF</button></div><div class="exportbox"><strong>${photoCount} Fotos</strong> werden im ZIP in den Ordner <strong>Fotos</strong> gelegt. Die Dateinamen ergeben sich aus der Ebene, z. B. <code>02_Gebaeude_Hinterhaus_001.jpg</code> oder <code>03_Gebaeude_Vorderhaus_Einheit_EG_links_002.jpg</code>. Zusätzlich liegt eine Fotoliste mit den Bildnotizen bei.</div></section><section class="card section"><h2>Datensicherung & Weiterverarbeitung</h2><div class="actions"><button class="btn" onclick="exportJSON()">Projektdatei inkl. Fotos (.json)</button><button class="btn" onclick="exportCSV()">Tabellendatei (.csv)</button><label class="btn">Projekt importieren<input class="hidden" type="file" accept="application/json,.json" onchange="importJSON(this)"></label></div></section>`;
}
