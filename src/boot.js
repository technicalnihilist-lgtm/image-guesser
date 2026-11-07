/* ================= boot & wiring ================= */
function ensureDailyCh(){
  if(!S.dailyCh || S.dailyCh.date !== todayKey()){ S.dailyCh = { date: todayKey(), done: {} }; save(); }
}
function dailySheet(){
  const names = [["image","Image Guesser","5 seeded photos"],["sound","Sound Guesser","5 seeded clips"],
                 ["diff","Find the Difference","one seeded puzzle"],["sort","Colour Sort","one seeded level"],
                 ["math","Math Master","5 seeded questions"]];
  const done = S.dailyCh.done || {};
  openSheet("Daily challenges", `<p>Five fresh challenges every day, seeded by today's date so everyone gets the same set. Each one pays <strong>+25 coins</strong> on top of the normal reward.</p>
    ${names.map(([id,label,sub])=>`<div class="arow"><div class="aic"><svg><use href="#i-target"/></svg></div>
      <div class="at"><b>${label}</b><span>${sub}</span></div>
      <button class="claim ${done[id]?"done":""}" ${done[id]?"disabled":""} data-dc="${id}">${done[id]?"Done":"Play"}</button></div>`).join("")}
    <p class="mini mt12">Play all five in one day for an extra +50 coin sweep bonus.</p>`);
  $$("[data-dc]").forEach(b=>b.onclick = ()=>{
    const id = b.dataset.dc; closeSheet();
    if(id === "image") imageStart(true);
    if(id === "sound") soundStart(true);
    if(id === "diff") diffStart(true, 2);
    if(id === "sort") sortStart(true);
    if(id === "math") mathStart(true, false);
  });
}
function looksSheet(){
  const owned = SHOP_ITEMS.filter(i=> i.type !== "boost" && owns(i.id));
  openSheet("Your looks", owned.length
    ? `<p>Tap to equip or remove.</p>` + owned.map(i=>{
        const eq = S.equipped[i.type] === i.id;
        return `<div class="arow"><div class="aic"><svg><use href="#${i.icon}"/></svg></div>
          <div class="at"><b>${i.n}</b><span>${i.type}</span></div>
          <button class="claim ${eq?"done":""}" data-look="${i.id}">${eq?"Equipped":"Equip"}</button></div>`;
      }).join("")
    : `<p>You don't own any cosmetics yet. Visit the Shop to unlock avatars, frames and themes.</p>
       <button class="btn mt12" id="lookShop">Open Shop</button>`, );
  $$("[data-look]").forEach(b=>b.onclick = ()=>{ equipItem(b.dataset.look); looksSheet(); });
  const ls = $("lookShop"); if(ls) ls.onclick = ()=>{ closeSheet(); go("shop"); };
}
function renameSheet(){
  openSheet("Your name", `<p>Shown on your profile and on your personal records.</p>
    <input id="nmInput" maxlength="18" value="${(S.name||"Player").replace(/"/g,"&quot;")}"
      style="width:100%;height:46px;border-radius:13px;background:var(--glass);border:1px solid var(--line-2);
      color:var(--ink);font-size:15px;font-weight:700;padding:0 12px;margin-top:6px">
    <div class="row2"><button class="btn ghost" id="nmCancel">Cancel</button>
      <button class="btn" id="nmSave">Save</button></div>`);
  $("nmCancel").onclick = closeSheet;
  $("nmSave").onclick = ()=>{
    const v = ($("nmInput").value || "").trim().slice(0,18);
    S.name = v || "Player"; save(); closeSheet(); renderWallet(); renderProfile(); toast("Name saved");
  };
}
function backupSheet(){
  const [title, html] = SHEETS.backup();
  openSheet(title, html);
  const ta = $("bkText");
  ta.value = JSON.stringify(S);
  $("bkCopy").onclick = async ()=>{
    try{ await navigator.clipboard.writeText(ta.value); toast("Save code copied"); }
    catch(e){ ta.select(); toast("Select all and copy manually"); }
  };
  $("bkRestore").onclick = ()=>{
    try{
      const obj = JSON.parse(ta.value);
      if(!obj || typeof obj !== "object") throw new Error("bad");
      S = deepMerge(DEFAULT_STATE, obj); save();
      closeSheet(); renderWallet(); renderHome(); renderProfile(); renderRewards();
      toast("Save restored");
    }catch(e){ toast("That save code could not be read"); }
  };
}
function oddsSheet(){
  const total = WHEEL.reduce((a,b)=>a+b.w,0);
  openSheet("Reward chances", `
    <p>Every value below is the exact chance used when you spin — nothing is hidden.</p>
    ${WHEEL.map(s=>`<div class="lbrow"><span class="rk">${s.label}</span>
      <span class="nm">${s.coins ? s.coins + " coins" : (s.item === "hint" ? "1 hint" : "1× 2X booster")}</span>
      <span class="sc">${(s.w/total*100).toFixed(1)}%</span></div>`).join("")}
    <h3>Treasure boxes</h3>
    ${BOXES.map(b=>{
      const t = BOX_TABLE[b.id], tot = t.reduce((a,x)=>a+x.w,0);
      return `<p><b>${b.n}</b> — ${fmt(b.p)} coins<br><span class="mini">${t.map(x=>
        (x.t === "coins" ? x.a + "–" + x.b + " coins" : x.t) + " " + (x.w/tot*100).toFixed(0) + "%").join(" · ")}</span></p>`;
    }).join("")}
    <p class="mini">Rewards are generated on your device with a fair random generator. No real money is involved anywhere in this game.</p>`);
}

