/* ================= IMAGE GUESSER v2 — core ================= */
const DB = window.__DB__;              // image items
const SOUNDS = window.__SOUNDS__;      // audio items
const VERSION = "2.0.0";
const LS = "ig.v2.";
const API = "https://en.wikipedia.org/w/api.php";

const $ = id => document.getElementById(id);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function stripHtml(s){ return String(s||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim(); }
function fmt(n){ return Number(n||0).toLocaleString("en-IN"); }
function mmss(sec){ const m=Math.floor(sec/60), s=Math.max(0,Math.floor(sec%60)); return m+":"+String(s).padStart(2,"0"); }

/* ---------- deterministic rng ---------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function seeded(key){ return mulberry32(hashStr(key)); }
function todayKey(d){ const x = d || new Date(); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); }
function weekKey(){ const d=new Date(); const onejan=new Date(d.getFullYear(),0,1); const w=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7); return d.getFullYear()+"-W"+w; }
function monthKey(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }

/* ---------- state ---------- */
const DEFAULT_STATE = {
  v: 2, coins: 0, xp: 0, name: "Player", created: null,
  coinsEarned: 0, coinsSpent: 0,
  stats: { answered:0, correct:0, wrong:0, gamesPlayed:0, bestStreak:0, streak:0,
           sortLevels:0, diffPuzzles:0, dailyClaims:0, missionsDone:0,
           perMode: { image:{plays:0,correct:0,best:0}, sound:{plays:0,correct:0,best:0},
                      diff:{plays:0,correct:0,best:0}, sort:{plays:0,correct:0,best:0},
                      math:{plays:0,correct:0,best:0} } },
  inv: { hint:0, life:0, skip:0, double:0 },
  owned: [], equipped: { avatar:"av_fox", frame:"", skin:"", crown:"", effect:"" },
  achievements: {}, missions: { day:{ key:"", prog:{}, claimed:{} }, week:{ key:"", prog:{}, claimed:{} } },
  daily: { last:"", streak:0, spinDay:"", spinsUsed:0 },
  dailyCh: { date:"", done:{} },
  seenImage: [], seenSound: [], ledger: [],
  records: { image:[], sound:[], diff:[], sort:[], math:[] },
  settings: { sound:true, music:true, vibe:true, theme:"dark", blur:true, lang:"en", graphics:"high" },
  counters: { imageCorrect:0, soundCorrect:0, mathCorrect:0, diffDone:0, sortDone:0 }
};
function deepMerge(base, over){
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if(!over || typeof over !== "object") return out;
  for(const k in over){
    const v = over[k];
    if(v && typeof v === "object" && !Array.isArray(v) && base && typeof base[k] === "object" && !Array.isArray(base[k]))
      out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}
let S = deepMerge(DEFAULT_STATE, loadRaw());
function loadRaw(){ try{ return JSON.parse(localStorage.getItem(LS+"save") || "null") || {}; }catch(e){ return {}; } }
function save(){
  try{ localStorage.setItem(LS+"save", JSON.stringify(S)); }
  catch(e){ /* storage full / blocked: game keeps running in memory */ }
}
if(!S.created){ S.created = todayKey(); save(); }

/* ---------- economy ---------- */
function ledgerPush(delta, reason){
  S.ledger.unshift({ t: Date.now(), d: delta, r: reason });
  if(S.ledger.length > 250) S.ledger.length = 250;
}
function addCoins(n, reason){
  n = Math.round(n);
  if(!(n > 0)) return 0;
  S.coins += n; S.coinsEarned += n; ledgerPush(n, reason); save(); renderCoins();
  return n;
}
function spendCoins(n, reason){
  n = Math.round(n);
  if(n <= 0) return false;
  if(S.coins < n) return false;
  S.coins -= n; S.coinsSpent += n; ledgerPush(-n, reason); save(); renderCoins();
  return true;
}
function addXp(n){
  S.xp += n;
  const lvl = Math.floor(Math.sqrt(S.xp / 60)) + 1;
  S.level = lvl; save(); renderWallet();
}
function level(){ return Math.floor(Math.sqrt(Math.max(0, S.xp || 0) / 60)) + 1; }
function xpForNext(){ const l = level(); return Math.round(60 * l * l); }

/* reward for a correct answer, honouring the 2X booster */
function rewardAnswer(mode, base){
  let n = base || 10;
  let doubled = false;
  if(S.inv.double > 0){ S.inv.double--; n *= 2; doubled = true; save(); }
  S.counters[mode + "Correct"] = (S.counters[mode + "Correct"] || 0) + 1;
  addCoins(n, (doubled ? "2x " : "") + mode + " correct");
  addXp(doubled ? 12 : 8);
  return { coins: n, doubled };
}

/* ---------- streaks & stats ---------- */
function markAnswer(correct, mode){
  const st = S.stats;
  st.answered++;
  if(correct){ st.correct++; st.streak++; if(st.streak > st.bestStreak) st.bestStreak = st.streak; }
  else { st.wrong++; st.streak = 0; }
  const pm = st.perMode[mode]; if(pm){ if(correct) pm.correct++; if(st.streak > pm.best) pm.best = st.streak; }
  bumpMissions("answer", 1);
  if(correct) bumpMissions("correct", 1);
  save(); checkAchievements(true);
}
function startMode(mode){ S.stats.gamesPlayed++; if(S.stats.perMode[mode]) S.stats.perMode[mode].plays++; save(); }
function recordScore(mode, score, label){
  const r = S.records[mode] || (S.records[mode] = []);
  r.push({ s: score, l: label || "", t: Date.now() });
  r.sort((a,b)=>b.s-a.s);
  if(r.length > 10) r.length = 10;
  save();
}

/* ---------- i18n ---------- */
function t(k){ const L = I18N[S.settings.lang] || I18N.en; return (L && L[k]) || I18N.en[k] || k; }
function applyI18n(){
  $$("[data-i18n]").forEach(el=>{ const v = t(el.getAttribute("data-i18n")); if(v) el.innerHTML = v; });
  document.documentElement.lang = S.settings.lang;
  renderNav();
}

/* ---------- audio ---------- */
let ac = null, musicGain = null, musicNodes = [];
function audio(){ if(!ac){ try{ ac = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} }
  if(ac && ac.state === "suspended") ac.resume(); return ac; }
function tone(freq, dur, type, vol, delay){
  if(!S.settings.sound) return; const c = audio(); if(!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine"; o.frequency.value = freq;
  const t0 = c.currentTime + (delay || 0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol || .1, t0 + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .02);
}
const sfx = {
  tap(){ tone(620,.05,"sine",.045); },
  correct(){ [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.22,"triangle",.085,i*.07)); },
  wrong(){ tone(233,.16,"sawtooth",.055); tone(174,.28,"sawtooth",.055,.13); },
  coin(){ tone(1318,.09,"square",.03); tone(1760,.14,"square",.028,.06); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.26,"triangle",.09,i*.09)); },
  fail(){ [330,262,196].forEach((f,i)=>tone(f,.22,"sawtooth",.06,i*.12)); }
};
function startMusic(){
  const c = audio(); if(!c || !S.settings.music || musicNodes.length) return;
  musicGain = c.createGain(); musicGain.gain.value = .032; musicGain.connect(c.destination);
  [110,164.81,220,277.18].forEach((f,i)=>{
    const o = c.createOscillator(), g = c.createGain();
    o.type = i%2 ? "sine" : "triangle"; o.frequency.value = f; g.gain.value = .3/(i+1);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = .06 + i*.017; lg.gain.value = .18/(i+1);
    lfo.connect(lg).connect(g.gain); lfo.start();
    o.connect(g).connect(musicGain); o.start(); musicNodes.push(o, lfo);
  });
}
function stopMusic(){ musicNodes.forEach(n=>{ try{n.stop();}catch(e){} }); musicNodes = []; if(musicGain){ try{musicGain.disconnect();}catch(e){} musicGain = null; } }
function syncMusic(){ S.settings.music ? startMusic() : stopMusic(); }
function buzz(p){ if(S.settings.vibe && navigator.vibrate){ try{ navigator.vibrate(p); }catch(e){} } }

