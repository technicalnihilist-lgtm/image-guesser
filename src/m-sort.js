/* ================= MODE 4: COLOUR SORT MASTER ================= */
const SORT = { tubes:[], initial:[], sel:-1, moves:0, hist:[], level:1, colors:3, timer:null,
               secs:0, done:false, score:0, daily:false, rng:null };
const BALL_COLORS = ["#ef4444","#3b82f6","#22c55e","#f59e0b","#a855f7","#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4"];
const CAP = 4;
function sortRand(){ return (SORT.rng || Math.random)(); }
function sortColorsForLevel(l){
  if(l <= 1) return 3;
  if(l === 2) return 4;
  if(l <= 4) return 5;
  if(l <= 6) return 6;
  if(l <= 8) return 7;
  if(l <= 10) return 8;
  if(l <= 12) return 9;
  return 10;
}
function sortDiffLabel(c){ return c <= 4 ? "Easy" : c <= 6 ? "Medium" : c <= 8 ? "Hard" : "Expert"; }

/* Build a puzzle by undoing legal moves from the solved state, so a solution
   is guaranteed to exist for every generated level. */
function sortGenerate(colors){
  const tubes = [];
  for(let c=0;c<colors;c++) tubes.push(new Array(CAP).fill(c));
  tubes.push([], []);
  const steps = colors * 14 + 30;
  for(let s=0;s<steps;s++){
    const froms = tubes.map((t,i)=>({t,i})).filter(o=>o.t.length > 0);
    const cand = froms.filter(o=>{
      const top = o.t[o.t.length-1];
      if(o.t.length === 1) return true;                      // removing empties the tube
      return o.t[o.t.length-2] === top;                       // below is same colour
    });
    if(!cand.length) continue;
    const src = cand[Math.floor(sortRand()*cand.length)];
    const dests = tubes.map((t,i)=>({t,i})).filter(o=>o.i !== src.i && o.t.length < CAP);
    if(!dests.length) continue;
    const dst = dests[Math.floor(sortRand()*dests.length)];
    const ball = src.t.pop();
    dst.t.push(ball);
  }
  return tubes;
}
function sortSolvedState(tubes){
  return tubes.every(t => t.length === 0 || (t.length === CAP && t.every(b => b === t[0])));
}
function sortStart(daily){
  startMode("sort");
  SORT.daily = !!daily;
  SORT.level = 1; SORT.score = 0;
  SORT.rng = daily ? seeded("sort-" + todayKey()) : null;
  SORT.colors = sortColorsForLevel(SORT.level);
  go("mode-sort");
  sortNew();
}
function sortNew(){
  clearInterval(SORT.timer);
  SORT.colors = sortColorsForLevel(SORT.level);
  let tubes = sortGenerate(SORT.colors);
  let guard = 0;
  while((sortSolvedState(tubes) || tubes.filter(t=>t.length && !t.every(b=>b===t[0])).length < 2) && guard++ < 40){
    tubes = sortGenerate(SORT.colors);
  }
  SORT.tubes = tubes.map(t=>t.slice());
  SORT.initial = tubes.map(t=>t.slice());
  SORT.sel = -1; SORT.moves = 0; SORT.hist = []; SORT.done = false; SORT.secs = 0;
  $("sortLevel").textContent = "Level " + SORT.level;
  $("sortDiff").textContent = sortDiffLabel(SORT.colors) + " · " + SORT.colors + " colours";
  $("sortMoves").textContent = "0";
  $("sortTimer").textContent = "0:00";
  sortRender();
  SORT.timer = setInterval(()=>{
    if(SORT.done) return;
    SORT.secs++;
    $("sortTimer").textContent = mmss(SORT.secs);
  }, 1000);
}
function sortRender(){
  const wrap = $("tubes");
  wrap.innerHTML = "";
  SORT.tubes.forEach((tube, i)=>{
    const el = document.createElement("div");
    el.className = "tube" + (SORT.sel === i ? " sel" : "") +
      (tube.length === CAP && tube.every(b => b === tube[0]) ? " done" : "");
    el.dataset.i = i;
    tube.forEach(c=>{
      const b = document.createElement("div");
      b.className = "ball";
      b.style.background = `radial-gradient(circle at 34% 28%, #ffffff55, ${BALL_COLORS[c % BALL_COLORS.length]} 55%, ${BALL_COLORS[c % BALL_COLORS.length]})`;
      el.appendChild(b);
    });
    el.onclick = ()=> sortTap(i);
    wrap.appendChild(el);
  });
}
function sortTap(i){
  if(SORT.done) return;
  const tubes = SORT.tubes;
  if(SORT.sel === -1){
    if(!tubes[i].length) return;
    SORT.sel = i; sfx.tap(); sortRender(); return;
  }
  if(SORT.sel === i){ SORT.sel = -1; sortRender(); return; }
  const from = SORT.sel, src = tubes[from], dst = tubes[i];
  const color = src[src.length-1];
  const legal = dst.length < CAP && (dst.length === 0 || dst[dst.length-1] === color);
  if(!legal){ sfx.wrong(); buzz(20); SORT.sel = i; sortRender(); return; }

  // move the whole same-colour run, as far as it fits
  let run = 1;
  for(let k = src.length-2; k >= 0 && src[k] === color; k--) run++;
  const space = CAP - dst.length;
  const moveCount = Math.min(run, space);
  SORT.hist.push({ from, to: i, count: moveCount });
  for(let k=0;k<moveCount;k++) dst.push(src.pop());
  SORT.moves++;
  $("sortMoves").textContent = SORT.moves;
  SORT.sel = -1;
  sfx.tap(); buzz(8);
  sortRender();
  if(sortSolvedState(tubes)) sortWin();
}
function sortUndo(){
  if(SORT.done || !SORT.hist.length) return;
  const m = SORT.hist.pop();
  for(let k=0;k<m.count;k++) SORT.tubes[m.from].push(SORT.tubes[m.to].pop());
  SORT.moves = Math.max(0, SORT.moves - 1);
  $("sortMoves").textContent = SORT.moves;
  SORT.sel = -1; sfx.tap(); sortRender();
}
function sortRestart(){
  clearInterval(SORT.timer);
  SORT.tubes = SORT.initial.map(t=>t.slice());
  SORT.sel = -1; SORT.moves = 0; SORT.hist = []; SORT.done = false; SORT.secs = 0;
  $("sortMoves").textContent = "0"; $("sortTimer").textContent = "0:00";
  sortRender();
  SORT.timer = setInterval(()=>{ if(!SORT.done){ SORT.secs++; $("sortTimer").textContent = mmss(SORT.secs); } }, 1000);
}
function sortHint(){
  if(SORT.done) return;
  if(S.inv.hint > 0){ S.inv.hint--; save(); }
  else if(!spendCoins(30, "sort hint")){ toast("Hints cost 30 coins, or buy one in the Shop"); return; }
  // score every legal move: completing a tube or emptying one is best
  let best = null, bestScore = -1;
  SORT.tubes.forEach((src, fi)=>{
    if(!src.length) return;
    const color = src[src.length-1];
    let run = 1;
    for(let k=src.length-2;k>=0 && src[k]===color;k--) run++;
    SORT.tubes.forEach((dst, ti)=>{
      if(ti === fi || dst.length >= CAP) return;
      if(dst.length && dst[dst.length-1] !== color) return;
      if(dst.length === 0 && run === src.length) return;           // pointless shuffle
      let sc = 1;
      if(dst.length + run === CAP && (dst.length === 0 || dst[0] === color)) sc += 6;
      if(run === src.length) sc += 3;
      if(dst.length && dst[dst.length-1] === color) sc += 2;
      if(sc > bestScore){ bestScore = sc; best = [fi, ti]; }
    });
  });
  if(!best){ toast("No useful move — undo or restart"); return; }
  SORT.sel = best[0]; sortRender();
  toast("Try moving from the highlighted tube");
  const els = $$("#tubes .tube");
  if(els[best[1]]){ els[best[1]].style.boxShadow = "0 0 0 2px rgba(34,197,94,.9)"; setTimeout(()=>{ if(els[best[1]]) els[best[1]].style.boxShadow = ""; }, 1600); }
}
function sortWin(){
  SORT.done = true;
  clearInterval(SORT.timer);
  const par = SORT.colors * 3;
  const bonus = SORT.moves <= par ? 5 : 0;
  const coins = 10 + bonus;
  addCoins(coins, "colour sort level");
  addXp(10);
  S.stats.sortLevels++;
  S.bestSortColors = Math.max(S.bestSortColors || 0, SORT.colors);
  SORT.score += coins;
  recordScore("sort", SORT.level, "Level " + SORT.level + " · " + SORT.colors + " colours");
  markAnswer(true, "sort"); checkDaily("sort");
  sfx.win(); buzz([12,40,12,40]);
  if(SORT.daily){
    if(!S.dailyCh.done.sort){ S.dailyCh.done.sort = true; addCoins(25, "daily sort challenge"); }
    save(); showReward("Daily sort solved", "+" + coins + " coins · daily bonus +25", ()=> go("home"));
    return;
  }
  showReward("Level " + SORT.level + " sorted!", "+" + coins + " coins · " + SORT.moves + " moves" + (bonus ? " · efficiency +5" : ""), ()=>{
    SORT.level++; sortNew();
  });
  renderWallet();
}
