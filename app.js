// ===== PAGE NAVIGATION =====
function showPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  btn.classList.add('active');
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  document.getElementById('clock').textContent = h + ':' + m;
}
updateClock();
setInterval(updateClock, 1000);

// ===== TIMER (regressivo) =====
let timerRunning = false;
let timerSeconds = 0;
let timerTotal = 0;
let timerInterval = null;
let timerMuted = false;
let audioCtx = null;
let activeAlarmNodes = [];

// --- Masked input hh:mm:ss ---
// Stores only the 6 digits (no colons): [h,h,m,m,s,s]
let timerDigits = [0,0,0,0,0,0];

function renderTimerInput() {
  const d = timerDigits;
  document.getElementById('timer-set-input').value =
    d[0]+''+d[1]+':'+d[2]+''+d[3]+':'+d[4]+''+d[5];
}

function timerInputFocus() {
  // move cursor to end
  const el = document.getElementById('timer-set-input');
  setTimeout(() => { el.selectionStart = el.selectionEnd = el.value.length; }, 0);
}

function timerInputKeydown(e) {
  if (e.key === 'Enter') { setTimerFromInput(); return; }
  if (e.key === 'Backspace') {
    e.preventDefault();
    // shift digits right (clear last digit)
    timerDigits = [0, ...timerDigits.slice(0, 5)];
    renderTimerInput();
    return;
  }
  if (e.key === 'Delete') {
    e.preventDefault();
    timerDigits = [0,0,0,0,0,0];
    renderTimerInput();
    return;
  }
  // block non-numeric, allow tab/arrows
  if (!/^\d$/.test(e.key) && !['Tab','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
}

function timerInputKeyup(e) {
  if (!/^\d$/.test(e.key)) return;
  e.preventDefault();
  // shift digits left and append new digit
  timerDigits = [...timerDigits.slice(1), parseInt(e.key)];
  renderTimerInput();
}

function setTimerFromInput() {
  const h = timerDigits[0]*10 + timerDigits[1];
  const m = timerDigits[2]*10 + timerDigits[3];
  const s = timerDigits[4]*10 + timerDigits[5];
  timerTotal = h * 3600 + m * 60 + s;
  timerSeconds = timerTotal;
  updateTimerDisplay();
  document.getElementById('timer-label').textContent = timerTotal > 0 ? 'Pronto — clique em Iniciar' : 'Digite um tempo válido';
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-start-btn').textContent = 'Iniciar';
  }
}

// --- Audio ---
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTickSound() {
  if (timerMuted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  } catch(e) {}
}

function playUrgentTick() {
  if (timerMuted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 1200; osc.type = 'square';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  } catch(e) {}
}

function playAlarmSound() {
  if (timerMuted) return;
  try {
    const ctx = getAudioCtx();
    stopAlarm();
    [900,700,900,700,900].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sawtooth';
      const t = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.25);
      gain.gain.linearRampToValueAtTime(0, t + 0.32);
      osc.start(t); osc.stop(t + 0.35);
      activeAlarmNodes.push(osc);
    });
  } catch(e) {}
}

function stopAlarm() {
  activeAlarmNodes.forEach(n => { try { n.stop(); } catch(e) {} });
  activeAlarmNodes = [];
}

function toggleMute() {
  timerMuted = !timerMuted;
  document.getElementById('mute-icon-on').style.display = timerMuted ? 'none' : 'block';
  document.getElementById('mute-icon-off').style.display = timerMuted ? 'block' : 'none';
  document.getElementById('mute-btn').classList.toggle('muted', timerMuted);
  if (timerMuted) stopAlarm();
}

