/* ================= IMAGE GUESSER — engine ================= */
const DB = window.__DB__;
const VERSION = "1.0.0";
const LS = "ig.v1.";

const CATS = [
  {id:"all",ic:"c-sparkle"},{id:"animals",ic:"c-paw"},{id:"technology",ic:"c-chip"},{id:"vehicles",ic:"c-car"},
  {id:"food",ic:"c-food"},{id:"nature",ic:"c-leaf"},{id:"history",ic:"c-column"},{id:"science",ic:"c-flask"},
  {id:"buildings",ic:"c-city"},{id:"sports",ic:"c-ball"},{id:"household",ic:"c-house"},{id:"arts",ic:"c-palette"},
  {id:"random",ic:"c-globe"}
];
const API = "https://en.wikipedia.org/w/api.php";
const BLOCK = /village|town\b|city\b|municipalit|commune|district|county|province|parish|hamlet|neighbou?rhood|suburb|borough|census|album|song\b|single\b|film|novel|episode|season \d|footballer|cricketer|politician|actor|singer|rapper|river in|stream in|lake in|mountain in|island in|list of|disambiguation|genus of (moth|fungus|plant)|species of (moth|fungus)|genus\b.*bacteri|chemical compound|isotope|protein|gene\b|enzyme|star\b|asteroid|galaxy|railway station|highway|treaty|battle of|election|law\b|concept|theory|language\b|ethnic group|religion|company|software|protocol\b|algorithm|mineral|mathematic|theorem/i;

/* ---------- storage ---------- */
function load(k, d){ try{ const v = localStorage.getItem(LS+k); return v===null?d:JSON.parse(v); }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(LS+k, JSON.stringify(v)); }catch(e){} }

const S = {
  coins: load("coins",0), best: load("best",0), answered: load("answered",0),
  seen: load("seen",[]), qIndex: 0, streak: 0, cat: "all",
  settings: Object.assign({sound:true,music:true,vibe:true,theme:"dark",blur:true,lang:"en"}, load("settings",{}))
};
const seenSet = new Set(S.seen);
let creditCache = load("cred",{});
let liveCache = load("live",[]);

/* ---------- i18n ---------- */
function t(k){ const L = I18N[S.settings.lang] || I18N.en; return (L && L[k]) || I18N.en[k] || k; }
function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n"); const v = t(k); if(v) el.innerHTML = v;
  });
  document.documentElement.lang = S.settings.lang;
  document.getElementById("catCount").textContent = (S.cat==="all" ? DB.length.toLocaleString() : poolForCat(S.cat).length.toLocaleString()) + " " + t("items");
  renderChips();
}

/* ---------- audio ---------- */
let ac=null, musicGain=null, musicNodes=[];
function audio(){ if(!ac){ try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } 
  if(ac && ac.state==="suspended") ac.resume(); return ac; }
function tone(freq, dur, type="sine", vol=.1, delay=0){
  if(!S.settings.sound) return; const c = audio(); if(!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t0 = c.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0+.012);
  g.gain.exponentialRampToValueAtTime(.0001, t0+dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0+dur+.02);
}
const sfx = {
  tap(){ tone(620,.05,"sine",.045); },
  correct(){ [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.22,"triangle",.085,i*.07)); },
  wrong(){ tone(233,.16,"sawtooth",.055); tone(174,.28,"sawtooth",.055,.13); },
  coin(){ tone(1318,.09,"square",.03); tone(1760,.14,"square",.028,.06); }
};
function startMusic(){
  const c = audio(); if(!c || !S.settings.music || musicNodes.length) return;
  musicGain = c.createGain(); musicGain.gain.value = .035; musicGain.connect(c.destination);
  [110, 164.81, 220, 277.18].forEach((f,i)=>{
    const o = c.createOscillator(), g = c.createGain();
    o.type = i%2 ? "sine" : "triangle"; o.frequency.value = f;
    g.gain.value = .3 / (i+1);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = .06 + i*.017; lg.gain.value = .18/(i+1);
    lfo.connect(lg).connect(g.gain); lfo.start();
    o.connect(g).connect(musicGain); o.start();
    musicNodes.push(o, lfo);
  });
}
function stopMusic(){ musicNodes.forEach(n=>{ try{n.stop();}catch(e){} }); musicNodes=[]; if(musicGain){ try{musicGain.disconnect();}catch(e){} musicGain=null; } }
function syncMusic(){ S.settings.music ? startMusic() : stopMusic(); }

