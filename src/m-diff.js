/* ================= MODE 3: FIND THE DIFFERENCE ================= */
const DIFF = { img:null, base:null, diffs:[], found:[], n:0, total:5, left:0, timer:null, hints:0,
               solved:false, zoom:false, level:1, score:0, daily:false, rng:null, size:512 };
const DIFF_LEVELS = [ {n:5, t:120, lbl:"Easy"}, {n:7, t:150, lbl:"Medium"}, {n:10, t:180, lbl:"Hard"}, {n:15, t:240, lbl:"Expert"} ];

function diffStart(daily, level){
  startMode("diff");
  DIFF.daily = !!daily;
  DIFF.level = level || 1;
  DIFF.rng = daily ? seeded("diff-" + todayKey()) : null;
  DIFF.score = 0;
  go("mode-diff");
  diffNew();
}
function diffRand(){ return (DIFF.rng || Math.random)(); }
function diffNew(){
  clearInterval(DIFF.timer);
  const lvl = DIFF_LEVELS[Math.min(DIFF.level-1, DIFF_LEVELS.length-1)];
  DIFF.total = lvl.n; DIFF.left = lvl.t; DIFF.hints = 0; DIFF.solved = false;
  DIFF.found = []; DIFF.diffs = [];
  $("dTitle").textContent = "Find the Difference";
  $("dDiffLbl").textContent = lvl.lbl + " · " + lvl.n + " differences";
  $("dFound").textContent = "0"; $("dTotal").textContent = lvl.n;
  $("dTimer").textContent = mmss(lvl.t);

  const pool = DB.filter(i => /\.(jpe?g)/i.test(i.u));
  const item = pool[Math.floor(diffRand()*pool.length)];
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";
  img.onload = ()=>{ DIFF.img = img; diffBuild(); };
  img.onerror = ()=>{ toast("Photo failed to load — trying another"); setTimeout(diffNew, 600); };
  img.src = item.u;
  DIFF.item = item;
}
function diffBuild(){
  const size = DIFF.size;
  const base = document.createElement("canvas");
  base.width = size; base.height = size;
  const bctx = base.getContext("2d");
  const img = DIFF.img;
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s)/2, sy = (img.height - s)/2;
  bctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  DIFF.base = base;

  // generate differences at known coordinates
  const N = DIFF.total;
  const margin = 56, r = 34;
  const placed = [];
  const tries = N * 60;
  for(let i=0; i<tries && placed.length < N; i++){
    const x = margin + diffRand()*(size - margin*2);
    const y = margin + diffRand()*(size - margin*2);
    if(placed.some(p => Math.hypot(p.x-x, p.y-y) < r*2.5)) continue;
    placed.push({ x, y, r: r + diffRand()*10, type: Math.floor(diffRand()*5) });
  }
  DIFF.diffs = placed;
  DIFF.total = placed.length;
  $("dTotal").textContent = DIFF.total;
  diffPaint();
  DIFF.timer = setInterval(()=>{
    DIFF.left--;
    $("dTimer").textContent = mmss(DIFF.left);
    if(DIFF.left <= 0 && !DIFF.solved){ clearInterval(DIFF.timer); diffFail(); }
  }, 1000);
}
function diffPaint(){
  const size = DIFF.size;
  const left = $("dLeft"), right = $("dRight");
  [left, right].forEach(c=>{ c.width = size; c.height = size; });
  const lc = left.getContext("2d"), rc = right.getContext("2d");
  lc.drawImage(DIFF.base, 0, 0);
  rc.drawImage(DIFF.base, 0, 0);

  DIFF.diffs.forEach(d=>{
    const x = d.x, y = d.y, rr = d.r;
    switch(d.type){
      case 0: // clone stamp — copies a patch from another spot
        rc.save();
        rc.beginPath(); rc.arc(x, y, rr, 0, Math.PI*2); rc.clip();
        rc.drawImage(DIFF.base, x - rr*1.4, y - rr*1.4, rr*2, rr*2, x - rr, y - rr, rr*2, rr*2);
        rc.restore();
        break;
      case 1: // colour shift
        rc.save(); rc.globalAlpha = .55;
        rc.fillStyle = ["#ef4444","#22d3ee","#a855f7","#22c55e","#f59e0b"][Math.floor(diffRand()*5)];
        rc.beginPath(); rc.arc(x, y, rr, 0, Math.PI*2); rc.fill(); rc.restore();
        break;
      case 2: // added shape
        rc.save(); rc.fillStyle = ["#f43f5e","#facc15","#38bdf8","#a3e635"][Math.floor(diffRand()*4)];
        rc.beginPath(); rc.arc(x, y, rr*.62, 0, Math.PI*2); rc.fill();
        rc.strokeStyle = "rgba(0,0,0,.35)"; rc.lineWidth = 2; rc.stroke(); rc.restore();
        break;
      case 3: // brightness patch
        rc.save(); rc.globalAlpha = .5; rc.fillStyle = diffRand() > .5 ? "#ffffff" : "#000000";
        rc.fillRect(x - rr, y - rr, rr*2, rr*2); rc.restore();
        break;
      default: // mirrored patch
        rc.save();
        rc.beginPath(); rc.arc(x, y, rr, 0, Math.PI*2); rc.clip();
        rc.translate(x, y); rc.scale(-1, 1); rc.translate(-x, -y);
        rc.drawImage(DIFF.base, x - rr, y - rr, rr*2, rr*2, x - rr, y - rr, rr*2, rr*2);
        rc.restore();
    }
  });
  // draw found markers on both
  DIFF.found.forEach(d=>{
    [lc, rc].forEach(ctx=>{
      ctx.save(); ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 4; ctx.globalAlpha = .95;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 12, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    });
  });
}
function diffTap(canvas, ev){
  if(DIFF.solved) return;
  const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) / rect.width * DIFF.size;
  const py = (ev.clientY - rect.top) / rect.height * DIFF.size;
  let hit = null;
  for(const d of DIFF.diffs){
    if(DIFF.found.includes(d)) continue;
    if(Math.hypot(d.x - px, d.y - py) < d.r * 1.7){ hit = d; break; }
  }
  if(hit){
    DIFF.found.push(hit);
    $("dFound").textContent = DIFF.found.length;
    sfx.correct(); buzz(12);
    diffPaint();
    if(DIFF.found.length >= DIFF.total) diffWin();
  } else {
    sfx.wrong(); buzz([20,40]);
    canvas.style.transition = "transform .12s";
    canvas.style.transform = "scale(.985)";
    setTimeout(()=>{ canvas.style.transform = ""; }, 120);
  }
}
function diffHint(){
  if(DIFF.solved) return;
  const remaining = DIFF.diffs.filter(d => !DIFF.found.includes(d));
  if(!remaining.length) return;
  let usedItem = false;
  if(S.inv.hint > 0){ S.inv.hint--; usedItem = true; save(); }
  else if(!spendCoins(30, "difference hint")){ toast("Hints cost 30 coins, or buy one in the Shop"); return; }
  DIFF.hints++;
  const d = remaining[0];
  DIFF.found.push(d);
  $("dFound").textContent = DIFF.found.length;
  diffPaint();
  toast(usedItem ? "Hint used (1 from your bag)" : "Hint used (−30 coins)");
  if(DIFF.found.length >= DIFF.total) diffWin();
}
function diffWin(){
  DIFF.solved = true;
  clearInterval(DIFF.timer);
  const bonus = DIFF.hints === 0 ? 5 : 0;
  const coins = 10 + bonus;
  addCoins(coins, "difference puzzle");
  addXp(10);
  S.stats.diffPuzzles++;
  S.bestDiffDiff = Math.max(S.bestDiffDiff || 0, DIFF.total);
  recordScore("diff", DIFF.total, DIFF_LEVELS[Math.min(DIFF.level-1,3)].lbl + " · " + DIFF.total + " diffs");
  markAnswer(true, "diff"); checkDaily("diff");
  sfx.win(); buzz([12,40,12,40]);
  showReward("Puzzle solved!", "+" + coins + " coins" + (bonus ? " (no-hint bonus +5)" : ""), ()=>{
    DIFF.level = Math.min(DIFF.level + 1, DIFF_LEVELS.length);
    diffNew();
  });
  renderWallet();
}
function diffFail(){
  sfx.fail();
  openSheet("Time's up", `<p>You found ${DIFF.found.length} of ${DIFF.total} differences. No coins this time — the puzzle is regenerated fresh.</p>
    <div class="row2"><button class="btn ghost" id="dfHome">Home</button>
      <button class="btn" id="dfRetry">Try a new puzzle</button></div>`);
  $("dfHome").onclick = ()=>{ closeSheet(); go("home"); };
  $("dfRetry").onclick = ()=>{ closeSheet(); diffNew(); };
}