function applyPreset(mins) {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timer-start-btn').textContent = 'Iniciar';
  timerTotal = mins * 60;
  timerSeconds = timerTotal;
  // update masked input display
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  timerDigits = [
    Math.floor(hh/10), hh%10,
    Math.floor(mm/10), mm%10,
    0, 0
  ];
  renderTimerInput();
  updateTimerDisplay();
  document.getElementById('timer-label').textContent = 'Pronto — clique em Iniciar';
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function updateTimerDisplay() {
  const h = Math.floor(timerSeconds / 3600);
  const m = Math.floor((timerSeconds % 3600) / 60);
  const s = timerSeconds % 60;
  const display = h.toString().padStart(2,'0')+':'+m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0');
  document.getElementById('timer-display').textContent = display;
  const pct = timerTotal > 0 ? (timerSeconds / timerTotal) * 100 : 0;
  document.getElementById('timer-progress').style.width = pct + '%';
  const color = pct > 50 ? '#6BCB77' : pct > 20 ? '#FFD93D' : '#FF6B6B';
  document.getElementById('timer-progress').style.background = color;
}

function toggleTimer() {
  if (timerSeconds <= 0 && !timerRunning) return;
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-start-btn').textContent = 'Retomar';
    document.getElementById('timer-label').textContent = 'Em pausa';
  } else {
    if (timerSeconds <= 0) return;
    timerRunning = true;
    document.getElementById('timer-start-btn').textContent = 'Pausar';
    document.getElementById('timer-label').textContent = 'Contando...';
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 10 && timerSeconds > 0) playUrgentTick();
      else if (timerSeconds > 10 && timerSeconds % 60 === 0) playTickSound();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        document.getElementById('timer-start-btn').textContent = 'Iniciar';
        document.getElementById('timer-label').textContent = 'Finalizado!';
        playAlarmSound();
        showTimerAlert();
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  stopAlarm();
  timerRunning = false;
  // reset to 00:00:00
  timerTotal = 0;
  timerSeconds = 0;
  timerDigits = [0,0,0,0,0,0];
  renderTimerInput();
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('timer-progress').style.width = '0%';
  document.getElementById('timer-start-btn').textContent = 'Iniciar';
  document.getElementById('timer-label').textContent = 'Escolha um preset ou digite o tempo';
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function showTimerAlert() {
  document.getElementById('alert-muted-badge').style.display = timerMuted ? 'inline-block' : 'none';
  document.getElementById('timer-alert-overlay').style.display = 'flex';
}

function closeTimerAlert() {
  document.getElementById('timer-alert-overlay').style.display = 'none';
  stopAlarm();
  resetTimer();
}

// ===== TASKS =====
let tasks = [
  { id: 1, text: 'Responder e-mails importantes', done: false },
  { id: 2, text: 'Tomar medicação', done: true },
];

function renderTasks() {
  const list = document.getElementById('tasks-list');
  list.innerHTML = tasks.map(t => `
    <div class="task-item">
      <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})" />
      <span class="task-text ${t.done ? 'done' : ''}">${t.text}</span>
      <button class="task-del" onclick="deleteTask(${t.id})">✕</button>
    </div>
  `).join('');
  document.getElementById('stat-tasks').textContent = tasks.filter(t => t.done).length;
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) t.done = !t.done;
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
}

function showTaskInput() {
  const row = document.getElementById('task-input-row');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  if (row.style.display !== 'none') document.getElementById('task-input').focus();
}

function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, done: false });
  input.value = '';
  document.getElementById('task-input-row').style.display = 'none';
  renderTasks();
}

renderTasks();

// ===== CALENDAR =====
let calDate = new Date();
calDate.setDate(1);
let selectedDay = new Date().getDate();

let calEvents = {};

const months = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const dows = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const eventColors = ['#C77DFF','#4D96FF','#FF6B6B','#6BCB77','#FFD93D'];
let colorIdx = 0;

