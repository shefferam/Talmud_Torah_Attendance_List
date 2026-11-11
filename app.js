const STORAGE = {
  students: "tt_students",
  attendance: "tt_attendance",
  notes: "tt_notes",
  email: "tt_email",
  seeded: "tt_seeded"
};

let students = JSON.parse(localStorage.getItem(STORAGE.students) || "[]");
let attendance = JSON.parse(localStorage.getItem(STORAGE.attendance) || "{}");
let notes = JSON.parse(localStorage.getItem(STORAGE.notes) || "{}");

const DEFAULT_STUDENTS = [
  "שקד עובד", "אלון עובד", "אורי ניסן", "נטע פלורסהיים", "רועי שטיין",
  "אחיה ארנרייך", "איתמר אבנר", "רותם גוטמן", "בניה דלוי", "יהל לוי",
  "הלל גלס", "אופק טאובר", "רונה חכים", "יאיר חפץ", "אורי אליצור",
  "נויה נגר", "נעמי שפר"
];

// Seed only once so deleted defaults don't reappear
if (!localStorage.getItem(STORAGE.seeded)) {
  DEFAULT_STUDENTS.forEach((name, i) => {
    if (!students.some(s => s.name === name)) students.push({ id: "default_" + i, name });
  });
  localStorage.setItem(STORAGE.students, JSON.stringify(students));
  localStorage.setItem(STORAGE.seeded, "1");
}

const $ = id => document.getElementById(id);
const dateInput = $("dateInput");
let currentView = "attendance";

/* ---------- Dates ---------- */

function todayStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatShort(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function weekdayName(iso) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(parseIso(iso));
}

function hebrewNumeral(n) {
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש"];
  let s = "";
  while (n >= 400) { s += "ת"; n -= 400; }
  if (n >= 100) { s += hundreds[Math.floor(n / 100)]; n %= 100; }
  // 15 and 16 are written ט"ו / ט"ז to avoid spelling the divine name
  if (n === 15) s += "טו";
  else if (n === 16) s += "טז";
  else s += tens[Math.floor(n / 10)] + ones[n % 10];
  return s.length === 1 ? s + "׳" : s.slice(0, -1) + "״" + s.slice(-1);
}

function hebrewDate(iso, withYear = true) {
  try {
    let parts = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric" })
      .formatToParts(parseIso(iso));
    if (!withYear) {
      const yi = parts.findIndex(p => p.type === "year");
      if (yi > 0) parts = parts.slice(0, yi - 1).concat(parts.slice(yi + 1));
    }
    return parts.map(p => {
      if (p.type === "day" && /^\d+$/.test(p.value)) return hebrewNumeral(Number(p.value));
      if (p.type === "year" && /^\d+$/.test(p.value)) return hebrewNumeral(Number(p.value) % 1000);
      return p.value;
    }).join("").trim();
  } catch (e) {
    return "";
  }
}

/* ---------- Data ---------- */

function save() {
  localStorage.setItem(STORAGE.students, JSON.stringify(students));
  localStorage.setItem(STORAGE.attendance, JSON.stringify(attendance));
  localStorage.setItem(STORAGE.notes, JSON.stringify(notes));
}

function currentDate() {
  return dateInput.value || todayStr();
}

function ensureDateRecord(date) {
  if (!attendance[date]) attendance[date] = [];
}

function presentIn(date) {
  return (attendance[date] || []).filter(id => students.some(s => s.id === id));
}

// A date counts as a lesson only if at least one student attended
function lessonDates() {
  return Object.keys(attendance).filter(d => presentIn(d).length > 0).sort();
}

function recordedDates() {
  return [...new Set([...lessonDates(), ...Object.keys(notes)])].sort().reverse();
}

