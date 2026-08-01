const firebaseConfig={
  apiKey:"AIzaSyBc4VGehb4ZpEz46ZE0CyVBbl83S_d4IEE",
  authDomain:"titans-red-box.firebaseapp.com",
  databaseURL:"https://titans-red-box-default-rtdb.firebaseio.com",
  projectId:"titans-red-box",
  storageBucket:"titans-red-box.firebasestorage.app",
  messagingSenderId:"799718988017",
  appId:"1:799718988017:web:176627f7f76df5a6daf150"
};
firebase.initializeApp(firebaseConfig);
const stateRef=firebase.database().ref("state");
 
const rosterData=[[1,"Ichi Sasaki",283,2,null,"High","Pending",null],[2,"Lulufanulu",230,7,null,"High","Pending",null],[3,"TheAngryBeaver",206,12,null,"High","Pending",null],[4,"Gentleman Jack",200,15,null,"High","Pending",null],[5,"W0lfyy",256,4,null,"High","Pending",null],[6,"YunusEmre66",241,5,null,"High","Pending",null],[7,"Calvin",168,null,5,"Low","Pending",null],[8,"En Sabah Nur",212,11,null,"High","Pending",null],[9,"Bigh",229,8,null,"High","Pending",null],[10,"Linincker",183,null,8,"Low","Pending",null],[11,"*Dark Baron*",185,null,10,"Low","Pending",null],[12,"Gran",229,9,null,"High","Pending",null],[13,"Rukia Kunchiki",210,null,2,"Low","Pending",null],[14,"Ali Deniz",343,1,null,"High","Completed","Received rotating box 31 in the first auction."],[15,"Nativa",231,6,null,"High","Pending",null],[16,"Blah",133,null,1,"Low","Completed","Purchased rotating box 32 by mistake; counted as received."],[17,"Zaxos",177,null,7,"Low","Pending","Permanent box corrected from 31 to 17."],[18,"Canachris",184,null,9,"Low","Pending",null],[19,"AC Milan",278,null,15,"Low","Pending",null],[20,"Cmdr Aus",195,null,14,"Low","Pending",null],[21,"Darkfire8000",189,null,13,"Low","Pending",null],[22,"Falcon3500",187,null,12,"Low","Pending",null],[23,"Hoyrat",161,null,3,"Low","Pending",null],[24,"~Man0l0@~",220,10,null,"High","Pending","Permanent box corrected from 32 to 24."],[25,"Bootie hunter",271,3,null,"High","Pending",null],[26,"X Force",168,null,6,"Low","Pending",null],[27,"Locuu",185,null,11,"Low","Pending",null],[28,"Broekhoest",161,null,4,"Low","Pending",null],[29,"Axe",202,13,null,"High","Pending",null],[30,"KillerKlown",201,14,null,"High","Pending",null]];
 
const highQueue=[["Ali Deniz",343,"Completed"],["Ichi Sasaki",283,"Pending"],["Bootie hunter",271,"Pending"],["W0lfyy",256,"Pending"],["YunusEmre66",241,"Pending"],["Nativa",231,"Pending"],["Lulufanulu",230,"Pending"],["Bigh",229,"Pending"],["Gran",229,"Pending"],["~Man0l0@~",220,"Pending"],["En Sabah Nur",212,"Pending"],["TheAngryBeaver",206,"Pending"],["Axe",202,"Pending"],["KillerKlown",201,"Pending"],["Gentleman Jack",200,"Pending"]];
const lowQueue=[["Blah",133,"Completed"],["Rukia Kunchiki",210,"Pending"],["Hoyrat",161,"Pending"],["Broekhoest",161,"Pending"],["Calvin",168,"Pending"],["X Force",168,"Pending"],["Zaxos",177,"Pending"],["Linincker",183,"Pending"],["Canachris",184,"Pending"],["*Dark Baron*",185,"Pending"],["Locuu",185,"Pending"],["Falcon3500",187,"Pending"],["Darkfire8000",189,"Pending"],["Cmdr Aus",195,"Pending"],["AC Milan",278,"Pending"]];
 
