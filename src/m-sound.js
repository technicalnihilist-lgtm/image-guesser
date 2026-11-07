/* ================= MODE 2: SOUND GUESSER ================= */
const SND = { cur:null, options:[], answered:false, n:0, cat:"all", score:0, audio:null, t:null,
              limit:0, left:0, playing:false, daily:false, rng:null };
const SND_CATS = () => {
  const counts = {};
  SOUNDS.forEach(s => { counts[s.c] = (counts[s.c]||0) + 1; });
  const labels = { animals:"Animals", instruments:"Instruments", vehicles:"Vehicles", human:"Human",
                   nature:"Nature", everyday:"Everyday", household:"Household", machines:"Machines" };
  return [["all","All sounds"]].concat(Object.keys(labels).filter(k => (counts[k]||0) >= 2).map(k => [k, labels[k]]));
};
function sndPool(cat){
  const c = cat || SND.cat;
  return c === "all" ? SOUNDS : SOUNDS.filter(s => s.c === c);
}
function sndPick(){
  const rng = SND.rng || Math.random;
  const pool = sndPool();
  const seen = new Set(S.seenSound);
  const fresh = pool.filter(s => !seen.has(s.t.toLowerCase()));
  const arr = fresh.length ? fresh : pool;
  return arr[Math.floor(rng()*arr.length)];
}
function sndOptions(item){
  const rng = SND.rng || Math.random;
  const used = new Set([item.t.toLowerCase()]);
  const out = [item.t];
  const shuf = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  shuf(sndPool(item.c).filter(x=>x.t !== item.t)).forEach(x=>{
    if(out.length < 3 && !used.has(x.t.toLowerCase())){ used.add(x.t.toLowerCase()); out.push(x.t); }
  });
  shuf(SOUNDS.filter(x=>x.t !== item.t)).forEach(x=>{
    if(out.length < 4 && !used.has(x.t.toLowerCase())){ used.add(x.t.toLowerCase()); out.push(x.t); }
  });
  return shuf(out).slice(0,4);
}
function soundStart(daily){
  startMode("sound");
  SND.n = 0; SND.score = 0; SND.daily = !!daily;
  SND.rng = daily ? seeded("snd-" + todayKey()) : null;
  SND.limit = 30;
  go("mode-sound");
  soundNext();
}
function soundNext(){
  clearInterval(SND.t); clearTimeout(SND.t);
  SND.answered = false;
  $("sreveal").classList.remove("on");
  stopSound();
  const item = sndPick(); if(!item) return;
  SND.cur = item; SND.n++;
  const seen = new Set(S.seenSound); seen.add(item.t.toLowerCase());
  S.seenSound = Array.from(seen).slice(-600); save();

  $("sNum").textContent = (SND.daily ? "Daily " : "Sound ") + SND.n + (SND.daily ? "/5" : "");
  const catLabel = item.c === "all" ? "All sounds" : item.c.charAt(0).toUpperCase() + item.c.slice(1);
  $("sCat").textContent = catLabel + " · " + SND.limit + "s";
  $("srevName").textContent = item.t; $("srevMeta").textContent = "";
  $("sHintText").textContent = "Tap play, then choose below";

  SND.options = sndOptions(item);
  const box = $("sanswers"); box.innerHTML = "";
  SND.options.forEach((name,i)=>{
    const b = document.createElement("button");
    b.className = "ans"; b.type = "button";
    b.innerHTML = `<span class="num">${i+1}</span><span class="lbl">${name}</span>
      <svg class="mk" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></svg>`;
    b.onclick = ()=> soundAnswer(i);
    box.appendChild(b);
  });

  SND.left = SND.limit;
  SND.t = setInterval(()=>{
    SND.left--;
    $("sCat").textContent = catLabel + " · " + Math.max(0,SND.left) + "s";
    if(SND.left <= 0 && !SND.answered){ clearInterval(SND.t); soundAnswer(-1); }
  }, 1000);
  setTimeout(()=>{ if(!SND.answered) soundPlay(); }, 260);
}
function soundPlay(){
  if(!SND.cur) return;
  stopSound();
  const a = new Audio(SND.cur.u);
  a.volume = parseFloat($("volSlider").value || "0.9");
  a.preload = "auto";
  SND.audio = a;
  $("sbars").classList.add("play");
  a.onended = ()=>{ $("sbars").classList.remove("play"); SND.playing = false; };
  a.onerror = ()=>{ $("sbars").classList.remove("play"); toast("Clip could not load — skipping"); soundNext(); };
  a.play().then(()=>{ SND.playing = true; }).catch(()=>{ $("sbars").classList.remove("play"); });
  $("sHintText").textContent = "Playing… tap to replay";
}
function stopSound(){
  $("sbars").classList.remove("play");
  if(SND.audio){ try{ SND.audio.pause(); SND.audio.currentTime = 0; }catch(e){} SND.audio = null; }
}
function soundAnswer(idx){
  if(SND.answered || !SND.cur) return;
  SND.answered = true;
  clearInterval(SND.t);
  stopSound();
  const item = SND.cur, ok = idx >= 0 && SND.options[idx] === item.t;
  const correctIdx = SND.options.indexOf(item.t);
  $$("#sanswers .ans").forEach((b,i)=>{
    b.disabled = true;
    if(i === correctIdx){ b.classList.add("right"); b.querySelector(".mk").innerHTML = '<path d="M4.5 12.5l5 5 10-11"/>'; }
    else if(i === idx){ b.classList.add("wrong"); b.querySelector(".mk").innerHTML = '<path d="M6 6l12 12M18 6L6 18"/>'; }
    else b.classList.add("dim");
  });
  markAnswer(ok, "sound");
  if(ok){ const r = rewardAnswer("sound", 10); SND.score += r.coins; coinFx(r.coins, $("coinSound")); sfx.correct(); buzz([14,40,18]); }
  else { sfx.wrong(); buzz([40,60,40]); }

  $("srevName").textContent = item.t;
  const credit = [item.a, item.l, "Wikimedia Commons"].filter(Boolean).join(" · ");
  $("srevMeta").textContent = (ok ? "Correct! +10 coins" : (idx < 0 ? "Time up — it was " : "Not quite — it was ") + item.t) + " · " + credit;
  $("sreveal").classList.add("on");
  checkDaily("sound");
  SND.t = setTimeout(()=>{
    if(curScreen !== "mode-sound") return;
    if(SND.daily && SND.n >= 5) soundDailyDone(); else soundNext();
  }, ok ? 1600 : 2100);
}
function soundDailyDone(){
  recordScore("sound", SND.score, "Daily · " + todayKey());
  if(!S.dailyCh.done.sound){ S.dailyCh.done.sound = true; addCoins(25, "daily sound challenge"); }
  save(); showReward("Daily sound quiz done", "Score " + SND.score + " coins"); go("home");
}
function soundCatSheet(){
  const cats = SND_CATS();
  openSheet("Sound categories", `<div class="grid2" style="gap:8px">` + cats.map(([id,label])=>
    `<button class="chip ${SND.cat===id?"on":""}" data-scat="${id}" style="justify-content:flex-start">
      <svg class="ci"><use href="#i-sound"/></svg>${label}</button>`).join("") + `</div>`);
  $$("[data-scat]").forEach(b=>b.onclick = ()=>{
    SND.cat = b.dataset.scat; SND.rng = null; closeSheet(); sfx.tap(); soundNext();
  });
}
