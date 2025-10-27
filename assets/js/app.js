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

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}


function renderSchedulePage() {
  const scheduleList = document.getElementById("schedule-list");
  const weekLabel = document.querySelector(".week-label");
  const form = document.getElementById("schedule-form");
  const modal = document.getElementById("schedule-modal");
  let schedule = storage.get(scheduleKey, []);
  let currentWeekStart = startOfWeek(new Date());
  let editingId = null;

  function entriesForWeek(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return schedule.filter(item => {
      const date = new Date(item.date);
      return date >= startDate && date <= endDate;
    }).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  function renderWeek() {
    if (!scheduleList) return;
    const entries = entriesForWeek(currentWeekStart);
    weekLabel.textContent = `${formatDate(currentWeekStart)} – ${formatDate(new Date(currentWeekStart.getTime() + 6 * 86400000))}`;

    scheduleList.innerHTML = "";
    if (!entries.length) {
      scheduleList.innerHTML = `<div class="empty-state">No events this week. Add what matters most to you.</div>`;
      return;
    }

    entries.forEach(item => {
      const card = document.createElement("article");
      card.className = "timeline-card";
      card.innerHTML = `
        <div class="times">
          <div>${formatDate(item.date)}</div>
          <div>${formatTime(item.start)} – ${formatTime(item.end)}</div>
        </div>
        <div class="details">
          <h3>${item.title}</h3>
          <p class="tag">${item.type}</p>
          ${item.notes ? `<p class="notes">${item.notes}</p>` : ""}
        </div>
        <div class="actions">
          <button class="chip-action" data-edit="${item.id}">Edit</button>
          <button class="chip-action" data-delete="${item.id}">Remove</button>
        </div>`;
      scheduleList.appendChild(card);
    });
  }

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const direction = btn.dataset.action;
      if (direction === "next") {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      } else if (direction === "previous") {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      }
      renderWeek();
    });
  });

  scheduleList?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.edit || target.dataset.delete;
    if (!id) return;
    const item = schedule.find(entry => entry.id === id);
    if (!item) return;

    if (target.dataset.edit) {
      editingId = id;
      form.title.value = item.title;
      form.type.value = item.type;
      form.date.value = item.date;
      form.start.value = item.start;
      form.end.value = item.end;
      form.notes.value = item.notes ?? "";
      modal.hidden = false;
    }

    if (target.dataset.delete) {
      schedule = schedule.filter(entry => entry.id !== id);
      storage.set(scheduleKey, schedule);
      renderWeek();
    }
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const entry = {
      id: editingId ?? makeId(),
      title: data.title,
      type: data.type,
      date: data.date,
      start: data.start,
      end: data.end,
      notes: data.notes
    };

    schedule = storage.get(scheduleKey, []);
    const index = schedule.findIndex(item => item.id === entry.id);
    if (index >= 0) {
      schedule[index] = entry;
    } else {
      schedule.push(entry);
    }
    storage.set(scheduleKey, schedule);
    modal.hidden = true;
    form.reset();
    editingId = null;
    renderWeek();
  });

  renderWeek();
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
    renderSchedulePage();
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