// Firebase database keys can't contain . # $ / [ ] — player names can, so every place a
// name is used as an object key (highStatus/lowStatus) runs through this first.
function safeKey(name){return String(name).replace(/[.#$/\[\]]/g,"_")}
 
// One-off player renames. Old names are still sitting in the live Firebase data,
// so remap them every time state loads until the next save writes the new names.
const RENAMES={"Dagmara":"Rukia Kunchiki","A.C Millan":"AC Milan"};
function applyRenames(v){
  v.players.forEach(p=>{if(RENAMES[p.name])p.name=RENAMES[p.name]});
  ["highStatus","lowStatus"].forEach(k=>{
    Object.keys(RENAMES).forEach(oldName=>{
      const ok=safeKey(oldName),nk=safeKey(RENAMES[oldName]);
      if(ok!==nk&&v[k][ok]!==undefined){if(v[k][nk]===undefined)v[k][nk]=v[k][ok];delete v[k][ok]}
    });
  });
  v.history.forEach(h=>["highNom","highRec","lowNom","lowRec"].forEach(f=>{if(RENAMES[h[f]])h[f]=RENAMES[h[f]]}));
  ["high","low"].forEach(side=>{
    v.pendingDeclines[side]=v.pendingDeclines[side].map(n=>RENAMES[n]||n);
  });
  if(v.openRound){["highNom","lowNom"].forEach(f=>{if(RENAMES[v.openRound[f]])v.openRound[f]=RENAMES[v.openRound[f]]})}
  return v;
}
 
function defaultState(){
  return {
    players:rosterData.map(([box,name,power,,,,,notes])=>({box,name,power,notes})),
    highStatus:Object.fromEntries(highQueue.map(([n,,s])=>[safeKey(n),s])),
    lowStatus:Object.fromEntries(lowQueue.map(([n,,s])=>[safeKey(n),s])),
    history:[{auction:1,date:"2026-07-20",highNom:"Ali Deniz",highOut:"Accepted",highRec:"Ali Deniz",lowNom:"Blah",lowOut:"Accepted",lowRec:"Blah",cycle:1,notes:"Blah purchased rotating box 32 by mistake."}],
    pendingDeclines:{high:[],low:[]},
    openRound:null,
    currentCycle:1
  };
}
// shared, live state — synced with everyone via Firebase. Local edits call pushState();
// the render only ever happens inside the stateRef listener below, so every browser
// (including your own) stays in sync with the same source of truth.
let state=defaultState();
let spinning=false,pendingResult=null,rotationAngle=0;
// true while you have unsaved text in the notes box — stops an incoming
// Firebase update (yours or anyone else's) from wiping what you're typing.
// Declared up here because the Firebase listener renders before the notes code runs.
let notesDirty=false;
// What each status shows in the dropdown. The stored value stays "Completed" /
// "Declined" / "Pending" — only the visible label changes.
const STATUS_LABELS={Pending:"Pending",Completed:"Completed / Accepted",Declined:"Declined"};
 
function normalizeState(v){
  v.players=v.players||[];
  if(!Array.isArray(v.players))v.players=Object.values(v.players);
  v.players.forEach(p=>{if(p.box===undefined)p.box=null});
  v.highStatus=v.highStatus||{};
  v.lowStatus=v.lowStatus||{};
  v.history=v.history||[];
  if(!Array.isArray(v.history))v.history=Object.values(v.history);
  v.pendingDeclines=v.pendingDeclines||{};
  v.pendingDeclines.high=v.pendingDeclines.high||[];
  v.pendingDeclines.low=v.pendingDeclines.low||[];
  v.openRound=(v.openRound===undefined)?null:v.openRound;
  v.currentCycle=v.currentCycle||1;
  return applyRenames(v);
}
function pushState(){
  stateRef.set(state).catch(err=>{console.error("Failed to sync:",err);alert("Couldn't save — check your internet connection and try again.")});
}
stateRef.on("value",snap=>{
  const val=snap.val();
  if(val){
    state=normalizeState(val);
    renderAll();
  } else {
    pushState();
  }
});
 
const ADMIN_PASSWORD="1230";
// Notes get unlocked once per tab so you're not retyping the password on every save.
// Destructive actions (reset, new cycle, remove, delete) always prompt.
let notesUnlocked=false;
function askPassword(){
  const pw=prompt("Enter admin password to continue:");
  if(pw===null)return false;
  if(pw!==ADMIN_PASSWORD){alert("Incorrect password.");return false;}
  return true;
}
function withPassword(fn){
  return function(...args){if(askPassword())fn(...args)};
}
function withNotesPassword(fn){
  return function(...args){
    if(!notesUnlocked){if(!askPassword())return;notesUnlocked=true;}
    fn(...args);
  };
}
 
function availableBoxes(){const used=new Set(state.players.filter(p=>p.box!=null).map(p=>p.box));return Array.from({length:30},(_,i)=>i+1).filter(n=>!used.has(n))}
function unassignedPlayers(){return state.players.filter(p=>p.box==null)}
function nextPlayer(){
  const sel=document.getElementById("nextPlayerSelect");
  if(sel&&sel.value){const p=state.players.find(x=>x.name===sel.value);if(p&&p.box==null)return p;}
  return unassignedPlayers()[0]||null;
}
 
function colorFor(i){return "#b04f49"}
 
function drawWheel(){
  const c=document.getElementById("wheel"),x=c.getContext("2d"),b=availableBoxes(),cx=320,cy=320,r=300;
  x.clearRect(0,0,640,640);
  if(!b.length){
    x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fillStyle="#0f2c52";x.fill();
    x.fillStyle="#e8b94f";x.font="700 26px Cinzel";x.textAlign="center";
    x.fillText("ALL BOXES",cx,cy-6);x.fillText("ASSIGNED",cx,cy+26);
    return;
  }
  const sl=Math.PI*2/b.length;
  b.forEach((box,i)=>{
    const st=rotationAngle+i*sl,en=st+sl;
    x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,r,st,en);x.closePath();
    x.fillStyle=colorFor(i);x.fill();x.strokeStyle="#c9a24f";x.lineWidth=2;x.stroke();
    x.save();x.translate(cx,cy);x.rotate(st+sl/2);x.textAlign="right";
    x.fillStyle="#f5dfa0";
    x.font=`700 ${b.length>20?17:21}px Inter`;
    x.fillText(box,r-20,7);x.restore();
  });
  x.beginPath();x.arc(cx,cy,68,0,Math.PI*2);x.fillStyle="#0a1f3d";x.fill();
  x.strokeStyle="#e8b94f";x.lineWidth=5;x.stroke();
  x.fillStyle="#e8b94f";x.font="700 19px Cinzel";x.textAlign="center";
  x.fillText("TITAN",cx,cy-4);x.fillText("WARS",cx,cy+20);
}
 
function renderAssignments(){
  const b=document.getElementById("assignmentBody");b.innerHTML="";
  state.players.slice().sort((a,c)=>(a.box??999)-(c.box??999)).forEach(p=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.box??"—"}</td><td>${p.name}</td><td>${p.power}M</td><td class="small">${p.notes??""}</td>
      <td>${p.box!=null?`<button class="danger" style="width:auto;padding:6px 10px" onclick="unassign('${p.name.replace(/'/g,"\\'")}')">Remove</button>`:""}</td>`;
    b.appendChild(tr);
  });
  const avail=availableBoxes().length;
  document.getElementById("availableCount").textContent=avail;
  document.getElementById("assignedCount").textContent=30-avail;
  document.getElementById("dashAssigned").textContent=`${30-avail} / 30`;
  const sel=document.getElementById("nextPlayerSelect"),prevVal=sel.value;
  const up=unassignedPlayers();
  sel.innerHTML=up.length?up.map(p=>`<option value="${p.name.replace(/"/g,"&quot;")}">${p.name}</option>`).join(""):`<option value="">Cycle complete</option>`;
  if(up.some(p=>p.name===prevVal))sel.value=prevVal;
  const np=nextPlayer();
  document.getElementById("spinBtn").disabled=!avail||!np;
}
 
