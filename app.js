function getActiveProfile() {
  try {
    return JSON.parse(localStorage.getItem("campusPilotActiveProfile") || "null");
  } catch (error) {
    return null;
  }
}

const activeProfile = getActiveProfile();
const profileStoragePrefix = activeProfile ? `campusPilot_${activeProfile.id}_` : "campusPilot_guest_";
function storageKey(key) { return `${profileStoragePrefix}${key}`; }

const storedLinks = JSON.parse(localStorage.getItem(storageKey("placementLinks")) || "{}");
const links = { dsa: [], subjects: [] };
const removedHubs = JSON.parse(localStorage.getItem(storageKey("placementRemovedHubs")) || "[]");
const defaultTasks = ["Complete one DSA problem", "Revise one engineering topic", "Work on Aptitude", "Write down one thing I learned"];
const todayTasks = JSON.parse(localStorage.getItem(storageKey("placementTasks")) || JSON.stringify(defaultTasks)).map((task) => typeof task === "string" ? task : task.name);
defaultTasks.forEach((task) => { if (!todayTasks.includes(task)) todayTasks.push(task); });
const taskDone = JSON.parse(localStorage.getItem(storageKey("placementTaskProgress")) || "[]");
const taskOutcomes = JSON.parse(localStorage.getItem(storageKey("placementTaskOutcomes")) || "[]");
const customHubs = JSON.parse(localStorage.getItem(storageKey("placementCustomHubs")) || "[]");
customHubs.forEach((hub) => { links[hub.id] = Array.isArray(hub.sources) ? hub.sources : []; });
const DAILY_HISTORY_KEY = storageKey("placementDailyHistory");
const ACADEMIC_TRACK_KEY = storageKey("academicTrack");
const academicDefaults = { course: "", currentSemester: "1", semesters: [] };

function getAcademicState() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACADEMIC_TRACK_KEY) || "null");
    if (!saved || typeof saved !== "object") return { ...academicDefaults };
    return {
      course: typeof saved.course === "string" ? saved.course : "",
      currentSemester: typeof saved.currentSemester === "string" ? saved.currentSemester : "1",
      semesters: Array.isArray(saved.semesters) ? saved.semesters : []
    };
  } catch (error) {
    return { ...academicDefaults };
  }
}

let academicState = getAcademicState();

function saveAcademicState() {
  localStorage.setItem(ACADEMIC_TRACK_KEY, JSON.stringify(academicState));
}

function ensureAcademicSemester(semesterNumber) {
  const parsedSemester = Number(semesterNumber);
  if (!Number.isFinite(parsedSemester)) return null;

  let semester = academicState.semesters.find((entry) => Number(entry.number) === parsedSemester);
  if (semester) return semester;

  semester = { id: `semester-${parsedSemester}-${Date.now()}`, number: parsedSemester, subjects: [] };
  academicState.semesters.push(semester);
  saveAcademicState();
  return semester;
}

function renderAcademicSemesters() {
  const grid = document.getElementById("semesterGrid");
  if (!grid) return;

  const semesterCards = [...academicState.semesters]
    .sort((first, second) => Number(first.number) - Number(second.number))
    .map((semester) => {
      const subjects = Array.isArray(semester.subjects) ? semester.subjects : [];
      const subjectList = subjects.length
        ? subjects.map((subject) => `<li><strong>${escapeHtml(subject.name)}</strong><span>${escapeHtml(subject.code || "No code added")}</span></li>`).join("")
        : "<li class='empty-semester'>No subjects added yet.</li>";

      return `
        <article class="semester-card">
          <div class="semester-card-header">
            <div>
              <p class="eyebrow">Academic track</p>
              <h3>Semester ${escapeHtml(semester.number)}</h3>
            </div>
            <span class="semester-count">${subjects.length} subject${subjects.length === 1 ? "" : "s"}</span>
          </div>
          <ul class="semester-subject-list">${subjectList}</ul>
          <button class="action primary" type="button" onclick="addAcademicSubject(${semester.number})">+ Add subject</button>
        </article>
      `;
    });

  if (!semesterCards.length) {
    grid.innerHTML = '<div class="empty-state academic-empty">Create a semester track to start building your course map.</div>';
  } else {
    grid.innerHTML = semesterCards.join("");
  }

  const profileSummary = document.getElementById("academicProfileSummary");
  const summaryNote = document.getElementById("academicSummaryNote");
  if (profileSummary) {
    profileSummary.textContent = academicState.course ? academicState.course : "No course set yet";
  }
  if (summaryNote) {
    summaryNote.textContent = academicState.course ? `Current focus: Semester ${academicState.currentSemester}` : "Choose your course and semester to begin.";
  }
}