/* ---------- nav ---------- */
const NAV_SCREENS = ["home","shop","rewards","awards","profile"];
let curScreen = "splash", backStack = [];
function go(name, opts){
  const el = $(name); if(!el) return;
  if(curScreen !== name && curScreen !== "splash") backStack.push(curScreen);
  if(backStack.length > 12) backStack.shift();
  $$(".screen").forEach(s=>s.classList.remove("on"));
  el.classList.add("on"); el.scrollTop = 0; curScreen = name;
  $("nav").style.display = NAV_SCREENS.includes(name) ? "grid" : "none";
  renderNav();
  if(name === "home"){ renderHome(); }
  if(name === "shop") renderShop();
  if(name === "rewards") renderRewards();
  if(name === "awards") renderAwards();
  if(name === "profile") renderProfile();
  if(name === "leaderboard") renderLeaderboard();
  if(name === "settings") paintSettings();
}
function back(){ const p = backStack.pop() || "home"; curScreen = "splash"; go(p); }
function renderNav(){ $$("#nav button").forEach(b=>b.classList.toggle("on", b.dataset.nav === curScreen)); }

/* ---------- toast / sheet / reward ---------- */
function toast(msg, ms){
  const el = $("toast"); el.textContent = msg; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove("on"), ms || 2200);
}
function openSheet(title, html){
  $("shTitle").textContent = title; $("shBody").innerHTML = html;
  $("scrim").classList.add("on"); $("sheet").classList.add("on");
}
function closeSheet(){ $("scrim").classList.remove("on"); $("sheet").classList.remove("on"); }
function showReward(title, text, onOk){
  $("rwTitle").textContent = title; $("rwText").textContent = text;
  $("reward").classList.add("on");
  $("rwOk").onclick = ()=>{ $("reward").classList.remove("on"); if(onOk) onOk(); };
}

/* ---------- coins / wallet ---------- */
function renderCoins(){ $$(".cval").forEach(e=>e.textContent = fmt(S.coins)); }
function coinFx(amount, anchorEl){
  const pill = anchorEl || $$(".coinpill").find(p=>p.getBoundingClientRect().width) || $("coinHome");
  if(!pill) return;
  const r = pill.getBoundingClientRect();
  pill.classList.add("pop"); setTimeout(()=>pill.classList.remove("pop"), 520);
  const f = document.createElement("div"); f.className = "flycoin"; f.textContent = "+" + amount;
  f.style.left = (r.left + r.width/2) + "px"; f.style.top = (r.top + r.height) + "px";
  document.body.appendChild(f); setTimeout(()=>f.remove(), 1000);
  for(let i=0;i<10;i++){
    const s = document.createElement("div"); s.className = "spark";
    const a = Math.random()*Math.PI*2, d = 24 + Math.random()*44;
    s.style.left = (r.left+r.width/2)+"px"; s.style.top = (r.top+r.height/2)+"px";
    s.style.setProperty("--dx", Math.cos(a)*d+"px"); s.style.setProperty("--dy", Math.sin(a)*d+"px");
    document.body.appendChild(s); setTimeout(()=>s.remove(), 820);
  }
  sfx.coin();
}
function renderWallet(){
  renderCoins();
  $("homeName").textContent = S.name;
  $("homeLvl").textContent = "Level " + level() + " · " + fmt(S.xp) + " XP";
  const need = xpForNext(), prev = Math.round(60*(level()-1)*(level()-1));
  $("homeXp").style.width = clamp(((S.xp-prev)/Math.max(1,need-prev))*100, 4, 100) + "%";
  paintAvatar($("homeAvatar"), "home");
}