function studentStats(id, dates) {
  let present = 0, run = 0, longest = 0;
  dates.forEach(d => {
    if ((attendance[d] || []).includes(id)) {
      present++;
      run = 0;
    } else {
      run++;
      longest = Math.max(longest, run);
    }
  });
  const total = dates.length;
  return { present, total, pct: total ? Math.round((present / total) * 100) : 0, current: run, longest };
}

function level(pct) {
  return pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function hashHue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}

function visibleStudents() {
  const q = $("searchInput").value.trim();
  return q ? students.filter(s => s.name.includes(q)) : students;
}

/* ---------- UI helpers ---------- */

let toastTimer;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// Resolves to the input text (or true when there is no input) on OK, null on cancel
function openDialog({ title, message = "", value, placeholder = "", inputType = "text", okText = "אישור", danger = false }) {
  return new Promise(resolve => {
    const dlg = $("dialog");
    const input = $("dlgInput");
    const hasInput = value !== undefined;
    $("dlgTitle").textContent = title;
    $("dlgMsg").textContent = message;
    $("dlgMsg").hidden = !message;
    input.hidden = !hasInput;
    input.required = hasInput;
    input.type = inputType;
    input.value = value || "";
    input.placeholder = placeholder;
    $("dlgOk").textContent = okText;
    $("dlgOk").className = danger ? "danger" : "";
    dlg.returnValue = "";
    dlg.onclose = () => resolve(dlg.returnValue === "ok" ? (hasInput ? input.value.trim() : true) : null);
    dlg.showModal();
    if (hasInput) input.select();
  });
}

function makeAvatar(name, text) {
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.style.setProperty("--h", hashHue(name));
  avatar.textContent = text ?? name.charAt(0);
  return avatar;
}

/* ---------- Rendering ---------- */

function renderHeader() {
  const date = currentDate();
  const heb = hebrewDate(date);
  $("hebDate").textContent = heb ? `${weekdayName(date)}, ${heb}` : weekdayName(date);
  $("gregDate").textContent = formatDate(date);
}

function buildTile(s, isPresent) {
  const tile = document.createElement("div");
  tile.className = "tile" + (isPresent ? " present" : "");
  tile.dataset.id = s.id;
  tile.tabIndex = 0;
  tile.setAttribute("role", "checkbox");
  tile.setAttribute("aria-checked", isPresent);

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = s.name;

  const actions = document.createElement("div");
  actions.className = "tile-actions";
  const edit = document.createElement("button");
  edit.className = "icon-btn";
  edit.title = "שינוי שם";
  edit.textContent = "✎";
  edit.addEventListener("click", e => { e.stopPropagation(); renameStudent(s.id); });
  const del = document.createElement("button");
  del.className = "icon-btn del";
  del.title = "מחיקת תלמיד";
  del.textContent = "×";
  del.addEventListener("click", e => { e.stopPropagation(); removeStudent(s.id); });
  actions.append(edit, del);

  tile.addEventListener("click", () => togglePresence(s.id, !isPresent));
  tile.addEventListener("keydown", e => {
    if (e.target === tile && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      togglePresence(s.id, !isPresent, true);
    }
  });

  tile.append(makeAvatar(s.name, isPresent ? "✓" : undefined), name, actions);
  return tile;
}

function renderAttendance() {
  const date = currentDate();
  const present = presentIn(date);
  const visible = visibleStudents();
  const list = $("studentList");
  list.innerHTML = "";

  if (!students.length) list.innerHTML = '<div class="empty">אין תלמידים עדיין. הוסף תלמיד למטה.</div>';
  else if (!visible.length) list.innerHTML = '<div class="empty">לא נמצאו תלמידים</div>';
  visible.forEach(s => list.appendChild(buildTile(s, present.includes(s.id))));

  const pct = students.length ? Math.round((present.length / students.length) * 100) : 0;
  $("statRing").style.setProperty("--pct", pct);
  $("statPct").textContent = `${pct}%`;
  $("summary").textContent = `${present.length} נוכחים מתוך ${students.length}`;
  $("absentSummary").textContent = `${students.length - present.length} חסרים`;

  const note = $("noteInput");
  if (document.activeElement !== note) note.value = notes[date] || "";
}

