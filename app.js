const storedLinks = JSON.parse(localStorage.getItem("placementLinks") || "{}");
const links = { dsa: [], subjects: [] };
const removedHubs = JSON.parse(localStorage.getItem("placementRemovedHubs") || "[]");
const defaultTasks = ["Complete one DSA problem", "Revise one engineering topic", "Work on Aptitude", "Write down one thing I learned"];
const todayTasks = JSON.parse(localStorage.getItem("placementTasks") || JSON.stringify(defaultTasks)).map((task) => typeof task === "string" ? task : task.name);
defaultTasks.forEach((task) => { if (!todayTasks.includes(task)) todayTasks.push(task); });
const taskDone = JSON.parse(localStorage.getItem("placementTaskProgress") || "[]");
const customHubs = JSON.parse(localStorage.getItem("placementCustomHubs") || "[]");
customHubs.forEach((hub) => { links[hub.id] = Array.isArray(hub.sources) ? hub.sources : []; });

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
const removeCardsDialog = document.getElementById("removeCardsDialog");
const removeDsaInput = document.getElementById("removeDsaInput");
const removeSubjectsInput = document.getElementById("removeSubjectsInput");

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function hubDetails(resource) {
  if (resource === "dsa") return { name: "DSA playlist" };
  if (resource === "subjects") return { name: "Engineering subjects" };
  return customHubs.find((hub) => hub.id === resource) || { name: "Study hub" };
}
function persistLinks() { localStorage.setItem("placementLinks", JSON.stringify(links)); }
function persistCustomHubs() { localStorage.setItem("placementCustomHubs", JSON.stringify(customHubs)); }
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
function saveLink(event) { event.preventDefault(); if (savingLink) return; savingLink = true; saveLinkButton.disabled = true; const item = { name: nameInput.value.trim(), description: descriptionInput.value.trim(), priority: normalizePriority(priorityInput.value), url: input.value.trim() }; const duplicateIndex = links[activeResource].findIndex((saved) => saved.url === item.url && saved.url); if (editingIndex === null && duplicateIndex !== -1) links[activeResource][duplicateIndex] = item; else if (editingIndex === null) links[activeResource].push(item); else links[activeResource][editingIndex] = item; persistLinks(); const hub = customHubs.find((item) => item.id === activeResource); if (hub) { hub.sources = links[activeResource]; persistCustomHubs(); } renderLinks(); if (document.getElementById("allDialog").open) renderAllPlaylists(); resetLinkForm(); editingIndex = null; dialog.close(); }
dialog.addEventListener("close", resetLinkForm);
function refreshLinks() { let latest = {}; try { latest = JSON.parse(localStorage.getItem("placementLinks") || "{}"); } catch (error) {} Object.keys(links).forEach((key) => { const saved = latest[key]; const normalized = Array.isArray(saved) ? saved.map((item) => ({ name: item.name || "Saved source", url: item.url || "", description: item.description || "", priority: normalizePriority(item.priority) })) : typeof saved === "string" && saved ? [{ name: "Saved source", url: saved, description: "", priority: 1 }] : []; links[key].splice(0, links[key].length, ...normalized); }); }
function resetSources(resource) { if (!window.confirm(`Remove all saved sources from ${hubDetails(resource).name}? This cannot be undone, but you can add them again afterward.`)) return; links[resource].splice(0, links[resource].length); persistLinks(); renderLinks(); if (document.getElementById("allDialog").open && allResource === resource) renderAllPlaylists(); }
function resetDsaSources() { resetSources("dsa"); }
function resetSubjectSources() { resetSources("subjects"); }
function openAll(resource) { refreshLinks(); renderLinks(); allResource = resource; const title = resource === "dsa" ? "All DSA playlists" : resource === "subjects" ? "All engineering subject playlists" : `All ${hubDetails(resource).name} playlists`; document.getElementById("allDialogTitle").textContent = title; document.getElementById("priorityFilter").value = "all"; renderAllPlaylists(); document.getElementById("allDialog").showModal(); }
function renderAllPlaylists() { const filter = document.getElementById("priorityFilter").value; const sorted = links[allResource].map((item, index) => ({ item, index })).filter(({ item }) => filter === "all" || String(item.priority) === filter).sort((a, b) => a.item.priority - b.item.priority); document.getElementById("allList").innerHTML = sorted.length ? sorted.map(({ item, index }) => `<article class="all-item"><div><h3>${escapeHtml(item.name)}</h3><span class="priority-badge">${escapeHtml(item.priority)} priority</span>${item.description ? `<p>${escapeHtml(item.description)}</p>` : "<p>No description added yet.</p>"}</div><div class="all-item-actions"><button class="menu-trigger" type="button" data-tooltip="Choose an action for this link" aria-label="Choose an action for ${escapeHtml(item.name)}" aria-expanded="false" onclick="toggleLinkMenu(this)">⋮</button><div class="link-menu"><a href="${escapeHtml(item.url)}">Open playlist ↗</a><button type="button" onclick="editLink('${allResource}', ${index})">Edit link</button><button class="delete-link" type="button" onclick="deleteLink('${allResource}', ${index})">Delete link</button></div></div></article>`).join("") : `<div class="empty-state">No playlists match this priority yet.</div>`; }
function openHubCreator() { hubNameInput.value = ""; hubDialog.showModal(); hubNameInput.focus(); }
function createStudyHub(event) { event.preventDefault(); const name = hubNameInput.value.trim(); if (!name) return; const id = `hub-${Date.now()}`; customHubs.push({ id, name, sources: [] }); links[id] = []; persistCustomHubs(); renderCustomHubs(); renderLinks(); hubDialog.close(); hubNameInput.value = ""; }
function applyHubVisibility() { document.getElementById("dsaCard").hidden = removedHubs.includes("dsa"); document.getElementById("subjectsCard").hidden = removedHubs.includes("subjects"); document.getElementById("restoreHubsButton").hidden = removedHubs.length === 0; }
function openRemoveCards() { removeDsaInput.checked = removedHubs.includes("dsa"); removeSubjectsInput.checked = removedHubs.includes("subjects"); removeCardsDialog.showModal(); }
function removeSelectedCards(event) { event.preventDefault(); const selected = []; if (removeDsaInput.checked) selected.push("dsa"); if (removeSubjectsInput.checked) selected.push("subjects"); if (!selected.length) return removeCardsDialog.close(); if (!window.confirm(`Remove ${selected.map((resource) => hubDetails(resource).name).join(" and ")} card${selected.length > 1 ? "s" : ""}? Your saved sources will stay safe and can be restored later.`)) return; removedHubs.splice(0, removedHubs.length, ...selected); localStorage.setItem("placementRemovedHubs", JSON.stringify(removedHubs)); applyHubVisibility(); removeCardsDialog.close(); }
function restoreDefaultHubs() { removedHubs.splice(0, removedHubs.length); localStorage.setItem("placementRemovedHubs", JSON.stringify(removedHubs)); applyHubVisibility(); }
function persistTasks() { localStorage.setItem("placementTasks", JSON.stringify(todayTasks)); localStorage.setItem("placementTaskProgress", JSON.stringify(taskDone)); }
function updateProgress() { document.getElementById("completedCount").textContent = `${taskDone.slice(0, todayTasks.length).filter(Boolean).length}/${todayTasks.length}`; }
function renderTasks() { document.getElementById("checklist").innerHTML = todayTasks.map((task, index) => `<label class="check-row"><input type="checkbox" ${taskDone[index] ? "checked" : ""} onchange="toggleTask(${index}, this.checked)" /><span>${escapeHtml(task)}</span><span class="task-actions"><button class="task-action" type="button" onclick="editTask(event, ${index})" aria-label="Edit task">✎</button><button class="task-action" type="button" onclick="deleteTask(event, ${index})" aria-label="Delete task">×</button></span></label>`).join(""); updateProgress(); }
function toggleTask(index, checked) { taskDone[index] = checked; persistTasks(); updateProgress(); }
function openTaskEditor(index = null) { editingTaskIndex = index; taskDialogTitle.textContent = index === null ? "Add a task" : "Edit task"; taskNameInput.value = index === null ? "" : todayTasks[index]; taskDialog.showModal(); taskNameInput.focus(); }
function editTask(event, index) { event.preventDefault(); event.stopPropagation(); openTaskEditor(index); }
function deleteTask(event, index) { event.preventDefault(); event.stopPropagation(); if (!window.confirm(`Delete "${todayTasks[index]}" from Today’s rhythm?`)) return; todayTasks.splice(index, 1); taskDone.splice(index, 1); persistTasks(); renderTasks(); }
function saveTask(event) { event.preventDefault(); const name = taskNameInput.value.trim(); if (!name) return; if (editingTaskIndex === null) { todayTasks.push(name); taskDone.push(false); } else todayTasks[editingTaskIndex] = name; persistTasks(); renderTasks(); taskDialog.close(); taskNameInput.value = ""; editingTaskIndex = null; }

document.getElementById("todayDate").textContent = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
applyHubVisibility();
renderCustomHubs();
renderLinks();
renderTasks();