/* ---------- avatars / cosmetics ---------- */
const AVATAR_ICON = { av_fox:"i-av-fox", av_owl:"i-av-owl", av_cat:"i-av-cat", av_bot:"i-av-bot", av_astro:"i-av-astro" };
function paintAvatar(el, size){
  if(!el) return;
  const eq = S.equipped || {};
  const ic = AVATAR_ICON[eq.avatar] || "i-av-fox";
  el.className = "av" + (size === "big" ? " big" : "") + (eq.frame ? " " + eq.frame : "") + (eq.effect ? " " + eq.effect : "");
  el.innerHTML = `<svg><use href="#${ic}"/></svg>` + (eq.crown ? `<span class="crown"><svg><use href="#i-crown"/></svg></span>` : "");
  const skin = eq.skin ? eq.skin.replace("skin_", "") : "";
  document.documentElement.setAttribute("data-skin", skin);
  document.documentElement.setAttribute("data-theme", S.settings.theme);
}

/* ---------- achievements ---------- */
const ACH = [
  { id:"first", n:"First steps", d:"Answer 1 question correctly", t:1, r:20, m:()=>S.stats.correct },
  { id:"c10", n:"Warming up", d:"Answer 10 questions correctly", t:10, r:50, m:()=>S.stats.correct },
  { id:"c50", n:"Sharp eye", d:"Answer 50 questions correctly", t:50, r:150, m:()=>S.stats.correct },
  { id:"c100", n:"Century", d:"Answer 100 questions correctly", t:100, r:300, m:()=>S.stats.correct },
  { id:"s5", n:"On a roll", d:"Get 5 correct in a row", t:5, r:60, m:()=>S.stats.bestStreak },
  { id:"s10", n:"Unstoppable", d:"Get 10 correct in a row", t:10, r:120, m:()=>S.stats.bestStreak },
  { id:"img25", n:"Image hunter", d:"25 correct image answers", t:25, r:100, m:()=>S.counters.imageCorrect||0 },
  { id:"snd10", n:"Good ear", d:"10 correct sound answers", t:10, r:100, m:()=>S.counters.soundCorrect||0 },
  { id:"mth25", n:"Number cruncher", d:"25 correct math answers", t:25, r:120, m:()=>S.counters.mathCorrect||0 },
  { id:"dif5", n:"Spotter", d:"Finish 5 difference puzzles", t:5, r:120, m:()=>S.stats.diffPuzzles },
  { id:"srt10", n:"Sorter", d:"Finish 10 colour-sort levels", t:10, r:150, m:()=>S.stats.sortLevels },
  { id:"all5", n:"All-rounder", d:"Play all five game modes", t:5, r:200,
    m:()=>Object.values(S.stats.perMode).filter(p=>p.plays>0).length },
  { id:"d7", n:"Loyal player", d:"Claim 7 daily rewards", t:7, r:250, m:()=>S.stats.dailyClaims },
  { id:"m10", n:"Mission runner", d:"Complete 10 missions", t:10, r:200, m:()=>S.stats.missionsDone },
  { id:"earn1k", n:"Coin collector", d:"Earn 1,000 coins in total", t:1000, r:100, m:()=>S.coinsEarned },
  { id:"acc80", n:"Precision", d:"80% accuracy over 50+ answers", t:80, r:150,
    m:()=>S.stats.answered >= 50 ? Math.round(100*S.stats.correct/S.stats.answered) : 0 },
  { id:"expdiff", n:"Eagle eye", d:"Finish a 15-difference puzzle", t:15, r:250, m:()=>S.bestDiffDiff || 0 },
  { id:"expsort", n:"Master sorter", d:"Finish a 9-colour level", t:9, r:200, m:()=>S.bestSortColors || 0 }
];
function achState(a){
  const rec = S.achievements[a.id] || {};
  const prog = Math.min(a.t, Math.floor(a.m() || 0));
  return { prog, target: a.t, done: prog >= a.t, claimed: !!rec.claimed };
}
function checkAchievements(silent){
  let newly = [];
  ACH.forEach(a=>{
    const st = achState(a);
    if(st.done && !st.claimed && !(S.achievements[a.id]||{}).notified){
      S.achievements[a.id] = Object.assign({}, S.achievements[a.id], { notified: true });
      newly.push(a);
    }
  });
  if(newly.length){ save(); if(!silent) toast("Achievement ready: " + newly[0].n); }
  return newly;
}
function claimAch(id){
  const a = ACH.find(x=>x.id === id); if(!a) return;
  const st = achState(a);
  if(!st.done || st.claimed) return;
  S.achievements[id] = Object.assign({}, S.achievements[id], { claimed: true });
  addCoins(a.r, "achievement: " + a.n);
  sfx.win(); buzz([12,40,12]);
  showReward("Achievement unlocked", a.n + " · +" + a.r + " coins");
  renderAwards();
}

