import { shiftDurationHours, WEEK_DAYS } from "../schedule/shifts.js";
import { deriveMealMetrics, mealSignature, normalizeIngredient } from "../recommendations/engine.js";

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayScore(score) {
  return Math.max(0, Math.min(10, Number(score) || 0)).toFixed(2);
}

function triedSignatures(history = []) {
  return new Set(history.map((entry) => entry.signature || mealSignature(entry)).filter(Boolean));
}

function additionsText(meal) {
  return (meal.additions || []).map((addition) => addition.name ?? addition).join(" · ");
}

function metricChip(label, value) {
  return `<span><b>${escapeHtml(label)}</b> ${Number(value).toFixed(1)}</span>`;
}

export function renderPriorityQueue(container, ranked = [], history = []) {
  if (!ranked.length) {
    container.innerHTML = '<div class="empty-state"><p>No matching meal found. Adjust the filters rather than negotiating with an empty list.</p></div>';
    return;
  }
  const exactSignatures = triedSignatures(history);
  container.innerHTML = ranked
    .map(({ meal, score, metrics = deriveMealMetrics(meal) }, index) => {
      const isTried = exactSignatures.has(meal.signature || mealSignature(meal));
      return `
        <article class="priority-row" data-meal-id="${escapeHtml(meal.id)}">
          <span class="priority-rank" aria-label="Priority ${index + 1}">${index + 1}</span>
          <button class="priority-open" type="button" data-action="open-meal" data-meal-id="${escapeHtml(meal.id)}" aria-label="Open ${escapeHtml(meal.name)} details">
            <span class="priority-state" title="${isTried ? "Exact build tried" : "New exact build"}" aria-label="${isTried ? "Exact build tried" : "New exact build"}">${isTried ? "✓" : "✦"}</span>
            <span class="priority-copy"><strong>${escapeHtml(meal.name)}</strong><small>${escapeHtml(additionsText(meal))}</small></span>
          </button>
          <span class="priority-metrics" aria-label="Nutrition ${metrics.nutrition.toFixed(1)}, satiety ${metrics.satiety.toFixed(1)}"><small>N ${metrics.nutrition.toFixed(1)}</small><small>S ${metrics.satiety.toFixed(1)}</small></span>
          <span class="priority-score" aria-label="Score ${displayScore(score)} out of 10">${displayScore(score)}</span>
          <button class="priority-reject" type="button" data-action="reject-meal" data-meal-id="${escapeHtml(meal.id)}" aria-label="Reject ${escapeHtml(meal.name)} for today" title="Reject this exact build">×</button>
        </article>`;
    })
    .join("");
}