function statusBadge(s){return `<span class="badge ${s}">${s}</span>`}
 
// Names involved in THIS cycle on a given side — nominee or recipient, from
// history. Status alone can't tell you this: highStatus just says "Completed",
// with no record of which cycle that came from.
function cycleParticipants(side){
  const cyc=String(state.currentCycle),out=new Set();
  state.history.forEach(h=>{
    if(String(h.cycle)!==cyc)return;
    [h[side+"Nom"],h[side+"Rec"]].forEach(n=>{if(n)out.add(n)});
  });
  return out;
}
 
// First player still Pending on a side — this is the queue position, NOT
// necessarily who the panel shows. See currentRound().
function firstPending(side){
  const q=side==="high"?highQueue:lowQueue;
  const st=side==="high"?state.highStatus:state.lowStatus;
  const f=q.find(([n])=>(st[safeKey(n)]||"Pending")==="Pending");
  return f?f[0]:null;
}
 
function renderQueues(){
  const h=document.getElementById("highBody"),l=document.getElementById("lowBody");
  const nh=firstPending("high"),nl=firstPending("low");
  const ph=cycleParticipants("high"),pl=cycleParticipants("low");
  h.innerHTML=l.innerHTML="";
  highQueue.forEach(([n,p],i)=>h.appendChild(queueRow(i,n,p,"high",n===nh,ph.has(n))));
  lowQueue.forEach(([n,p],i)=>l.appendChild(queueRow(i,n,p,"low",n===nl,pl.has(n))));
 
  // Vestigial spans — hidden in the current index.html, kept so a mismatched
  // deploy can't throw. Guarded, so they can be deleted from the HTML freely.
  const vh=document.getElementById("nextHigh"),vl=document.getElementById("nextLow");
  if(vh)vh.textContent=nh||"Cycle complete";
  if(vl)vl.textContent=nl||"Cycle complete";
 
  // Dash cards and the panel now read from the SAME source. Previously the dash
  // showed first-Pending while the panel showed the actual winner, so the top of
  // the page contradicted the middle of it.
  const r=currentRound();
  const put=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt};
  put("dashHigh",r.high.name);
  put("dashLow",r.low.name);
  put("dashHighState",r.high.state);
  put("dashLowState",r.low.state);
  const done=Object.values(state.highStatus).filter(v=>v==="Completed").length+Object.values(state.lowStatus).filter(v=>v==="Completed").length;
  document.getElementById("dashCycle").textContent=`Cycle ${state.currentCycle} — ${done} / 30`;
 
  // Current auction panel. Every lookup guarded so an older index.html
  // still renders the queue tables above.
  put("curCycle",`Cycle ${state.currentCycle}`);
  put("curHigh",r.high.text);
  put("curLow",r.low.text);
  put("upcomingHigh",r.upHigh);
  put("upcomingLow",r.upLow);
  put("cycleBadge",`Cycle ${state.currentCycle}`);
}
// Spotlight rule: this cycle's players and the next player up get the gold row.
// Everyone else recedes to 40%. The status cell stays at full opacity — members
// set their own status, and a faded dropdown reads as disabled.
function queueRow(i,n,p,side,isNext,inCycle){
  const tr=document.createElement("tr");
  const st=(side==="high"?state.highStatus:state.lowStatus)[safeKey(n)]||"Pending";
  const lit=isNext||inCycle;
  // Two strengths of gold: this cycle's players are the headline, so they get
  // the stronger fill. The next player sits a shade back. inCycle wins if
  // someone is both — they're still the current story.
  if(isNext)tr.style.background="rgba(232,185,79,.15)";
  if(inCycle)tr.style.background="rgba(232,185,79,.45)";
  if(lit)tr.style.fontWeight="700";
  if(inCycle)tr.style.borderLeft="4px solid var(--gold-600)";
  const fade=lit?"":' style="opacity:.4"';
  const tag=isNext?` <span class="badge Pending" style="margin-left:6px;font-size:10px">NEXT</span>`:"";
  const mark=inCycle?` <span class="badge ${st==="Declined"?"Declined":"Completed"}" style="margin-left:6px;font-size:10px">CYCLE ${state.currentCycle}</span>`:"";
  tr.innerHTML=`<td${fade}>${i+1}</td><td${fade}>${n}${tag}${mark}</td><td${fade}>${p}M</td><td>
    <select onchange="setQueueStatus('${side}','${n.replace(/'/g,"\\'")}',this.value)">
      ${["Pending","Completed","Declined"].map(o=>`<option value="${o}" ${st===o?"selected":""}>${STATUS_LABELS[o]}</option>`).join("")}
    </select></td>`;
  return tr;
}
function setQueueStatus(side,name,value){
  (side==="high"?state.highStatus:state.lowStatus)[safeKey(name)]=value;
  if(value==="Declined"||value==="Completed"){
    let idx=state.openRound;
    if(idx===null||idx===undefined||!state.history[idx]){
      idx=state.history.length;
      state.history.push({
        auction:state.history.length+1,
        date:new Date().toISOString().slice(0,10),
        highNom:"",highOut:"",highRec:"",
        lowNom:"",lowOut:"",lowRec:"",
        cycle:state.currentCycle,
        notes:""
      });
      state.openRound=idx;
    }
    const row=state.history[idx];
    const nomKey=side+"Nom",outKey=side+"Out",recKey=side+"Rec";
    if(value==="Declined"){
      state.pendingDeclines[side].push(name);
      if(!row[nomKey]){row[nomKey]=name;row[outKey]="Declined";}
    } else {
      if(!row[nomKey]){row[nomKey]=name;row[outKey]="Accepted";}
      row[recKey]=name;
      const declines=state.pendingDeclines[side];
      if(declines.length){
        const noteText=declines.map(d=>`${d} declined, ${name} Rxed`).join("; ");
        row.notes=row.notes?`${row.notes}; ${noteText}`:noteText;
        state.pendingDeclines[side]=[];
      }
    }
    if(row.highRec&&row.lowRec)state.openRound=null;
  }
  pushState();
}
window.setQueueStatus=setQueueStatus;
 