/* ---------- missions ---------- */
const DAILY_MISSIONS = [
  { id:"dm_ans", n:"Answer 15 questions", metric:"answer", t:15, r:40 },
  { id:"dm_cor", n:"Get 8 correct answers", metric:"correct", t:8, r:50 },
  { id:"dm_play", n:"Play 3 rounds", metric:"round", t:3, r:30 },
  { id:"dm_mode", n:"Try 2 different modes", metric:"mode", t:2, r:35 }
];
const WEEKLY_MISSIONS = [
  { id:"wm_cor", n:"Get 60 correct answers this week", metric:"correct", t:60, r:200 },
  { id:"wm_play", n:"Play 20 rounds this week", metric:"round", t:20, r:150 },
  { id:"wm_daily", n:"Claim 5 daily rewards", metric:"daily", t:5, r:180 }
];
function ensureMissions(){
  const dk = todayKey(), wk = weekKey();
  if(S.missions.day.key !== dk){ S.missions.day = { key: dk, prog:{}, claimed:{}, modes:[] }; }
  if(S.missions.week.key !== wk){ S.missions.week = { key: wk, prog:{}, claimed:{} }; }
  save();
}
function bumpMissions(metric, amount){
  ensureMissions();
  [["day", DAILY_MISSIONS], ["week", WEEKLY_MISSIONS]].forEach(([scope, list])=>{
    const box = S.missions[scope];
    list.forEach(m=>{
      if(m.metric === metric){ box.prog[m.id] = Math.min(m.t, (box.prog[m.id]||0) + (amount||1)); }
    });
  });
  if(metric === "mode" && S.missions.day.modes) { /* handled separately */ }
  save();
}
function claimMission(scope, id){
  const list = scope === "day" ? DAILY_MISSIONS : WEEKLY_MISSIONS;
  const m = list.find(x=>x.id === id); if(!m) return;
  const box = S.missions[scope];
  const prog = box.prog[id] || 0;
  if(prog < m.t || (box.claimed||{})[id]) return;
  box.claimed[id] = true;
  S.stats.missionsDone++;
  addCoins(m.r, "mission: " + m.n);
  sfx.win(); showReward("Mission complete", m.n + " · +" + m.r + " coins");
  renderAwards();
}

/* ---------- daily reward ---------- */
const DAILY_TABLE = [10,20,30,50,75,100,200];
function dailyInfo(){
  const today = todayKey();
  const claimedToday = S.daily.last === today;
  let streak = S.daily.streak || 0;
  const y = new Date(); y.setDate(y.getDate()-1);
  const wasYesterday = S.daily.last === todayKey(y);
  const nextStreak = claimedToday ? streak : (wasYesterday ? Math.min(7, streak+1) : 1);
  return { today, claimedToday, streak, nextStreak, reward: DAILY_TABLE[(nextStreak-1) % 7] };
}
function claimDaily(){
  const info = dailyInfo();
  if(info.claimedToday){ toast("Already claimed today — come back tomorrow"); return; }
  S.daily.last = info.today;
  S.daily.streak = info.nextStreak;
  S.stats.dailyClaims++;
  addCoins(info.reward, "daily reward day " + info.nextStreak);
  bumpMissions("daily", 1);
  sfx.win(); buzz([12,40,12]);
  showReward("Daily reward", "Day " + info.nextStreak + " · +" + info.reward + " coins");
  renderRewards(); checkAchievements(true);
}

/* ---------- spin wheel ---------- */
const WHEEL = [
  { label:"10",    coins:10,    w:28 },
  { label:"25",    coins:25,    w:24 },
  { label:"50",    coins:50,    w:18 },
  { label:"100",   coins:100,   w:12 },
  { label:"200",   coins:200,   w:7  },
  { label:"500",   coins:500,   w:2  },
  { label:"Hint",  item:"hint", w:6  },
  { label:"Boost", item:"double", w:3 }
];
function wheelSpinLeft(){
  const today = todayKey();
  if(S.daily.spinDay !== today){ S.daily.spinDay = today; S.daily.spinsUsed = 0; save(); }
  return 1 - (S.daily.spinsUsed || 0);
}
let wheelBusy = false;
function spinWheel(paid){
  if(wheelBusy) return;
  const free = wheelSpinLeft() > 0;
  if(!free){
    if(!paid){ toast("Free spin used — buy another for 100 coins"); return; }
    if(!spendCoins(100, "extra spin")){ toast("Not enough coins"); return; }
  }
  wheelBusy = true;
  S.daily.spinsUsed = (S.daily.spinsUsed || 0) + (free ? 1 : 0); save();
  const total = WHEEL.reduce((a,b)=>a+b.w,0);
  let roll = Math.random()*total, idx = 0;
  for(let i=0;i<WHEEL.length;i++){ roll -= WHEEL[i].w; if(roll <= 0){ idx = i; break; } }
  const seg = WHEEL[idx];
  const turns = 5 + Math.floor(Math.random()*2);
  const target = 360*turns - (22.5 + 45*idx) + (Math.random()*20-10);
  const wheel = $("wheel");
  wheel.style.transform = `rotate(${target}deg)`;
  setTimeout(()=>{
    wheelBusy = false;
    if(seg.coins){ addCoins(seg.coins, "spin wheel"); showReward("You won", "+" + seg.coins + " coins"); }
    else if(seg.item){ S.inv[seg.item] = (S.inv[seg.item]||0) + 1; save();
      showReward("You won", (seg.item === "hint" ? "1 Hint" : "1× 2X Booster")); }
    renderRewards(); sfx.win(); checkAchievements(true);
  }, 3700);
}