function renderCalendar() {
  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  document.getElementById('cal-month-label').textContent = months[m] + ' ' + y;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = dows.map(d => `<div class="cal-dow">${d}</div>`).join('');

  const first = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();

  // Previous month padding
  const prevDays = new Date(y, m, 0).getDate();
  for (let i = 0; i < first; i++) {
    grid.innerHTML += `<div class="cal-day other-month">${prevDays - first + i + 1}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const key = y + '-' + (m + 1) + '-' + d;
    const isToday = today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;
    const isSel = selectedDay === d;
    const hasEv = !!calEvents[key] && calEvents[key].length > 0;

    let classes = 'cal-day';
    if (isToday) classes += ' today';
    if (isSel && !isToday) classes += ' selected';
    if (hasEv) classes += ' has-event';

    grid.innerHTML += `<div class="${classes}" onclick="selectDay(${d})">${d}</div>`;
  }

  renderCalEvents();
}

function selectDay(d) {
  selectedDay = d;
  renderCalendar();
}

function changeMonth(dir) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
  renderCalendar();
}

function renderCalEvents() {
  const y = calDate.getFullYear();
  const m = calDate.getMonth() + 1;
  const key = y + '-' + m + '-' + selectedDay;
  document.getElementById('cal-day-label').textContent = 'Dia ' + selectedDay + ' — Eventos';
  const list = document.getElementById('cal-events-list');
  const evs = calEvents[key] || [];
  list.innerHTML = evs.length
    ? evs.map(e => `
        <div class="cal-event-item">
          <div class="cal-event-dot" style="background:${e.color}"></div>
          <span>${e.text}</span>
        </div>
      `).join('')
    : '<div style="font-size:12px;color:var(--muted);font-weight:600;">Nenhum evento</div>';
}

function addCalEvent() {
  const input = document.getElementById('cal-event-input');
  const text = input.value.trim();
  if (!text) return;
  const y = calDate.getFullYear();
  const m = calDate.getMonth() + 1;
  const key = y + '-' + m + '-' + selectedDay;
  if (!calEvents[key]) calEvents[key] = [];
  calEvents[key].push({ text, color: eventColors[colorIdx++ % eventColors.length] });
  input.value = '';
  renderCalendar();
}

renderCalendar();

// ===== REMINDERS =====
let reminders = [
  { id: 1, text: 'Beber água', time: '10:00', color: '#6BCB77' },
  { id: 2, text: 'Respirar fundo 5x', time: '14:30', color: '#4D96FF' },
];

const reminderColors = ['#6BCB77', '#4D96FF', '#FF6B6B', '#C77DFF', '#FFD93D'];
let remColorIdx = 2;

function renderReminders() {
  const list = document.getElementById('reminder-list');
  list.innerHTML = reminders.map(r => `
    <div class="reminder-item">
      <div class="reminder-icon" style="background:${r.color}">!</div>
      <div>
        <div class="reminder-text">${r.text}</div>
        ${r.time ? `<div class="reminder-time-tag">${r.time}</div>` : ''}
      </div>
      <button class="reminder-del" onclick="deleteReminder(${r.id})">✕</button>
    </div>
  `).join('');
  document.getElementById('stat-reminders').textContent = reminders.length;
}

function deleteReminder(id) {
  reminders = reminders.filter(r => r.id !== id);
  renderReminders();
}

function addReminder() {
  const input = document.getElementById('reminder-input');
  const time = document.getElementById('reminder-time').value;
  const text = input.value.trim();
  if (!text) return;
  reminders.unshift({
    id: Date.now(),
    text,
    time,
    color: reminderColors[remColorIdx++ % reminderColors.length]
  });
  input.value = '';
  document.getElementById('reminder-time').value = '';
  renderReminders();
}

renderReminders();

// ===== NOTES =====
let notes = [
  {
    id: 1,
    title: 'Ideia de App',
    content: 'Criar um app de produtividade para pessoas com TDAH...',
    date: formatDate(new Date())
  }
];
let currentNoteId = null;

function formatDate(d) {
  return d.getDate().toString().padStart(2, '0') + '/' +
    (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
    d.getFullYear();
}

function renderNotesSidebar() {
  const sidebar = document.getElementById('notes-sidebar');
  sidebar.innerHTML = notes.map(n => `
    <div class="note-card-mini ${currentNoteId === n.id ? 'active' : ''}" onclick="openNote(${n.id})">
      <div class="note-mini-title">${n.title || 'Sem título'}</div>
      <div class="note-mini-preview">${n.content ? n.content.substring(0, 40) + '...' : 'Vazio'}</div>
      <div class="note-mini-date">${n.date}</div>
    </div>
  `).join('');
}

function openNote(id) {
  currentNoteId = id;
  const n = notes.find(n => n.id === id);
  document.getElementById('empty-notes').style.display = 'none';
  document.getElementById('note-title').style.display = 'block';
  document.getElementById('note-content').style.display = 'block';
  document.getElementById('note-footer').style.display = 'flex';
  document.getElementById('note-title').value = n.title;
  document.getElementById('note-content').value = n.content;
  updateCharCount();
  renderNotesSidebar();
}

function newNote() {
  const n = { id: Date.now(), title: '', content: '', date: formatDate(new Date()) };
  notes.unshift(n);
  openNote(n.id);
  renderNotesSidebar();
  document.getElementById('note-title').focus();
}

function saveNote() {
  const n = notes.find(n => n.id === currentNoteId);
  if (!n) return;
  n.title = document.getElementById('note-title').value;
  n.content = document.getElementById('note-content').value;
  renderNotesSidebar();
  alert('Ideia salva! 💡');
}

function deleteNote() {
  if (!confirm('Apagar esta ideia?')) return;
  notes = notes.filter(n => n.id !== currentNoteId);
  currentNoteId = null;
  document.getElementById('empty-notes').style.display = 'flex';
  document.getElementById('note-title').style.display = 'none';
  document.getElementById('note-content').style.display = 'none';
  document.getElementById('note-footer').style.display = 'none';
  renderNotesSidebar();
}

function updateNotePreview() {
  updateCharCount();
}

function updateCharCount() {
  const c = (document.getElementById('note-content').value || '').length;
  document.getElementById('char-count').textContent = c + ' caractere' + (c !== 1 ? 's' : '');
}

renderNotesSidebar();
if (notes.length > 0) openNote(notes[0].id);
