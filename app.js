
let DATA = [];
const ACQ_OWNERS = ["Tamsir LO"]; // seul propriétaire qui est acquéreur ; tous les autres sont cédants
const $ = (id) => document.getElementById(id);
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls = {
  get(k){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
let byLot = {};
let current = null, S = null, REG = {}, DRAFT = {}, editing = false, dbReady = false, dbOK = null, armed = false;

/* ----- modèle ----- */
const party = (civ, nom, cin) => ({civ, nom: nom||'', cin: cin||'', delivre:'', demeure:''});
function fresh(lot){
  const d = byLot[lot], own = party(d.civ === 'Madame' ? 'Mme' : 'Mr', d.nom, d.cni), acq = ACQ_OWNERS.includes(d.nom);
  return { role: acq ? 'acquereur' : 'cedant', ced: acq ? party('','','') : own, acq: acq ? own : party('','',''),
    t1n:'',t1c:'',t2n:'',t2c:'', faita:'Tivaouane Peulh', faitle:'', sise: d.loc, sup: d.sup, nicad:false };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
function loadLot(lot){
  if (REG[lot]) return Object.assign(fresh(lot), clone(REG[lot]));
  const dr = ls.get('cession:'+lot); return dr ? Object.assign(fresh(lot), dr) : fresh(lot);
}
const status = (lot) => REG[lot] ? 'done' : (DRAFT[lot] ? 'draft' : 'todo');
const short = (n) => { const p = n.split(' '); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; };
const norm = (s) => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const digits = (s) => String(s||'').replace(/\D/g,'');
const ownerKey = () => S.role === 'cedant' ? 'ced' : 'acq';
const locked = () => !!REG[current] && !editing;

function problems(){
  const m = [];
  if (!S.ced.nom.trim()) m.push('Nom du cédant');
  if (!digits(S.ced.cin)) m.push('CIN du cédant');
  if (!S.acq.nom.trim()) m.push('Nom de l’acquéreur');
  if (!digits(S.acq.cin)) m.push('CIN de l’acquéreur');
  if (!S.t1n.trim()) m.push('Témoin 1');
  if (!S.t2n.trim()) m.push('Témoin 2');
  if (!S.faitle.trim()) m.push('Date de l’acte');
  const bad = [];
  if (S.ced.nom.trim() && S.acq.nom.trim() && (norm(S.ced.nom) === norm(S.acq.nom) || (digits(S.ced.cin) && digits(S.ced.cin) === digits(S.acq.cin))))
    bad.push('Le cédant et l’acquéreur sont la même personne.');
  const pn = [S.ced.nom, S.acq.nom, S.t1n, S.t2n].map(norm).filter(Boolean);
  if (S.t1n.trim() && S.t2n.trim() && norm(S.t1n) === norm(S.t2n)) bad.push('Les deux témoins sont identiques.');
  if (S.t1n.trim() && (norm(S.t1n) === norm(S.ced.nom) || norm(S.t1n) === norm(S.acq.nom))) bad.push('Le témoin 1 est une des parties.');
  if (S.t2n.trim() && (norm(S.t2n) === norm(S.ced.nom) || norm(S.t2n) === norm(S.acq.nom))) bad.push('Le témoin 2 est une des parties.');
  return {missing: m, bad};
}

/* ----- texte de l'acte ----- */
const U = (v, n) => (v && String(v).trim()) ? String(v).trim() : '_'.repeat(n);
function lines(s, lot){
  const d = byLot[lot], c = (p) => p.civ || 'Mme / Mr', L = [];
  L.push({k:'title', t:'ACTE DE CESSION DE PEINES'}, {k:'gap'});
  L.push({t:`Je soussigné(e) ${c(s.ced)} ${U(s.ced.nom,40)}`});
  L.push({t:`Demeurant à ${U(s.ced.demeure,45)}`});
  L.push({t:`Titulaire de la CIN n° ${U(s.ced.cin,22)} délivrée le ${U(s.ced.delivre,12)}`});
  L.push({k:'gap'});
  L.push({t:'Atteste avoir cédé mes peines et soins à :'});
  L.push({t:`${s.acq.civ || 'Mr / Mme'} ${U(s.acq.nom,40)}`});
  L.push({t:`Titulaire de la CIN n° ${U(s.acq.cin,22)} délivrée le ${U(s.acq.delivre,12)}`});
  L.push({k:'gap'});
  L.push({t:`Les impenses sont réalisées sur une parcelle à usage d’habitation n° ${U(lot,6)}`});
  L.push({t:`D’une superficie de ${U(s.sup,6)} m² sise à ${U(s.sise,28)}.` + (s.nicad && d.nicad ? ` NICAD n° ${d.nicad}.` : '')});
  L.push({k:'gap'});
  L.push({t:'Le montant des peines a été intégralement versé devant les témoins ci-dessous.'});
  L.push({t:'En foi de quoi, je délivre le présent acte pour servir et valoir ce que de droit.'});
  L.push({k:'gap'});
  L.push({k:'fait', t:`Fait à ${U(s.faita,24)} le ${U(s.faitle,16)}`});
  L.push({k:'gap'});
  L.push({k:'sig', a:'Le cédant :', b:'L’acquéreur :'});
  L.push({k:'sigline', a: s.ced.nom||'', b: s.acq.nom||''});
  L.push({k:'gap'});
  L.push({k:'bold', t:'TÉMOINS'});
  L.push({t:`1. Nom : ${U(s.t1n,34)} CIN : ${U(s.t1c,22)}`});
  L.push({t:`2. Nom : ${U(s.t2n,34)} CIN : ${U(s.t2c,22)}`});
  return L;
}
const blankify = (t) => esc(t).replace(/_{3,}/g, m => `<span class="bl">${m}</span>`);
function renderSheet(){
  $('sheet').innerHTML = lines(S, current).map(l => {
    if (l.k === 'gap') return '<div class="gap"></div>';
    if (l.k === 'title') return `<p class="title">${esc(l.t)}</p>`;
    if (l.k === 'fait') return `<p class="fait">${blankify(l.t)}</p>`;
    if (l.k === 'bold') return `<p><b>${esc(l.t)}</b></p>`;
    if (l.k === 'sig') return `<div class="sig"><b>${esc(l.a)}</b><b>${esc(l.b)}</b></div>`;
    if (l.k === 'sigline') return `<div class="sig sigline"><span>${esc(l.a)}</span><span>${esc(l.b)}</span></div>`;
    return `<p>${blankify(l.t)}</p>`;
  }).join('');
}
const plainText = (s, lot) => lines(s, lot).map(l => l.k==='gap' ? '' : (l.k==='sig'||l.k==='sigline') ? l.a+'\t\t'+l.b : l.t).join('\n');

/* ----- colonne des lots, fiche, registre ----- */
function renderTiles(){
  const q = norm($('search').value), digitsQ = $('search').value.trim();
  let shown = 0;
  $('tiles').innerHTML = DATA.map(d => {
    const st = status(d.lot), hit = !q || norm(d.nom).includes(q) || d.lot.startsWith(digitsQ);
    if (hit) shown++;
    const mk = st === 'done' ? '✓' : st === 'draft' ? '…' : '';
    const lab = st === 'done' ? 'enregistré' : st === 'draft' ? 'brouillon' : 'à faire';
    return `<button type="button" class="tile ${st}" data-lot="${d.lot}" ${hit?'':'hidden'} ${d.lot===current?'aria-current="true"':''} aria-label="Lot ${d.lot}, ${esc(d.nom)}, ${lab}"><span class="mk">${mk}</span><b>${d.lot}</b><small>${esc(short(d.nom))}</small></button>`;
  }).join('');
  $('nores').hidden = shown > 0;
}
function renderProgress(){
  const n = Object.keys(REG).length;
  $('progtxt').textContent = `${n} / ${DATA.length} enregistrés`;
  $('barfill').style.width = (n / DATA.length * 100) + '%';
}
function renderCard(){
  const d = byLot[current], st = status(current);
  $('lotno').textContent = d.lot;
  $('ownm').textContent = d.nom;
  $('facts').innerHTML = `<span>CIN <b>${esc(d.cni)}</b></span><span><b>${esc(d.sup)}</b> m²</span><span>NICAD <b>${esc(d.nicad)}</b></span>`;
  $('badge').innerHTML = `<span class="badge ${st}">${st==='done'?'✓ Acte enregistré':st==='draft'?'Brouillon':'À faire'}</span>`;
  const b = $('banner');
  if (REG[current]) {
    const r = REG[current], who = r.acq.nom || '?';
    b.hidden = false; b.className = 'banner';
    b.innerHTML = `<b>Lot ${esc(current)} cédé à ${esc(who)}</b><p>Acte enregistré${r.at ? ' le ' + esc(new Date(r.at).toLocaleDateString('fr-FR')) : ''}. Ce lot ne peut pas avoir un second acte pour une autre personne. Pour le céder à quelqu’un d’autre, annulez d’abord cet acte.</p>`;
  } else b.hidden = true;
}
function renderRegistry(){
  const f = $('regfilter').value;
  $('regbody').innerHTML = DATA.filter(d => f === 'all' || status(d.lot) === f).map(d => {
    const r = REG[d.lot], st = status(d.lot), dr = DRAFT[d.lot] && !r ? DRAFT[d.lot] : null, x = r || dr;
    const ced = x ? x.ced.nom : '', acq = x ? x.acq.nom : '';
    const own = x ? (x.role === 'acquereur' ? x.acq.nom : x.ced.nom) : d.nom;
    return `<tr class="go" data-lot="${d.lot}"><td class="n">${d.lot}</td><td>${esc(d.nom)}</td><td>${esc(ced) || '<span style="color:var(--muted)">—</span>'}</td><td>${esc(acq) || '<span style="color:var(--muted)">—</span>'}</td><td>${x && (x.t1n || x.t2n) ? esc([x.t1n,x.t2n].filter(Boolean).join(', ')) : '<span style="color:var(--muted)">—</span>'}</td><td><span class="badge ${st}">${st==='done'?'Enregistré':st==='draft'?'Brouillon':'À faire'}</span></td></tr>`;
  }).join('');
}
function refreshAll(){ renderTiles(); renderProgress(); renderCard(); renderRegistry(); renderActions(); }

/* ----- formulaire ----- */
function partyBox(key, title){
  const isOwner = ownerKey() === key, id = key;
  const dem = key === 'ced' ? `<div class="f"><label class="l" for="${id}-demeure">Demeurant à</label><input id="${id}-demeure" data-k="${key}.demeure" autocomplete="off"></div>` : '';
  return `<div class="phead"><h3>${title}</h3>${isOwner ? '<span class="tag">propriétaire du lot</span>' : ''}</div>
  <div class="row civ">
    <div class="f"><label class="l" for="${id}-civ">Civilité</label><select id="${id}-civ" data-k="${key}.civ"><option value="">—</option><option>Mr</option><option>Mme</option></select></div>
    <div class="f"><label class="l" for="${id}-nom">Prénom et nom</label><input id="${id}-nom" data-k="${key}.nom" autocomplete="off"></div>
  </div>
  ${dem}
  <div class="row">
    <div class="f"><label class="l" for="${id}-cin">N° de CIN</label><input id="${id}-cin" data-k="${key}.cin" autocomplete="off" inputmode="numeric"></div>
    <div class="f"><label class="l" for="${id}-delivre">CIN délivrée le</label><input id="${id}-delivre" data-k="${key}.delivre" autocomplete="off" placeholder="JJ/MM/AAAA"></div>
  </div>`;
}
const flat = ['t1n','t1c','t2n','t2c','faita','faitle','sise','sup'];
function getPath(k){ const [a,b] = k.split('.'); return b ? S[a][b] : S[a]; }
function setPath(k,v){ const [a,b] = k.split('.'); if (b) S[a][b] = v; else S[a] = v; }
function buildForm(){
  $('cedBox').innerHTML = partyBox('ced','Le cédant');
  $('acqBox').innerHTML = partyBox('acq','L’acquéreur');
  document.querySelectorAll('[data-k]').forEach(el => { el.value = getPath(el.dataset.k) || ''; });
  flat.forEach(k => { $(k).value = S[k] || ''; });
  $('nicadChk').checked = !!S.nicad;
  applyLocks();
}
function applyLocks(){
  const all = locked(), ok = ownerKey();
  document.querySelectorAll('[data-k]').forEach(el => {
    const [a,b] = el.dataset.k.split('.');
    el.disabled = all || (a === ok && (b === 'nom' || b === 'civ' || b === 'cin'));
  });
  flat.concat(['nicadChk']).forEach(k => { $(k).disabled = all; });
}

/* ----- actions ----- */
function say(t, kind){ const m = $('msg'); m.textContent = t || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }
function renderActions(){
  const p = problems(), rec = !!REG[current], t = $('todo'), a = $('actions');
  if (rec && !editing) { t.className = 'todo ready'; t.textContent = 'Acte enregistré. Le lot est verrouillé.'; }
  else if (p.bad.length) { t.className = 'todo bad'; t.innerHTML = '<b>À corriger</b><ul>' + p.bad.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'; }
  else if (p.missing.length) { t.className = 'todo'; t.innerHTML = '<b>Pour enregistrer, il manque</b><ul>' + p.missing.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'; }
  else { t.className = 'todo ready'; t.textContent = rec ? 'Modifications prêtes à enregistrer.' : 'Prêt à enregistrer.'; }
  const canSave = dbOK && !p.missing.length && !p.bad.length;
  let h = '';
  if (!rec) h += `<button class="btn primary" id="bSave" type="button" ${canSave?'':'disabled'}>Enregistrer l’acte</button>`;
  else if (editing) h += `<button class="btn primary" id="bUpd" type="button" ${canSave?'':'disabled'}>Mettre à jour l’acte</button><button class="btn" id="bStop" type="button">Annuler les modifications</button>`;
  else h += `<button class="btn" id="bEdit" type="button">Corriger l’acte</button>`;
  h += `<button class="btn" id="bDl" type="button">Télécharger (Word)</button><button class="btn" id="bPrint" type="button">Imprimer</button><button class="btn" id="bCopy" type="button">Copier le texte</button>`;
  if (rec && !editing) h += `<button class="btn danger ${armed?'arm':''}" id="bCancel" type="button">${armed?'Confirmer : libérer le lot':'Annuler l’acte'}</button>`;
  a.innerHTML = h;
}
function payload(){
  const o = clone(S); delete o.rec;
  o.lot = current; o.statut = 'enregistre';
  o.at = (REG[current] && REG[current].at) || new Date().toISOString();
  if (REG[current]) o.maj = new Date().toISOString();
  return o;
}
const cfg = window.APP_CONFIG || {};
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/VOTRE/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);
const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
function note(t){ const n = $('dbnote'); n.hidden = !t; n.textContent = t || ''; }
async function loadLots(){
  const { data, error } = await sb.from('lots').select('*');
  if (error) throw error;
  DATA = data.map(r => ({lot:r.lot, civ:r.civ, nom:r.nom, cni:r.cni, sup:r.sup, nicad:r.nicad, loc:r.loc})).sort((x,y) => Number(x.lot) - Number(y.lot));
  byLot = Object.fromEntries(DATA.map(d => [d.lot, d]));
}
async function loadReg(){
  const { data, error } = await sb.from('actes').select('lot,data,created_at');
  if (error) throw error;
  REG = {};
  data.forEach(r => { REG[r.lot] = Object.assign({}, r.data, { at: (r.data && r.data.at) || r.created_at }); });
}
async function syncReg(){
  try {
    await loadReg(); dbOK = true; note('');
    if (current) {
      if (REG[current] && !editing) { S = loadLot(current); buildForm(); renderSheet(); }
      else if (!REG[current] && $('bCancel')) { editing = false; S = loadLot(current); buildForm(); renderSheet(); }
    }
    refreshAll();
  } catch(e){ dbOK = false; note('Le registre est inaccessible pour le moment. Vérifiez la connexion internet.'); if (current) renderActions(); }
}
async function record(){
  const p = problems(); if (p.missing.length || p.bad.length) return;
  say('Vérification du lot…');
  const data = payload();
  const { error } = await sb.from('actes').insert({ lot: current, acq_nom: S.acq.nom.trim(), data });
  if (error) {
    if (error.code === '23505') {
      await syncReg();
      const ex = REG[current];
      say(`Ce lot est déjà cédé à ${ex && ex.acq ? ex.acq.nom : 'une autre personne'}. Aucun second acte n’est possible.`, 'err');
      S = loadLot(current); buildForm(); renderSheet(); refreshAll();
    } else say('L’enregistrement a échoué : ' + error.message, 'err');
    return;
  }
  REG[current] = data; ls.del('cession:' + current); delete DRAFT[current]; editing = false;
  S = loadLot(current); buildForm(); renderSheet(); refreshAll(); say('Acte enregistré. Le lot est verrouillé.', 'ok');
}
async function update(){
  const data = payload();
  const { error } = await sb.from('actes').update({ acq_nom: S.acq.nom.trim(), data }).eq('lot', current);
  if (error) { say('La mise à jour a échoué : ' + error.message, 'err'); return; }
  REG[current] = data; editing = false; S = loadLot(current); buildForm(); renderSheet(); refreshAll(); say('Acte mis à jour.', 'ok');
}
async function cancelAct(){
  const { error } = await sb.from('actes').delete().eq('lot', current);
  if (error) { say('L’annulation a échoué : ' + error.message, 'err'); return; }
  delete REG[current]; armed = false; editing = false; S = loadLot(current); buildForm(); renderSheet(); refreshAll(); say('Acte annulé. Le lot est de nouveau libre.', 'ok');
}

/* ----- Word (docx écrit à la main) ----- */
const enc = new TextEncoder();
const crcT = (() => { const t = new Uint32Array(256); for (let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i=0;i<b.length;i++) c = crcT[(c^b[i])&255] ^ (c>>>8); return (c^0xFFFFFFFF)>>>0; };
function zip(files, mime){
  const parts = [], cd = []; let off = 0;
  const u16 = (v) => [v&255,(v>>8)&255], u32 = (v) => [v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  for (const [name, text] of files){
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const lh = Uint8Array.from([0x50,0x4b,3,4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)]);
    parts.push(lh, nb, data);
    cd.push(Uint8Array.from([0x50,0x4b,1,2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += lh.length + nb.length + data.length;
  }
  const cdSize = cd.reduce((a,b)=>a+b.length,0);
  const end = Uint8Array.from([0x50,0x4b,5,6, 0,0,0,0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), 0,0]);
  return new Blob([...parts, ...cd, end], {type: mime});
}
const X = (t) => String(t).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const RP = (o={}) => `<w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:cs="Cambria"/>${o.b?'<w:b/>':''}${o.u?'<w:u w:val="single"/>':''}<w:sz w:val="${o.sz||24}"/></w:rPr>`;
const run = (t,o) => `<w:r>${RP(o)}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
const para = (inner, o={}) => `<w:p><w:pPr>${o.pb?'<w:pageBreakBefore/>':''}<w:tabs><w:tab w:val="right" w:pos="9461"/></w:tabs><w:spacing w:after="${o.after??100}" w:line="300" w:lineRule="auto"/>${o.jc?`<w:jc w:val="${o.jc}"/>`:''}</w:pPr>${inner}</w:p>`;
function actXml(s, lot, first){
  let fp = true;
  return lines(s, lot).map(l => {
    const pb = first ? false : fp; fp = false;
    if (l.k === 'gap') return para('', {after:60});
    if (l.k === 'title') return para(run(l.t,{b:1,u:1,sz:34}), {jc:'center', after:100, pb});
    if (l.k === 'fait') return para(run(l.t), {jc:'center'});
    if (l.k === 'bold') return para(run(l.t,{b:1}));
    if (l.k === 'sig') return para(run(l.a,{b:1}) + '<w:r><w:tab/></w:r>' + run(l.b,{b:1}));
    if (l.k === 'sigline') return para(run(l.a) + '<w:r><w:tab/></w:r>' + run(l.b), {after:400});
    return para(run(l.t));
  }).join('');
}
function buildDocx(items){
  const body = items.map(([s,lot],i) => actXml(s, lot, i===0)).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1200" w:right="1361" w:bottom="1000" w:left="1418" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', doc]
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
async function saveFile(filename, data, target){
  const out = target === 'reg' ? $('regmsg') : $('msg');
  const blob = data instanceof Blob ? data : new Blob([data], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  out.textContent = 'Fichier téléchargé : ' + filename; out.className = 'msg ok';
}
const safe = (t) => String(t).replace(/[\\/:*?"<>|]/g,'').trim();
const stateOf = (lot) => REG[lot] ? clone(REG[lot]) : (lot === current ? S : loadLot(lot));

/* ----- navigation ----- */
function go(lot){
  current = lot; editing = false; armed = false; S = loadLot(lot);
  buildForm(); renderSheet(); refreshAll(); say('');
  try { history.replaceState(null,'','#lot-' + lot); } catch(e){}
}
function showTab(t){
  const a = t === 'A';
  $('viewA').hidden = !a; $('viewR').hidden = a;
  $('tabA').setAttribute('aria-selected', a); $('tabR').setAttribute('aria-selected', !a);
  if (!a) renderRegistry();
}
$('tabA').addEventListener('click', () => showTab('A'));
$('tabR').addEventListener('click', () => showTab('R'));
$('tiles').addEventListener('click', e => { const b = e.target.closest('[data-lot]'); if (b) go(b.dataset.lot); });
$('search').addEventListener('input', renderTiles);
$('regfilter').addEventListener('change', renderRegistry);
$('regbody').addEventListener('click', e => { const r = e.target.closest('[data-lot]'); if (r) { go(r.dataset.lot); showTab('A'); window.scrollTo({top:0}); } });

document.addEventListener('input', e => {
  const el = e.target; if (locked()) return;
  if (el.dataset && el.dataset.k) setPath(el.dataset.k, el.value);
  else if (flat.includes(el.id)) S[el.id] = el.value;
  else if (el.id === 'nicadChk') S.nicad = el.checked;
  else return;
  if (!REG[current]) { ls.set('cession:' + current, S); DRAFT[current] = clone(S); }
  renderSheet(); renderActions(); renderTiles(); renderCard(); if (!$('viewR').hidden) renderRegistry();
});
document.addEventListener('change', e => {
  if (e.target.matches && e.target.matches('select[data-k]') && !locked()) {
    setPath(e.target.dataset.k, e.target.value);
    if (!REG[current]) { ls.set('cession:' + current, S); DRAFT[current] = clone(S); }
    renderSheet();
  }
});
$('actions').addEventListener('click', async e => {
  const id = e.target.closest('button') && e.target.closest('button').id; if (!id) return;
  if (id !== 'bCancel' && armed) { armed = false; renderActions(); }
  if (id === 'bSave') record();
  else if (id === 'bUpd') update();
  else if (id === 'bEdit') { editing = true; applyLocks(); renderActions(); say('Modification en cours.'); }
  else if (id === 'bStop') { editing = false; S = loadLot(current); buildForm(); renderSheet(); renderActions(); say(''); }
  else if (id === 'bDl') saveFile(`Acte de cession - LOT ${current} - ${safe(S.acq.nom || byLot[current].nom)}.docx`, buildDocx([[S, current]]));
  else if (id === 'bPrint') window.print();
  else if (id === 'bCopy') {
    try { await navigator.clipboard.writeText(plainText(S, current)); say('Texte copié.', 'ok'); }
    catch(err){ const r = document.createRange(); r.selectNodeContents($('sheet')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); say('Copie automatique refusée : le texte est sélectionné, faites Ctrl+C.', 'err'); }
  }
  else if (id === 'bCancel') { if (!armed) { armed = true; renderActions(); say('Cliquez de nouveau pour confirmer. L’acte enregistré sera supprimé.'); } else cancelAct(); }
});
$('dlAll').addEventListener('click', () => saveFile('Actes de cession - 40 modèles.docx', buildDocx(DATA.map(d => [d.lot === current ? S : loadLot(d.lot), d.lot])), 'reg'));
$('dlRec').addEventListener('click', () => {
  const l = DATA.filter(d => REG[d.lot]); if (!l.length) { $('regmsg').textContent = 'Aucun acte enregistré pour le moment.'; $('regmsg').className = 'msg err'; return; }
  saveFile(`Actes de cession enregistres (${l.length}).docx`, buildDocx(l.map(d => [clone(REG[d.lot]), d.lot])), 'reg');
});
$('csv').addEventListener('click', () => {
  const q = (v) => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const rows = [['Lot','Propriétaire','Cédant','Acquéreur','CIN acquéreur','Témoin 1','Témoin 2','Date de l’acte','Enregistré le','État']];
  DATA.forEach(d => { const r = REG[d.lot];
    rows.push([d.lot, d.nom, r ? r.ced.nom : '', r ? r.acq.nom : '', r ? r.acq.cin : '', r ? r.t1n : '', r ? r.t2n : '', r ? r.faitle : '', r && r.at ? new Date(r.at).toLocaleDateString('fr-FR') : '', r ? 'Enregistré' : (DRAFT[d.lot] ? 'Brouillon' : 'À faire')]); });
  saveFile('Registre des actes de cession.csv', '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'reg');
});

/* ----- connexion et démarrage ----- */
let started = false;
async function enter(){
  $('loginView').hidden = true; $('app').hidden = false;
  try { await loadLots(); await loadReg(); dbOK = true; }
  catch(e){ note('Impossible de charger les données : ' + (e.message || 'erreur') + '. Vérifiez la configuration Supabase.'); return; }
  DATA.forEach(d => { const v = ls.get('cession:' + d.lot); if (v) DRAFT[d.lot] = v; });
  const h0 = (location.hash.match(/^#lot-(\d+)$/) || [])[1];
  go(h0 && byLot[h0] ? h0 : DATA[0].lot);
  if (!started) { started = true; setInterval(syncReg, 60000); window.addEventListener('focus', syncReg); }
}
function showLogin(msg){ $('app').hidden = true; $('loginView').hidden = false; $('loginMsg').textContent = msg || ''; }
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('loginMsg').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('pwd').value });
  if (error) $('loginMsg').textContent = 'Connexion refusée : e-mail ou mot de passe incorrect.';
  else { $('pwd').value = ''; enter(); }
});
$('logout').addEventListener('click', async () => { await sb.auth.signOut(); current = null; showLogin(); });
(async () => {
  if (!sb) { $('loginView').hidden = false; $('loginMsg').textContent = 'Configuration manquante : renseignez config.js (voir le guide).'; return; }
  const { data } = await sb.auth.getSession();
  if (data && data.session) enter(); else showLogin();
})();
