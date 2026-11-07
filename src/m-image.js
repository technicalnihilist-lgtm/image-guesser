/* ================= MODE 1: IMAGE GUESSER ================= */
const ICATS = [
  { id:"all", ic:"c-sparkle" }, { id:"animals", ic:"c-paw" }, { id:"technology", ic:"c-chip" },
  { id:"vehicles", ic:"c-car" }, { id:"food", ic:"c-food" }, { id:"nature", ic:"c-leaf" },
  { id:"history", ic:"c-column" }, { id:"science", ic:"c-flask" }, { id:"buildings", ic:"c-city" },
  { id:"sports", ic:"c-ball" }, { id:"household", ic:"c-house" }, { id:"arts", ic:"c-palette" }
];
const IMG = { cur:null, options:[], answered:false, n:0, cat:"all", score:0, daily:false, t:null, imgTries:0, rng:null };

function imgPool(cat){
  const c = cat || IMG.cat;
  return c === "all" ? DB : DB.filter(i => i.c === c);
}
function imgSeenSet(){ return new Set(S.seenImage); }
function imgPickItem(){
  const rng = IMG.rng || Math.random;
  const pool = imgPool();
  const seen = imgSeenSet();
  const fresh = pool.filter(i => !seen.has(i.t.toLowerCase()));
  const arr = fresh.length ? fresh : pool;
  return arr[Math.floor(rng()*arr.length)];
}
function imgOptions(item){
  const rng = IMG.rng || Math.random;
  const used = new Set([item.t.toLowerCase()]);
  const out = [item.t];
  const same = imgPool(item.c).filter(x => x.t.toLowerCase() !== item.t.toLowerCase());
  const shuf = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  shuf(same.slice()).forEach(x=>{ if(out.length<3){ const k=x.t.toLowerCase(); if(!used.has(k)){ used.add(k); out.push(x.t); } } });
  shuf(DB.slice()).forEach(x=>{ if(out.length<4){ const k=x.t.toLowerCase(); if(!used.has(k)){ used.add(k); out.push(x.t); } } });
  return shuf(out).slice(0,4);
}
function imageStart(daily){
  startMode("image");
  IMG.n = 0; IMG.score = 0; IMG.daily = !!daily;
  IMG.rng = daily ? seeded("img-" + todayKey()) : null;
  if(daily){ IMG.cat = "all"; }
  go("mode-image");
  imageNext();
}
function imageNext(){
  clearTimeout(IMG.t);
  IMG.answered = false; IMG.options = [];
  $("reveal").classList.remove("on");
  const card = $("imgcard"), img = $("qimg");
  img.style.transition = "none";
  card.classList.add("veiled");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ img.style.transition = ""; }));

  const item = imgPickItem();
  if(!item) return;
  IMG.cur = item; IMG.n++;
  const seen = imgSeenSet(); seen.add(item.t.toLowerCase());
  S.seenImage = Array.from(seen).slice(-1500); save();

  $("qNum").textContent = (IMG.daily ? "Daily " : "Question ") + IMG.n + (IMG.daily ? "/5" : "");
  $("qCat").textContent = (item.c === "all" ? "All items" : t(item.c)) + (IMG.daily ? " · daily" : "");
  $("tagpill").textContent = t(item.c);
  $("revName").textContent = item.t;
  $("revMeta").textContent = "";
  imageLoad(item);

  IMG.options = imgOptions(item);
  const box = $("answers"); box.innerHTML = "";
  IMG.options.forEach((name,i)=>{
    const b = document.createElement("button");
    b.className = "ans"; b.type = "button";
    b.innerHTML = `<span class="num">${i+1}</span><span class="lbl">${name}</span>
      <svg class="mk" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></svg>`;
    b.onclick = ()=> imageAnswer(i);
    box.appendChild(b);
  });
}
function imageLoad(item){
  const card = $("imgcard"), img = $("qimg");
  card.classList.add("loading"); card.classList.remove("err");
  IMG.imgTries = 0;
  img.onload = ()=>{ card.classList.remove("loading"); };
  img.onerror = ()=> imageImgError(item);
  img.src = item.u;
}
function imageImgError(item){
  const img = $("qimg"), card = $("imgcard");
  IMG.imgTries++;
  if(IMG.imgTries === 1 && item.f){
    fetch(`${API}?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=640&titles=${encodeURIComponent(item.t)}`)
      .then(r=>r.json()).then(j=>{
        const p = Object.values(j.query.pages)[0];
        const src = p && p.thumbnail && p.thumbnail.source;
        if(src && src !== img.src){ card.classList.add("loading"); img.src = src; return; }
        throw new Error("no alt");
      }).catch(()=>{ imageImgFail(item); });
    return;
  }
  imageImgFail(item);
}
function imageImgFail(item){
  const card = $("imgcard");
  card.classList.remove("loading"); card.classList.add("err");
  $("errmsg").textContent = t("imgErr");
  toast(t("noImage"), 1600);
  clearTimeout(IMG.t);
  IMG.t = setTimeout(()=>{ if(!IMG.answered && curScreen === "mode-image") imageNext(); }, 2400);
}
function imageAnswer(idx){
  if(IMG.answered || !IMG.cur) return;
  IMG.answered = true;
  const item = IMG.cur, chosen = IMG.options[idx], ok = chosen === item.t;
  const correctIdx = IMG.options.indexOf(item.t);
  $$("#answers .ans").forEach((b,i)=>{
    b.disabled = true;
    if(i === correctIdx){ b.classList.add("right"); b.querySelector(".mk").innerHTML = '<path d="M4.5 12.5l5 5 10-11"/>'; }
    else if(i === idx){ b.classList.add("wrong"); b.querySelector(".mk").innerHTML = '<path d="M6 6l12 12M18 6L6 18"/>'; }
    else b.classList.add("dim");
  });
  $("imgcard").classList.remove("veiled");
  markAnswer(ok, "image");
  if(ok){
    const r = rewardAnswer("image", 10);
    IMG.score += r.coins;
    coinFx(r.coins, $("coinGame")); sfx.correct(); buzz([14,40,18]);
  } else { sfx.wrong(); buzz([40,60,40]); }

  $("revName").textContent = item.t;
  $("revMeta").textContent = (ok ? "Correct! +10 coins" : "Not quite — it was " + item.t) + (item.d ? " · " + item.d : "");
  $("reveal").classList.add("on");
  creditFor(item).then(c=>{
    $("revMeta").textContent = (ok ? "Correct!" : "Not quite — it was " + item.t) + " · " + (item.d ? item.d + " · " : "") + c;
  });
  checkDaily("image");
  IMG.t = setTimeout(()=>{
    if(curScreen !== "mode-image") return;
    if(IMG.daily && IMG.n >= 5){ imageDailyDone(); } else imageNext();
  }, ok ? 1500 : 2000);
}
function imageDailyDone(){
  recordScore("image", IMG.score, "Daily · " + todayKey());
  showReward("Daily image quiz done", "Score " + IMG.score + " coins" + (S.dailyCh.done.image ? "" : " · +25 bonus"));
  if(!S.dailyCh.done.image){ S.dailyCh.done.image = true; addCoins(25, "daily image challenge"); }
  save(); go("home");
}
async function creditFor(item){
  const key = "ig.cred." + item.f;
  try{ const c = localStorage.getItem(key); if(c) return c; }catch(e){}
  try{
    const u = `${API}?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata`
      + `&iiextmetadatafilter=Artist|LicenseShortName&titles=${encodeURIComponent("File:"+item.f)}`;
    const j = await (await fetch(u)).json();
    const p = Object.values(j.query.pages)[0];
    const md = (p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata) || {};
    let artist = stripHtml(md.Artist && md.Artist.value).replace(/\s+/g," ");
    if(artist.length > 6 && artist.length % 2 === 0 && artist.slice(0, artist.length/2) === artist.slice(artist.length/2))
      artist = artist.slice(0, artist.length/2);
    artist = artist.slice(0, 52);
    const lic = stripHtml(md.LicenseShortName && md.LicenseShortName.value).slice(0,26);
    const s = [artist || "Wikimedia contributor", lic, "Wikimedia Commons"].filter(Boolean).join(" · ");
    try{ localStorage.setItem(key, s); }catch(e){}
    return s;
  }catch(e){ return "Wikimedia Commons"; }
}
function imageCatSheet(){
  const html = `<div class="grid2" style="gap:8px">` + ICATS.map(c=>
    `<button class="chip ${IMG.cat===c.id?"on":""}" data-cat="${c.id}" style="justify-content:flex-start">
      <svg class="ci"><use href="#${c.ic}"/></svg>${c.id==="all" ? t("allItems") : t(c.id)}</button>`).join("") + `</div>`;
  openSheet(t("categories"), html);
  $$("[data-cat]").forEach(b=>b.onclick = ()=>{
    IMG.cat = b.dataset.cat; IMG.rng = null; closeSheet(); sfx.tap(); imageNext();
  });
}
function checkDaily(mode){
  if(!S.dailyCh.done) S.dailyCh.done = {};
  if(S.dailyCh.date !== todayKey()){ S.dailyCh = { date: todayKey(), done: {} }; }
  if(!S.dailyCh.done[mode]){
    S.dailyCh.done[mode] = true; save();
    const done = Object.keys(S.dailyCh.done).length;
    if(done === 5){ addCoins(50, "all five daily modes"); showReward("Daily sweep!", "All five modes played · +50 coins"); }
  }
}