function renderHistory(){
  const b=document.getElementById("historyBody");b.innerHTML="";
  state.history.forEach((h,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td class="col-hash">${h.auction}</td><td class="col-date">${h.date||""}</td>
      <td class="grp-31">${h.highNom||""}</td><td class="grp-31">${h.highOut||""}</td><td class="grp-31 grp-31-end"><strong>${h.highRec||"—"}</strong></td>
      <td class="grp-32">${h.lowNom||""}</td><td class="grp-32">${h.lowOut||""}</td><td class="grp-32 grp-32-end"><strong>${h.lowRec||"—"}</strong></td>
      <td class="col-cycle">${h.cycle||""}</td>
      <td class="col-notes small">${h.notes||""} <button class="secondary" style="width:auto;padding:3px 8px;font-size:11px" onclick="editHistoryNotes(${i})">Edit</button></td>
      <td><button class="danger" style="width:auto;padding:6px 10px" onclick="deleteHistory(${i})">Delete</button></td>`;
    b.appendChild(tr);
  });
}
function editHistoryNotesActual(i){
  const h=state.history[i];if(!h)return;
  const val=prompt("Notes for auction #"+h.auction+":",h.notes||"");
  if(val===null)return;
  h.notes=val.trim();
  pushState();
}
const editHistoryNotes=withNotesPassword(editHistoryNotesActual);
window.editHistoryNotes=editHistoryNotes;
function deleteHistoryActual(i){state.history.splice(i,1);pushState()}
const deleteHistory=withPassword(deleteHistoryActual);
window.deleteHistory=deleteHistory;
 
function playerCycleLog(name,sideKey){
  const nomKey=sideKey+"Nom",outKey=sideKey+"Out",recKey=sideKey+"Rec";
  const rows=state.history.filter(h=>h[nomKey]===name).sort((a,c)=>a.cycle-c.cycle);
  const parts=rows.map(h=>{
    if(h[outKey]==="Declined"&&h[recKey])return `C${h.cycle}: Declined (→ ${h[recKey]})`;
    return `C${h.cycle}: ${h[outKey]}`;
  });
  const loggedCurrent=rows.some(h=>String(h.cycle)===String(state.currentCycle));
  if(!loggedCurrent){
    const live=(sideKey==="high"?state.highStatus:state.lowStatus)[safeKey(name)]||"Pending";
    parts.push(`C${state.currentCycle}: ${live}`);
  }
  return parts;
}
function renderRoster(){
  const b=document.getElementById("rosterBody");b.innerHTML="";
  state.players.slice().sort((a,c)=>(a.box??999)-(c.box??999)).forEach(p=>{
    const src=rosterData.find(r=>r[1]===p.name)||[];
    const [,,,hrank,lrank,side]=src;
    const sideKey=side==="High"?"high":"low";
    const log=playerCycleLog(p.name,sideKey);
    const cycleCell=log.map(entry=>{
      const cls=entry.includes(": Accepted")?"Completed":entry.includes(": Declined")?"Declined":"Pending";
      return `<span class="badge ${cls}" style="margin:2px 4px 2px 0">${entry}</span>`;
    }).join("");
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.box??"—"}</td><td>${p.name}</td><td>${p.power}M</td><td>${hrank??"—"}</td><td>${lrank??"—"}</td>
      <td>${side||"—"}</td><td>${cycleCell}</td><td class="small">${p.notes??""}</td>`;
    b.appendChild(tr);
  });
}
 
