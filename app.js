// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection,
  query, where, getDocs, addDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrE8C3sWDB0DWaVnI2sZeTnhVrcFqtBCk",
  authDomain: "tdahaha-6b9bf.firebaseapp.com",
  projectId: "tdahaha-6b9bf",
  storageBucket: "tdahaha-6b9bf.firebasestorage.app",
  messagingSenderId: "225924896771",
  appId: "1:225924896771:web:f62976b312d239f7ce9636"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ===== STATE =====
let currentUser = null;   // { uid, username }
let otherUser   = null;   // { uid, username } — the other registered user
let calEvents   = {};     // local cache: key -> [events]
let unsubInvites = null;  // Firestore listener

// ===== THEME =====
function toggleTheme() {
  const isDark = document.body.classList.toggle("dark");
  document.getElementById("theme-icon-moon").style.display = isDark ? "none" : "";
  document.getElementById("theme-icon-sun").style.display  = isDark ? "" : "none";
  localStorage.setItem("tdahaha-theme", isDark ? "dark" : "light");
}
(function() {
  if (localStorage.getItem("tdahaha-theme") === "dark") {
    document.body.classList.add("dark");
    document.getElementById("theme-icon-moon").style.display = "none";
    document.getElementById("theme-icon-sun").style.display  = "";
  }
})();
window.toggleTheme = toggleTheme;

// ===== AUTH SCREENS =====
function showLogin() {
  document.getElementById("register-screen").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
}
function showRegister() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("register-screen").style.display = "flex";
}
window.showLogin    = showLogin;
window.showRegister = showRegister;

// Simple hash (not crypto-safe, but functional for this scope)
async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function doLogin() {
  const username = document.getElementById("login-username").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("login-error");
  errEl.textContent = "";

  if (!username || !password) { errEl.textContent = "Preencha todos os campos."; return; }

  const hash = await hashPassword(password);
  const userRef = doc(db, "users", username);
  const snap = await getDoc(userRef);

  if (!snap.exists()) { errEl.textContent = "Usuário não encontrado."; return; }
  if (snap.data().passwordHash !== hash) { errEl.textContent = "Senha incorreta."; return; }

  currentUser = { uid: username, username: snap.data().displayName || username };
  localStorage.setItem("tdahaha-session", username);
  await startApp();
}
window.doLogin = doLogin;

async function doRegister() {
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const password2= document.getElementById("reg-password2").value;
  const errEl    = document.getElementById("reg-error");
  errEl.textContent = "";

  if (!username || !password) { errEl.textContent = "Preencha todos os campos."; return; }
  if (username.length < 3)    { errEl.textContent = "Nome deve ter pelo menos 3 caracteres."; return; }
  if (password.length < 4)    { errEl.textContent = "Senha deve ter pelo menos 4 caracteres."; return; }
  if (password !== password2) { errEl.textContent = "As senhas não coincidem."; return; }

  const userRef = doc(db, "users", username);
  const snap = await getDoc(userRef);
  if (snap.exists()) { errEl.textContent = "Este nome já está em uso."; return; }

  const hash = await hashPassword(password);
  await setDoc(userRef, { passwordHash: hash, displayName: username, createdAt: serverTimestamp() });

  currentUser = { uid: username, username };
  localStorage.setItem("tdahaha-session", username);
  await startApp();
}
window.doRegister = doRegister;

async function doLogout() {
  localStorage.removeItem("tdahaha-session");
  if (unsubInvites) unsubInvites();
  currentUser = null;
  otherUser   = null;
  calEvents   = {};
  document.getElementById("main-app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
}
window.doLogout = doLogout;

// ===== APP START =====
async function startApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("register-screen").style.display = "none";
  document.getElementById("main-app").style.display = "flex";
  document.getElementById("nav-user").textContent = currentUser.username;

  // Find the other user
  await loadOtherUser();

  // Load this user's events from Firestore
  await loadCalEvents();

  // Listen for pending invites in real time
  listenInvites();

  // Init all local modules
  initLocalModules();

  // Check day-before alerts
  checkEventAlerts();
}