/* ---------- haptics ---------- */
function buzz(p){ if(S.settings.vibe && navigator.vibrate){ try{ navigator.vibrate(p); }catch(e){} } }

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function stripHtml(s){ return String(s||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ").trim(); }
function poolForCat(cat){ return cat==="all" ? DB : DB.filter(i=>i.c===cat); }

/* ---------- screens ---------- */
let curScreen = "splash";
function go(name){
  const el = $(name); if(!el) return;
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("on"));
  el.classList.add("on"); el.scrollTop = 0; curScreen = name;
  if(name === "home") renderPeek();
}
function toast(msg, ms=2100){
  const el = $("toast"); el.textContent = msg; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove("on"), ms);
}

/* ---------- sheet ---------- */
function openSheet(title, html){
  $("shTitle").textContent = title; $("shBody").innerHTML = html;
  $("scrim").classList.add("on"); $("sheet").classList.add("on");
}
function closeSheet(){ $("scrim").classList.remove("on"); $("sheet").classList.remove("on"); }

/* ---------- coins ---------- */
function renderCoins(){
  document.querySelectorAll(".cval").forEach(e=>e.textContent = S.coins.toLocaleString());
  $("statBest").textContent = S.best; $("statAns").textContent = S.answered;
}
function coinFx(amount){
  const pill = $("coinGame").getBoundingClientRect().width ? $("coinGame") : $("coinHome");
  const r = pill.getBoundingClientRect();
  pill.classList.add("pop"); setTimeout(()=>pill.classList.remove("pop"), 520);
  const f = document.createElement("div"); f.className="flycoin"; f.textContent = "+"+amount;
  f.style.left = (r.left + r.width/2)+"px"; f.style.top = (r.top + r.height)+"px";
  document.body.appendChild(f); setTimeout(()=>f.remove(), 1000);
  for(let i=0;i<11;i++){
    const s = document.createElement("div"); s.className="spark";
    const a = Math.random()*Math.PI*2, d = 26+Math.random()*46;
    s.style.left = (r.left+r.width/2)+"px"; s.style.top = (r.top+r.height/2)+"px";
    s.style.setProperty("--dx", Math.cos(a)*d+"px"); s.style.setProperty("--dy", Math.sin(a)*d+"px");
    s.style.background = Math.random()>.5 ? "radial-gradient(circle,#fff6cf,#ffcf5c)" : "radial-gradient(circle,#d7f7ff,#22d3ee)";
    document.body.appendChild(s); setTimeout(()=>s.remove(), 820);
  }
  sfx.coin();
}

/* ---------- chips ---------- */
function renderChips(){
  const box = $("chips"); box.innerHTML = "";
  CATS.forEach(c=>{
    const b = document.createElement("button");
    b.className = "chip" + (S.cat===c.id ? " on" : "");
    b.innerHTML = `<svg class="ci"><use href="#${c.ic}"/></svg>${c.id==="all" ? t("allItems") : t(c.id)}`;
    b.onclick = ()=>{ S.cat = c.id; save("cat", S.cat); renderChips(); $("catCount").textContent = (S.cat==="all"?DB.length:poolForCat(S.cat).length).toLocaleString()+" "+t("items"); sfx.tap(); buzz(8); };
    box.appendChild(b);
  });
  const on = box.querySelector(".chip.on"); if(on && on.scrollIntoView) on.scrollIntoView({inline:"center", block:"nearest"});
}

/* ---------- live wikipedia items ---------- */
async function fetchLive(n=14){
  const u = `${API}?action=query&format=json&origin=*&generator=random&grnnamespace=0&grnlimit=${n}`
    + `&prop=pageimages|description|pageprops&piprop=thumbnail|name&pithumbsize=900&redirects=1`;
  const r = await fetch(u, {cache:"no-store"});
  if(!r.ok) throw new Error("api "+r.status);
  const j = await r.json();
  const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
  const out = [];
  pages.forEach(p=>{
    if(!p || !p.thumbnail || !p.thumbnail.source) return;
    if(!/\.(jpe?g)(\?|$)/i.test(p.thumbnail.source)) return;
    if(p.pageprops && p.pageprops.disambiguation) return;
    const title = p.title || "";
    if(!title || title.includes(":") || /^List of/i.test(title)) return;
    const desc = (p.description||"");
    if(BLOCK.test(title) || BLOCK.test(desc)) return;
    const disp = title.replace(/\s*\([^)]*\)\s*$/,"").trim();
    if(!disp || disp.length>34) return;
    out.push({t:disp, u:p.thumbnail.source, c:"random", f:p.pageimage||"", d:desc.slice(0,120),
      w:"https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_")), live:1});
  });
  if(out.length){
    liveCache = out.concat(liveCache).slice(0,300);
    save("live", liveCache);
  }
  return out;
}

