const clone = value => {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
};

const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Unable to read ${key} from storage`, error);
      return clone(fallback);
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to write ${key} to storage`, error);
    }
  }
};

const settingsKey = "studentflow-settings";
const scheduleKey = "studentflow-schedule";
const assignmentKey = "studentflow-assignments";
const noteKey = "studentflow-notes";
const goalKey = "studentflow-goals";

const defaultSettings = {
  accent: "teal",
  depth: "midnight",
  density: "balanced"
};

function applyTheme(preferences) {
  const body = document.body;
  body.dataset.accent = preferences.accent;
  body.dataset.depth = preferences.depth;
  body.dataset.density = preferences.density;
}

function initTheme() {
  const saved = storage.get(settingsKey, defaultSettings);
  applyTheme(saved);
}

function initModals() {
  const openers = document.querySelectorAll("[data-open]");
  const closers = document.querySelectorAll("[data-close]");

  openers.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.open);
      if (target) target.hidden = false;
    });
  });

  closers.forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) modal.hidden = true;
    });
  });

  document.addEventListener("click", event => {
    if (event.target.classList?.contains("modal")) {
      event.target.hidden = true;
    }
  });
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(date));
}

function formatTime(time) {
  if (!time) return "";
  const [hour, minute] = time.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute));
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(date);
}