function renderHistory() {
  const select = $("historySelect");
  select.innerHTML = '<option value="">תאריכים קודמים...</option>';
  recordedDates().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = `${formatDate(d)} · ${hebrewDate(d)} (${presentIn(d).length} נוכחים)`;
    select.appendChild(opt);
  });
}

function renderEmailInfo() {
  const email = localStorage.getItem(STORAGE.email);
  const info = $("emailInfo");
  info.innerHTML = "";
  if (email) {
    const change = document.createElement("a");
    change.textContent = "שינוי";
    change.addEventListener("click", askEmail);
    info.append(`יישלח אל ${email} · `, change);
  }
}

function renderReport() {
  const wrap = $("reportTable");
  const asc = lessonDates();
  const dates = [...asc].reverse();
  wrap.innerHTML = "";
  $("reportMeta").textContent = `${dates.length} שיעורים · ${students.length} תלמידים`;
  if (!dates.length || !students.length) {
    wrap.innerHTML = '<div class="empty">עדיין אין נתוני נוכחות</div>';
    return;
  }

  const table = document.createElement("table");
  table.className = "report";

  const head = table.createTHead().insertRow();
  const addTh = (text, cls) => {
    const th = document.createElement("th");
    th.className = cls;
    th.textContent = text;
    head.appendChild(th);
    return th;
  };
  addTh("תלמיד", "sticky-col");
  addTh("נוכחות", "");
  dates.forEach(d => {
    const btn = document.createElement("button");
    btn.className = "date-head";
    btn.title = notes[d] ? `${weekdayName(d)} · ${notes[d]}` : weekdayName(d);
    const g = document.createElement("span");
    g.className = "g";
    g.textContent = formatShort(d);
    const h = document.createElement("span");
    h.className = "h";
    h.textContent = hebrewDate(d, false);
    btn.append(g, h);
    if (notes[d]) {
      const dot = document.createElement("span");
      dot.className = "note-dot";
      btn.appendChild(dot);
    }
    btn.addEventListener("click", () => { dateInput.value = d; switchView("attendance"); });
    addTh("", "").appendChild(btn);
  });

  const body = table.createTBody();
  students.forEach(s => {
    const row = body.insertRow();
    const nameCell = row.insertCell();
    nameCell.className = "sticky-col";
    nameCell.textContent = s.name;

    const { pct } = studentStats(s.id, asc);
    const pill = document.createElement("span");
    pill.className = `pill ${level(pct)}`;
    pill.textContent = `${pct}%`;
    row.insertCell().appendChild(pill);

    dates.forEach(d => {
      const yes = (attendance[d] || []).includes(s.id);
      const mark = document.createElement("span");
      mark.className = "mark " + (yes ? "yes" : "no");
      mark.textContent = yes ? "✓" : "·";
      row.insertCell().appendChild(mark);
    });
  });

  const foot = table.createTFoot().insertRow();
  const totalLabel = foot.insertCell();
  totalLabel.className = "sticky-col";
  totalLabel.textContent = "סה״כ נוכחים";
  foot.insertCell();
  dates.forEach(d => { foot.insertCell().textContent = presentIn(d).length; });

  wrap.appendChild(table);
}