/* ---------- question building ---------- */
function pickFromPool(){
  const pool = poolForCat(S.cat);
  const fresh = pool.filter(i=>!seenSet.has(i.t.toLowerCase()));
  return pick(fresh.length ? fresh : pool);
}
async function pickQuestion(){
  if(S.cat==="random" || (S.cat==="all" && Math.random()<.2)){
    let live = liveCache.filter(i=>!seenSet.has(i.t.toLowerCase()));
    if(!live.length && navigator.onLine){
      try{ live = await fetchLive(); }catch(e){}
    }
    if(live.length) return pick(live);
  }
  return pickFromPool();
}
function makeOptions(item){
  const id = item.t.toLowerCase();
  const used = new Set([id]);
  const opts = [item.t];
  const same = shuffle(poolForCat(item.c).filter(x=>x.t.toLowerCase()!==id));
  for(const x of same){ if(opts.length>=3) break; const k=x.t.toLowerCase(); if(!used.has(k)){ used.add(k); opts.push(x.t); } }
  const all = shuffle(DB.filter(x=>x.t.toLowerCase()!==id));
  for(const x of all){ if(opts.length>=4) break; const k=x.t.toLowerCase(); if(!used.has(k)){ used.add(k); opts.push(x.t); } }
  return shuffle(opts).slice(0,4);
}

/* ---------- image handling ---------- */
let imgTries = 0;
function loadImage(item){
  const card = $("imgcard"), img = $("qimg");
  card.classList.add("loading"); card.classList.remove("err");
  imgTries = 0;
  img.onload = ()=>{ card.classList.remove("loading"); };
  img.onerror = ()=> onImgError(item);
  img.src = item.u;
}
async function onImgError(item){
  const img = $("qimg"), card = $("imgcard");
  imgTries++;
  if(imgTries === 1 && item.f){
    try{
      const u = `${API}?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=640&titles=${encodeURIComponent(item.t)}`;
      const j = await (await fetch(u)).json();
      const p = Object.values(j.query.pages)[0];
      const src = p && p.thumbnail && p.thumbnail.source;
      if(src && src !== img.src){ card.classList.add("loading"); img.src = src; return; }
    }catch(e){}
  }
  card.classList.remove("loading"); card.classList.add("err");
  $("errmsg").textContent = t("imgErr");
  toast(t("noImage"), 1600);
  clearTimeout(onImgError._t);
  onImgError._t = setTimeout(()=>{ if(!answered && curScreen==="game") nextQuestion(); }, 2600);
}

/* ---------- attribution ---------- */
async function creditFor(item){
  if(!item.f) return "Wikimedia Commons";
  if(creditCache[item.f]) return creditCache[item.f];
  try{
    const u = `${API}?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata`
      + `&iiextmetadatafilter=Artist|LicenseShortName&titles=${encodeURIComponent("File:"+item.f)}`;
    const j = await (await fetch(u)).json();
    const p = Object.values(j.query.pages)[0];
    const md = (p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata) || {};
    const artist = stripHtml(md.Artist && md.Artist.value).replace(/\s+/g," ").slice(0,52);
    const lic = stripHtml(md.LicenseShortName && md.LicenseShortName.value).slice(0,26);
    const s = [artist || "Wikimedia contributor", lic, "Wikimedia Commons"].filter(Boolean).join(" · ");
    creditCache[item.f] = s; save("cred", creditCache);
    return s;
  }catch(e){ return "Wikimedia Commons"; }
}