function populateNotesSelect(){
  const sel=document.getElementById("notesPlayerSelect"),prevVal=sel.value;
  const names=state.players.map(p=>p.name).slice().sort((a,c)=>a.localeCompare(c));
  const current=Array.from(sel.options).map(o=>o.value);
  if(names.join("\u0001")!==current.join("\u0001")){
    sel.innerHTML=names.map(n=>`<option value="${n.replace(/"/g,"&quot;")}">${n}</option>`).join("");
    if(names.includes(prevVal))sel.value=prevVal;
  }
  loadSelectedNotes();
}
function loadSelectedNotes(force){
  const inp=document.getElementById("notesEditInput");
  // don't clobber an edit in progress
  if(!force&&(notesDirty||document.activeElement===inp))return;
  const sel=document.getElementById("notesPlayerSelect"),p=state.players.find(x=>x.name===sel.value);
  const raw=p?(p.notes||""):"";
  inp.value=raw.replace(/^\[[^\]]*\]\s*/,"");
  notesDirty=false;
}
function gmtTimestamp(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} GMT`;
}
function saveNotesActual(){
  const sel=document.getElementById("notesPlayerSelect"),p=state.players.find(x=>x.name===sel.value);
  if(!p){alert("Pick a player first.");return;}
  const text=document.getElementById("notesEditInput").value.trim();
  p.notes=text?`[${gmtTimestamp()}] ${text}`:"";
  notesDirty=false;
  pushState();
  const btn=document.getElementById("saveNotesBtn"),label=btn.textContent;
  btn.textContent="Saved \u2713";setTimeout(()=>{btn.textContent=label},1500);
}
const saveNotes=withNotesPassword(saveNotesActual);
document.getElementById("notesPlayerSelect").onchange=()=>{notesDirty=false;loadSelectedNotes(true)};
document.getElementById("notesEditInput").oninput=()=>{notesDirty=true};
document.getElementById("notesEditInput").onkeydown=e=>{if(e.key==="Enter")saveNotes()};
document.getElementById("saveNotesBtn").onclick=saveNotes;
 
function renderAll(){
  const steps=[populateNotesSelect,drawWheel,renderAssignments,renderQueues,renderHistory,renderRoster];
  steps.forEach(fn=>{try{fn()}catch(e){console.error(fn.name,"failed:",e)}});
}
 
function unassignActual(name){const p=state.players.find(x=>x.name===name);if(p)p.box=null;pushState()}
const unassign=withPassword(unassignActual);
window.unassign=unassign;
 
document.getElementById("spinBtn").onclick=()=>{
  if(spinning)return;
  const np=nextPlayer(),b=availableBoxes();
  if(!np||!b.length)return;
  spinning=true;pendingResult=null;
  document.getElementById("confirmBtn").disabled=true;document.getElementById("cancelBtn").disabled=true;
  const wi=Math.floor(Math.random()*b.length),sl=Math.PI*2/b.length,target=-(wi*sl+sl/2),start=rotationAngle,
    turns=6+Math.floor(Math.random()*3),final=target+Math.PI*2*turns,dur=4200,t0=performance.now();
  function anim(now){
    const t=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-t,4);
    rotationAngle=start+(final-start)*e;drawWheel();
    if(t<1){requestAnimationFrame(anim)}
    else{
      rotationAngle=((target%(Math.PI*2))+(Math.PI*2))%(Math.PI*2);drawWheel();
      const relative=((0-rotationAngle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      const landedIndex=Math.floor(relative/sl)%b.length,landedBox=b[landedIndex];
      pendingResult={player:np.name,box:landedBox};
      document.getElementById("resultBox").textContent=landedBox;
      document.getElementById("resultPlayer").textContent=np.name;
      document.getElementById("confirmBtn").disabled=false;document.getElementById("cancelBtn").disabled=false;
      spinning=false;
    }
  }
  requestAnimationFrame(anim);
};
document.getElementById("confirmBtn").onclick=()=>{
  if(!pendingResult)return;
  if(!availableBoxes().includes(pendingResult.box)){
    alert("That box was just taken by someone else — please spin again.");
    pendingResult=null;
    document.getElementById("resultBox").textContent="—";document.getElementById("resultPlayer").textContent="Box no longer available";
    document.getElementById("confirmBtn").disabled=true;document.getElementById("cancelBtn").disabled=true;
    return;
  }
  state.players.find(x=>x.name===pendingResult.player).box=pendingResult.box;
  pendingResult=null;
  document.getElementById("resultBox").textContent="—";document.getElementById("resultPlayer").textContent="Assignment saved";
  document.getElementById("confirmBtn").disabled=true;document.getElementById("cancelBtn").disabled=true;
  pushState();
};
document.getElementById("cancelBtn").onclick=()=>{
  pendingResult=null;
  document.getElementById("resultBox").textContent="—";document.getElementById("resultPlayer").textContent="Spin cancelled";
  document.getElementById("confirmBtn").disabled=true;document.getElementById("cancelBtn").disabled=true;
};
document.getElementById("newCycleBtn").onclick=withPassword(()=>{
  if(confirm("Reset both rotating queues to Pending for a new cycle?")){
    highQueue.forEach(([n])=>state.highStatus[safeKey(n)]="Pending");
    lowQueue.forEach(([n])=>state.lowStatus[safeKey(n)]="Pending");
    state.pendingDeclines={high:[],low:[]};
    state.openRound=null;
    state.currentCycle+=1;
    pushState();
  }
});
document.getElementById("resetBtn").onclick=withPassword(()=>{
  if(confirm("Clear all permanent box assignments and start the draw over?")){
    state.players.forEach(p=>p.box=null);pushState();
  }
});
document.getElementById("exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="titan-wars-box-data.json";a.click();
};
document.getElementById("importBtn").onclick=()=>fileInput.click();
fileInput.onchange=e=>{
  const r=new FileReader();
  r.onload=()=>{try{state=normalizeState(JSON.parse(r.result));pushState()}catch(err){alert("Invalid file")}};
  r.readAsText(e.target.files[0]);
};
 
// ---------------------------------------------------------------------------
// Current auction panel
//
// The queue tables show POSITION (who is next in line). This shows OUTCOME
// (who actually won this cycle), and keeps showing it until the cycle moves on.
//
// Reads the NEWEST history row whose cycle matches state.currentCycle.
// A history row carrying the wrong cycle makes this silently fall back to
// "first Pending" and look wrong — check the Cycle column in Auction History
// before assuming the panel is broken.
// ---------------------------------------------------------------------------
function currentRound(){
  const cyc=String(state.currentCycle);
  let row=null;
  for(let i=state.history.length-1;i>=0;i--){
    if(String(state.history[i].cycle)===cyc){row=state.history[i];break}
  }
  function describe(side){
    const up=firstPending(side);
    const idle=up?{name:up,state:"Next up",text:up}:{name:"Cycle complete",state:"",text:"Cycle complete"};
    if(!row)return idle;
    const nom=row[side+"Nom"]||"",out=row[side+"Out"]||"",rec=row[side+"Rec"]||"";
    if(rec)return {name:rec,state:"Accepted",text:`${rec} — accepted`};
    if(out==="Declined"&&nom)return {name:nom,state:"Declined",text:`${nom} declined → ${up||"cycle complete"} now next`};
    if(nom)return {name:nom,state:"Awaiting answer",text:nom};
    return idle;
  }
  return {
    high:describe("high"),
    low:describe("low"),
    upHigh:firstPending("high")||"Cycle complete",
    upLow:firstPending("low")||"Cycle complete",
    row:row
  };
}
 
// Built from the same source as the panel, so the page and the chat message
// can never disagree. Short, plain sentences — most members read this through
// a translator. "Completed" and "Declined" stay in English to match the dropdown.
function announcementText(){
  const r=currentRound();
  return [
    `RED BOX ROTATION — CYCLE ${state.currentCycle}`,
    ``,
    `Box 31: ${r.high.text}`,
    `Box 32: ${r.low.text}`,
    ``,
    `Next up`,
    `Box 31: ${r.upHigh}`,
    `Box 32: ${r.upLow}`,
    ``,
    `Buy the box, then set your status to Completed.`,
    `Do not want it? Set your status to Declined.`,
    ``,
    `https://techlchat.github.io/titans-wars-red-box-auction/`
  ].join("\n");
}
 
const copyAnnounceBtn=document.getElementById("copyAnnounceBtn");
if(copyAnnounceBtn){
  copyAnnounceBtn.onclick=()=>{
    const text=announcementText();
    const flash=()=>{
      const label=copyAnnounceBtn.textContent;
      copyAnnounceBtn.textContent="Copied \u2713";
      setTimeout(()=>{copyAnnounceBtn.textContent=label},1500);
    };
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(flash).catch(()=>prompt("Copy the message below:",text));
    } else {
      prompt("Copy the message below:",text);
    }
  };
}