/* ---------- treasure boxes ---------- */
const BOXES = [
  { id:"bronze", n:"Bronze Box", p:200,  odds:"coins 10–40 · hint 30% · skip 5%" },
  { id:"silver", n:"Silver Box", p:500,  odds:"coins 30–90 · hint 40% · booster 10%" },
  { id:"gold",   n:"Gold Box",   p:1000, odds:"coins 80–200 · booster 25% · avatar 8%" },
  { id:"diamond",n:"Diamond Box",p:2500, odds:"coins 200–500 · frame 20% · skin 10% · crown 4%" }
];
const BOX_TABLE = {
  bronze: [ {t:"coins", a:10, b:40, w:65}, {t:"hint", w:30}, {t:"skip", w:5} ],
  silver: [ {t:"coins", a:30, b:90, w:50}, {t:"hint", w:40}, {t:"double", w:10} ],
  gold:   [ {t:"coins", a:80, b:200, w:52}, {t:"double", w:25}, {t:"life", w:15}, {t:"av_owl", w:8} ],
  diamond:[ {t:"coins", a:200, b:500, w:46}, {t:"fr_gold", w:20}, {t:"skin_sunset", w:10},
            {t:"crown", w:4}, {t:"life", w:10}, {t:"hint", w:10} ]
};
function openBox(id){
  const box = BOXES.find(b=>b.id === id); if(!box) return;
  if(!spendCoins(box.p, "box: " + box.n)){ toast("Not enough coins"); return; }
  const table = BOX_TABLE[id];
  const total = table.reduce((a,b)=>a+b.w, 0);
  let roll = Math.random()*total, seg = table[0];
  for(const s of table){ roll -= s.w; if(roll <= 0){ seg = s; break; } }
  if(seg.t === "coins"){
    const amount = Math.floor(seg.a + Math.random()*(seg.b - seg.a + 1));
    addCoins(amount, "box: " + box.n);
    showReward(box.n, "+" + amount + " coins");
  } else if(seg.t === "hint" || seg.t === "skip" || seg.t === "life" || seg.t === "double"){
    S.inv[seg.t] = (S.inv[seg.t]||0) + 1; save();
    showReward(box.n, { hint:"1 Hint", skip:"1 Skip", life:"1 Extra life", double:"1× 2X Booster" }[seg.t]);
  } else {
    if(!S.owned.includes(seg.t)) S.owned.push(seg.t);
    save();
    const it = SHOP_ITEMS.find(x=>x.id === seg.t);
    showReward(box.n, "Unlocked: " + (it ? it.n : seg.t));
  }
  sfx.win(); renderRewards(); checkAchievements(true);
}

/* ---------- shop ---------- */
const SHOP_ITEMS = [
  { id:"hint",   n:"Hint",              d:"Reveals one difference or a clue", p:50,   type:"boost", icon:"i-hint" },
  { id:"life",   n:"Extra Life",        d:"Adds 30 seconds when time runs out", p:100, type:"boost", icon:"i-heart" },
  { id:"skip",   n:"Skip Question",     d:"Move on without losing your streak", p:150, type:"boost", icon:"i-skip" },
  { id:"double", n:"2X Reward Booster", d:"Doubles your next 10 rewards", p:300, type:"boost", icon:"i-bolt" },
  { id:"av_owl", n:"Owl avatar",   d:"A new profile picture", p:500, type:"avatar", icon:"i-av-owl" },
  { id:"av_cat", n:"Cat avatar",   d:"A new profile picture", p:500, type:"avatar", icon:"i-av-cat" },
  { id:"av_bot", n:"Robot avatar", d:"A new profile picture", p:500, type:"avatar", icon:"i-av-bot" },
  { id:"av_astro", n:"Astronaut avatar", d:"A new profile picture", p:500, type:"avatar", icon:"i-av-astro" },
  { id:"fr_gold", n:"Gold frame",  d:"Golden ring around your avatar", p:300, type:"frame", icon:"i-star" },
  { id:"fr_neon", n:"Neon frame",  d:"Electric blue glow", p:300, type:"frame", icon:"i-bolt" },
  { id:"skin_sunset", n:"Sunset theme", d:"Warm orange interface skin", p:700, type:"skin", icon:"i-globe" },
  { id:"skin_emerald", n:"Emerald theme", d:"Green interface skin", p:700, type:"skin", icon:"i-globe" },
  { id:"crown", n:"Special Crown", d:"A crown above your avatar", p:1000, type:"crown", icon:"i-crown" },
  { id:"vip",   n:"VIP Profile Effect", d:"Animated aura around your avatar", p:2000, type:"effect", icon:"i-sparkle" }
];
function owns(id){ return S.owned.includes(id); }
function buyItem(id){
  const it = SHOP_ITEMS.find(x=>x.id === id); if(!it) return;
  if(it.type !== "boost" && owns(id)){ equipItem(id); return; }
  if(S.coins < it.p){ toast("You need " + fmt(it.p - S.coins) + " more coins"); return; }
  openSheet("Buy " + it.n, `<p>${it.d}</p>
    <p class="mt8"><b>Price:</b> ${fmt(it.p)} coins · <b>Balance:</b> ${fmt(S.coins)}</p>
    <div class="row2"><button class="btn ghost" id="buyNo">Cancel</button>
      <button class="btn gold" id="buyYes">Buy for ${fmt(it.p)}</button></div>`);
  $("buyNo").onclick = closeSheet;
  $("buyYes").onclick = ()=>{
    if(!spendCoins(it.p, "shop: " + it.n)){ closeSheet(); toast("Not enough coins"); return; }
    if(it.type === "boost"){ S.inv[id] = (S.inv[id]||0) + 1; }
    else { if(!S.owned.includes(id)) S.owned.push(id); equipItem(id); }
    save(); closeSheet(); sfx.coin();
    toast(it.type === "boost" ? it.n + " added" : it.n + " unlocked");
    renderShop(); renderWallet();
  };
}
function equipItem(id){
  const it = SHOP_ITEMS.find(x=>x.id === id); if(!it) return;
  if(it.type === "boost") return;
  const slot = it.type;
  S.equipped[slot] = (S.equipped[slot] === id) ? "" : id;
  save(); paintAvatar($("homeAvatar"), "home"); renderShop(); renderProfile();
  toast(S.equipped[slot] ? it.n + " equipped" : "Unequipped");
}