function renderCalendarPage() {
  const calendarGrid = document.getElementById("calendar-grid");
  const monthHeading = document.getElementById("calendar-month");
  const modal = document.getElementById("calendar-modal");
  const form = document.getElementById("calendar-form");
  const typeSelect = document.getElementById("calendar-entry-type");
  const scheduleGroups = form?.querySelectorAll('[data-entry-group="schedule"]');
  const assignmentGroups = form?.querySelectorAll('[data-entry-group="assignment"]');
  const scheduleRequired = form?.querySelectorAll('[data-entry-group="schedule"] [data-required]');
  const assignmentRequired = form?.querySelectorAll('[data-entry-group="assignment"] [data-required]');

  if (!calendarGrid || !monthHeading) return;

  let focusDate = startOfMonth(new Date());

  function removeScheduleItem(id) {
    const updated = storage.get(scheduleKey, []).filter(item => item.id !== id);
    storage.set(scheduleKey, updated);
    render();
  }

  function removeAssignmentItem(id) {
    const updated = storage.get(assignmentKey, []).filter(item => item.id !== id);
    storage.set(assignmentKey, updated);
    render();
  }

  function toggleAssignmentCompletion(id) {
    const updated = storage.get(assignmentKey, []).map(item => item.id === id ? { ...item, completed: !item.completed } : item);
    storage.set(assignmentKey, updated);
    render();
  }

  function updateFieldVisibility() {
    if (!form || !typeSelect) return;
    const type = typeSelect.value;
    scheduleGroups?.forEach(group => {
      group.hidden = type !== "schedule";
    });
    assignmentGroups?.forEach(group => {
      group.hidden = type !== "assignment";
    });
    scheduleRequired?.forEach(input => {
      input.required = type === "schedule";
    });
    assignmentRequired?.forEach(input => {
      input.required = type === "assignment";
    });
  }

  function render() {
    const schedule = storage.get(scheduleKey, []);
    const assignments = storage.get(assignmentKey, []);
    monthHeading.textContent = formatMonthLabel(focusDate);

    const monthStart = startOfMonth(focusDate);
    const firstDay = monthStart.getDay();
    const offset = (firstDay + 6) % 7; // start week on Monday
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - offset);
    const todayKey = toDateKey(new Date());

    calendarGrid.innerHTML = "";

    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const dayKey = toDateKey(day);
      const inMonth = day.getMonth() === focusDate.getMonth();
      const daySchedule = schedule
        .filter(item => toDateKey(item.date) === dayKey)
        .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
      const dayAssignments = assignments
        .filter(item => toDateKey(item.due) === dayKey)
        .sort((a, b) => Number(a.completed) - Number(b.completed));

      const cell = document.createElement("div");
      cell.className = "calendar-day";
      if (!inMonth) cell.classList.add("calendar-day--muted");
      if (dayKey === todayKey) cell.classList.add("calendar-day--today");
      cell.dataset.date = dayKey ?? "";

      const header = document.createElement("header");
      const heading = document.createElement("div");
      heading.className = "day-heading";
      const dayName = document.createElement("span");
      dayName.className = "day-name";
      dayName.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day);
      const dayNumber = document.createElement("span");
      dayNumber.className = "day-number";
      dayNumber.textContent = day.getDate().toString();
      heading.append(dayName, dayNumber);
      header.appendChild(heading);

      const pending = dayAssignments.filter(item => !item.completed).length;
      if (pending) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `${pending} due`;
        header.appendChild(badge);
      }

      cell.appendChild(header);

      const list = document.createElement("ul");
      list.className = "calendar-items";

      daySchedule.forEach(eventItem => {
        const li = document.createElement("li");
        li.className = "calendar-item schedule";
        const timeLabel = [formatTime(eventItem.start), formatTime(eventItem.end)].filter(Boolean).join(" – ");
        li.innerHTML = `
          <div class="calendar-item-main">
            <span class="calendar-dot" aria-hidden="true"></span>
            <div class="calendar-text">
              <span class="calendar-title">${timeLabel ? `${timeLabel} · ` : ""}${eventItem.title}</span>
              <span class="calendar-sub">${eventItem.type}</span>
            </div>
          </div>
          <button type="button" class="calendar-remove" data-remove-schedule="${eventItem.id}" aria-label="Remove ${eventItem.title}">&times;</button>`;
        if (eventItem.notes) {
          li.title = eventItem.notes;
        }
        list.appendChild(li);
      });

      dayAssignments.forEach(assignment => {
        const li = document.createElement("li");
        li.className = `calendar-item assignment${assignment.completed ? " completed" : ""}`;
        li.dataset.toggleAssignment = assignment.id;
        li.setAttribute("tabindex", "0");
        li.setAttribute("role", "button");
        li.setAttribute("aria-pressed", assignment.completed ? "true" : "false");
        const course = assignment.course?.trim();
        const status = assignment.completed ? "Completed" : "Mark complete";
        li.innerHTML = `
          <div class="calendar-item-main">
            <span class="calendar-dot" aria-hidden="true"></span>
            <div class="calendar-text">
              <span class="calendar-title">${assignment.title}</span>
              <span class="calendar-sub">${course ? `${course} • ${status}` : status}</span>
            </div>
          </div>
          <button type="button" class="calendar-remove" data-remove-assignment="${assignment.id}" aria-label="Remove ${assignment.title}">&times;</button>`;
        const actionHint = assignment.completed ? "Click to undo completion" : "Click to mark complete";
        li.title = assignment.notes ? `${assignment.notes} — ${actionHint}` : actionHint;
        list.appendChild(li);
      });

      cell.appendChild(list);
      calendarGrid.appendChild(cell);
    }
  }

  document.querySelectorAll('[data-calendar-nav]').forEach(button => {
    button.addEventListener("click", () => {
      const direction = button.dataset.calendarNav;
      focusDate.setMonth(focusDate.getMonth() + (direction === "next" ? 1 : -1));
      render();
    });
  });

  calendarGrid.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const removeSchedule = target.closest('[data-remove-schedule]');
    if (removeSchedule) {
      const id = removeSchedule.dataset.removeSchedule;
      removeScheduleItem(id);
      return;
    }

    const removeAssignment = target.closest('[data-remove-assignment]');
    if (removeAssignment) {
      const id = removeAssignment.dataset.removeAssignment;
      removeAssignmentItem(id);
      return;
    }

    const toggle = target.closest('[data-toggle-assignment]');
    if (toggle) {
      const id = toggle.dataset.toggleAssignment;
      toggleAssignmentCompletion(id);
    }
  });

  calendarGrid.addEventListener("keydown", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    const toggle = target.closest('[data-toggle-assignment]');
    if (toggle && target === toggle) {
      event.preventDefault();
      const id = toggle.dataset.toggleAssignment;
      toggleAssignmentCompletion(id);
    }
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!typeSelect) return;
    const type = typeSelect.value;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const title = data.title?.toString().trim();
    const notes = data.notes?.toString().trim();
    const cleanNotes = notes ?? "";

    if (!title) {
      return;
    }

    if (type === "schedule") {
      const schedule = storage.get(scheduleKey, []);
      if (!data["event-date"] || !data.start || !data.end) {
        return;
      }
      schedule.push({
        id: makeId(),
        title,
        type: data["event-type"],
        date: data["event-date"],
        start: data.start,
        end: data.end,
        notes: cleanNotes
      });
      storage.set(scheduleKey, schedule);
    } else {
      const assignments = storage.get(assignmentKey, []);
      if (!data["due-date"]) {
        return;
      }
      assignments.push({
        id: makeId(),
        title,
        course: data.course?.toString().trim() ?? "",
        due: data["due-date"],
        notes: cleanNotes,
        completed: false
      });
      storage.set(assignmentKey, assignments);
    }

    if (modal) modal.hidden = true;
    form.reset();
    if (typeSelect) {
      typeSelect.value = "schedule";
    }
    updateFieldVisibility();
    render();
  });

  typeSelect?.addEventListener("change", () => {
    updateFieldVisibility();
  });

  updateFieldVisibility();
  render();
}