function addAcademicSubject(semesterNumber) {
  const subjectName = window.prompt("Enter the subject name", "Data Structures");
  if (subjectName === null || !subjectName.trim()) return;

  const subjectCode = window.prompt("Enter the subject code", "CS201");
  if (subjectCode === null || !subjectCode.trim()) return;

  const semester = ensureAcademicSemester(semesterNumber);
  if (!semester) return;

  const parsedSemester = Number(semesterNumber);
  academicState.currentSemester = String(parsedSemester);
  semester.subjects = Array.isArray(semester.subjects) ? semester.subjects : [];
  semester.subjects.push({
    id: `subject-${Date.now()}`,
    name: subjectName.trim(),
    code: subjectCode.trim(),
    resources: []
  });

  saveAcademicState();
  renderAcademicSemesters();
}

function showAcademicStudio() {
  document.getElementById("authView").hidden = true;
  document.getElementById("campusView").hidden = true;
  document.getElementById("studioView").hidden = true;
  document.getElementById("academicView").hidden = false;
  window.scrollTo(0, 0);
}

function getDateKey(date = new Date()) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 10);
}

function getPreviousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return getDateKey(date);
}

function getDailyHistory() {
  try {
    return JSON.parse(localStorage.getItem(DAILY_HISTORY_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveDailyHistory(history) {
  localStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(history));
}

function getHistorySnapshot(dateKey) {
  const history = getDailyHistory();
  const snapshot = history[dateKey];

  if (!snapshot || !Array.isArray(snapshot.tasks)) {
    return { tasks: [], completed: [], outcomes: [] };
  }

  return {
    tasks: snapshot.tasks,
    completed: Array.isArray(snapshot.completed) ? snapshot.completed : [],
    outcomes: Array.isArray(snapshot.outcomes) ? snapshot.outcomes : []
  };
}

function persistDailyProgress() {
  const history = getDailyHistory();
  history[getDateKey()] = {
    tasks: [...todayTasks],
    completed: [...taskDone],
    outcomes: [...taskOutcomes],
    savedAt: Date.now()
  };
  saveDailyHistory(history);
  renderYesterdayTasks();
}

function renderYesterdayTasks() {
  const yesterdayList = document.getElementById("yesterdayTasksList");
  if (!yesterdayList) return;

  const yesterdayKey = getPreviousDateKey(getDateKey());
  const snapshot = getHistorySnapshot(yesterdayKey);
  const completedTaskNames = snapshot.tasks.filter((task, index) => snapshot.completed[index]);

  if (!completedTaskNames.length) {
    yesterdayList.innerHTML = "";
    return;
  }

  yesterdayList.innerHTML = completedTaskNames.map((task) => `<li>${task}</li>`).join("");
}

function openHistoryCalendar() {
  const historyDialog = document.getElementById("historyDialog");
  if (!historyDialog) return;

  selectedHistoryDate = getMostRecentCompletedDate();
  historyCalendarDate = new Date(`${selectedHistoryDate}T00:00:00`);
  historyDialog.showModal();
  renderHistoryCalendar();
  renderSelectedHistoryDate();
  renderProgressDashboard();
}

function getMostRecentCompletedDate() {
  const history = getDailyHistory();
  const dates = Object.keys(history).filter((dateKey) => Array.isArray(history[dateKey].completed) && history[dateKey].completed.some(Boolean));
  if (!dates.length) return getDateKey();
  return [...dates].sort().at(-1);
}

function formatDisplayDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function getTasksForDate(dateKey) {
  const snapshot = getTrackableSnapshot(dateKey);
  return snapshot.tasks.filter((task, index) => snapshot.completed[index]);
}

function getTrackableSnapshot(dateKey) {
  const snapshot = getHistorySnapshot(dateKey);
  if (dateKey === getDateKey() && !snapshot.tasks.length) {
    return { tasks: [...todayTasks], completed: [...taskDone], outcomes: [...taskOutcomes] };
  }
  return snapshot;
}

function renderSelectedHistoryDate() {
  const dateLabel = document.getElementById("selectedHistoryDateLabel");
  const dayList = document.getElementById("historyDayTaskList");

  if (!dateLabel || !dayList) return;

  dateLabel.textContent = formatDisplayDate(selectedHistoryDate);
  const tasksForDate = getTasksForDate(selectedHistoryDate);

  if (!tasksForDate.length) {
    dayList.innerHTML = "<li>No tasks completed on this date.</li>";
    return;
  }

  const snapshot = getTrackableSnapshot(selectedHistoryDate);
  dayList.innerHTML = tasksForDate.map((task) => {
    const taskIndex = snapshot.tasks.indexOf(task);
    const outcome = snapshot.outcomes[taskIndex];
    return `<li><strong>${escapeHtml(task)}</strong>${outcome ? `<span>${escapeHtml(outcome)}</span>` : ""}</li>`;
  }).join("");
}

function renderHistoryCalendar() {
  const calendarGrid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calendarMonthLabel");
  if (!calendarGrid || !monthLabel) return;

  const monthDate = new Date(historyCalendarDate.getFullYear(), historyCalendarDate.getMonth(), 1);
  monthLabel.textContent = formatMonthYear(monthDate);

  const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const daysInPreviousMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate();

  const cells = [];
  for (let index = firstDayOfMonth - 1; index >= 0; index -= 1) {
    const dayNumber = daysInPreviousMonth - index;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, dayNumber);
    cells.push({ key: getDateKey(date), number: dayNumber, muted: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    cells.push({ key: getDateKey(date), number: day, muted: false });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstDayOfMonth + daysInMonth) + 1;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, nextDay);
    cells.push({ key: getDateKey(date), number: date.getDate(), muted: true });
  }

  calendarGrid.innerHTML = cells.map((cell) => {
    const isSelected = cell.key === selectedHistoryDate;
    const hasTasks = getTasksForDate(cell.key).length > 0;
    const classes = ["calendar-day", cell.muted ? "muted" : "", hasTasks ? "has-tasks" : "", isSelected ? "selected" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-date-key="${cell.key}" aria-label="View tasks for ${formatDisplayDate(cell.key)}">${cell.number}</button>`;
  }).join("");
}

function setHistoryMonth(offset) {
  const nextMonth = new Date(historyCalendarDate.getFullYear(), historyCalendarDate.getMonth() + offset, 1);
  historyCalendarDate = nextMonth;
  renderHistoryCalendar();
}

function getHistoryWindow() {
  const dates = [];
  const today = new Date(`${getDateKey()}T00:00:00`);
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(getDateKey(date));
  }
  return dates;
}

function renderProgressDashboard() {
  const chart = document.getElementById("progressChart");
  const summary = document.getElementById("progressSummary");
  const topicList = document.getElementById("topicProgressList");
  if (!chart || !summary || !topicList) return;

  const dates = getHistoryWindow();
  const dailyData = dates.map((dateKey) => {
    const snapshot = getTrackableSnapshot(dateKey);
    const completed = snapshot.tasks.filter((task, index) => snapshot.completed[index]).length;
    return { dateKey, completed, total: snapshot.tasks.length };
  });
  const completedTotal = dailyData.reduce((total, day) => total + day.completed, 0);
  const trackedDays = dailyData.filter((day) => day.total > 0).length;
  summary.textContent = `${completedTotal} completed across ${trackedDays} tracked day${trackedDays === 1 ? "" : "s"}`;
  chart.innerHTML = dailyData.map((day) => {
    const percent = day.total ? Math.round((day.completed / day.total) * 100) : 0;
    const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${day.dateKey}T00:00:00`));
    return `<div class="progress-day" title="${label}: ${day.completed}/${day.total} tasks"><div class="progress-bar-track"><div class="progress-bar-fill" style="height:${percent}%"></div></div><strong>${day.completed}</strong><span>${label}</span></div>`;
  }).join("");

  const topicTotals = {};
  dailyData.forEach((day) => {
    const snapshot = getTrackableSnapshot(day.dateKey);
    snapshot.tasks.forEach((task, index) => {
      const topic = String(task).trim();
      if (!topic) return;
      if (!topicTotals[topic]) topicTotals[topic] = { completed: 0, total: 0 };
      topicTotals[topic].total += 1;
      if (snapshot.completed[index]) topicTotals[topic].completed += 1;
    });
  });
  const topics = Object.entries(topicTotals).sort(([, first], [, second]) => second.total - first.total);
  topicList.innerHTML = topics.length ? topics.map(([topic, progress]) => {
    const percent = Math.round((progress.completed / progress.total) * 100);
    return `<div class="topic-progress-row"><div class="topic-progress-label"><span>${escapeHtml(topic)}</span><strong>${progress.completed}/${progress.total}</strong></div><div class="topic-progress-track"><span style="width:${percent}%"></span></div></div>`;
  }).join("") : '<p class="empty-state">Complete a rhythm task to start tracking topics.</p>';
}

function normalizePriority(priority) {
  if (priority === "high") return 1;
  if (priority === "medium") return 2;
  if (priority === "low") return 3;
  const number = Number(priority);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : 1;
}
Object.keys(links).forEach((key) => {
  const saved = storedLinks[key];
  if (Array.isArray(saved)) links[key] = saved.map((item) => ({ priority: normalizePriority(item.priority), description: "", ...item, priority: normalizePriority(item.priority) }));
  else if (typeof saved === "string" && saved) links[key] = [{ name: "Saved source", url: saved, priority: 1, description: "" }];
});

let activeResource = "dsa";
let editingIndex = null;
let savingLink = false;
let allResource = "dsa";
let editingTaskIndex = null;
const labels = { dsa: document.getElementById("dsaLabel"), subjects: document.getElementById("subjectsLabel") };
const lists = { dsa: document.getElementById("dsaLinks"), subjects: document.getElementById("subjectsLinks") };
const dialog = document.getElementById("linkDialog");
const linkForm = document.getElementById("linkForm");
const nameInput = document.getElementById("nameInput");
const descriptionInput = document.getElementById("descriptionInput");
const priorityInput = document.getElementById("priorityInput");
const input = document.getElementById("linkInput");
const saveLinkButton = document.getElementById("saveLinkButton");
const hubDialog = document.getElementById("hubDialog");
const hubNameInput = document.getElementById("hubNameInput");
const taskDialog = document.getElementById("taskDialog");
const taskDialogTitle = document.getElementById("taskDialogTitle");
const taskNameInput = document.getElementById("taskNameInput");
const outcomeDialog = document.getElementById("outcomeDialog");
const outcomeTaskLabel = document.getElementById("outcomeTaskLabel");
const outcomeInput = document.getElementById("outcomeInput");
const removeCardsDialog = document.getElementById("removeCardsDialog");
const removeDsaInput = document.getElementById("removeDsaInput");
const removeSubjectsInput = document.getElementById("removeSubjectsInput");
const historyDialog = document.getElementById("historyDialog");
const prevMonthButton = document.getElementById("prevMonthButton");
const nextMonthButton = document.getElementById("nextMonthButton");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const selectedHistoryDateLabel = document.getElementById("selectedHistoryDateLabel");
const historyDayTaskList = document.getElementById("historyDayTaskList");
let selectedHistoryDate = getDateKey();
let historyCalendarDate = new Date();
let pendingTaskIndex = null;

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function hubDetails(resource) {
  if (resource === "dsa") return { name: "DSA playlist" };
  if (resource === "subjects") return { name: "Engineering subjects" };
  return customHubs.find((hub) => hub.id === resource) || { name: "Study hub" };
}
function persistLinks() { localStorage.setItem(storageKey("placementLinks"), JSON.stringify(links)); }
function persistCustomHubs() { localStorage.setItem(storageKey("placementCustomHubs"), JSON.stringify(customHubs)); }
function renderCustomHubs() {
  document.getElementById("customHubs").innerHTML = customHubs.map((hub) => `<article class="resource-card custom"><div class="resource-top"><span class="resource-icon">+</span><span class="resource-type">Custom hub</span></div><h3>${escapeHtml(hub.name)}</h3><p>Your personal collection of study sources, organized your way.</p><div class="resource-list" id="${hub.id}Links"></div><div class="resource-footer"><div class="actions"><button class="action" type="button" onclick="openAll('${hub.id}')">View all playlists</button><button class="action primary" type="button" onclick="openEditor('${hub.id}')">+ Add source</button></div><div class="resource-meta"><button class="reset-link" type="button" onclick="resetSources('${hub.id}')">Reset sources</button><span class="resource-link" id="${hub.id}Label">No sources saved yet</span></div></div></article>`).join("");
  customHubs.forEach((hub) => { labels[hub.id] = document.getElementById(`${hub.id}Label`); lists[hub.id] = document.getElementById(`${hub.id}Links`); });
}
function renderLinks() {
  Object.keys(labels).forEach((key) => {
    const saved = links[key];
    labels[key].textContent = saved.length ? `${saved.length} source${saved.length === 1 ? "" : "s"} saved` : "No sources saved yet";
    lists[key].innerHTML = saved.map((item, index) => `<div class="saved-link"><div class="saved-link-main"><span class="saved-link-name">${escapeHtml(item.name)}</span><span class="saved-link-host">${escapeHtml(new URL(item.url).hostname.replace("www.", ""))}</span>${item.description ? `<span class="saved-link-description">${escapeHtml(item.description)}</span>` : ""}<span class="priority-badge">${escapeHtml(item.priority)} priority</span></div><div class="saved-link-actions"><button class="menu-trigger" type="button" data-tooltip="Choose an action for this link" aria-label="Choose an action for ${escapeHtml(item.name)}" aria-expanded="false" onclick="toggleLinkMenu(this)">⋮</button><div class="link-menu"><a href="${escapeHtml(item.url)}">Open playlist ↗</a><button type="button" onclick="editLink('${key}', ${index})">Edit link</button><button class="delete-link" type="button" onclick="deleteLink('${key}', ${index})">Delete link</button></div></div></div>`).join("");
  });
}
function renderStudyTopicOptions() {
  const topicOptions = document.getElementById("studyTopicOptions");
  if (!topicOptions) return;
  const topics = [...Object.values(links).flat().map((item) => item.name), ...customHubs.map((hub) => hub.name)].filter(Boolean);
  topicOptions.innerHTML = [...new Set(topics)].map((topic) => `<option value="${escapeHtml(topic)}"></option>`).join("");
}
function toggleLinkMenu(trigger) {
  const menu = trigger.nextElementSibling;
  const isOpen = menu.classList.toggle("open");
  trigger.setAttribute("aria-expanded", String(isOpen));
  document.querySelectorAll(".link-menu.open").forEach((otherMenu) => { if (otherMenu !== menu) { otherMenu.classList.remove("open"); otherMenu.previousElementSibling.setAttribute("aria-expanded", "false"); } });
}
document.addEventListener("click", (event) => { if (!event.target.closest(".saved-link-actions, .all-item-actions")) document.querySelectorAll(".link-menu.open").forEach((menu) => { menu.classList.remove("open"); menu.previousElementSibling.setAttribute("aria-expanded", "false"); }); });
function resetLinkForm() { linkForm.reset(); descriptionInput.value = ""; priorityInput.value = "1"; savingLink = false; saveLinkButton.disabled = false; }
function openEditor(resource) { activeResource = resource; editingIndex = null; resetLinkForm(); document.getElementById("dialogTitle").textContent = resource === "dsa" ? "Add your DSA source" : resource === "subjects" ? "Add your subjects source" : `Add a source to ${hubDetails(resource).name}`; dialog.showModal(); nameInput.focus(); }
function editLink(resource, index) { activeResource = resource; editingIndex = index; const item = links[resource][index]; document.getElementById("dialogTitle").textContent = "Edit saved source"; nameInput.value = item.name; descriptionInput.value = item.description || ""; priorityInput.value = normalizePriority(item.priority); input.value = item.url; dialog.showModal(); nameInput.focus(); }
function deleteLink(resource, index) { const item = links[resource][index]; if (!window.confirm(`Delete "${item.name}" from your saved sources?`)) return; links[resource].splice(index, 1); persistLinks(); renderLinks(); if (document.getElementById("allDialog").open) renderAllPlaylists(); }
function saveLink(event) { event.preventDefault(); if (savingLink) return; savingLink = true; saveLinkButton.disabled = true; const item = { name: nameInput.value.trim(), description: descriptionInput.value.trim(), priority: normalizePriority(priorityInput.value), url: input.value.trim() }; const duplicateIndex = links[activeResource].findIndex((saved) => saved.url === item.url && saved.url); if (editingIndex === null && duplicateIndex !== -1) links[activeResource][duplicateIndex] = item; else if (editingIndex === null) links[activeResource].push(item); else links[activeResource][editingIndex] = item; persistLinks(); const hub = customHubs.find((item) => item.id === activeResource); if (hub) { hub.sources = links[activeResource]; persistCustomHubs(); } renderLinks(); renderStudyTopicOptions(); if (document.getElementById("allDialog").open) renderAllPlaylists(); resetLinkForm(); editingIndex = null; dialog.close(); }
dialog.addEventListener("close", resetLinkForm);
function refreshLinks() { let latest = {}; try { latest = JSON.parse(localStorage.getItem(storageKey("placementLinks")) || "{}"); } catch (error) {} Object.keys(links).forEach((key) => { const saved = latest[key]; const normalized = Array.isArray(saved) ? saved.map((item) => ({ name: item.name || "Saved source", url: item.url || "", description: item.description || "", priority: normalizePriority(item.priority) })) : typeof saved === "string" && saved ? [{ name: "Saved source", url: saved, description: "", priority: 1 }] : []; links[key].splice(0, links[key].length, ...normalized); }); }
function resetSources(resource) { if (!window.confirm(`Remove all saved sources from ${hubDetails(resource).name}? This cannot be undone, but you can add them again afterward.`)) return; links[resource].splice(0, links[resource].length); persistLinks(); renderLinks(); if (document.getElementById("allDialog").open && allResource === resource) renderAllPlaylists(); }
function resetDsaSources() { resetSources("dsa"); }
function resetSubjectSources() { resetSources("subjects"); }
function openAll(resource) { refreshLinks(); renderLinks(); allResource = resource; const title = resource === "dsa" ? "All DSA playlists" : resource === "subjects" ? "All engineering subject playlists" : `All ${hubDetails(resource).name} playlists`; document.getElementById("allDialogTitle").textContent = title; document.getElementById("priorityFilter").value = "all"; renderAllPlaylists(); document.getElementById("allDialog").showModal(); }
function renderAllPlaylists() { const filter = document.getElementById("priorityFilter").value; const sorted = links[allResource].map((item, index) => ({ item, index })).filter(({ item }) => filter === "all" || String(item.priority) === filter).sort((a, b) => a.item.priority - b.item.priority); document.getElementById("allList").innerHTML = sorted.length ? sorted.map(({ item, index }) => `<article class="all-item"><div><h3>${escapeHtml(item.name)}</h3><span class="priority-badge">${escapeHtml(item.priority)} priority</span>${item.description ? `<p>${escapeHtml(item.description)}</p>` : "<p>No description added yet.</p>"}</div><div class="all-item-actions"><button class="menu-trigger" type="button" data-tooltip="Choose an action for this link" aria-label="Choose an action for ${escapeHtml(item.name)}" aria-expanded="false" onclick="toggleLinkMenu(this)">⋮</button><div class="link-menu"><a href="${escapeHtml(item.url)}">Open playlist ↗</a><button type="button" onclick="editLink('${allResource}', ${index})">Edit link</button><button class="delete-link" type="button" onclick="deleteLink('${allResource}', ${index})">Delete link</button></div></div></article>`).join("") : `<div class="empty-state">No playlists match this priority yet.</div>`; }
function openHubCreator() { hubNameInput.value = ""; hubDialog.showModal(); hubNameInput.focus(); }
function createStudyHub(event) { event.preventDefault(); const name = hubNameInput.value.trim(); if (!name) return; const id = `hub-${Date.now()}`; customHubs.push({ id, name, sources: [] }); links[id] = []; persistCustomHubs(); renderCustomHubs(); renderLinks(); renderStudyTopicOptions(); hubDialog.close(); hubNameInput.value = ""; }
function applyHubVisibility() { document.getElementById("dsaCard").hidden = removedHubs.includes("dsa"); document.getElementById("subjectsCard").hidden = removedHubs.includes("subjects"); document.getElementById("restoreHubsButton").hidden = removedHubs.length === 0; }
function openRemoveCards() { removeDsaInput.checked = removedHubs.includes("dsa"); removeSubjectsInput.checked = removedHubs.includes("subjects"); removeCardsDialog.showModal(); }
function removeSelectedCards(event) { event.preventDefault(); const selected = []; if (removeDsaInput.checked) selected.push("dsa"); if (removeSubjectsInput.checked) selected.push("subjects"); if (!selected.length) return removeCardsDialog.close(); if (!window.confirm(`Remove ${selected.map((resource) => hubDetails(resource).name).join(" and ")} card${selected.length > 1 ? "s" : ""}? Your saved sources will stay safe and can be restored later.`)) return; removedHubs.splice(0, removedHubs.length, ...selected); localStorage.setItem(storageKey("placementRemovedHubs"), JSON.stringify(removedHubs)); applyHubVisibility(); removeCardsDialog.close(); }
function restoreDefaultHubs() { removedHubs.splice(0, removedHubs.length); localStorage.setItem(storageKey("placementRemovedHubs"), JSON.stringify(removedHubs)); applyHubVisibility(); }
function persistTasks() {
  localStorage.setItem(storageKey("placementTasks"), JSON.stringify(todayTasks));
  localStorage.setItem(storageKey("placementTaskProgress"), JSON.stringify(taskDone));
  localStorage.setItem(storageKey("placementTaskOutcomes"), JSON.stringify(taskOutcomes));
  persistDailyProgress();
}
function updateProgress() {
  if (!document.getElementById("completedCount")) return;
  const completedCount = taskDone.slice(0, todayTasks.length).filter(Boolean).length;
  document.getElementById("completedCount").textContent = `${completedCount} completed`;
  renderFocusPanel();
}
function renderFocusPanel() {
  const ring = document.getElementById("focusRing");
  const percentLabel = document.getElementById("focusPercent");
  const taskCount = document.getElementById("focusTaskCount");
  if (!ring || !percentLabel || !taskCount) return;
  const completedCount = taskDone.slice(0, todayTasks.length).filter(Boolean).length;
  const percent = todayTasks.length ? Math.round((completedCount / todayTasks.length) * 100) : 0;
  ring.style.setProperty("--focus-progress", `${percent * 3.6}deg`);
  percentLabel.textContent = `${percent}%`;
  taskCount.textContent = `${completedCount} of ${todayTasks.length}`;
}
function renderTasks() { const checklist = document.getElementById("checklist"); if (!checklist) return; checklist.innerHTML = todayTasks.map((task, index) => `<label class="check-row" draggable="true" data-task-index="${index}"><span class="drag-handle" aria-hidden="true">⋮⋮</span><input type="checkbox" ${taskDone[index] ? "checked" : ""} onchange="toggleTask(${index}, this.checked)" /><span class="task-name">${escapeHtml(task)}</span><span class="task-actions"><button class="task-action" type="button" onclick="editTask(event, ${index})" aria-label="Edit task">✎</button><button class="task-action" type="button" onclick="deleteTask(event, ${index})" aria-label="Delete task">×</button></span></label>`).join(""); updateProgress(); renderCompletedToday(); }
function reorderTask(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const moveItem = (items) => items.splice(toIndex, 0, items.splice(fromIndex, 1)[0]);
  moveItem(todayTasks);
  moveItem(taskDone);
  moveItem(taskOutcomes);
  persistTasks();
  renderTasks();
}
function renderCompletedToday() {
  const completedList = document.getElementById("completedTodayList");
  if (!completedList) return;
  const completedDate = document.getElementById("completedTodayDate");
  if (completedDate) completedDate.textContent = formatDisplayDate(getDateKey());
  const completedTasks = todayTasks.map((task, index) => ({ task, index })).filter(({ index }) => taskDone[index]);
  if (!completedTasks.length) {
    completedList.innerHTML = '<p class="completed-empty">Check off a task above to record what you accomplished.</p>';
    return;
  }
  completedList.innerHTML = completedTasks.map(({ task, index }) => `<article class="completed-task"><div class="completed-task-heading"><span class="completed-check">✓</span><strong>${escapeHtml(task)}</strong><div class="outcome-actions saved-link-actions"><button class="menu-trigger" type="button" data-tooltip="Choose an action for this note" aria-label="Choose an action for this note" aria-expanded="false" onclick="toggleLinkMenu(this)">⋮</button><div class="link-menu"><button type="button" onclick="editTaskOutcome(${index})">Update note</button></div></div></div><label class="outcome-label" for="taskOutcome-${index}">What did you complete?</label><textarea id="taskOutcome-${index}" class="task-outcome" maxlength="300" disabled>${escapeHtml(taskOutcomes[index] || "")}</textarea><div class="outcome-actions"><button class="action primary" type="button" onclick="saveTaskOutcome(${index})" hidden>Save update</button><button class="action" type="button" onclick="cancelTaskOutcomeEdit(${index})" hidden>Cancel</button></div></article>`).join("");
}
function toggleTask(index, checked) {
  if (!checked) {
    taskDone[index] = false;
    taskOutcomes[index] = "";
    persistTasks();
    renderTasks();
    return;
  }
  pendingTaskIndex = index;
  outcomeTaskLabel.textContent = `Add a short note for “${todayTasks[index]}” so your progress shows the work behind the checkmark.`;
  outcomeInput.value = taskOutcomes[index] || "";
  outcomeDialog.showModal();
  outcomeInput.focus();
}
function submitTaskOutcome(event) {
  event.preventDefault();
  if (pendingTaskIndex === null) return;
  taskDone[pendingTaskIndex] = true;
  taskOutcomes[pendingTaskIndex] = outcomeInput.value.trim();
  pendingTaskIndex = null;
  persistTasks();
  renderTasks();
  outcomeDialog.close();
  outcomeInput.value = "";
}
function cancelTaskOutcome() {
  pendingTaskIndex = null;
  outcomeDialog.close();
  renderTasks();
}
function editTaskOutcome(index) { const input = document.getElementById(`taskOutcome-${index}`); const card = input.closest(".completed-task"); const actions = card.querySelector(".outcome-actions:not(.saved-link-actions)").querySelectorAll("button"); const menu = card.querySelector(".link-menu"); menu.classList.remove("open"); menu.previousElementSibling.setAttribute("aria-expanded", "false"); input.disabled = false; actions[0].hidden = false; actions[1].hidden = false; input.focus(); }
function saveTaskOutcome(index) { const input = document.getElementById(`taskOutcome-${index}`); const outcome = input.value.trim(); if (!outcome) return; taskOutcomes[index] = outcome; persistTasks(); renderCompletedToday(); }
function cancelTaskOutcomeEdit(index) { renderCompletedToday(); }
function openTaskEditor(index = null) { editingTaskIndex = index; taskDialogTitle.textContent = index === null ? "Add a task" : "Edit task"; taskNameInput.value = index === null ? "" : todayTasks[index]; taskDialog.showModal(); taskNameInput.focus(); }
function editTask(event, index) { event.preventDefault(); event.stopPropagation(); openTaskEditor(index); }
function deleteTask(event, index) { event.preventDefault(); event.stopPropagation(); if (!window.confirm(`Delete "${todayTasks[index]}" from Today’s rhythm?`)) return; todayTasks.splice(index, 1); taskDone.splice(index, 1); taskOutcomes.splice(index, 1); persistTasks(); renderTasks(); }
function saveTask(event) { event.preventDefault(); const name = taskNameInput.value.trim(); if (!name) return; if (editingTaskIndex === null) { todayTasks.push(name); taskDone.push(false); taskOutcomes.push(""); } else todayTasks[editingTaskIndex] = name; persistTasks(); renderTasks(); taskDialog.close(); taskNameInput.value = ""; editingTaskIndex = null; }

function showCampusHome() {
  document.getElementById("authView").hidden = true;
  document.getElementById("campusView").hidden = false;
  document.getElementById("studioView").hidden = true;
  document.getElementById("academicView").hidden = true;
  window.scrollTo(0, 0);
}

function showPlacementStudio() {
  document.getElementById("authView").hidden = true;
  document.getElementById("campusView").hidden = true;
  document.getElementById("studioView").hidden = false;
  document.getElementById("academicView").hidden = true;
  const profileNote = document.getElementById("studioProfileNote");
  if (profileNote && activeProfile) profileNote.textContent = `Personalized for ${activeProfile.name}.`;
  window.scrollTo(0, 0);
}

function demoLogout() {
  localStorage.removeItem("campusPilotActiveProfile");
  window.location.reload();
}

function initializePortal() {
  const authView = document.getElementById("authView");
  const campusView = document.getElementById("campusView");
  const studioView = document.getElementById("studioView");
  const academicView = document.getElementById("academicView");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const greeting = document.getElementById("studentGreeting");
  const ownerPanel = document.getElementById("ownerPanel");
  const campusDate = document.getElementById("campusDate");
  const academicProfileForm = document.getElementById("academicProfileForm");
  const courseNameInput = document.getElementById("courseNameInput");
  const semesterSelect = document.getElementById("semesterSelect");

  if (!activeProfile) {
    greeting.textContent = "Student";
    const today = new Date();
    document.getElementById("campusDay").textContent = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(today);
    campusDate.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(today);
    ownerPanel.hidden = true;
    showCampusHome();
  } else {
    greeting.textContent = activeProfile.name;
    const today = new Date();
    document.getElementById("campusDay").textContent = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(today);
    campusDate.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(today);
    ownerPanel.hidden = activeProfile.role !== "owner";
    showCampusHome();
  }

  if (courseNameInput) courseNameInput.value = academicState.course || "";
  if (semesterSelect) semesterSelect.value = academicState.currentSemester || "1";

  if (academicProfileForm) {
    academicProfileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const course = courseNameInput.value.trim();
      const semester = semesterSelect.value;
      if (!course) return;
      academicState.course = course;
      academicState.currentSemester = semester;
      ensureAcademicSemester(semester);
      saveAcademicState();
      renderAcademicSemesters();
      showAcademicStudio();
    });
  }

  if (loginForm) loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("studentNameInput").value.trim();
    const identity = document.getElementById("studentEmailInput").value.trim().toLowerCase();
    const password = document.getElementById("studentPasswordInput").value;
    const role = document.getElementById("accountTypeInput").value;
    if (name.length < 2 || identity.length < 2 || password.length < 4) {
      loginError.textContent = "Enter your name, student ID or email, and a 4-character demo password.";
      loginError.hidden = false;
      return;
    }
    const profile = { id: identity.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, identity, role };
    localStorage.setItem("campusPilotActiveProfile", JSON.stringify(profile));
    window.location.reload();
  });

  const campusLogoutButton = document.getElementById("campusLogoutButton");
  if (campusLogoutButton) campusLogoutButton.addEventListener("click", demoLogout);
  document.querySelectorAll("[data-feature]").forEach((feature) => feature.addEventListener("click", () => {
    if (feature.dataset.feature === "placement") return showPlacementStudio();
    if (feature.dataset.feature === "academic") {
      const message = document.getElementById("featureMessage");
      message.textContent = "Academic Studio is coming soon.";
      message.hidden = false;
      return;
    }
    const message = document.getElementById("featureMessage");
    message.textContent = `${feature.querySelector("strong").textContent} will be available in a future CampusPilot update.`;
    message.hidden = false;
  }));
}