/* ---------- renderers ---------- */
function renderHome(){
  renderWallet(); ensureMissions();
  const done = Object.keys(S.dailyCh.done || {}).length;
  $("dailyProg").style.width = (done/5*100) + "%";
  $("dailyChallengeSub").textContent = done >= 5 ? "All five done today — bonus claimed" : done + " of 5 modes played today";
  $("progImage").textContent = fmt(DB.length) + " items";
  $("progSound").textContent = SOUNDS.length + " clips";
  const d = dailyInfo();
  $("dotDaily").style.display = d.claimedToday ? "none" : "block";
  $("btnDailyAll").textContent = done >= 5 ? "Done" : "Play";
}
function renderShop(){
  const tab = ($$("#shopTabs button").find(b=>b.classList.contains("on")) || {}).dataset?.tab || "boost";
  const body = $("shopBody");
  if(tab === "owned"){
    const owned = SHOP_ITEMS.filter(i=>i.type !== "boost" && owns(i.id));
    body.innerHTML = owned.length ? `<div class="shopgrid">${owned.map(i=>{
      const eq = S.equipped[i.type] === i.id;
      return `<div class="item"><div class="prev"><svg><use href="#${i.icon}"/></svg></div>
        <b>${i.n}</b><div class="sub">${i.d}</div>
        <button class="buy ${eq ? "equipped" : "owned"}" data-equip="${i.id}">${eq ? "Equipped" : "Equip"}</button></div>`;
    }).join("")}</div>` : `<div class="card"><p>Nothing owned yet. Buy something from the Looks tab — it stays yours forever.</p></div>`;
    $$("[data-equip]").forEach(b=>b.onclick = ()=>{ sfx.tap(); equipItem(b.dataset.equip); });
    return;
  }
  const list = SHOP_ITEMS.filter(i=> tab === "boost" ? i.type === "boost" : i.type !== "boost");
  body.innerHTML = `<div class="shopgrid">${list.map(i=>{
    const has = i.type !== "boost" && owns(i.id);
    const eq = i.type !== "boost" && S.equipped[i.type] === i.id;
    const count = i.type === "boost" ? (S.inv[i.id]||0) : 0;
    return `<div class="item"><div class="prev"><svg><use href="#${i.icon}"/></svg></div>
      <b>${i.n}${count ? ` ×${count}` : ""}</b><div class="sub">${i.d}</div>
      <button class="buy ${eq ? "equipped" : (has ? "owned" : "")}" data-buy="${i.id}">
        ${eq ? "Equipped" : (has ? "Equip" : fmt(i.p) + " coins")}</button></div>`;
  }).join("")}</div>`;
  $$("[data-buy]").forEach(b=>b.onclick = ()=>{ sfx.tap(); buyItem(b.dataset.buy); });
}
function renderRewards(){
  const d = dailyInfo();
  $("dailyStreakPill").textContent = "Day " + (d.claimedToday ? d.streak : d.nextStreak);
  $("dailyCal").innerHTML = DAILY_TABLE.map((v,i)=>{
    const idx = i + 1;
    const cur = d.claimedToday ? d.streak : d.nextStreak;
    const got = idx <= (d.claimedToday ? d.streak : d.streak);
    const today = idx === cur;
    return `<div class="day ${got ? "got" : ""} ${today ? "today" : ""}"><b>D${idx}</b><div class="c">${v}</div></div>`;
  }).join("");
  $("btnClaimDaily").disabled = d.claimedToday;
  $("btnClaimDaily").textContent = d.claimedToday ? "Claimed today" : "Claim +" + d.reward;
  $("dailyNote").textContent = d.claimedToday ? "Come back tomorrow for the next reward." : "Day 7 pays 200 coins, then the cycle repeats.";
  const left = wheelSpinLeft();
  $("spinPill").textContent = left > 0 ? "1 free" : "0 free";
  $("btnSpin").textContent = left > 0 ? "Spin free" : "Spin for 100 coins";
  $("spinNote").textContent = left > 0 ? "One free spin every day." : "Free spin used today — an extra spin costs 100 coins.";
  $("boxGrid").innerHTML = BOXES.map(b=>`<div class="box"><div class="bx">${b.id === "bronze" ? "🥉" : b.id === "silver" ? "🥈" : b.id === "gold" ? "🥇" : "💎"}</div>
    <b>${b.n}</b><div class="odds">${b.odds}</div>
    <div class="price"><span class="coin" style="width:14px;height:14px"></span>${fmt(b.p)}</div>
    <button class="btn sm mt8" data-box="${b.id}">Open</button></div>`).join("");
  $$("[data-box]").forEach(b=>b.onclick = ()=>{ sfx.tap(); openBox(b.dataset.box); });
  renderWheelLabels();
}
function renderWheelLabels(){
  const w = $("wheel"); if(!w || w.dataset.labelled) return;
  w.dataset.labelled = "1";
  WHEEL.forEach((seg,i)=>{
    const s = document.createElement("span"); s.className = "seg";
    s.textContent = seg.label;
    const ang = 22.5 + 45*i;
    s.style.transform = `rotate(${ang}deg) translateY(-104px) rotate(${-ang}deg)`;
    w.appendChild(s);
  });
}
function renderAwards(){
  ensureMissions();
  const tab = ($$("#awardTabs button").find(b=>b.classList.contains("on")) || {}).dataset?.tab || "daily";
  const body = $("awardBody");
  const rowHtml = (m, scope) => {
    const prog = Math.min(m.t, (S.missions[scope].prog[m.id]||0));
    const claimed = !!(S.missions[scope].claimed||{})[m.id];
    const ready = prog >= m.t && !claimed;
    return `<div class="arow"><div class="aic"><svg><use href="#i-target"/></svg></div>
      <div class="at"><b>${m.n}</b><span>${prog}/${m.t} · +${m.r} coins</span>
        <div class="progress mt8" style="height:5px"><i style="width:${prog/m.t*100}%"></i></div></div>
      <button class="claim ${ready ? "" : "done"}" ${ready ? "" : "disabled"} data-m="${m.id}" data-scope="${scope}">
        ${claimed ? "Done" : (ready ? "Claim" : "…")}</button></div>`;
  };
  if(tab === "daily"){
    body.innerHTML = DAILY_MISSIONS.map(m=>rowHtml(m,"day")).join("");
  } else if(tab === "weekly"){
    body.innerHTML = WEEKLY_MISSIONS.map(m=>rowHtml(m,"week")).join("");
  } else {
    body.innerHTML = ACH.map(a=>{
      const st = achState(a);
      return `<div class="arow"><div class="aic"><svg><use href="#i-trophy"/></svg></div>
        <div class="at"><b>${a.n}</b><span>${a.d} · ${st.prog}/${st.target} · +${a.r}</span>
          <div class="progress mt8" style="height:5px"><i style="width:${st.prog/st.target*100}%"></i></div></div>
        <button class="claim ${st.done && !st.claimed ? "" : "done"}" ${st.done && !st.claimed ? "" : "disabled"} data-ach="${a.id}">
          ${st.claimed ? "Done" : (st.done ? "Claim" : "…")}</button></div>`;
    }).join("");
    $$("[data-ach]").forEach(b=>b.onclick = ()=>{ sfx.tap(); claimAch(b.dataset.ach); });
  }
  $$("[data-m]").forEach(b=>b.onclick = ()=>{ sfx.tap(); claimMission(b.dataset.scope, b.dataset.m); });
}
function renderProfile(){
  paintAvatar($("profAvatar"), "big");
  $("profName").textContent = S.name;
  $("profLevel").textContent = "Level " + level() + " · " + fmt(S.xp) + " XP";
  const st = S.stats;
  const acc = st.answered ? Math.round(100*st.correct/st.answered) : 0;
  $("profStats").innerHTML = [
    ["Coins", fmt(S.coins)], ["Answered", fmt(st.answered)], ["Accuracy", acc + "%"],
    ["Best streak", st.bestStreak], ["Games", fmt(st.gamesPlayed)], ["Awards", ACH.filter(a=>achState(a).claimed).length + "/" + ACH.length]
  ].map(([k,v])=>`<div class="s"><b>${v}</b><span>${k}</span></div>`).join("");
  const names = { image:"Image", sound:"Sound", diff:"Difference", sort:"Colour sort", math:"Math" };
  $("profModes").innerHTML = Object.keys(st.perMode).map(k=>{
    const p = st.perMode[k];
    return `<div class="lbrow"><span class="rk">${p.plays ? "▶" : "–"}</span>
      <span class="nm">${names[k]}</span>
      <span class="mini">${p.plays} played · ${p.correct} correct</span></div>`;
  }).join("");
  const best = (S.records.image[0] || {}).s || 0;
  $("lbTeaser").textContent = "Your best image run: " + fmt(best) + " points. Personal records stay on this device.";
}
function renderLeaderboard(){
  const tab = ($$("#lbTabs button").find(b=>b.classList.contains("on")) || {}).dataset?.tab || "all";
  const body = $("lbBody");
  const now = Date.now(), week = 7*864e5, month = 30*864e5;
  const cutoff = tab === "week" ? now - week : tab === "month" ? now - month : 0;
  const modes = [["image","Image Guesser"],["sound","Sound Guesser"],["diff","Find the Difference"],["sort","Colour Sort"],["math","Math Master"]];
  let html = "";
  modes.forEach(([key,label])=>{
    const runs = (S.records[key]||[]).filter(r=>r.t >= cutoff);
    if(!runs.length) return;
    html += `<div style="margin:10px 0 4px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute)">${label}</div>`;
    html += runs.slice(0,5).map((r,i)=>`<div class="lbrow"><span class="rk ${i===0?"g":""}">${i+1}</span>
      <span class="nm">${r.l || "Run"}</span><span class="sc">${fmt(r.s)}</span></div>`).join("");
  });
  body.innerHTML = html || `<p class="mini">No runs recorded ${tab === "all" ? "yet" : "in this period"}. Play a mode and your best scores show up here.</p>`;
  $("lbNote").textContent = "These rankings are your own runs, stored on this device — there are no invented players here. A worldwide leaderboard needs a server, and this game ships without one so that no account or personal data is required.";
}

