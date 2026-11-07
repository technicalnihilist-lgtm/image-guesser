/* ================= MODE 5: MATH MASTER ================= */
const MATH = { cur:null, options:[], answered:false, n:0, streak:0, best:0, score:0, timer:null,
               left:0, diff:1, rng:null, inputMode:false, attack:false, daily:false, attackLeft:0 };
const MDIFF = [
  { name:"Beginner", limit:30 }, { name:"Easy", limit:30 }, { name:"Medium", limit:20 },
  { name:"Hard", limit:15 }, { name:"Expert", limit:10 }, { name:"Master", limit:10 }
];
function mathRand(){ return (MATH.rng || Math.random)(); }
function ri(a, b){ return Math.floor(mathRand()*(b-a+1)) + a; }

function mathGen(diff){
  const d = diff || MATH.diff;
  const r = () => mathRand();
  const pickFrom = a => a[Math.floor(r()*a.length)];
  const type = (()=>{
    if(d <= 2) return pickFrom(["add","sub","mul","div"]);
    if(d === 3) return pickFrom(["add","sub","mul","div","pattern","missing"]);
    if(d === 4) return pickFrom(["mul","mixed","equation","percent","pattern","div"]);
    if(d === 5) return pickFrom(["square","root","equation","fraction","sequence","percent"]);
    return pickFrom(["multi","exponent","average","equation","sequence","percent","root"]);
  })();
  let q = "", a = 0, cat = "Arithmetic", ex = "";

  if(type === "add"){
    const x = ri(5, d<=1?20:d<=2?50:d<=3?200:900), y = ri(3, d<=1?15:d<=2?40:d<=3?180:700);
    q = `${x} + ${y}`; a = x + y; cat = "Addition"; ex = `${x} + ${y} = ${a}`;
  } else if(type === "sub"){
    const x = ri(10, d<=1?20:d<=2?50:d<=3?200:900), y = ri(1, x-1);
    q = `${x} − ${y}`; a = x - y; cat = "Subtraction"; ex = `${x} − ${y} = ${a}`;
  } else if(type === "mul"){
    const x = d<=1?ri(2,5):d<=2?ri(2,10):d<=3?ri(3,12):ri(6,25);
    const y = d<=1?ri(2,5):d<=2?ri(2,10):d<=3?ri(2,12):ri(3,15);
    q = `${x} × ${y}`; a = x*y; cat = "Multiplication"; ex = `${x} × ${y} = ${a} — ${y} groups of ${x}.`;
  } else if(type === "div"){
    const y = d<=2?ri(2,9):ri(2,12), a0 = d<=2?ri(2,10):ri(3,20);
    a = a0; const x = y*a0;
    q = `${x} ÷ ${y}`; cat = "Division"; ex = `${y} × ${a} = ${x}, so ${x} ÷ ${y} = ${a}.`;
  } else if(type === "mixed"){
    const x = ri(2,12), y = ri(2,9), z = ri(2,20);
    q = `${x} × ${y} + ${z}`; a = x*y + z; cat = "Mixed operations";
    ex = `${x} × ${y} = ${x*y}, then + ${z} = ${a}.`;
  } else if(type === "pattern"){
    const start = ri(1,9), step = ri(2, d>=5?12:6);
    const seq = [start, start+step, start+2*step, start+3*step];
    q = `${seq.join(", ")}, ?`; a = start + 4*step; cat = "Number pattern";
    ex = `Each term adds ${step}: ${seq.join(", ")}, ${a}.`;
  } else if(type === "missing"){
    const x = ri(2,20), y = ri(2,20), sum = x + y;
    q = `${x} + ? = ${sum}`; a = y; cat = "Missing number"; ex = `${sum} − ${x} = ${y}.`;
  } else if(type === "equation"){
    const x = ri(2,12), k = ri(2,9), b = ri(1,15);
    q = `${k}x + ${b} = ${k*x + b}`; a = x; cat = "Equation solving";
    ex = `Subtract ${b}, then divide by ${k}: x = ${x}.`;
  } else if(type === "percent"){
    const p = pickFrom([10,20,25,50,75]), n = ri(2,20)*10;
    q = `${p}% of ${n}`; a = Math.round(n*p/100); cat = "Percentages";
    ex = `${p}% of ${n} = ${n} × ${p/100} = ${a}.`;
  } else if(type === "square"){
    const x = ri(2, d>=6?25:16);
    q = `${x}²`; a = x*x; cat = "Squares"; ex = `${x} × ${x} = ${a}.`;
  } else if(type === "root"){
    const x = ri(2, d>=6?20:13);
    q = `√${x*x}`; a = x; cat = "Square roots"; ex = `${x} × ${x} = ${x*x}, so the root is ${x}.`;
  } else if(type === "fraction"){
    const den = pickFrom([2,3,4,5]), num = 1, n = den * ri(2,12);
    q = `${num}/${den} of ${n}`; a = n*num/den; cat = "Fractions";
    ex = `${n} ÷ ${den} × ${num} = ${a}.`;
  } else if(type === "sequence"){
    const start = ri(1,6), mul = ri(2,3);
    const seq = [start, start*mul, start*mul*mul, start*mul*mul*mul];
    q = `${seq.join(", ")}, ?`; a = start*Math.pow(mul,4); cat = "Sequences";
    ex = `Each term is multiplied by ${mul}: ${a}.`;
  } else if(type === "exponent"){
    const b = ri(2,5), e = ri(2,4);
    q = `${b}^${e}`; a = Math.pow(b,e); cat = "Exponents"; ex = `${b} to the power ${e} = ${a}.`;
  } else if(type === "average"){
    const nums = [ri(2,20), ri(2,20), ri(2,20)];
    const sum = nums.reduce((x,y)=>x+y,0);
    const target = Math.round(sum/3);
    a = target; q = `Average of ${nums.join(", ")}`; cat = "Averages";
    ex = `(${nums.join(" + ")}) ÷ 3 ≈ ${target}.`;
  } else {
    const x = ri(2,9), y = ri(2,9), z = ri(2,9);
    q = `(${x} + ${y}) × ${z}`; a = (x+y)*z; cat = "Multi-step";
    ex = `${x} + ${y} = ${x+y}, then × ${z} = ${a}.`;
  }
  return { q, a, cat, ex };
}
function mathOptions(ans){
  const set = new Set([ans]);
  const opts = [ans];
  const spread = Math.max(2, Math.round(Math.abs(ans) * .18) + 3);
  let guard = 0;
  while(opts.length < 4 && guard++ < 80){
    let cand = ans + (Math.floor(mathRand()*spread*2) - spread);
    if(cand === ans || cand < 0) cand = ans + (1 + Math.floor(mathRand()*9));
    if(cand < 0 || set.has(cand)) continue;
    set.add(cand); opts.push(cand);
  }
  while(opts.length < 4){ const c = ans + opts.length * 7; if(!set.has(c)){ set.add(c); opts.push(c); } }
  for(let i=opts.length-1;i>0;i--){ const j = Math.floor(mathRand()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }
  return opts;
}
function mathStart(daily, attack){
  startMode("math");
  MATH.n = 0; MATH.streak = 0; MATH.score = 0; MATH.answered = false;
  MATH.daily = !!daily; MATH.attack = !!attack;
  MATH.rng = daily ? seeded("math-" + todayKey()) : null;
  MATH.attackLeft = 60;
  go("mode-math");
  mathNext();
}
function mathNext(){
  clearInterval(MATH.timer);
  MATH.answered = false;
  $("mreveal").classList.remove("on");
  const q = mathGen();
  MATH.cur = q;
  MATH.n++;
  const d = MDIFF[MATH.diff-1];
  $("mNum").textContent = MATH.attack ? "Time attack" : (MATH.daily ? "Daily " + MATH.n + "/5" : "Question " + MATH.n);
  $("mCat").textContent = q.cat + " · " + (MATH.streak ? "streak " + MATH.streak : d.name);
  $("mDiffLbl").textContent = d.name + (MATH.inputMode ? " · type your answer" : "");
  $("mQuestion").textContent = q.q;
  $("mrevName").textContent = ""; $("mrevMeta").textContent = "";

  MATH.options = mathOptions(q.a);
  const box = $("manswers");
  if(MATH.inputMode){
    box.innerHTML = `<div class="numinput"><input id="mathInput" inputmode="numeric" autocomplete="off" placeholder="?">
      <button class="btn" id="mathSubmit" style="width:96px">OK</button></div>`;
    const inp = $("mathInput");
    $("mathSubmit").onclick = ()=> mathSubmitInput(inp.value);
    inp.onkeydown = e => { if(e.key === "Enter") mathSubmitInput(inp.value); };
    setTimeout(()=>{ try{ inp.focus(); }catch(e){} }, 120);
  } else {
    box.innerHTML = "";
    MATH.options.forEach((v,i)=>{
      const b = document.createElement("button");
      b.className = "ans"; b.type = "button";
      b.innerHTML = `<span class="num">${i+1}</span><span class="lbl">${fmt(v)}</span>
        <svg class="mk" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></svg>`;
      b.onclick = ()=> mathAnswer(v, i);
      box.appendChild(b);
    });
  }
  MATH.left = MATH.attack ? MATH.attackLeft : MDIFF[MATH.diff-1].limit;
  const total = MATH.left;
  $("mTimerBar").style.width = "100%";
  MATH.timer = setInterval(()=>{
    MATH.left--;
    const pct = clamp((MATH.left / total) * 100, 0, 100);
    $("mTimerBar").style.width = pct + "%";
    if(MATH.attack){ MATH.attackLeft = MATH.left; $("mCat").textContent = MATH.left + "s · " + MATH.streak + " in a row"; }
    if(MATH.left <= 0){
      clearInterval(MATH.timer);
      if(MATH.attack) mathAttackEnd();
      else if(!MATH.answered) mathAnswer(-1, -1);
    }
  }, 1000);
}
function mathSubmitInput(val){
  if(MATH.answered) return;
  const n = Number(String(val).replace(/[^0-9.\-]/g, ""));
  if(!isFinite(n)) { toast("Type a number first"); return; }
  mathAnswer(n, -2);
}
function mathAnswer(val, idx){
  if(MATH.answered) return;
  MATH.answered = true;
  clearInterval(MATH.timer);
  const q = MATH.cur, ok = val === q.a;
  if(!MATH.inputMode){
    const correctIdx = MATH.options.indexOf(q.a);
    $$("#manswers .ans").forEach((b,i)=>{
      b.disabled = true;
      if(i === correctIdx){ b.classList.add("right"); b.querySelector(".mk").innerHTML = '<path d="M4.5 12.5l5 5 10-11"/>'; }
      else if(i === idx){ b.classList.add("wrong"); b.querySelector(".mk").innerHTML = '<path d="M6 6l12 12M18 6L6 18"/>'; }
      else b.classList.add("dim");
    });
  } else {
    $("manswers").innerHTML = `<div class="card center"><b style="font-size:15px">${ok ? "Correct" : "Answer: " + fmt(q.a)}</b>
      <p class="mini mt8">${q.ex}</p></div>`;
  }
  markAnswer(ok, "math");
  if(ok){
    MATH.streak++;
    if(MATH.streak > MATH.best) MATH.best = MATH.streak;
    const bonus = MATH.streak >= 5 ? 5 : 0;
    const r = rewardAnswer("math", 10 + bonus);
    MATH.score += r.coins;
    coinFx(r.coins, $("coinMath")); sfx.correct(); buzz([14,40,18]);
    $("mrevName").textContent = "Correct · +" + r.coins + " coins" + (bonus ? " (streak bonus)" : "");
  } else {
    MATH.streak = 0;
    sfx.wrong(); buzz([40,60,40]);
    $("mrevName").textContent = (idx === -1 ? "Time up" : "Not quite") + " · answer " + fmt(q.a);
  }
  $("mrevMeta").textContent = q.ex;
  $("mreveal").classList.add("on");
  checkDaily("math");
  if(MATH.attack){ setTimeout(()=>{ if(MATH.attackLeft > 0) mathNext(); }, 700); return; }
  clearTimeout(MATH._t);
  MATH._t = setTimeout(()=>{
    if(curScreen !== "mode-math") return;
    if(MATH.daily && MATH.n >= 5) mathDailyDone(); else mathNext();
  }, ok ? 1400 : 2000);
}
function mathAttackEnd(){
  MATH.answered = true;
  recordScore("math", MATH.score, "Time attack · " + MATH.streak + " streak");
  showReward("Time attack over", "You scored " + MATH.score + " coins · best streak " + MATH.best, ()=>{
    MATH.best = 0; go("home");
  });
}
function mathDailyDone(){
  recordScore("math", MATH.score, "Daily · " + todayKey());
  if(!S.dailyCh.done.math){ S.dailyCh.done.math = true; addCoins(25, "daily math challenge"); }
  save(); showReward("Daily math done", "Score " + MATH.score + " coins"); go("home");
}
function mathSettingsSheet(){
  openSheet("Math settings", `
    <h3>Difficulty</h3>
    <div class="grid2" style="gap:8px">${MDIFF.map((d,i)=>
      `<button class="chip ${MATH.diff===i+1?"on":""}" data-mdiff="${i+1}" style="justify-content:center">
        ${d.name} · ${d.limit}s</button>`).join("")}</div>
    <h3>Answer style</h3>
    <div class="row2">
      <button class="btn ${MATH.inputMode?"ghost":""}" id="mdChoice">4 options</button>
      <button class="btn ${MATH.inputMode?"":"ghost"}" id="mdType">Type answer</button>
    </div>
    <h3>Session</h3>
    <div class="row2">
      <button class="btn ghost" id="mdAttack">Time attack (60s)</button>
      <button class="btn ghost" id="mdDaily">Daily 5</button>
    </div>`);
  $$("[data-mdiff]").forEach(b=>b.onclick = ()=>{ MATH.diff = +b.dataset.mdiff; closeSheet(); mathNext(); });
  $("mdChoice").onclick = ()=>{ MATH.inputMode = false; closeSheet(); mathNext(); };
  $("mdType").onclick = ()=>{ MATH.inputMode = true; closeSheet(); mathNext(); };
  $("mdAttack").onclick = ()=>{ closeSheet(); mathStart(false, true); };
  $("mdDaily").onclick = ()=>{ closeSheet(); mathStart(true, false); };
}