/* ---------- question flow ---------- */
let current = null, options = [], answered = false, autoTimer = null;
async function nextQuestion(){
  clearTimeout(autoTimer);
  clearTimeout(onImgError._t);
  answered = false; options = [];
  const rev = $("reveal"); rev.classList.remove("on");
  const card0 = $("imgcard"), img0 = $("qimg");
  img0.style.transition = "none";
  card0.classList.add("veiled");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ img0.style.transition = ""; }));

  const item = await pickQuestion();
  if(!item) return;
  current = item;
  seenSet.add(item.t.toLowerCase());
  S.seen = Array.from(seenSet).slice(-1400); save("seen", S.seen);
  S.qIndex++;

  $("qNum").textContent = t("question") + " " + S.qIndex;
  $("qCat").textContent = (item.c==="random" ? t("random") : t(item.c)) + (item.live ? " · " + t("live") : "");
  $("tagpill").textContent = item.c==="random" ? t("random") : t(item.c);
  $("revName").textContent = item.t;
  $("revMeta").textContent = "";
  loadImage(item);

  options = makeOptions(item);
  const box = $("answers"); box.innerHTML = "";
  options.forEach((name, i)=>{
    const b = document.createElement("button");
    b.className = "ans"; b.type = "button"; b.dataset.i = i;
    b.innerHTML = `<span class="num">${i+1}</span><span class="lbl">${name}</span>
      <svg class="mk" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></svg>`;
    b.onclick = ()=> answer(i, b);
    box.appendChild(b);
  });

  // warm the next image
  try{ const nx = pickFromPool(); const pre = new Image(); pre.referrerPolicy="no-referrer"; pre.src = nx.u; }catch(e){}
}

function answer(idx, btn){
  if(answered) return;
  answered = true;
  const chosen = options[idx], ok = chosen === current.t;
  const correctIdx = options.indexOf(current.t);

  document.querySelectorAll(".ans").forEach((b,i)=>{
    b.disabled = true;
    if(i === correctIdx){ b.classList.add("right"); b.querySelector(".mk").innerHTML = '<path d="M4.5 12.5l5 5 10-11"/>'; }
    else if(i === idx){ b.classList.add("wrong"); b.querySelector(".mk").innerHTML = '<path d="M6 6l12 12M18 6L6 18"/>'; }
    else b.classList.add("dim");
  });

  $("imgcard").classList.remove("veiled");
  S.answered++;
  if(ok){
    S.coins += 10; S.streak++; if(S.streak > S.best) S.best = S.streak;
    save("coins", S.coins); save("best", S.best); save("answered", S.answered);
    renderCoins(); coinFx(10); sfx.correct(); buzz([14,40,18]);
  } else {
    S.streak = 0; save("answered", S.answered); renderCoins();
    sfx.wrong(); buzz([40,60,40]);
  }

  const rev = $("reveal");
  $("revName").textContent = current.t;
  $("revMeta").textContent = (ok ? t("correct") : t("wrong") + " " + current.t) + (current.d ? " · " + current.d : "");
  rev.classList.add("on");
  creditFor(current).then(c=>{
    const extra = (current.d ? current.d + " · " : "") + c;
    $("revMeta").textContent = (ok ? t("correct") : t("wrong") + " " + current.t) + " · " + extra;
  });

  autoTimer = setTimeout(()=>{ if(curScreen==="game") nextQuestion(); }, ok ? 1500 : 2100);
}

/* ---------- home preview ---------- */
function renderPeek(){
  const box = $("peek"); if(!box) return;
  const picks = []; const cats = new Set();
  let guard = 0;
  while(picks.length < 3 && guard++ < 300){
    const it = pick(DB);
    if(cats.has(it.c)) continue;
    cats.add(it.c); picks.push(it);
  }
  box.innerHTML = picks.map(it=>`<div class="pk"><img src="${it.u}" alt="" referrerpolicy="no-referrer"><span class="q">?</span></div>`).join("");
}

/* ---------- settings ---------- */
function paintSettings(){
  document.documentElement.setAttribute("data-theme", S.settings.theme);
  document.querySelectorAll("[data-toggle]").forEach(sw=>{
    const k = sw.dataset.toggle;
    const on = k === "theme" ? S.settings.theme === "dark" : !!S.settings[k];
    sw.classList.toggle("on", on);
    sw.setAttribute("aria-checked", on ? "true" : "false");
  });
  $("langsel").value = S.settings.lang;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", S.settings.theme === "dark" ? "#07070e" : "#f3f4fb");
}
function toggle(k){
  if(k === "theme"){ S.settings.theme = S.settings.theme === "dark" ? "light" : "dark"; }
  else { S.settings[k] = !S.settings[k]; }
  save("settings", S.settings); paintSettings(); sfx.tap(); buzz(8);
  if(k === "music") syncMusic();
}