async function loadOtherUser() {
  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach(d => {
    if (d.id !== currentUser.uid) {
      otherUser = { uid: d.id, username: d.data().displayName || d.id };
    }
  });
  if (otherUser) {
    document.getElementById("cal-share-row").style.display = "flex";
    document.getElementById("other-user-name").textContent = otherUser.username;
  }
}

// ===== FIRESTORE: EVENTS =====
async function loadCalEvents() {
  calEvents = {};
  const q = query(collection(db, "events"), where("ownerUid", "==", currentUser.uid));
  const snap = await getDocs(q);
  snap.forEach(d => {
    const ev = { ...d.data(), firestoreId: d.id };
    if (!calEvents[ev.dateKey]) calEvents[ev.dateKey] = [];
    calEvents[ev.dateKey].push(ev);
  });
  renderCalendar();
}

async function saveEventToFirestore(ev) {
  const docRef = await addDoc(collection(db, "events"), ev);
  return docRef.id;
}

async function deleteEventFromFirestore(firestoreId) {
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(db, "events", firestoreId));
}

// ===== FIRESTORE: INVITES =====
function listenInvites() {
  if (unsubInvites) unsubInvites();
  const q = query(
    collection(db, "invites"),
    where("toUid", "==", currentUser.uid),
    where("status", "==", "pending")
  );
  unsubInvites = onSnapshot(q, snap => {
    const count = snap.size;
    const btn   = document.getElementById("invite-badge-btn");
    document.getElementById("invite-badge-count").textContent = count;
    btn.style.display = count > 0 ? "flex" : "none";
  });
}

// In-memory store for pending invites — avoids JSON-in-onclick issues
let pendingInvitesCache = {};

