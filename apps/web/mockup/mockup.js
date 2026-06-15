const workItems = [
  {
    selected: true,
    id: "INIT-000123",
    type: "Initiative",
    typeClass: "initiative",
    title: "AOS Operations Cockpit",
    stage: "3. Ops Cockpit",
    status: "In Progress",
    statusClass: "progress",
    owner: "Ilya",
    priority: "P0",
    priorityClass: "p0",
    blocker: "PD-OPT-001",
    blockerTone: "high",
    evidence: "3h ago",
    activity: "16m ago"
  },
  {
    id: "EPIC-000589",
    type: "Epic",
    typeClass: "epic",
    title: "Functional Contract",
    stage: "3. Ops Cockpit",
    status: "In Progress",
    statusClass: "progress",
    owner: "Verity",
    priority: "P0",
    priorityClass: "p0",
    blocker: "BUILD-012",
    blockerTone: "medium",
    evidence: "1h ago",
    activity: "24m ago"
  },
  {
    id: "STORY-001234",
    type: "Story",
    typeClass: "story",
    title: "Cockpit Layout Contract",
    stage: "3. Ops Cockpit",
    status: "Review",
    statusClass: "review",
    owner: "Talia",
    priority: "P0",
    priorityClass: "p0",
    blocker: "PD-OPT-001",
    blockerTone: "high",
    evidence: "45m ago",
    activity: "32m ago"
  },
  {
    id: "STORY-001235",
    type: "Story",
    typeClass: "story",
    title: "Metrics Widget Set",
    stage: "3. Ops Cockpit",
    status: "Done",
    statusClass: "done",
    owner: "Ilya",
    priority: "P1",
    priorityClass: "p1",
    blocker: "—",
    evidence: "2h ago",
    activity: "1h ago"
  },
  {
    id: "STORY-001236",
    type: "Story",
    typeClass: "story",
    title: "AI Employee Panel",
    stage: "3. Ops Cockpit",
    status: "Review",
    statusClass: "review",
    owner: "Talia",
    priority: "P1",
    priorityClass: "p1",
    blocker: "—",
    evidence: "1h ago",
    activity: "1h ago"
  },
  {
    id: "STORY-001237",
    type: "Story",
    typeClass: "story",
    title: "Conference Links Panel",
    stage: "2. Gateway",
    status: "In Progress",
    statusClass: "progress",
    owner: "Rowan",
    priority: "P1",
    priorityClass: "p1",
    blocker: "CONF-067",
    blockerTone: "low",
    evidence: "30m ago",
    activity: "2h ago"
  },
  {
    id: "EPIC-000590",
    type: "Epic",
    typeClass: "epic",
    title: "MCP Gateway Reliability",
    stage: "2. Gateway",
    status: "In Progress",
    statusClass: "progress",
    owner: "Ilya",
    priority: "P0",
    priorityClass: "p0",
    blocker: "—",
    evidence: "2h ago",
    activity: "—"
  },
  {
    id: "STORY-001238",
    type: "Story",
    typeClass: "story",
    title: "Gateway Health Monitor",
    stage: "2. Gateway",
    status: "Done",
    statusClass: "done",
    owner: "Ilya",
    priority: "P1",
    priorityClass: "p1",
    blocker: "—",
    evidence: "3h ago",
    activity: "3h ago"
  },
  {
    id: "INIT-000124",
    type: "Initiative",
    typeClass: "initiative",
    title: "AI Execution Engine",
    stage: "4. AI Execution",
    status: "Planned",
    statusClass: "planned",
    owner: "—",
    priority: "P1",
    priorityClass: "p1",
    blocker: "—",
    evidence: "—",
    activity: "—"
  },
  {
    id: "INIT-000125",
    type: "Initiative",
    typeClass: "initiative",
    title: "Release Readiness",
    stage: "5. Release",
    status: "Planned",
    statusClass: "planned",
    owner: "—",
    priority: "P0",
    priorityClass: "p0",
    blocker: "—",
    evidence: "—",
    activity: "—"
  }
];