/* ---------- sheets content ---------- */
const SHEETS = {
  howto: () => [t("howto"), `
    <p>Every round shows <strong>one real photo</strong> of a real-world item — an animal, a gadget, a dish, a monument, a tool, anything from anywhere in the world.</p>
    <h3>The rules</h3>
    <ul>
      <li>Each question has <strong>exactly 4 answer options</strong> and only one is correct.</li>
      <li>A correct answer gives <strong>+10 coins</strong>. A wrong answer gives 0.</li>
      <li>The photo starts blurred so it stays a challenge — it clears the moment you answer.</li>
      <li>After you answer, the item's name, a one-line fact and the photo credit appear.</li>
      <li>The next question loads automatically; tap <span class="kbd">Next</span> to skip the wait.</li>
      <li>Tap the refresh button any time for a brand-new photo.</li>
      <li>Pick a category on the home screen, or keep <strong>All items</strong> for a worldwide mix.</li>
    </ul>
    <h3>Your progress</h3>
    <p>Coins, best streak, answered count and the items you have already seen are saved on this device. Coins never reset on their own — only the reset button in Settings clears them.</p>
    <h3>Keyboard</h3>
    <p>Press <span class="kbd">1</span>–<span class="kbd">4</span> to answer, <span class="kbd">R</span> for a new photo, <span class="kbd">Esc</span> to go back.</p>`],
  privacy: () => [t("privacy"), `
    <p><strong>Short version:</strong> Image Guesser has no accounts, no ads, no trackers and no analytics. Nothing about you leaves your device except the plain image requests described below.</p>
    <h3>What is stored, and where</h3>
    <p>Your coins, best streak, answered count, list of already-seen items, settings and language are kept in your browser/app <strong>local storage on this device</strong>. They are never uploaded anywhere, and uninstalling the app or clearing app data removes them.</p>
    <h3>Network requests</h3>
    <p>To show a real photo, the app asks <strong>Wikipedia</strong> (en.wikipedia.org) and <strong>Wikimedia Commons</strong> (upload.wikimedia.org) for the image and its credit line. Those requests carry no personal data beyond what any web request contains (such as your IP address, which Wikimedia needs to serve the file). Wikimedia's own policies apply to them.</p>
    <h3>Children</h3>
    <p>The game is a general-audience quiz with educational content and collects no personal information from anyone.</p>
    <h3>Contact</h3>
    <p>Questions about privacy: nihaonihao54059@gmail.com</p>`],
  about: () => [t("about"), `
    <p><strong>Image Guesser</strong> v${VERSION} — a worldwide image quiz. One photo, four names, ten coins for the right call.</p>
    <p>It ships with <strong>${DB.length.toLocaleString()} curated items</strong> across ${CATS.length-2} categories, and it keeps discovering more: in <em>All items</em> and <em>Random World</em> it pulls live articles from Wikipedia, so the quiz never runs out of new things to show.</p>
    <h3>How it is built</h3>
    <p>One self-contained HTML app — no frameworks, no build step — wrapped in a native Android shell. Item names, descriptions and photos come from Wikipedia and Wikimedia Commons through the public MediaWiki API.</p>
    <h3>Data &amp; licensing</h3>
    <p>Text and images are used under the licenses shown with each photo. Every question displays its photo credit. Wikipedia text is available under CC BY-SA 4.0; individual images carry their own licenses (usually CC BY-SA, CC BY or public domain).</p>
    <p><strong>Image Guesser is an independent project. It is not affiliated with, endorsed by, or sponsored by the Wikimedia Foundation, Wikipedia or Wikimedia Commons.</strong></p>`],
  credits: () => [t("credits"), `
    <p><strong>Image Guesser</strong> — concept, design and development: built for Nihao Nihao as a complete single-file game plus Android app.</p>
    <h3>Content sources</h3>
    <ul>
      <li><a href="https://www.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a> — item names, one-line descriptions, article links. Text under CC BY-SA 4.0.</li>
      <li><a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a> — the photos themselves, plus their license metadata.</li>
      <li><a href="https://www.mediawiki.org/wiki/API:Main_page" target="_blank" rel="noopener">MediaWiki API documentation</a> — the public API this game queries at runtime.</li>
    </ul>
    <h3>Image creators &amp; licenses</h3>
    <p>Photographs on Wikimedia Commons are made by thousands of volunteer photographers and institutions. Rather than list them all here, <strong>every question shows the credit for its own photo</strong> — author, license and source — right under the image after you answer. The license shown there (for example CC BY-SA 4.0, CC BY 3.0, CC0 or public domain) is the one that applies to that specific image.</p>
    <p>To inspect an image's full license page, open its article on Wikipedia and follow the photo's file link.</p>
    <h3>Fonts &amp; assets</h3>
    <p>No third-party fonts, icon packs, analytics SDKs or ad networks are used. All icons and the logo are drawn as inline SVG inside the app; sounds are synthesised in the browser with the Web Audio API.</p>
    <h3>Disclaimer</h3>
    <p>This is an independent, unofficial project. No partnership with or endorsement by the Wikimedia Foundation, Wikipedia or Wikimedia Commons is claimed or implied. "Wikipedia" and "Wikimedia" are trademarks of the Wikimedia Foundation.</p>`]
};