async function openPendingInvites() {
  const q = query(
    collection(db, "invites"),
    where("toUid",  "==", currentUser.uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const list = document.getElementById("invite-panel-list");
  list.innerHTML = "";
  pendingInvitesCache = {};

  if (snap.empty) {
    list.innerHTML = '<div class="invite-empty">Nenhum convite pendente.</div>';
  } else {
    snap.forEach(d => {
      const inv = { ...d.data(), id: d.id };
      // Store in memory — referenced by id from button clicks
      pendingInvitesCache[inv.id] = inv;

      const isEdit = inv.type === "edit";
      const card = document.createElement("div");
      card.className = "invite-card rel-" + (inv.event.relevance || "green");

      const timeStr = inv.event.time ? " · ⏰ " + inv.event.time : "";
      const obsHtml = inv.event.obs
        ? `<div class="invite-event-obs">${inv.event.obs}</div>` : "";

      card.innerHTML =
        `<div class="invite-card-from">${isEdit ? "✏️ Edição de" : "📅 Convite de"} <strong>${inv.fromUsername}</strong></div>
        <div class="invite-card-event">
          <div class="invite-event-name">${inv.event.text}</div>
          <div class="invite-event-date">📆 ${formatDateKey(inv.event.dateKey)}${timeStr}</div>
          ${obsHtml}
        </div>
        <div class="invite-card-actions">
          <button class="invite-accept-btn" data-id="${inv.id}">✓ Aceitar</button>
          <button class="invite-reject-btn" data-id="${inv.id}">✕ Recusar</button>
        </div>`;

      // Attach listeners directly — no inline JSON
      card.querySelector(".invite-accept-btn").addEventListener("click", () => {
        respondInvite(inv.id, "accepted");
      });
      card.querySelector(".invite-reject-btn").addEventListener("click", () => {
        respondInvite(inv.id, "rejected");
      });

      list.appendChild(card);
    });
  }

  document.getElementById("invite-overlay").style.display = "flex";
}
window.openPendingInvites = openPendingInvites;

function closeInviteOverlay() {
  document.getElementById("invite-overlay").style.display = "none";
}
window.closeInviteOverlay = closeInviteOverlay;

async function respondInvite(inviteId, status) {
  console.log("[respondInvite] chamado:", inviteId, status);
  try {
  await updateDoc(doc(db, "invites", inviteId), { status });

  if (status === "accepted") {
    const inv = pendingInvitesCache[inviteId];
    if (inv) {
      const ev = inv.event;
      const firestoreId = await saveEventToFirestore({
        ownerUid:   currentUser.uid,
        dateKey:    ev.dateKey,
        text:       ev.text,
        time:       ev.time      || "",
        obs:        ev.obs       || "",
        relevance:  ev.relevance || "green",
        notify:     ev.notify    || false,
        sharedFrom: inv.fromUsername,
        createdAt:  serverTimestamp()
      });
      if (!calEvents[ev.dateKey]) calEvents[ev.dateKey] = [];
      calEvents[ev.dateKey].push({ ...ev, ownerUid: currentUser.uid, firestoreId });
      renderCalendar();
    }
  }

  delete pendingInvitesCache[inviteId];
  closeInviteOverlay();
  await openPendingInvites();
  } catch(err) {
    console.error("[respondInvite] ERRO:", err);
    alert("Erro ao processar convite: " + err.message);
  }
}
window.respondInvite = respondInvite;

function formatDateKey(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-");
  return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
}

// ===== PAGE / CLOCK =====
function showPage(page, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  btn.classList.add("active");
}
window.showPage = showPage;

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.getHours().toString().padStart(2,"0") + ":" +
    now.getMinutes().toString().padStart(2,"0");
}
updateClock();
setInterval(updateClock, 1000);

// ===== TIMER =====
let timerRunning=false,timerSeconds=0,timerTotal=0,timerInterval=null,timerMuted=false;
let audioCtx=null,activeAlarmNodes=[];
let timerDigits=[0,0,0,0,0,0];

function renderTimerInput(){
  const d=timerDigits;
  document.getElementById("timer-set-input").value=d[0]+""+d[1]+":"+d[2]+""+d[3]+":"+d[4]+""+d[5];
}
function timerInputFocus(){const el=document.getElementById("timer-set-input");setTimeout(()=>{el.selectionStart=el.selectionEnd=el.value.length;},0);}
function timerInputKeydown(e){
  if(e.key==="Enter"){setTimerFromInput();return;}
  if(e.key==="Backspace"){e.preventDefault();timerDigits=[0,...timerDigits.slice(0,5)];renderTimerInput();return;}
  if(e.key==="Delete"){e.preventDefault();timerDigits=[0,0,0,0,0,0];renderTimerInput();return;}
  if(!/^\d$/.test(e.key)&&!["Tab","ArrowLeft","ArrowRight"].includes(e.key))e.preventDefault();
}
function timerInputKeyup(e){
  if(!/^\d$/.test(e.key))return;
  timerDigits=[...timerDigits.slice(1),parseInt(e.key)];
  renderTimerInput();
}
function setTimerFromInput(){
  const h=timerDigits[0]*10+timerDigits[1],m=timerDigits[2]*10+timerDigits[3],s=timerDigits[4]*10+timerDigits[5];
  timerTotal=h*3600+m*60+s;timerSeconds=timerTotal;
  updateTimerDisplay();
  document.getElementById("timer-label").textContent=timerTotal>0?"Pronto — clique em Iniciar":"Digite um tempo válido";
  document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));
  if(timerRunning){clearInterval(timerInterval);timerRunning=false;document.getElementById("timer-start-btn").textContent="Iniciar";}
}
function getAudioCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function playTickSound(){if(timerMuted)return;try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;o.type="sine";g.gain.setValueAtTime(0.06,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08);o.start(c.currentTime);o.stop(c.currentTime+0.08);}catch(e){}}
function playUrgentTick(){if(timerMuted)return;try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=1200;o.type="square";g.gain.setValueAtTime(0.1,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);o.start(c.currentTime);o.stop(c.currentTime+0.1);}catch(e){}}
function playAlarmSound(){if(timerMuted)return;try{const c=getAudioCtx();stopAlarm();[900,700,900,700,900].forEach((freq,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=freq;o.type="sawtooth";const t=c.currentTime+i*0.35;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.25,t+0.05);g.gain.linearRampToValueAtTime(0.2,t+0.25);g.gain.linearRampToValueAtTime(0,t+0.32);o.start(t);o.stop(t+0.35);activeAlarmNodes.push(o);});}catch(e){}}
function stopAlarm(){activeAlarmNodes.forEach(n=>{try{n.stop();}catch(e){}});activeAlarmNodes=[];}
function toggleMute(){timerMuted=!timerMuted;document.getElementById("mute-icon-on").style.display=timerMuted?"none":"block";document.getElementById("mute-icon-off").style.display=timerMuted?"block":"none";document.getElementById("mute-btn").classList.toggle("muted",timerMuted);if(timerMuted)stopAlarm();}
function applyPreset(mins){
  clearInterval(timerInterval);timerRunning=false;
  document.getElementById("timer-start-btn").textContent="Iniciar";
  timerTotal=mins*60;timerSeconds=timerTotal;
  const hh=Math.floor(mins/60),mm=mins%60;
  timerDigits=[Math.floor(hh/10),hh%10,Math.floor(mm/10),mm%10,0,0];
  renderTimerInput();updateTimerDisplay();
  document.getElementById("timer-label").textContent="Pronto — clique em Iniciar";
  document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));
  event.target.classList.add("active");
}
function updateTimerDisplay(){
  const h=Math.floor(timerSeconds/3600),m=Math.floor((timerSeconds%3600)/60),s=timerSeconds%60;
  document.getElementById("timer-display").textContent=h.toString().padStart(2,"0")+":"+m.toString().padStart(2,"0")+":"+s.toString().padStart(2,"0");
  const pct=timerTotal>0?(timerSeconds/timerTotal)*100:0;
  document.getElementById("timer-progress").style.width=pct+"%";
  document.getElementById("timer-progress").style.background=pct>50?"#6BCB77":pct>20?"#FFD93D":"#FF6B6B";
}
function toggleTimer(){
  if(timerSeconds<=0&&!timerRunning)return;
  if(timerRunning){clearInterval(timerInterval);timerRunning=false;document.getElementById("timer-start-btn").textContent="Retomar";document.getElementById("timer-label").textContent="Em pausa";}
  else{
    if(timerSeconds<=0)return;
    timerRunning=true;document.getElementById("timer-start-btn").textContent="Pausar";document.getElementById("timer-label").textContent="Contando...";
    timerInterval=setInterval(()=>{
      timerSeconds--;updateTimerDisplay();
      if(timerSeconds<=10&&timerSeconds>0)playUrgentTick();
      else if(timerSeconds>10&&timerSeconds%60===0)playTickSound();
      if(timerSeconds<=0){clearInterval(timerInterval);timerRunning=false;document.getElementById("timer-start-btn").textContent="Iniciar";document.getElementById("timer-label").textContent="Finalizado!";playAlarmSound();showTimerAlert();}
    },1000);
  }
}
function resetTimer(){clearInterval(timerInterval);stopAlarm();timerRunning=false;timerTotal=0;timerSeconds=0;timerDigits=[0,0,0,0,0,0];renderTimerInput();document.getElementById("timer-display").textContent="00:00:00";document.getElementById("timer-progress").style.width="0%";document.getElementById("timer-start-btn").textContent="Iniciar";document.getElementById("timer-label").textContent="Escolha um preset ou digite o tempo";document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));}
function showTimerAlert(){document.getElementById("alert-muted-badge").style.display=timerMuted?"inline-block":"none";document.getElementById("timer-alert-overlay").style.display="flex";}
function closeTimerAlert(){document.getElementById("timer-alert-overlay").style.display="none";stopAlarm();resetTimer();}