function renderStats() {
  const dates = lessonDates();
  const list = $("statsList");
  list.innerHTML = "";

  const avg = dates.length && students.length
    ? Math.round(dates.reduce((sum, d) => sum + presentIn(d).length, 0) / (dates.length * students.length) * 100)
    : 0;
  $("kpiLessons").textContent = dates.length;
  $("kpiAvg").textContent = `${avg}%`;
  $("kpiStudents").textContent = students.length;

  if (!dates.length) {
    list.innerHTML = '<div class="empty">עדיין אין נתוני נוכחות</div>';
    return;
  }

  students
    .map(s => ({ s, ...studentStats(s.id, dates) }))
    .sort((a, b) => b.pct - a.pct || a.s.name.localeCompare(b.s.name, "he"))
    .forEach(({ s, present, total, pct, current, longest }) => {
      const row = document.createElement("div");
      row.className = "stat-row";

      const info = document.createElement("div");
      const name = document.createElement("div");
      name.className = "s-name";
      name.textContent = s.name;
      const sub = document.createElement("div");
      sub.className = "s-sub";
      sub.textContent = `${present} מתוך ${total} שיעורים · שיא היעדרויות ברצף: ${longest}`;
      info.append(name, sub);

      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.className = `fill ${level(pct)}`;
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      const pctEl = document.createElement("div");
      pctEl.className = "pct-val";
      pctEl.textContent = `${pct}%`;

      const streak = document.createElement("span");
      streak.className = "streak " + (current >= 3 ? "warn" : current > 0 ? "mild" : "ok");
      streak.textContent = current > 0 ? `${current} היעדרויות ברצף` : "נכח בשיעור האחרון";

      row.append(makeAvatar(s.name), info, bar, pctEl, streak);
      list.appendChild(row);
    });
}