/* ---------- settings ---------- */
function paintSettings(){
  document.documentElement.setAttribute("data-theme", S.settings.theme);
  document.documentElement.setAttribute("data-gfx", S.settings.graphics);
  $$("[data-toggle]").forEach(sw=>{
    const k = sw.dataset.toggle;
    const on = k === "theme" ? S.settings.theme === "dark" : !!S.settings[k];
    sw.classList.toggle("on", on); sw.setAttribute("aria-checked", on ? "true" : "false");
  });
  $("langsel").value = S.settings.lang;
  $("graphicsSel").value = S.settings.graphics;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", S.settings.theme === "dark" ? "#07070e" : "#f3f4fb");
}
function toggleSetting(k){
  if(k === "theme"){ S.settings.theme = S.settings.theme === "dark" ? "light" : "dark"; }
  else S.settings[k] = !S.settings[k];
  save(); paintSettings(); sfx.tap(); buzz(8);
  if(k === "music") syncMusic();
}

/* ---------- sheets ---------- */
const SHEETS = {
  howto: () => ["How to play", `
    <p>Five games, one coin wallet. Every correct answer or finished puzzle pays <strong>10 coins</strong>; a wrong answer pays nothing.</p>
    <h3>The five modes</h3>
    <ul>
      <li><strong>Image Guesser</strong> — a real photo, four names. The photo is blurred until you answer.</li>
      <li><strong>Sound Guesser</strong> — a real recording, four sources. Replay it as often as you like.</li>
      <li><strong>Find the Difference</strong> — two versions of the same photo; tap every change before the timer ends.</li>
      <li><strong>Colour Sort</strong> — pour balls between tubes until each tube holds one colour. Every puzzle is generated solvable.</li>
      <li><strong>Math Master</strong> — timed arithmetic and brain teasers with worked explanations.</li>
    </ul>
    <h3>Coins, boosts and looks</h3>
    <p>Coins are earned in any mode and spent in the Shop on hints, extra time, skips, a 2X booster and cosmetics. Cosmetics you buy are yours permanently and can be equipped or removed at any time.</p>
    <p>Coins are virtual, have no cash value, and are never reset by playing — only the reset button in Settings clears them.</p>`],
  privacy: () => ["Privacy Policy", `
    <p><strong>Short version:</strong> no accounts, no ads, no trackers, no analytics. Everything you earn stays on this device.</p>
    <h3>What is stored</h3>
    <p>Coins, purchases, achievements, missions, statistics, settings and the item history are kept in this app's local storage on your device. Nothing is uploaded anywhere.</p>
    <h3>Network requests</h3>
    <p>Photos and sound clips come from <strong>Wikipedia</strong> (en.wikipedia.org) and <strong>Wikimedia Commons</strong> (upload.wikimedia.org, commons.wikimedia.org). Those requests carry nothing beyond a normal web request, such as your IP address, which Wikimedia needs to serve the file.</p>
    <h3>No accounts, no cloud save</h3>
    <p>There is no login and no server, so there is nothing to breach. Use Settings → Backup &amp; restore to keep a copy of your save file.</p>
    <h3>Contact</h3><p>nihaonihao54059@gmail.com</p>`],
  terms: () => ["Terms & conditions", `
    <p>Image Guesser is provided as-is, for entertainment. Coins and items are virtual, non-transferable and have no monetary value. They cannot be bought with real money and cannot be cashed out.</p>
    <p>Rewards (spin wheel, boxes, daily bonuses) are generated on your device by chance using the probabilities shown in the app. There is no server and no purchase involved, so no real money is ever at stake.</p>
    <p>Content is drawn from Wikipedia and Wikimedia Commons under their licenses and is credited in-app. Do not redistribute the photographs separately from that attribution.</p>
    <p>The game is an independent project, not affiliated with or endorsed by the Wikimedia Foundation.</p>`],
  about: () => ["About Image Guesser", `
    <p><strong>Image Guesser v${VERSION}</strong> — five quiz games in one app, sharing a single coin wallet and profile.</p>
    <p>${fmt(DB.length)} curated image items across 11 categories, ${SOUNDS.length} licensed sound clips, procedurally generated difference puzzles and colour-sort levels, and unlimited verified math questions.</p>
    <h3>Built with</h3>
    <p>One self-contained HTML app — no frameworks, no build step — wrapped in a native Android WebView shell. Icons, logo and avatars are inline SVG; all sounds are synthesised with the Web Audio API except the Wikimedia recordings.</p>
    <h3>Data</h3>
    <p>Images, names and descriptions from Wikipedia and Wikimedia Commons via the public MediaWiki API. Every photo and clip shows its author and license in the app.</p>
    <p><strong>Independent project. Not affiliated with, endorsed by or sponsored by the Wikimedia Foundation.</strong></p>`],
  credits: () => ["Credits", `
    <p><strong>Image Guesser</strong> — concept, design and development.</p>
    <h3>Content sources</h3>
    <ul>
      <li><a href="https://www.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a> — item names, descriptions, article links (CC BY-SA 4.0)</li>
      <li><a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a> — photographs and sound recordings, plus license metadata</li>
      <li><a href="https://www.mediawiki.org/wiki/API:Main_page" target="_blank" rel="noopener">MediaWiki API documentation</a> — the public API queried at runtime</li>
    </ul>
    <h3>Photographs and audio</h3>
    <p>Every question credits its own source: after you answer, the author, license and "Wikimedia Commons" appear under the item. Sound clips credit their recordist the same way, with a link to the original file page.</p>
    <p>Recordists and photographers whose work appears include Xeno-canto contributors, klankbeeld, InspectorJ, Gravity Sound and many other Wikimedia volunteers — each credited per file inside the game.</p>
    <h3>Fonts &amp; libraries</h3>
    <p>None. No web fonts, icon packs, analytics or ad SDKs. All graphics are inline SVG or CSS; game audio effects are generated with the Web Audio API.</p>
    <h3>Disclaimer</h3>
    <p>Independent, unofficial project. "Wikipedia" and "Wikimedia" are trademarks of the Wikimedia Foundation, used here only to describe the source of content.</p>`],
  backup: () => ["Backup & restore", `
    <p>Your save lives on this device. Copy it out to keep a backup, or paste one back to restore.</p>
    <h3>Your save code</h3>
    <textarea id="bkText" style="width:100%;height:110px;border-radius:12px;background:var(--glass);border:1px solid var(--line-2);
      color:var(--ink);font-size:11px;padding:8px;font-family:ui-monospace,monospace"></textarea>
    <div class="row2"><button class="btn ghost" id="bkCopy">Copy</button>
      <button class="btn" id="bkRestore">Restore from code</button></div>
    <p class="mini mt8">Restoring replaces the current save. Coins and purchases in the code are restored exactly.</p>`]
};

/* ---------- reset ---------- */
function resetProgress(){
  openSheet("Reset progress?", `<p>This deletes your coins, purchases, achievements, missions, statistics and item history on this device. It cannot be undone.</p>
    <div class="row2"><button class="btn ghost" id="rsNo">Cancel</button>
      <button class="btn gold" id="rsYes">Yes, reset</button></div>`);
  $("rsNo").onclick = closeSheet;
  $("rsYes").onclick = ()=>{
    S = deepMerge(DEFAULT_STATE, {}); S.created = todayKey();
    save(); closeSheet(); toast("Progress reset");
    renderWallet(); renderHome(); renderProfile(); renderRewards(); renderAwards(); renderShop();
  };
}