window.timerInputFocus=timerInputFocus;window.timerInputKeydown=timerInputKeydown;window.timerInputKeyup=timerInputKeyup;
window.setTimerFromInput=setTimerFromInput;window.applyPreset=applyPreset;window.toggleTimer=toggleTimer;
window.resetTimer=resetTimer;window.toggleMute=toggleMute;window.closeTimerAlert=closeTimerAlert;

// ===== TASKS (local) =====
let tasks=[],totalDone=0;
function renderTasks(){
  const list = document.getElementById("tasks-list");
  list.innerHTML = "";
  tasks.forEach(t => {
    const div = document.createElement("div");
    div.className = "task-item";
    div.innerHTML =
      `<input type="checkbox" class="task-check" ${t.done?"checked":""}/>` +
      `<span class="task-text ${t.done?"done":""}">${t.text}</span>` +
      `<button class="task-del">✕</button>`;
    div.querySelector(".task-check").addEventListener("change", () => toggleTask(t.id));
    div.querySelector(".task-del").addEventListener("click",   () => deleteTask(t.id));
    list.appendChild(div);
  });
  document.getElementById("stat-tasks").textContent=totalDone;
  localStorage.setItem("tdahaha-tasks-"+currentUser?.uid, JSON.stringify({tasks,totalDone}));
}
function toggleTask(id){const t=tasks.find(t=>t.id===id);if(!t)return;const was=t.done;t.done=!t.done;if(!was&&t.done)totalDone++;renderTasks();}
function deleteTask(id){tasks=tasks.filter(t=>t.id!==id);renderTasks();}
function addTask(){const inp=document.getElementById("task-input"),text=inp.value.trim();if(!text)return;tasks.push({id:Date.now(),text,done:false});inp.value="";renderTasks();}
function clearDoneTasks(){tasks=tasks.filter(t=>!t.done);renderTasks();}
window.toggleTask=toggleTask;window.deleteTask=deleteTask;window.addTask=addTask;window.clearDoneTasks=clearDoneTasks;