const viewLabels = {
  Cockpit: "Project Cockpit",
  "Work Index": "Work Index",
  "Stage Map": "Stage Map",
  "Employee List": "Employee List",
  Conference: "Conference",
  "Approval Flows": "Approval Flows",
  "MCP Gateway": "MCP Gateway",
  "Knowledge Base": "Knowledge Base",
  "User Guide": "User Guide",
  "Release Notes": "Release Notes",
  "Resource Library": "Resource Library",
  "Dependency & License": "Dependency & License",
  "Evidence Ledger": "Evidence Ledger",
  "Audit Log": "Audit Log",
  "Local Storage": "Local Storage",
  Integrations: "Integrations",
  Settings: "Settings"
};

const table = document.querySelector(".work-table");
const search = document.querySelector("#workSearch");
const navRows = Array.from(document.querySelectorAll(".nav-row"));
const shell = document.querySelector(".app-shell");

const drawer = {
  id: document.querySelector("#drawerId"),
  title: document.querySelector("#drawerTitle"),
  stage: document.querySelector("#drawerStage"),
  owner: document.querySelector("#drawerOwner"),
  priority: document.querySelector("#drawerPriority"),
  status: document.querySelector("#drawerStatus"),
  blocker: document.querySelector("#drawerBlocker")
};

function ticketRow(item) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `table-row ticket-entry${item.selected ? " active" : ""}`;
  row.dataset.ticketId = item.id;
  row.innerHTML = `
    <span><input type="checkbox" ${item.selected ? "checked" : ""} aria-label="Select ${item.id}" /></span>
    <span>${item.id}</span>
    <span><em class="type ${item.typeClass}">${item.type}</em></span>
    <strong class="ticket-title">${item.title}</strong>
    <span class="stage">${item.stage}</span>
    <span><em class="status ${item.statusClass}">${item.status}</em></span>
    <span>${item.owner}</span>
    <span><em class="priority ${item.priorityClass}">${item.priority}</em></span>
    <span>${item.blocker === "—" ? "—" : `<i class="risk ${item.blockerTone}"></i> ${item.blocker}`}</span>
    <span class="${item.evidence === "—" ? "stale" : "fresh"}">${item.evidence}</span>
    <span>${item.activity}</span>
    <span class="row-menu">...</span>
  `;
  row.addEventListener("click", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    selectItem(item.id);
  });
  return row;
}

function renderRows() {
  document.querySelectorAll(".ticket-entry").forEach((row) => row.remove());
  const query = search.value.trim().toLowerCase();
  workItems
    .filter((item) => `${item.id} ${item.type} ${item.title} ${item.stage} ${item.owner} ${item.blocker}`.toLowerCase().includes(query))
    .forEach((item) => table.append(ticketRow(item)));
}

function selectItem(id) {
  const item = workItems.find((candidate) => candidate.id === id) ?? workItems[2];
  document.querySelectorAll(".ticket-entry").forEach((row) => {
    row.classList.toggle("active", row.dataset.ticketId === item.id);
  });
  drawer.id.textContent = item.id;
  drawer.title.textContent = item.title;
  drawer.stage.textContent = item.stage;
  drawer.owner.innerHTML = `<span class="tiny-avatar">${item.owner.slice(0, 2)}</span>${item.owner}`;
  drawer.priority.textContent = item.priority;
  drawer.priority.className = `pill ${item.priorityClass}`;
  drawer.status.textContent = item.status;
  drawer.status.className = `pill ${item.statusClass === "review" ? "review" : item.statusClass === "done" ? "ok" : "fresh"}`;
  drawer.blocker.textContent = item.blocker === "—" ? "No active blocker" : item.blocker;
}

navRows.forEach((row) => {
  row.addEventListener("click", () => {
    const view = row.dataset.view ?? "Cockpit";
    shell.dataset.activeView = viewLabels[view] ?? view;
    navRows.forEach((item) => item.classList.toggle("active", item === row));
  });
});

document.querySelectorAll("[data-ticket-id]").forEach((button) => {
  button.addEventListener("click", () => selectItem(button.dataset.ticketId));
});

search.addEventListener("input", renderRows);

renderRows();
selectItem("STORY-001234");