function renderAssignmentsPage() {
  const list = document.getElementById("assignment-list");
  const form = document.getElementById("assignment-form");
  const modal = document.getElementById("assignment-modal");
  const completedMetric = document.getElementById("assign-completed");
  const totalMetric = document.getElementById("assign-total");
  const progressBar = document.getElementById("assign-progress");

  function refresh() {
    const assignments = storage.get(assignmentKey, []);
    if (!assignments.length) {
      list.innerHTML = '<div class="empty-state">No assignments yet. Add one to set your next milestone.</div>';
      completedMetric.textContent = "0";
      totalMetric.textContent = "0";
      progressBar.style.width = "0%";
      return;
    }

    list.innerHTML = "";
    assignments.sort((a, b) => a.due.localeCompare(b.due)).forEach(item => {
      const li = document.createElement("li");
      li.className = "assignment-card";
      li.innerHTML = `
        <header>
          <div>
            <h3>${item.title}</h3>
            <p class="course">${item.course}</p>
          </div>
          <button class="chip-action" data-remove="${item.id}">Remove</button>
        </header>
        ${item.notes ? `<p class="notes">${item.notes}</p>` : ""}
        <footer>
          <span class="due-date">Due ${formatDate(item.due)}</span>
          <button class="btn ghost" data-toggle="${item.id}">${item.completed ? "Completed" : "Mark complete"}</button>
        </footer>`;
      list.appendChild(li);
    });

    const total = assignments.length;
    const completed = assignments.filter(item => item.completed).length;
    completedMetric.textContent = completed.toString();
    totalMetric.textContent = total.toString();
    progressBar.style.width = `${total ? Math.round((completed / total) * 100) : 0}%`;
  }

  list?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const assignments = storage.get(assignmentKey, []);

    if (target.dataset.toggle) {
      const id = target.dataset.toggle;
      const updated = assignments.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
      storage.set(assignmentKey, updated);
      refresh();
    }

    if (target.dataset.remove) {
      const id = target.dataset.remove;
      const updated = assignments.filter(item => item.id !== id);
      storage.set(assignmentKey, updated);
      refresh();
    }
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const assignments = storage.get(assignmentKey, []);
    assignments.push({
      id: makeId(),
      title: data.title,
      course: data.course,
      due: data.due,
      notes: data.notes,
      completed: false
    });
    storage.set(assignmentKey, assignments);
    modal.hidden = true;
    form.reset();
    refresh();
  });

  refresh();
}