// ===== CALENDAR =====
let calDate=new Date();calDate.setDate(1);
let selectedDay=new Date().getDate();
let currentRelevance="green";

const months=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const dows=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const relevanceColor={green:"#6BCB77",yellow:"#FFD93D",red:"#FF6B6B"};

function setRelevance(rel){
  currentRelevance=rel;
  ["green","yellow","red"].forEach(r=>document.getElementById("rel-"+r).classList.toggle("active",r===rel));
}
window.setRelevance=setRelevance;

function renderCalendar(){
  const y=calDate.getFullYear(),m=calDate.getMonth();
  document.getElementById("cal-month-label").textContent=months[m]+" "+y;
  const grid=document.getElementById("cal-grid");
  grid.innerHTML=dows.map(d=>`<div class="cal-dow">${d}</div>`).join("");
  const first=new Date(y,m,1).getDay(),daysInMonth=new Date(y,m+1,0).getDate();
  const today=new Date(),prevDays=new Date(y,m,0).getDate();
  for(let i=0;i<first;i++) grid.innerHTML+=`<div class="cal-day other-month">${prevDays-first+i+1}</div>`;
  for(let d=1;d<=daysInMonth;d++){
    const key=y+"-"+(m+1)+"-"+d;
    const isToday=today.getDate()===d&&today.getMonth()===m&&today.getFullYear()===y;
    const isSel=selectedDay===d;
    const evs=calEvents[key]||[];
    let cls="cal-day";
    if(isToday)cls+=" today";
    if(isSel&&!isToday)cls+=" selected";
    let dots="";
    if(evs.length>0){
      dots='<div class="cal-dots">'+evs.slice(0,3).map(e=>`<div class="cal-dot" style="background:${relevanceColor[e.relevance]||"#ccc"}"></div>`).join("")+"</div>";
    }
    const dayDiv = document.createElement("div");
    dayDiv.className = cls;
    dayDiv.innerHTML = d + dots;
    dayDiv.addEventListener("click", ((day) => () => selectDay(day))(d));
    grid.appendChild(dayDiv);
  }
  renderCalEvents();
}

