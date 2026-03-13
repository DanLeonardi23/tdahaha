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

// ===== TIMER =====
let timerRunning = false;
let timerSeconds = 0;
let timerInterval = null;

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-start-btn').textContent = 'Retomar';
    document.getElementById('timer-label').textContent = 'Em pausa';
  } else {
    timerRunning = true;
    document.getElementById('timer-start-btn').textContent = 'Pausar';
    document.getElementById('timer-label').textContent = 'Contando...';
    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
      const s = (timerSeconds % 60).toString().padStart(2, '0');
      document.getElementById('timer-display').textContent = m + ':' + s;
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 0;
  document.getElementById('timer-display').textContent = '00:00';
  document.getElementById('timer-start-btn').textContent = 'Iniciar';
  document.getElementById('timer-label').textContent = 'Pronto para começar';
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