function boot(){
  ensureMissions(); ensureDailyCh();
  applyI18n(); paintSettings(); renderWallet(); renderHome();

  $$("#nav button").forEach(b => b.onclick = ()=>{ sfx.tap(); go(b.dataset.nav); });
  $$("[data-back]").forEach(b => b.onclick = ()=>{ sfx.tap(); back(); });

  $$("[data-mode]").forEach(card => card.onclick = ()=>{
    const m = card.dataset.mode; sfx.tap(); buzz(8);
    if(m === "image") imageStart(false);
    else if(m === "sound") soundStart(false);
    else if(m === "diff") diffStart(false, 1);
    else if(m === "sort") sortStart(false);
    else if(m === "math") mathStart(false, false);
  });

  $("qDaily").onclick = ()=>{ sfx.tap(); go("rewards"); };
  $("qSpin").onclick = ()=>{ sfx.tap(); go("rewards"); setTimeout(()=>$("btnSpin").scrollIntoView({block:"center", behavior:"smooth"}), 120); };
  $("qBoxes").onclick = ()=>{ sfx.tap(); go("rewards"); setTimeout(()=>$("boxGrid").scrollIntoView({block:"center", behavior:"smooth"}), 120); };
  $("qAch").onclick = ()=>{ sfx.tap(); go("awards"); };
  $("btnDailyAll").onclick = ()=>{ sfx.tap(); dailySheet(); };
  $("btnSettingsHome").onclick = ()=>{ sfx.tap(); go("settings"); };
  $("whoBtn").onclick = ()=>{ sfx.tap(); go("profile"); };

  /* ---- image mode ---- */
  $("btnRefresh").onclick = ()=>{ sfx.tap(); imageNext(); };
  $("btnNext").onclick = ()=>{ clearTimeout(IMG.t); imageNext(); };
  $("btnImgRetry").onclick = ()=>{ if(IMG.cur) imageLoad(IMG.cur); };
  $("qCat").parentElement.onclick = ()=>{ sfx.tap(); imageCatSheet(); };
  $("qCat").parentElement.style.cursor = "pointer";

  /* ---- sound mode ---- */
  $("btnPlay").onclick = ()=>{ sfx.tap(); soundPlay(); };
  $("btnSoundNext").onclick = ()=>{ clearTimeout(SND.t); soundNext(); };
  $("btnSoundSkip").onclick = ()=>{
    if(S.inv.skip > 0){ S.inv.skip--; save(); toast("Skip used"); }
    soundNext();
  };
  $("volSlider").oninput = e => { if(SND.audio) SND.audio.volume = parseFloat(e.target.value); };
  $("sCat").parentElement.onclick = ()=>{ sfx.tap(); soundCatSheet(); };
  $("sCat").parentElement.style.cursor = "pointer";

  /* ---- difference mode ---- */
  ["dLeft","dRight"].forEach(id => {
    const c = $(id);
    c.addEventListener("click", ev => diffTap(c, ev));
    c.addEventListener("touchstart", ev => { if(ev.touches.length === 1) diffTap(c, ev.touches[0]); }, { passive: true });
  });
  $("btnDiffHint").onclick = ()=>{ sfx.tap(); diffHint(); };
  $("btnDiffRestart").onclick = ()=>{ sfx.tap(); diffNew(); };
  $("btnDiffNew").onclick = ()=>{ sfx.tap(); diffNew(); };
  $("btnZoom").onclick = ()=>{
    DIFF.zoom = !DIFF.zoom;
    $("diffwrap").classList.toggle("zoom", DIFF.zoom);
    toast(DIFF.zoom ? "Zoomed — tap the picture" : "Showing both pictures");
  };

  /* ---- sort mode ---- */
  $("btnSortUndo").onclick = ()=>{ sfx.tap(); sortUndo(); };
  $("btnSortHint").onclick = ()=>{ sfx.tap(); sortHint(); };
  $("btnSortRestart").onclick = ()=>{ sfx.tap(); sortRestart(); };
  $("btnSortNew").onclick = ()=>{ sfx.tap(); sortNew(); };

  /* ---- math mode ---- */
  $("btnMathNext").onclick = ()=>{ clearTimeout(MATH._t); mathNext(); };
  $("btnMathSkip").onclick = ()=>{
    if(S.inv.skip > 0){ S.inv.skip--; save(); toast("Skip used"); }
    mathNext();
  };
  $("mDiffLbl").onclick = ()=>{ sfx.tap(); mathSettingsSheet(); };
  $("mDiffLbl").style.cursor = "pointer";

  /* ---- shop / awards / leaderboard tabs ---- */
  const wireTabs = (id, render) => {
    $$("#" + id + " button").forEach(b => b.onclick = ()=>{
      $$("#" + id + " button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on"); sfx.tap(); render();
    });
  };
  wireTabs("shopTabs", renderShop);
  wireTabs("awardTabs", renderAwards);
  wireTabs("lbTabs", renderLeaderboard);

  /* ---- rewards ---- */
  $("btnClaimDaily").onclick = ()=>{ sfx.tap(); claimDaily(); };
  $("btnSpin").onclick = ()=>{ sfx.tap(); spinWheel(wheelSpinLeft() <= 0); };
  $("btnOdds").onclick = ()=>{ sfx.tap(); oddsSheet(); };

  /* ---- profile ---- */
  $("btnRename").onclick = ()=>{ sfx.tap(); renameSheet(); };
  $("btnLooks").onclick = ()=>{ sfx.tap(); looksSheet(); };
  $("btnLb").onclick = ()=>{ sfx.tap(); go("leaderboard"); };

  /* ---- settings ---- */
  $$("[data-toggle]").forEach(sw => {
    sw.onclick = ()=> toggleSetting(sw.dataset.toggle);
    sw.onkeydown = e => { if(e.key === " " || e.key === "Enter"){ e.preventDefault(); toggleSetting(sw.dataset.toggle); } };
  });
  $("langsel").onchange = e => { S.settings.lang = e.target.value; save(); applyI18n(); paintSettings(); };
  $("graphicsSel").onchange = e => { S.settings.graphics = e.target.value; save(); paintSettings(); toast("Graphics: " + e.target.value); };
  $("rowHow").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.howto(); openSheet(ti,h); };
  $("rowBackup").onclick = ()=>{ sfx.tap(); backupSheet(); };
  $("rowPrivacy").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.privacy(); openSheet(ti,h); };
  $("rowTerms").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.terms(); openSheet(ti,h); };
  $("rowAbout").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.about(); openSheet(ti,h); };
  $("rowCredits").onclick = ()=>{ sfx.tap(); const [ti,h] = SHEETS.credits(); openSheet(ti,h); };
  $("rowReset").onclick = ()=>{ sfx.tap(); resetProgress(); };
  $("shClose").onclick = closeSheet;
  $("scrim").onclick = closeSheet;

  /* ---- keyboard ---- */
  document.addEventListener("keydown", e => {
    const inField = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
    if(e.key === "Escape"){ if($("sheet").classList.contains("on")) closeSheet(); else back(); return; }
    if(inField) return;
    const map = { "mode-image": ()=> { const b = $$("#answers .ans")[+e.key-1]; if(b && !b.disabled) b.click(); },
                  "mode-sound": ()=> { const b = $$("#sanswers .ans")[+e.key-1]; if(b && !b.disabled) b.click(); },
                  "mode-math":  ()=> { const b = $$("#manswers .ans")[+e.key-1]; if(b && !b.disabled) b.click(); } };
    if(["1","2","3","4"].includes(e.key) && map[curScreen]) map[curScreen]();
    if(e.key.toLowerCase() === "r" && curScreen === "mode-image") imageNext();
  });

  /* ---- offline banner ---- */
  const off = $("offline");
  const setOff = ()=> off.classList.toggle("on", !navigator.onLine);
  window.addEventListener("online", setOff);
  window.addEventListener("offline", setOff);
  setOff();

  /* ---- audio unlock ---- */
  const unlock = ()=>{ audio(); if(S.settings.music) startMusic(); document.removeEventListener("pointerdown", unlock); };
  document.addEventListener("pointerdown", unlock, { once: true });

  $("verline").textContent = "Version " + VERSION;
  setTimeout(()=>{ if(curScreen === "splash") go("home"); }, 1200);
}
document.addEventListener("DOMContentLoaded", boot);