function selectDay(d){selectedDay=d;renderCalendar();}
function changeMonth(dir){calDate=new Date(calDate.getFullYear(),calDate.getMonth()+dir,1);renderCalendar();}
window.selectDay=selectDay;window.changeMonth=changeMonth;

function toggleCalEvents() {
  const card   = document.querySelector('.calendar-card');
  const grid   = document.getElementById('cal-grid');
  const header = document.querySelector('.cal-header');
  const addBlock = document.querySelector('.cal-add-block');
  const icon   = document.getElementById('cal-collapse-icon');

  const isMin = card.classList.toggle('cal-minimized');

  // minimized = hide grid + header nav + input form, show only events list
  grid.style.display     = isMin ? 'none' : '';
  addBlock.style.display = isMin ? 'none' : '';
  // hide nav arrows but keep month label + collapse btn
  header.querySelectorAll('.cal-nav').forEach(b => b.style.display = isMin ? 'none' : '');

  icon.style.transform = isMin ? 'rotate(180deg)' : 'rotate(0deg)';
  localStorage.setItem('tdahaha-cal-minimized', isMin ? '1' : '0');
}
window.toggleCalEvents = toggleCalEvents;

function restoreCalState() {
  if (localStorage.getItem('tdahaha-cal-minimized') === '1') {
    const card     = document.querySelector('.calendar-card');
    const grid     = document.getElementById('cal-grid');
    const header   = document.querySelector('.cal-header');
    const addBlock = document.querySelector('.cal-add-block');
    const icon     = document.getElementById('cal-collapse-icon');
    if (!card) return;
    card.classList.add('cal-minimized');
    grid.style.display     = 'none';
    addBlock.style.display = 'none';
    header.querySelectorAll('.cal-nav').forEach(b => b.style.display = 'none');
    icon.style.transform   = 'rotate(180deg)';
  }
}

function renderCalEvents(){
  const y=calDate.getFullYear(),m=calDate.getMonth()+1;
  const key=y+"-"+m+"-"+selectedDay;
  document.getElementById("cal-day-label").textContent="Dia "+selectedDay+" — "+months[calDate.getMonth()];
  const list=document.getElementById("cal-events-list");
  const evs=calEvents[key]||[];
  if(!evs.length){list.innerHTML='<div class="cal-empty">Nenhum evento neste dia</div>';return;}
  list.innerHTML = "";
  evs.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "cal-event-item rel-" + e.relevance;
    const bellIcon  = e.notify ? "🔔 " : "";
    const sharedTag = e.sharedFrom
      ? `<span class="ev-shared-tag">de ${e.sharedFrom}</span> ` : "";
    const timeHtml  = e.time ? `<div class="cal-event-time-tag">⏰ ${e.time}</div>` : "";
    const obsHtml   = e.obs  ? `<div class="cal-event-obs-text">${e.obs}</div>`  : "";
    div.innerHTML =
      `<div class="cal-event-body">` +
        `<div class="cal-event-name">${bellIcon}${sharedTag}${e.text}</div>` +
        timeHtml + obsHtml +
      `</div>` +
      `<button class="cal-event-del">✕</button>`;
    div.querySelector(".cal-event-del").addEventListener("click", () => deleteCalEvent(key, i));
    list.appendChild(div);
  });
}

async function deleteCalEvent(key,idx){
  const ev=calEvents[key][idx];
  if(ev.firestoreId) await deleteEventFromFirestore(ev.firestoreId);
  calEvents[key].splice(idx,1);
  renderCalendar();
}
window.deleteCalEvent=deleteCalEvent;

