import { shiftDurationHours, WEEK_DAYS } from "../schedule/shifts.js";

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderPriorityQueue(container, ranked = [], history = []) {
  if (!ranked.length) {
    container.innerHTML = '<div class="empty-state"><p>No matching meal found.</p></div>';
    return;
  }
  const exactSignatures = new Set(history.map((entry) => entry.signature).filter(Boolean));
  container.innerHTML = ranked
    .map(({ meal, score }, index) => {
      const displayScore = Math.max(0, Math.min(10, score));
      const additions = meal.additions.map((addition) => addition.name).join(" · ");
      const isTried = exactSignatures.has(meal.signature);
      return `
        <article class="priority-row" data-meal-id="${escapeHtml(meal.id)}">
          <span class="priority-rank" aria-label="Priority ${index + 1}">${index + 1}</span>
          <button class="priority-open" type="button" data-action="open-meal" data-meal-id="${escapeHtml(meal.id)}" aria-label="Open ${escapeHtml(meal.name)} details">
            <span class="priority-state" title="${isTried ? "Exact build tried" : "New exact build"}" aria-label="${isTried ? "Exact build tried" : "New exact build"}">${isTried ? "✓" : "✦"}</span>
            <span class="priority-copy"><strong>${escapeHtml(meal.name)}</strong><small>${escapeHtml(additions)}</small></span>
          </button>
          <span class="priority-score" aria-label="Score ${displayScore.toFixed(2)} out of 10">${displayScore.toFixed(2)}</span>
          <button class="priority-reject" type="button" data-action="reject-meal" data-meal-id="${escapeHtml(meal.id)}" aria-label="Reject ${escapeHtml(meal.name)} for today" title="Reject this exact build">×</button>
        </article>`;
    })
    .join("");
}

export function renderMealDialog(elements, ranked) {
  if (!ranked) return;
  const { meal, score, reasons = [] } = ranked;
  const displayScore = Math.max(0, Math.min(10, score));
  elements.category.textContent = `${meal.category} · ${meal.style}`;
  elements.name.textContent = meal.name;
  elements.additions.textContent = meal.additions.map((addition) => addition.name).join(" · ");
  elements.meta.innerHTML = `
    <span>Score ${displayScore.toFixed(2)}/10</span>
    <span>${meal.additions.length} additions</span>
    <span>Weight ${Number(meal.heaviness).toFixed(1)}/10</span>
    <span>Novelty ${Number(meal.novelty).toFixed(1)}/10</span>`;
  const fallbacks = ["strong model fit", "variety across recent meals", "stable deterministic tie-breaking"];
  elements.reasons.innerHTML = [...reasons, ...fallbacks]
    .slice(0, 3)
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join("");
}

export function renderSchedule(container, schedule) {
  const byDay = new Map(schedule.map((item) => [item.day, item]));
  container.innerHTML = WEEK_DAYS.map((day) => {
    const shift = byDay.get(day) || { start: "", end: "" };
    const duration = shiftDurationHours(shift.start, shift.end);
    return `
      <div class="schedule-row" data-day="${day}">
        <strong>${day}</strong>
        <label><span class="sr-only">${day} start</span><input class="shift-start" type="text" inputmode="numeric" maxlength="5" placeholder="09:30" value="${escapeHtml(shift.start)}" aria-label="${day} start time" /></label>
        <label><span class="sr-only">${day} finish</span><input class="shift-end" type="text" inputmode="numeric" maxlength="5" placeholder="17:30" value="${escapeHtml(shift.end)}" aria-label="${day} finish time" /></label>
        <span class="schedule-duration">${duration ? `${duration} h` : "Off"}</span>
      </div>`;
  }).join("");
}

export function readSchedule(container) {
  return [...container.querySelectorAll(".schedule-row")].map((row) => ({
    day: row.dataset.day,
    start: row.querySelector(".shift-start").value.trim(),
    end: row.querySelector(".shift-end").value.trim()
  }));
}

export function renderLedger(container, entries, search = "") {
  const query = String(search).trim().toLowerCase();
  const filtered = query
    ? entries.filter((entry) => [
        entry.mealName,
        entry.category,
        entry.style,
        entry.comment,
        ...(entry.additions || []).map((addition) => addition.name ?? addition)
      ].join(" ").toLowerCase().includes(query))
    : entries;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-list">${query ? "No ledger entries match that search." : "No meals yet. Log one and the ranking engine will learn from it."}</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((entry) => `
      <article class="ledger-entry">
        <div>
          <h3>${escapeHtml(entry.mealName)}</h3>
          <p>${escapeHtml((entry.additions || []).map((addition) => addition.name ?? addition).join(" · "))}</p>
          ${entry.comment ? `<p>“${escapeHtml(entry.comment)}”</p>` : ""}
          <p>${new Date(entry.eatenAt).toLocaleDateString()}</p>
        </div>
        <span class="rating" aria-label="${entry.rating} out of 5">${"★".repeat(Number(entry.rating))}${"☆".repeat(5 - Number(entry.rating))}</span>
      </article>`)
    .join("");
}