/* ---------- boot ---------- */
function boot(){
  window.__DB__ = DB;
  renderCoins(); applyI18n(); paintSettings();

  $("btnStart").onclick = ()=>{ sfx.tap(); buzz(10); startMusic(); S.qIndex = 0; go("game"); nextQuestion(); };
  $("btnHow").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.howto(); openSheet(ti,h); };
  $("btnSettingsHome").onclick = ()=>{ sfx.tap(); go("settings"); };
  $("btnBack").onclick = ()=>{ clearTimeout(autoTimer); go("home"); };
  $("btnBack2").onclick = ()=>{ go("home"); };
  $("btnRefresh").onclick = ()=>{ sfx.tap(); buzz(10); nextQuestion(); toast(t("live"), 900); };
  $("btnNext").onclick = ()=>{ clearTimeout(autoTimer); nextQuestion(); };
  $("btnImgRetry").onclick = ()=>{ if(current) loadImage(current); };

  $("rowHow").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.howto(); openSheet(ti,h); };
  $("rowPrivacy").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.privacy(); openSheet(ti,h); };
  $("rowAbout").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.about(); openSheet(ti,h); };
  $("rowCredits").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.credits(); openSheet(ti,h); };
  $("rowReset").onclick = ()=>{
    sfx.tap();
    openSheet(t("resetTitle"), `<p>${t("resetBody")}</p>
      <div style="display:flex;gap:9px;margin-top:14px">
        <button class="ghost" id="rsNo" style="height:46px">${t("cancel")}</button>
        <button class="nextbtn" id="rsYes" style="height:46px;flex:1;justify-content:center">${t("resetGo")}</button>
      </div>`);
    $("rsNo").onclick = closeSheet;
    $("rsYes").onclick = ()=>{
      S.coins = 0; S.best = 0; S.answered = 0; S.streak = 0; S.seen = []; seenSet.clear();
      creditCache = {}; liveCache = [];
      save("coins",0); save("best",0); save("answered",0); save("seen",[]); save("cred",{}); save("live",[]);
      renderCoins(); closeSheet(); toast(t("resetDone"));
    };
  };

  $("shClose").onclick = closeSheet;
  $("scrim").onclick = closeSheet;
  document.querySelectorAll("[data-toggle]").forEach(sw=>{
    sw.onclick = ()=> toggle(sw.dataset.toggle);
    sw.onkeydown = e=>{ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); toggle(sw.dataset.toggle); } };
  });
  $("langsel").onchange = e=>{ S.settings.lang = e.target.value; save("settings", S.settings); applyI18n(); paintSettings(); };

  document.addEventListener("keydown", e=>{
    if(curScreen!=="game") return;
    if(["1","2","3","4"].includes(e.key)){
      const b = document.querySelectorAll(".ans")[+e.key-1]; if(b && !b.disabled) b.click();
    }
    if(e.key.toLowerCase()==="r") nextQuestion();
    if(e.key==="Escape") go("home");
  });

  const off = $("offline");
  const setOff = ()=> off.classList.toggle("on", !navigator.onLine);
  window.addEventListener("online", setOff); window.addEventListener("offline", setOff); setOff();

  // first gesture unlocks audio on mobile
  const unlock = ()=>{ audio(); if(S.settings.music) startMusic(); document.removeEventListener("pointerdown", unlock); };
  document.addEventListener("pointerdown", unlock, {once:true});

  // splash → home
  setTimeout(()=>{ go("home"); }, 1150);
  const cat = load("cat","all"); if(cat) S.cat = cat;
  renderPeek();
  renderChips();
  $("verline").textContent = "Version " + VERSION;
  $("langsel").value = S.settings.lang;
  applyI18n();
}
document.addEventListener("DOMContentLoaded", boot);