async function addCalEvent(){
  const text=document.getElementById("cal-event-input").value.trim();
  if(!text)return;
  const time=document.getElementById("cal-event-time").value;
  const obs=document.getElementById("cal-event-obs").value.trim();
  const notify=document.getElementById("cal-notify-check").checked;
  const share=document.getElementById("cal-share-check").checked;
  const y=calDate.getFullYear(),m=calDate.getMonth()+1;
  const key=y+"-"+m+"-"+selectedDay;

  const evData={
    ownerUid:   currentUser.uid,
    dateKey:    key,
    text, time, obs,
    relevance:  currentRelevance,
    notify,
    createdAt:  serverTimestamp()
  };

  const firestoreId = await saveEventToFirestore(evData);
  const localEv = { text, time, obs, relevance: currentRelevance, notify, firestoreId, dateKey: key };

  if(!calEvents[key]) calEvents[key]=[];
  calEvents[key].push(localEv);

  // Send invite if share checked and other user exists
  if(share && otherUser){
    await addDoc(collection(db,"invites"),{
      fromUid:      currentUser.uid,
      fromUsername: currentUser.username,
      toUid:        otherUser.uid,
      type:         "new",
      status:       "pending",
      event:        { text, time, obs, relevance: currentRelevance, notify, dateKey: key },
      createdAt:    serverTimestamp()
    });
  }

  document.getElementById("cal-event-input").value="";
  document.getElementById("cal-event-time").value="";
  document.getElementById("cal-event-obs").value="";
  document.getElementById("cal-notify-check").checked=false;
  document.getElementById("cal-share-check").checked=false;
  renderCalendar();
}
window.addCalEvent=addCalEvent;

// ===== EVENT DAY-BEFORE ALERTS =====
function getTomorrowKey(){
  const t=new Date();t.setDate(t.getDate()+1);
  return t.getFullYear()+"-"+(t.getMonth()+1)+"-"+t.getDate();
}
function checkEventAlerts(){
  const key=getTomorrowKey();
  const evs=(calEvents[key]||[]).filter(e=>e.notify);
  if(!evs.length)return;
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const label=tomorrow.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
  document.getElementById("event-alert-list").innerHTML=evs.map(e=>`
    <div class="event-alert-item rel-${e.relevance}">
      <div class="event-alert-body">
        <div class="event-alert-name">${e.text}</div>
        ${e.time?`<div class="event-alert-time">⏰ ${e.time}</div>`:""}
        ${e.obs?`<div class="event-alert-obs">${e.obs}</div>`:""}
      </div>
    </div>`).join("");
  document.querySelector(".event-alert-title").textContent="Amanhã — "+label;
  document.getElementById("event-alert-overlay").style.display="flex";
}
function closeEventAlerts(){document.getElementById("event-alert-overlay").style.display="none";}
window.closeEventAlerts=closeEventAlerts;

// ===== REMINDERS (local) =====
let reminders=[],remColorIdx=0;
const reminderColors=["#6BCB77","#4D96FF","#FF6B6B","#C77DFF","#FFD93D"];

function renderReminders(){
  const list = document.getElementById("reminder-list");
  list.innerHTML = "";
  reminders.forEach(r => {
    const div = document.createElement("div");
    div.className = "reminder-item";
    const timeHtml = r.time ? `<div class="reminder-time-tag">${r.time}</div>` : "";
    div.innerHTML =
      `<div class="reminder-icon" style="background:${r.color}">!</div>` +
      `<div><div class="reminder-text">${r.text}</div>${timeHtml}</div>` +
      `<button class="reminder-del">✕</button>`;
    div.querySelector(".reminder-del").addEventListener("click", () => deleteReminder(r.id));
    list.appendChild(div);
  });
  document.getElementById("stat-reminders").textContent=reminders.length;
  localStorage.setItem("tdahaha-reminders-"+currentUser?.uid, JSON.stringify(reminders));
}
function deleteReminder(id){reminders=reminders.filter(r=>r.id!==id);renderReminders();}
function addReminder(){
  const inp=document.getElementById("reminder-input"),time=document.getElementById("reminder-time").value,text=inp.value.trim();
  if(!text)return;
  reminders.unshift({id:Date.now(),text,time,color:reminderColors[remColorIdx++%reminderColors.length]});
  inp.value="";document.getElementById("reminder-time").value="";
  renderReminders();
}
window.deleteReminder=deleteReminder;window.addReminder=addReminder;