export function renderSelectedMeal(container, ranked, { compact = false } = {}) {
  if (!ranked) {
    container.innerHTML = '<div class="empty-state"><p>Select a recommendation to inspect the exact build.</p></div>';
    return;
  }
  const { meal, score, reasons = [], metrics = deriveMealMetrics(meal) } = ranked;
  container.innerHTML = `
    <div class="selected-meal-head">
      <div><p class="eyebrow">${escapeHtml(meal.category)} · ${escapeHtml(meal.style)}</p><h2>${escapeHtml(meal.name)}</h2></div>
      <strong class="selected-score">${displayScore(score)}</strong>
    </div>
    <p class="selected-additions">${escapeHtml(additionsText(meal))}</p>
    <div class="metric-strip">
      ${metricChip("Nutrition", metrics.nutrition)}
      ${metricChip("Satiety", metrics.satiety)}
      ${metricChip("Protein", metrics.protein)}
      ${metricChip("Vegetables", metrics.vegetables)}
    </div>
    ${compact ? "" : `<ul class="reason-list">${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`}
    <div class="selected-actions">
      <button class="button button-primary" type="button" data-action="choose-selected">Choose and log</button>
      <button class="button button-quiet" type="button" data-action="reject-selected">Not today</button>
    </div>`;
}

export function renderMealDialog(elements, ranked) {
  if (!ranked) return;
  const { meal, score, reasons = [], metrics = deriveMealMetrics(meal) } = ranked;
  elements.category.textContent = `${meal.category} · ${meal.style}`;
  elements.name.textContent = meal.name;
  elements.additions.textContent = additionsText(meal);
  elements.meta.innerHTML = `
    <span>Score ${displayScore(score)}/10</span>
    <span>Nutrition ${metrics.nutrition.toFixed(1)}</span>
    <span>Satiety ${metrics.satiety.toFixed(1)}</span>
    <span>Weight ${Number(meal.heaviness).toFixed(1)}</span>`;
  const fallbacks = ["stable deterministic fit", "queue diversity", "recent-exposure balance"];
  elements.reasons.innerHTML = [...reasons, ...fallbacks]
    .slice(0, 3)
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join("");
}

export function groupRankedMeals(ranked = []) {
  const groups = new Map();
  for (const candidate of ranked) {
    const key = `${normalizeIngredient(candidate.meal.category)}::${normalizeIngredient(candidate.meal.name)}`;
    if (!groups.has(key)) groups.set(key, { key, name: candidate.meal.name, category: candidate.meal.category, style: candidate.meal.style, rows: [] });
    groups.get(key).rows.push(candidate);
  }
  return [...groups.values()];
}

export function renderSearchGroups(container, ranked = [], history = [], limitPerGroup = 10) {
  const groups = groupRankedMeals(ranked);
  if (!groups.length) {
    container.innerHTML = '<div class="empty-state"><p>No menu build matches those filters.</p></div>';
    return;
  }
  const exact = triedSignatures(history);
  container.innerHTML = groups.map((group, groupIndex) => {
    const top = group.rows[0];
    return `
      <details class="meal-family" ${groupIndex === 0 ? "open" : ""}>
        <summary>
          <span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.category)} · ${group.rows.length} matching builds</small></span>
          <span class="family-top-score">${displayScore(top.score)}</span>
        </summary>
        <div class="family-variants">
          ${group.rows.slice(0, limitPerGroup).map(({ meal, score, metrics }) => {
            const isTried = exact.has(meal.signature || mealSignature(meal));
            return `<article class="variant-row">
              <button type="button" data-action="open-search-meal" data-meal-id="${escapeHtml(meal.id)}" aria-label="Open ${escapeHtml(meal.name)} details">
                <span class="variant-state">${isTried ? "✓" : "✦"}</span>
                <span><strong>${escapeHtml(additionsText(meal))}</strong><small>${escapeHtml(meal.style)} · N ${metrics.nutrition.toFixed(1)} · S ${metrics.satiety.toFixed(1)}</small></span>
              </button>
              <strong>${displayScore(score)}</strong>
              <button class="variant-choose" type="button" data-action="choose-search-meal" data-meal-id="${escapeHtml(meal.id)}">Choose</button>
            </article>`;
          }).join("")}
          ${group.rows.length > limitPerGroup ? `<p class="family-note">Showing the best ${limitPerGroup} of ${group.rows.length} matching builds.</p>` : ""}
        </div>
      </details>`;
  }).join("");
}

export function renderRouletteResult(container, ranked) {
  if (!ranked) {
    container.innerHTML = '<div class="roulette-placeholder"><strong>No draw yet</strong><p>Launch roulette when outsourcing one small decision feels reasonable.</p></div>';
    return;
  }
  const { meal, score, metrics, reasons = [] } = ranked;
  container.innerHTML = `
    <div class="roulette-result-head"><span class="roulette-badge">Drawn</span><strong>${displayScore(score)}</strong></div>
    <h2>${escapeHtml(meal.name)}</h2>
    <p>${escapeHtml(additionsText(meal))}</p>
    <div class="metric-strip">${metricChip("Nutrition", metrics.nutrition)}${metricChip("Satiety", metrics.satiety)}</div>
    <p class="roulette-reason">${escapeHtml(reasons[0] || "Eligible under the current ranking context")}</p>
    <div class="selected-actions">
      <button class="button button-primary" type="button" data-action="choose-roulette">Choose and log</button>
      <button class="button button-quiet" type="button" data-action="open-roulette">View details</button>
    </div>`;
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
        <span class="schedule-duration">${duration ? `${duration}h` : "Off"}</span>
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

export function renderLedger(container, entries = [], search = "") {
  const query = normalizeIngredient(search);
  const filtered = entries.filter((entry) => {
    const text = normalizeIngredient([
      entry.mealName,
      entry.category,
      entry.comment,
      entry.nextTime,
      ...(entry.additions || []).map((item) => item.name ?? item)
    ].join(" "));
    return !query || query.split(" ").every((token) => text.includes(token));
  });
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-list">${entries.length ? "No past meal matches that search." : "No meals logged yet."}</div>`;
    return;
  }
  container.innerHTML = filtered.map((entry) => `
    <article class="ledger-entry">
      <div>
        <h3>${escapeHtml(entry.mealName)}</h3>
        <p>${escapeHtml((entry.additions || []).map((item) => item.name ?? item).join(" · "))}</p>
        ${entry.comment ? `<p>${escapeHtml(entry.comment)}</p>` : ""}
        ${entry.nextTime ? `<p><strong>Next time:</strong> ${escapeHtml(entry.nextTime)}</p>` : ""}
        <small>${new Date(entry.eatenAt).toLocaleString()}${entry.fullness ? ` · ${escapeHtml(entry.fullness)}` : ""}${entry.wouldRepeat === false ? " · would not repeat" : ""}</small>
      </div>
      <span class="rating">${"★".repeat(Math.max(0, Number(entry.rating) || 0))}</span>
    </article>`).join("");
}

export function renderAnalytics(container, entries = [], catalog = []) {
  const signatures = new Set(entries.map((entry) => entry.signature || mealSignature(entry)));
  const families = new Set(entries.map((entry) => normalizeIngredient(entry.repetitionFamily || entry.mealName)));
  const ratings = entries.map((entry) => Number(entry.rating)).filter(Number.isFinite);
  const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
  const additions = new Map();
  entries.forEach((entry) => (entry.additions || []).forEach((item) => {
    const name = item.name ?? item;
    additions.set(name, (additions.get(name) || 0) + 1);
  }));
  const repeated = [...additions.entries()].sort((a, b) => b[1] - a[1])[0];
  container.innerHTML = `
    <article><strong>${signatures.size}</strong><span>exact builds tried</span></article>
    <article><strong>${families.size}</strong><span>meal families reached</span></article>
    <article><strong>${average ? average.toFixed(1) : "–"}</strong><span>average personal rating</span></article>
    <article><strong>${repeated ? escapeHtml(repeated[0]) : "–"}</strong><span>${repeated ? `${repeated[1]} logged appearances` : `${catalog.length} builds remain available`}</span></article>`;
}