document.getElementById("todayDate").textContent = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
applyHubVisibility();
renderAcademicSemesters();
renderCustomHubs();
renderLinks();
renderStudyTopicOptions();
renderTasks();
renderYesterdayTasks();
renderHistoryCalendar();
renderSelectedHistoryDate();

if (prevMonthButton) prevMonthButton.addEventListener("click", () => setHistoryMonth(-1));
if (nextMonthButton) nextMonthButton.addEventListener("click", () => setHistoryMonth(1));
if (document.getElementById("openHistoryCalendarButton")) {
  document.getElementById("openHistoryCalendarButton").addEventListener("click", openHistoryCalendar);
}
if (calendarGrid) {
  calendarGrid.addEventListener("click", (event) => {
    const target = event.target.closest(".calendar-day");
    if (!target) return;
    selectedHistoryDate = target.dataset.dateKey;
    renderHistoryCalendar();
    renderSelectedHistoryDate();
  });
}
const checklist = document.getElementById("checklist");
let draggedTaskIndex = null;
if (checklist) {
  checklist.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".check-row");
    if (!row) return;
    draggedTaskIndex = Number(row.dataset.taskIndex);
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(draggedTaskIndex));
  });
  checklist.addEventListener("dragover", (event) => {
    if (event.target.closest(".check-row")) event.preventDefault();
  });
  checklist.addEventListener("drop", (event) => {
    event.preventDefault();
    const row = event.target.closest(".check-row");
    if (!row) return;
    reorderTask(draggedTaskIndex, Number(row.dataset.taskIndex));
    draggedTaskIndex = null;
  });
  checklist.addEventListener("dragend", (event) => {
    event.target.closest(".check-row")?.classList.remove("dragging");
    draggedTaskIndex = null;
  });
}

initializePortal();

let previousScrollPosition = window.scrollY;
window.addEventListener("scroll", () => {
  const currentScrollPosition = window.scrollY;
  const campusView = document.getElementById("campusView");
  if (!campusView || campusView.hidden) return;
  if (currentScrollPosition < previousScrollPosition - 4) campusView.classList.add("scrolling-up");
  if (currentScrollPosition > previousScrollPosition + 4) campusView.classList.remove("scrolling-up");
  previousScrollPosition = currentScrollPosition;
}, { passive: true });