// ===== NOTES (local) =====
let notes=[],currentNoteId=null;
function formatDate(d){return d.getDate().toString().padStart(2,"0")+"/"+(d.getMonth()+1).toString().padStart(2,"0")+"/"+d.getFullYear();}
function renderNotesSidebar(){
  const sidebar = document.getElementById("notes-sidebar");
  sidebar.innerHTML = "";
  notes.forEach(n => {
    const div = document.createElement("div");
    div.className = "note-card-mini" + (currentNoteId === n.id ? " active" : "");
    div.innerHTML =
      `<div class="note-mini-title">${n.title||"Sem título"}</div>` +
      `<div class="note-mini-preview">${n.content ? n.content.substring(0,40)+"..." : "Vazio"}</div>` +
      `<div class="note-mini-date">${n.date}</div>`;
    div.addEventListener("click", () => openNote(n.id));
    sidebar.appendChild(div);
  });
}
function openNote(id){
  currentNoteId=id;const n=notes.find(n=>n.id===id);
  document.getElementById("empty-notes").style.display="none";
  document.getElementById("note-title").style.display="block";
  document.getElementById("note-content").style.display="block";
  document.getElementById("note-footer").style.display="flex";
  document.getElementById("note-title").value=n.title;
  document.getElementById("note-content").value=n.content;
  updateCharCount();renderNotesSidebar();
}
function newNote(){const n={id:Date.now(),title:"",content:"",date:formatDate(new Date())};notes.unshift(n);openNote(n.id);renderNotesSidebar();document.getElementById("note-title").focus();}
function saveNote(){
  const n=notes.find(n=>n.id===currentNoteId);if(!n)return;
  n.title=document.getElementById("note-title").value;
  n.content=document.getElementById("note-content").value;
  renderNotesSidebar();
  localStorage.setItem("tdahaha-notes-"+currentUser?.uid, JSON.stringify(notes));
  alert("Ideia salva! 💡");
}
function deleteNote(){
  if(!confirm("Apagar esta ideia?"))return;
  notes=notes.filter(n=>n.id!==currentNoteId);currentNoteId=null;
  document.getElementById("empty-notes").style.display="flex";
  ["note-title","note-content"].forEach(id=>document.getElementById(id).style.display="none");
  document.getElementById("note-footer").style.display="none";
  renderNotesSidebar();
  localStorage.setItem("tdahaha-notes-"+currentUser?.uid, JSON.stringify(notes));
}
function updateNotePreview(){updateCharCount();}
function updateCharCount(){const c=(document.getElementById("note-content").value||"").length;document.getElementById("char-count").textContent=c+" caractere"+(c!==1?"s":"");}
window.openNote=openNote;window.newNote=newNote;window.saveNote=saveNote;window.deleteNote=deleteNote;window.updateNotePreview=updateNotePreview;

// ===== INIT LOCAL MODULES =====
function initLocalModules(){
  // Restore local data per user
  const uid = currentUser.uid;

  const savedTasks = localStorage.getItem("tdahaha-tasks-"+uid);
  if(savedTasks){ const p=JSON.parse(savedTasks);tasks=p.tasks||[];totalDone=p.totalDone||0; }
  else { tasks=[]; totalDone=0; }
  renderTasks();

  const savedRem = localStorage.getItem("tdahaha-reminders-"+uid);
  reminders = savedRem ? JSON.parse(savedRem) : [];
  renderReminders();

  const savedNotes = localStorage.getItem("tdahaha-notes-"+uid);
  notes = savedNotes ? JSON.parse(savedNotes) : [];
  renderNotesSidebar();
  if(notes.length>0) openNote(notes[0].id);
  restoreCalState();
}

// ===== AUTO-LOGIN =====
(async function autoLogin(){
  const saved = localStorage.getItem("tdahaha-session");
  if(!saved) return;
  const snap = await getDoc(doc(db,"users",saved));
  if(!snap.exists()){ localStorage.removeItem("tdahaha-session"); return; }
  currentUser = { uid: saved, username: snap.data().displayName || saved };
  await startApp();
})();