function render() {
  renderHeader();
  renderAttendance();
  renderHistory();
  renderEmailInfo();
  if (currentView === "report") renderReport();
  if (currentView === "stats") renderStats();
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  $("sendBar").classList.toggle("hidden", view !== "attendance");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Actions ---------- */

function addStudent() {
  const input = $("studentName");
  const name = input.value.trim();
  if (!name) return;
  if (students.some(s => s.name === name)) {
    toast("תלמיד בשם זה כבר קיים");
    return;
  }
  students.push({ id: newId(), name });
  input.value = "";
  save();
  render();
  toast(`${name} נוסף לרשימה`);
  input.focus();
}

async function renameStudent(id) {
  const student = students.find(s => s.id === id);
  const name = await openDialog({ title: "שינוי שם תלמיד", value: student.name, placeholder: "שם התלמיד", okText: "שמור" });
  if (!name || name === student.name) return;
  if (students.some(s => s.name === name && s.id !== id)) {
    toast("תלמיד בשם זה כבר קיים");
    return;
  }
  student.name = name;
  save();
  render();
  toast("השם עודכן");
}

async function removeStudent(id) {
  const student = students.find(s => s.id === id);
  const ok = await openDialog({
    title: "מחיקת תלמיד",
    message: `למחוק את ${student.name} מהרשימה? הנוכחות שלו לא תופיע יותר בדוחות.`,
    okText: "מחק",
    danger: true
  });
  if (!ok) return;
  students = students.filter(s => s.id !== id);
  save();
  render();
  toast(`${student.name} נמחק`);
}

function togglePresence(id, isPresent, refocus = false) {
  const date = currentDate();
  ensureDateRecord(date);
  if (isPresent && !attendance[date].includes(id)) attendance[date].push(id);
  if (!isPresent) attendance[date] = attendance[date].filter(x => x !== id);
  save();
  render();
  if (refocus) $("studentList").querySelector(`[data-id="${id}"]`)?.focus();
}

function setAll(isPresent) {
  const date = currentDate();
  ensureDateRecord(date);
  const ids = visibleStudents().map(s => s.id);
  attendance[date] = isPresent
    ? [...new Set([...attendance[date], ...ids])]
    : attendance[date].filter(id => !ids.includes(id));
  save();
  render();
  toast(isPresent ? "כולם סומנו כנוכחים" : "הסימונים נוקו");
}

function saveNote() {
  const date = currentDate();
  const text = $("noteInput").value;
  if (text.trim()) notes[date] = text;
  else delete notes[date];
  save();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function askEmail() {
  const email = await openDialog({
    title: "כתובת מייל",
    message: "לאיזו כתובת לשלוח את רשימת הנוכחות? הכתובת תישמר לפעמים הבאות.",
    value: localStorage.getItem(STORAGE.email) || "",
    placeholder: "name@example.com",
    inputType: "email",
    okText: "שמור"
  });
  if (email === null) return null;
  if (!isValidEmail(email)) {
    toast("כתובת מייל לא תקינה");
    return null;
  }
  localStorage.setItem(STORAGE.email, email);
  renderEmailInfo();
  toast("כתובת המייל נשמרה");
  return email;
}

async function sendEmail() {
  const email = localStorage.getItem(STORAGE.email) || await askEmail();
  if (!email) return;

  const date = currentDate();
  const present = presentIn(date);
  const presentNames = students.filter(s => present.includes(s.id)).map(s => s.name);
  const absentNames = students.filter(s => !present.includes(s.id)).map(s => s.name);
  const heb = hebrewDate(date);
  const dateText = heb ? `${formatDate(date)} (${heb})` : formatDate(date);
  const note = (notes[date] || "").trim();

  const subject = `נוכחות תלמוד תורה - ${dateText}`;
  let body = `רשימת נוכחות - ${weekdayName(date)} ${dateText}\n`;
  if (note) body += `נושא השיעור / הערה: ${note}\n`;
  body += `\nנוכחים (${presentNames.length}):\n`;
  body += presentNames.length ? presentNames.map((n, i) => `${i + 1}. ${n}`).join("\n") : "אין נוכחים";
  if (absentNames.length) {
    body += `\n\nחסרים (${absentNames.length}):\n` + absentNames.map((n, i) => `${i + 1}. ${n}`).join("\n");
  }

  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function csvCell(value) {
  let s = String(value);
  // Prevent spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const dates = lessonDates();
  if (!dates.length) {
    toast("אין נתונים לייצוא");
    return;
  }
  const rows = [
    ["שם תלמיד", "נוכחויות", "אחוז נוכחות", "היעדרויות ברצף", ...dates.map(formatDate)],
    ["", "", "", "", ...dates.map(d => hebrewDate(d))]
  ];
  students.forEach(s => {
    const st = studentStats(s.id, dates);
    rows.push([s.name, st.present, `${st.pct}%`, st.current, ...dates.map(d => (attendance[d] || []).includes(s.id) ? "V" : "")]);
  });
  rows.push(["סה״כ נוכחים", "", "", "", ...dates.map(d => presentIn(d).length)]);
  rows.push(["נושא / הערה", "", "", "", ...dates.map(d => notes[d] || "")]);

  const csv = "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `נוכחות_תלמוד_תורה_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("הקובץ הורד");
}

/* ---------- Events ---------- */

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => switchView(t.dataset.view)));
$("addStudentBtn").addEventListener("click", addStudent);
$("studentName").addEventListener("keydown", e => { if (e.key === "Enter") addStudent(); });
$("todayBtn").addEventListener("click", () => { dateInput.value = todayStr(); render(); });
dateInput.addEventListener("change", () => { if (dateInput.value) render(); });
$("historySelect").addEventListener("change", e => {
  if (e.target.value) {
    dateInput.value = e.target.value;
    render();
  }
});
$("searchInput").addEventListener("input", renderAttendance);
$("markAllBtn").addEventListener("click", () => setAll(true));
$("clearAllBtn").addEventListener("click", () => setAll(false));
$("noteInput").addEventListener("input", saveNote);
$("noteInput").addEventListener("blur", renderHistory);
$("exportBtn").addEventListener("click", exportCsv);
$("sendBtn").addEventListener("click", sendEmail);

/* ---------- PWA ---------- */

let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("installBtn").classList.add("hidden");
});

// Service workers only run over http(s), not when opening the file directly
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js");
}

dateInput.value = todayStr();
render();