function renderNotesPage() {
  const grid = document.getElementById("note-grid");
  const form = document.getElementById("note-form");
  const modal = document.getElementById("note-modal");
  const filter = document.getElementById("note-filter");
  const sortSelect = document.getElementById("note-sort");

  function populateFilter(notes) {
    const tags = new Set(notes.filter(note => note.tag).map(note => note.tag));
    filter.innerHTML = '<option value="all">All</option>';
    tags.forEach(tag => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      filter.appendChild(option);
    });
  }

  function render() {
    const notes = storage.get(noteKey, []);
    if (!notes.length) {
      grid.innerHTML = '<div class="empty-state">No notes yet. Capture a thought to begin.</div>';
      populateFilter([]);
      return;
    }

    populateFilter(notes);
    let filtered = [...notes];
    if (filter.value !== "all") {
      filtered = filtered.filter(note => note.tag === filter.value);
    }

    filtered.sort((a, b) => {
      if (sortSelect.value === "oldest") {
        return new Date(a.created) - new Date(b.created);
      }
      return new Date(b.created) - new Date(a.created);
    });

    grid.innerHTML = "";
    filtered.forEach(note => {
      const article = document.createElement("article");
      article.className = "note-card";
      article.innerHTML = `
        <h3>${note.title}</h3>
        ${note.tag ? `<span class="tag">${note.tag}</span>` : ""}
        <p>${note.content.replace(/\n/g, "<br>")}</p>
        <div class="note-footer">
          <span>${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created))}</span>
          <button class="chip-action" data-delete="${note.id}">Remove</button>
        </div>`;
      grid.appendChild(article);
    });
  }

  grid?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.delete) {
      const notes = storage.get(noteKey, []);
      const updated = notes.filter(note => note.id !== target.dataset.delete);
      storage.set(noteKey, updated);
      render();
    }
  });

  filter?.addEventListener("change", render);
  sortSelect?.addEventListener("change", render);

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const notes = storage.get(noteKey, []);
    notes.push({
      id: makeId(),
      title: data.title,
      tag: data.tag,
      content: data.content,
      created: new Date().toISOString()
    });
    storage.set(noteKey, notes);
    modal.hidden = true;
    form.reset();
    render();
  });

  render();
}

function renderGoalsPage() {
  const form = document.getElementById("goal-form");
  const modal = document.getElementById("goal-modal");
  const lists = document.querySelectorAll(".goal-list");

  function render() {
    const goals = storage.get(goalKey, []);
    const grouped = goals.reduce((acc, goal) => {
      acc[goal.scope] = acc[goal.scope] || [];
      acc[goal.scope].push(goal);
      return acc;
    }, {});

    lists.forEach(list => {
      const scope = list.dataset.scope;
      const items = grouped[scope] || [];
      list.innerHTML = "";
      if (!items.length) {
        list.innerHTML = '<li class="empty-state">Set a goal to begin.</li>';
        return;
      }

      items.sort((a, b) => (a.target || "").localeCompare(b.target || ""));
      items.forEach(goal => {
        const li = document.createElement("li");
        li.className = "goal-card";
        li.innerHTML = `
          <h3>${goal.title}</h3>
          <p>${goal.description}</p>
          <footer>
            <span>${goal.target ? `Target ${formatDate(goal.target)}` : "Flexible timeline"}</span>
            <button class="chip-action" data-done="${goal.id}">${goal.completed ? "Completed" : "Celebrate"}</button>
            <button class="chip-action" data-remove="${goal.id}">Remove</button>
          </footer>
          ${goal.completed ? '<span class="celebrate">✨ Well done!</span>' : ""}`;
        list.appendChild(li);
      });
    });
  }

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest(".goal-list")) return;
    const goals = storage.get(goalKey, []);

    if (target.dataset.done) {
      const updated = goals.map(goal => goal.id === target.dataset.done ? { ...goal, completed: !goal.completed } : goal);
      storage.set(goalKey, updated);
      render();
    }

    if (target.dataset.remove) {
      const updated = goals.filter(goal => goal.id !== target.dataset.remove);
      storage.set(goalKey, updated);
      render();
    }
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const goals = storage.get(goalKey, []);
    goals.push({
      id: makeId(),
      title: data.title,
      description: data.description,
      scope: data.scope,
      target: data.target,
      completed: false
    });
    storage.set(goalKey, goals);
    modal.hidden = true;
    form.reset();
    render();
  });

  render();
}

function renderSettingsPage() {
  const form = document.getElementById("settings-form");
  if (!form) return;
  const preferences = storage.get(settingsKey, defaultSettings);

  form.elements["accent"].value = preferences.accent;
  form.elements["depth"].value = preferences.depth;
  form.elements["density"].value = preferences.density;

  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    storage.set(settingsKey, data);
    applyTheme(data);
    const button = form.querySelector("button[type='submit']");
    if (button) {
      button.textContent = "Saved ✔";
      setTimeout(() => (button.textContent = "Save preferences"), 1800);
    }
  });
}

initTheme();
initModals();

switch (document.body.dataset.page) {
  case "dashboard":
    renderCalendarPage();
    break;
  case "assignments":
    renderAssignmentsPage();
    break;
  case "notes":
    renderNotesPage();
    break;
  case "goals":
    renderGoalsPage();
    break;
  case "settings":
    renderSettingsPage();
    break;
  default:
    break;
}
