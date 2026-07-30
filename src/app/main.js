import {
  buildMealQueue,
  deriveMealMetrics,
  mealSignature,
  normalizeIngredient,
  rankMeals,
  weightedRoulettePick
} from "../recommendations/engine.js";
import { LedgerStore, sampleLedger } from "../ledger/store.js";
import {
  deleteAllCloudData,
  createCloudClient,
  loadCloudSchedule,
  saveCloudSchedule
} from "../storage/cloud.js";
import { clearNovelBiteData, readJson, storageKeys, writeJson } from "../storage/local.js";
import { emptySchedule, parseTime, shiftDurationHours, totalScheduledHours } from "../schedule/shifts.js";
import {
  readSchedule,
  renderAnalytics,
  renderLedger,
  renderMealDialog,
  renderPriorityQueue,
  renderRouletteResult,
  renderSchedule,
  renderSearchGroups,
  renderSelectedMeal
} from "../ui/render.js";

const APP_VERSION = "1.1.0";
const config = window.APP_CONFIG || {};
const supabase = createCloudClient(config);
const storage = window.localStorage;
const todayKey = () => new Date().toISOString().slice(0, 10);
const dismissedStorageKey = () => `novelbite.dismissed.${todayKey()}`;
const preferencesKey = `${storageKeys.preferences}.v1.1`;

const state = {
  catalog: [],
  history: [],
  schedule: readJson(storage, storageKeys.schedule, emptySchedule()),
  mode: storage.getItem(storageKeys.mode),
  user: null,
  queue: [],
  selectedRanked: null,
  searchRanked: [],
  rouletteResult: null,
  rouletteRecentIds: [],
  dismissedIds: readJson(storage, dismissedStorageKey(), []),
  lastDismissed: null
};

const ids = [
  "modeBadge", "accountButton", "modeOnboarding", "tryDemoButton", "localModeButton", "heroSignInButton",
  "catalogStatus", "shiftLength", "goal", "serviceMoment", "priority", "naturalOnly", "avoidSecondFlatbread",
  "priorityQueue", "selectedMealPanel", "contextChips", "queueToast", "editScheduleShortcut", "tuneDetails",
  "menuSearch", "searchCategory", "searchTriedStatus", "searchSort", "searchSummary", "searchResults",
  "rouletteResult", "rouletteButton", "rouletteAgainButton", "rouletteCategory", "roulettePriority",
  "rouletteNaturalOnly", "roulettePoolStatus",
  "scheduleGrid", "scheduleSummary", "saveScheduleButton", "clearScheduleButton", "scheduleMessage",
  "analyticsGrid", "openLedgerComposer", "ledgerComposer", "ledgerForm", "ledgerMealSearch", "ledgerMeal",
  "ledgerRating", "ledgerFullness", "ledgerWouldRepeat", "ledgerComment", "ledgerNextTime", "ledgerMessage",
  "ledgerSearch", "ledgerList", "ledgerCount", "exportButton", "deleteDataButton", "deleteAccountButton", "privacyMessage",
  "authDialog", "closeAuthButton", "authForm", "authEmail", "authMessage", "signOutButton",
  "mealDialog", "closeMealButton", "mealDialogCategory", "mealDialogName", "mealDialogAdditions", "mealDialogMeta",
  "reasonList", "chooseMealButton"
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const ledgerStore = new LedgerStore({ storage, supabase, getUser: () => (state.mode === "cloud" ? state.user : null) });

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function startOfWeek(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result.toISOString().slice(0, 10);
}

function todaysSavedShiftHours() {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const shift = state.schedule.find((item) => item.day === day);
  const hours = shiftDurationHours(shift?.start, shift?.end);
  return hours || null;
}

function currentContext(overrides = {}) {
  const savedHours = todaysSavedShiftHours();
  return {
    shiftHours: savedHours ?? Number(el.shiftLength.value),
    goal: el.goal.value,
    serviceMoment: el.serviceMoment.value,
    priority: el.priority.value,
    naturalOnly: el.naturalOnly.checked,
    avoidSecondFlatbread: el.avoidSecondFlatbread.checked,
    localHour: new Date().getHours(),
    ...overrides
  };
}

function historyWithSignatures() {
  return state.history.map((entry) => ({ ...entry, signature: entry.signature || mealSignature(entry) }));
}

function preferencesFromControls() {
  return {
    shiftLength: el.shiftLength.value,
    goal: el.goal.value,
    serviceMoment: el.serviceMoment.value,
    priority: el.priority.value,
    naturalOnly: el.naturalOnly.checked,
    avoidSecondFlatbread: el.avoidSecondFlatbread.checked
  };
}

function loadPreferences() {
  const saved = readJson(storage, preferencesKey, null);
  if (!saved) return;
  if (saved.shiftLength !== undefined) el.shiftLength.value = String(saved.shiftLength);
  if (saved.goal) el.goal.value = saved.goal;
  if (saved.serviceMoment) el.serviceMoment.value = saved.serviceMoment;
  if (saved.priority) el.priority.value = saved.priority;
  el.naturalOnly.checked = Boolean(saved.naturalOnly);
  el.avoidSecondFlatbread.checked = saved.avoidSecondFlatbread !== false;
}

function savePreferences() {
  writeJson(storage, preferencesKey, preferencesFromControls());
}

function updateModeUi() {
  const labels = {
    demo: "Guest demo · this browser",
    local: "Local mode · this browser",
    cloud: state.user ? `Signed in · ${state.user.email}` : "Cloud mode"
  };
  el.modeBadge.textContent = labels[state.mode] || "Choose a mode";
  el.accountButton.textContent = state.user ? "Account" : "Sign in";
  el.signOutButton.hidden = !state.user;
  el.modeOnboarding.hidden = Boolean(state.mode);
}

async function setMode(mode) {
  state.mode = mode;
  storage.setItem(storageKeys.mode, mode);
  if (mode === "demo" && readJson(storage, storageKeys.ledger, []).length === 0) {
    writeJson(storage, storageKeys.ledger, sampleLedger(state.catalog));
  }
  state.history = await ledgerStore.list();
  updateModeUi();
  renderAll();
}

function renderAll() {
  renderSchedule(el.scheduleGrid, state.schedule);
  renderScheduleSummary();
  renderLedger(el.ledgerList, state.history, el.ledgerSearch.value);
  el.ledgerCount.textContent = `${state.history.length} ${state.history.length === 1 ? "entry" : "entries"}`;
  renderAnalytics(el.analyticsGrid, state.history, state.catalog);
  renderMealOptions(el.ledgerMealSearch.value);
  updateRecommendations();
  updateSearchResults();
  updateRoulettePoolStatus();
}

function renderMealOptions(query = "") {
  const selected = el.ledgerMeal.value;
  const normalized = normalizeIngredient(query);
  const matches = state.catalog
    .filter((meal) => !normalized || normalizeIngredient([meal.name, meal.category, meal.style, ...meal.additions.map((item) => item.name)].join(" ")).includes(normalized))
    .sort((left, right) => left.name.localeCompare(right.name) || right.baseScore - left.baseScore)
    .slice(0, normalized ? 80 : 50);
  el.ledgerMeal.innerHTML = matches
    .map((meal) => `<option value="${meal.id}">${meal.name} · ${meal.additions.map((addition) => addition.name).join(", ")}</option>`)
    .join("");
  if (matches.some((meal) => meal.id === selected)) el.ledgerMeal.value = selected;
  else if (state.selectedRanked && matches.some((meal) => meal.id === state.selectedRanked.meal.id)) el.ledgerMeal.value = state.selectedRanked.meal.id;
}

function updateContextChips(context) {
  const chips = [];
  const savedHours = todaysSavedShiftHours();
  chips.push(`<span title="Shift context">◷ ${savedHours ? `${savedHours}h saved shift` : `${context.shiftHours}h context`}</span>`);
  chips.push(`<span title="Goal">◎ ${context.goal}</span>`);
  chips.push(`<span title="Ranking priority">↕ ${context.priority}</span>`);
  chips.push(`<span title="Service moment">◉ ${context.serviceMoment}</span>`);
  if (context.naturalOnly) chips.push('<span title="Whole-food filter">⌁ whole-food only</span>');
  if (context.avoidSecondFlatbread) chips.push('<span title="Daily route guard">1× flatbread guard</span>');
  el.contextChips.innerHTML = chips.join("");
}

function updateRecommendations() {
  if (!state.catalog.length) return;
  const context = currentContext();
  updateContextChips(context);
  state.queue = buildMealQueue(state.catalog, context, historyWithSignatures(), 5, { excludeIds: state.dismissedIds });
  renderPriorityQueue(el.priorityQueue, state.queue, historyWithSignatures());
  if (!state.selectedRanked || !state.queue.some((item) => item.meal.id === state.selectedRanked.meal.id)) {
    state.selectedRanked = state.queue[0] || null;
  } else {
    state.selectedRanked = state.queue.find((item) => item.meal.id === state.selectedRanked.meal.id) || state.queue[0] || null;
  }
  renderSelectedMeal(el.selectedMealPanel, state.selectedRanked);
}

function candidateById(mealId) {
  return [...state.queue, ...state.searchRanked, state.rouletteResult].filter(Boolean).find((item) => item.meal.id === mealId)
    || rankMeals(state.catalog.filter((meal) => meal.id === mealId), currentContext(), historyWithSignatures())[0]
    || null;
}

function selectMeal(mealId, { openDialog = false } = {}) {
  const candidate = candidateById(mealId);
  if (!candidate) return;
  state.selectedRanked = candidate;
  renderSelectedMeal(el.selectedMealPanel, candidate);
  if (openDialog || window.matchMedia("(max-width: 680px)").matches) {
    renderMealDialog({
      category: el.mealDialogCategory,
      name: el.mealDialogName,
      additions: el.mealDialogAdditions,
      meta: el.mealDialogMeta,
      reasons: el.reasonList
    }, candidate);
    el.mealDialog.showModal();
  }
}

function rejectMeal(mealId) {
  if (!mealId || state.dismissedIds.includes(mealId)) return;
  state.lastDismissed = mealId;
  state.dismissedIds = [...state.dismissedIds, mealId];
  writeJson(storage, dismissedStorageKey(), state.dismissedIds);
  updateRecommendations();
  el.queueToast.hidden = false;
  el.queueToast.innerHTML = `Exact build hidden for today. <button type="button" data-action="undo-reject">Undo</button>`;
}

function undoReject() {
  if (!state.lastDismissed) return;
  state.dismissedIds = state.dismissedIds.filter((id) => id !== state.lastDismissed);
  writeJson(storage, dismissedStorageKey(), state.dismissedIds);
  state.lastDismissed = null;
  el.queueToast.hidden = true;
  updateRecommendations();
}

function searchContext() {
  const sort = el.searchSort.value;
  return currentContext({
    query: el.menuSearch.value,
    category: el.searchCategory.value,
    triedStatus: el.searchTriedStatus.value,
    priority: sort === "fit" ? el.priority.value : sort
  });
}

function updateSearchResults() {
  if (!state.catalog.length) return;
  const context = searchContext();
  state.searchRanked = rankMeals(state.catalog, context, historyWithSignatures());
  if (el.searchSort.value !== "fit") {
    const key = el.searchSort.value;
    state.searchRanked.sort((a, b) => {
      const left = key === "novelty" ? Number(a.meal.novelty) : Number(a.metrics[key]);
      const right = key === "novelty" ? Number(b.meal.novelty) : Number(b.metrics[key]);
      return right - left || b.score - a.score;
    });
  }
  const familyCount = new Set(state.searchRanked.map((item) => `${item.meal.category}:${item.meal.name}`)).size;
  el.searchSummary.textContent = `${state.searchRanked.length} builds across ${familyCount} meal families. Variations stay grouped instead of occupying separate postal districts.`;
  renderSearchGroups(el.searchResults, state.searchRanked, historyWithSignatures(), 10);
}

function rouletteContext() {
  return currentContext({
    category: el.rouletteCategory.value,
    priority: el.roulettePriority.value,
    naturalOnly: el.rouletteNaturalOnly.checked,
    goal: el.roulettePriority.value === "novelty" ? "novelty" : el.goal.value
  });
}

function updateRoulettePoolStatus() {
  if (!state.catalog.length) return;
  const pool = rankMeals(state.catalog, rouletteContext(), historyWithSignatures(), { excludeIds: state.rouletteRecentIds });
  el.roulettePoolStatus.textContent = `${pool.length} eligible builds in the weighted pool.`;
}

function drawRoulette() {
  const candidate = weightedRoulettePick(state.catalog, rouletteContext(), historyWithSignatures(), {
    excludeIds: state.rouletteRecentIds,
    poolSize: 70
  });
  if (!candidate) return;
  state.rouletteResult = candidate;
  state.rouletteRecentIds = [candidate.meal.id, ...state.rouletteRecentIds].slice(0, 4);
  renderRouletteResult(el.rouletteResult, candidate);
  updateRoulettePoolStatus();
}

function renderScheduleSummary() {
  const hours = totalScheduledHours(state.schedule);
  el.scheduleSummary.textContent = hours ? `${hours} hours this week` : "No shifts saved";
}

async function loadCatalog() {
  const [catalogResponse, metaResponse] = await Promise.all([fetch("/data/catalog.json"), fetch("/data/catalog-meta.json")]);
  if (!catalogResponse.ok || !metaResponse.ok) throw new Error("The fictional catalogue could not be loaded.");
  const [catalog, meta] = await Promise.all([catalogResponse.json(), metaResponse.json()]);
  if (catalog.length !== meta.count || meta.schemaVersion !== 1) throw new Error("The catalogue failed its runtime integrity check.");
  state.catalog = catalog.map((meal) => ({ ...meal, metrics: deriveMealMetrics(meal), signature: meal.signature || mealSignature(meal) }));
  el.catalogStatus.textContent = `${meta.count} fictional combinations`;
}

async function loadSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;
  if (state.user && state.mode === "cloud") {
    state.history = await ledgerStore.list();
    await loadScheduleForUser();
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    if (state.user) {
      state.mode = "cloud";
      storage.setItem(storageKeys.mode, "cloud");
      state.history = await ledgerStore.list();
      await loadScheduleForUser();
    }
    updateModeUi();
    renderAll();
  });
}

async function loadScheduleForUser() {
  if (!supabase || !state.user || state.mode !== "cloud") return;
  const row = await loadCloudSchedule(supabase, state.user.id, startOfWeek());
  if (row?.shifts) state.schedule = row.shifts;
}

function closeOpenDialogs() {
  [el.mealDialog, el.authDialog].forEach((dialog) => { if (dialog?.open) dialog.close(); });
}

function showPage(pageName, updateHash = true) {
  closeOpenDialogs();
  const valid = ["discover", "search", "roulette", "ledger", "more"];
  const target = valid.includes(pageName) ? pageName : "discover";
  document.querySelectorAll(".page").forEach((page) => { page.hidden = page.id !== `${target}Page`; });
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === target));
  if (updateHash) history.replaceState(null, "", `#${target}`);
  if (target === "search") updateSearchResults();
  if (target === "roulette") updateRoulettePoolStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openAuth() {
  setMessage(el.authMessage, supabase ? "" : "Cloud sync is not configured. Guest and local modes are ready.", !supabase);
  el.authDialog.showModal();
}

function chooseCandidate(candidate) {
  if (!candidate) return;
  state.selectedRanked = candidate;
  renderMealOptions(candidate.meal.name);
  el.ledgerMeal.value = candidate.meal.id;
  el.ledgerMealSearch.value = candidate.meal.name;
  el.ledgerComposer.open = true;
  el.mealDialog.close();
  showPage("ledger");
  requestAnimationFrame(() => el.ledgerComposer.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function collectSchedule() {
  return readSchedule(el.scheduleGrid).map((shift) => {
    if (!shift.start && !shift.end) return shift;
    const start = parseTime(shift.start);
    const end = parseTime(shift.end);
    if (!start || !end) throw new Error(`${shift.day} needs valid start and finish times.`);
    return { ...shift, start, end };
  });
}

async function saveSchedule() {
  try {
    state.schedule = collectSchedule();
    writeJson(storage, storageKeys.schedule, state.schedule);
    if (supabase && state.user && state.mode === "cloud") await saveCloudSchedule(supabase, state.user.id, startOfWeek(), state.schedule);
    renderSchedule(el.scheduleGrid, state.schedule);
    renderScheduleSummary();
    updateRecommendations();
    setMessage(el.scheduleMessage, state.mode === "cloud" && state.user ? "Schedule saved to your account." : "Schedule saved in this browser.");
  } catch (error) {
    setMessage(el.scheduleMessage, error.message, true);
  }
}

async function addLedgerEntry(event) {
  event.preventDefault();
  const meal = state.catalog.find((item) => item.id === el.ledgerMeal.value);
  if (!meal) return;
  try {
    await ledgerStore.add({
      mealId: meal.id,
      mealName: meal.name,
      category: meal.category,
      style: meal.style,
      repetitionFamily: meal.repetitionFamily,
      additions: meal.additions,
      signature: mealSignature(meal),
      rating: Number(el.ledgerRating.value),
      fullness: el.ledgerFullness.value,
      wouldRepeat: el.ledgerWouldRepeat.checked,
      comment: el.ledgerComment.value.trim(),
      nextTime: el.ledgerNextTime.value.trim(),
      eatenAt: new Date().toISOString()
    });
    state.history = await ledgerStore.list();
    el.ledgerComment.value = "";
    el.ledgerNextTime.value = "";
    el.ledgerComposer.open = false;
    renderAll();
    setMessage(el.ledgerMessage, state.mode === "cloud" && state.user ? "Saved to your private cloud ledger." : "Saved in this browser.");
  } catch (error) {
    setMessage(el.ledgerMessage, error.message, true);
  }
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    mode: state.mode || "unselected",
    ledger: state.history,
    schedule: state.schedule,
    preferences: preferencesFromControls()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `novelbite-export-${todayKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setMessage(el.privacyMessage, "Your JSON export has been prepared.");
}

async function deleteLedgerData() {
  if (!window.confirm("Delete every ledger entry for the current mode? This cannot be undone.")) return;
  try {
    await ledgerStore.removeAll();
    state.history = [];
    renderAll();
    setMessage(el.privacyMessage, "All ledger entries were deleted.");
  } catch (error) {
    setMessage(el.privacyMessage, error.message, true);
  }
}

async function deleteAccount() {
  if (!supabase || !state.user || state.mode !== "cloud") {
    setMessage(el.privacyMessage, "Sign in to delete a cloud account.", true);
    return;
  }
  if (!window.confirm("Permanently delete your account and synced data? This cannot be undone.")) return;
  try {
    await deleteAllCloudData(supabase, state.user.id);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) throw error;
    await supabase.auth.signOut();
    clearNovelBiteData(storage);
    state.mode = "local";
    state.user = null;
    state.history = [];
    state.schedule = emptySchedule();
    storage.setItem(storageKeys.mode, "local");
    updateModeUi();
    renderAll();
    setMessage(el.privacyMessage, "Your account and synced data were deleted.");
  } catch (error) {
    setMessage(el.privacyMessage, error.message, true);
  }
}

async function signIn(event) {
  event.preventDefault();
  if (!supabase) {
    setMessage(el.authMessage, "Add a separate demo Supabase configuration first.", true);
    return;
  }
  const { error } = await supabase.auth.signInWithOtp({ email: el.authEmail.value.trim(), options: { emailRedirectTo: window.location.origin } });
  setMessage(el.authMessage, error ? error.message : "Magic link sent. Check your email to finish signing in.", Boolean(error));
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => showPage(tab.dataset.tab)));
  document.querySelectorAll("[data-tab-link]").forEach((control) => control.addEventListener("click", (event) => { event.preventDefault(); showPage(control.dataset.tabLink); }));
  el.tryDemoButton.addEventListener("click", () => setMode("demo"));
  el.localModeButton.addEventListener("click", () => setMode("local"));
  [el.accountButton, el.heroSignInButton].forEach((button) => button.addEventListener("click", openAuth));
  el.closeAuthButton.addEventListener("click", () => el.authDialog.close());
  el.closeMealButton.addEventListener("click", () => el.mealDialog.close());
  [el.authDialog, el.mealDialog].forEach((dialog) => {
    dialog.addEventListener("cancel", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeOpenDialogs(); });
  el.authForm.addEventListener("submit", signIn);
  el.signOutButton.addEventListener("click", async () => { await supabase?.auth.signOut(); await setMode("local"); el.authDialog.close(); });

  [el.shiftLength, el.goal, el.serviceMoment, el.priority, el.naturalOnly, el.avoidSecondFlatbread].forEach((control) => control.addEventListener("change", () => {
    savePreferences();
    updateRecommendations();
    updateSearchResults();
    updateRoulettePoolStatus();
  }));

  el.priorityQueue.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "open-meal") selectMeal(button.dataset.mealId);
    if (button.dataset.action === "reject-meal") rejectMeal(button.dataset.mealId);
  });
  el.selectedMealPanel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "choose-selected") chooseCandidate(state.selectedRanked);
    if (action === "reject-selected") rejectMeal(state.selectedRanked?.meal.id);
  });
  el.queueToast.addEventListener("click", (event) => { if (event.target.closest('[data-action="undo-reject"]')) undoReject(); });

  [el.menuSearch, el.searchCategory, el.searchTriedStatus, el.searchSort].forEach((control) => control.addEventListener(control.tagName === "INPUT" ? "input" : "change", updateSearchResults));
  el.searchResults.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const candidate = state.searchRanked.find((item) => item.meal.id === button.dataset.mealId);
    if (button.dataset.action === "open-search-meal") selectMeal(button.dataset.mealId, { openDialog: true });
    if (button.dataset.action === "choose-search-meal") chooseCandidate(candidate);
  });

  [el.rouletteCategory, el.roulettePriority, el.rouletteNaturalOnly].forEach((control) => control.addEventListener("change", updateRoulettePoolStatus));
  el.rouletteButton.addEventListener("click", drawRoulette);
  el.rouletteAgainButton.addEventListener("click", drawRoulette);
  el.rouletteResult.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "choose-roulette") chooseCandidate(state.rouletteResult);
    if (action === "open-roulette" && state.rouletteResult) selectMeal(state.rouletteResult.meal.id, { openDialog: true });
  });

  el.chooseMealButton.addEventListener("click", () => chooseCandidate(state.selectedRanked));
  el.editScheduleShortcut.addEventListener("click", () => {
    showPage("more");
    requestAnimationFrame(() => el.scheduleGrid.closest(".panel").scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  el.saveScheduleButton.addEventListener("click", saveSchedule);
  el.clearScheduleButton.addEventListener("click", () => {
    state.schedule = emptySchedule();
    renderSchedule(el.scheduleGrid, state.schedule);
    setMessage(el.scheduleMessage, "Schedule cleared. Save to make the change permanent.");
  });
  el.scheduleGrid.addEventListener("input", () => {
    try {
      const draft = collectSchedule();
      const hours = totalScheduledHours(draft);
      el.scheduleSummary.textContent = hours ? `${hours} hours this week` : "No shifts saved";
    } catch {
      el.scheduleSummary.textContent = "Check time format";
    }
  });

  el.openLedgerComposer.addEventListener("click", () => {
    el.ledgerComposer.open = !el.ledgerComposer.open;
    if (el.ledgerComposer.open) requestAnimationFrame(() => el.ledgerComposer.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  el.ledgerMealSearch.addEventListener("input", () => renderMealOptions(el.ledgerMealSearch.value));
  el.ledgerForm.addEventListener("submit", addLedgerEntry);
  el.ledgerSearch.addEventListener("input", () => renderLedger(el.ledgerList, state.history, el.ledgerSearch.value));
  el.exportButton.addEventListener("click", exportData);
  el.deleteDataButton.addEventListener("click", deleteLedgerData);
  el.deleteAccountButton.addEventListener("click", deleteAccount);
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1), false));
}

async function initialize() {
  loadPreferences();
  bindEvents();
  showPage(location.hash.slice(1) || "discover", false);
  renderSchedule(el.scheduleGrid, state.schedule);
  renderRouletteResult(el.rouletteResult, null);
  updateModeUi();
  try {
    await loadCatalog();
    await loadSession();
    if (state.mode === "demo" && readJson(storage, storageKeys.ledger, []).length === 0) writeJson(storage, storageKeys.ledger, sampleLedger(state.catalog));
    state.history = await ledgerStore.list();
    renderAll();
  } catch (error) {
    el.catalogStatus.textContent = "Catalogue unavailable";
    el.priorityQueue.innerHTML = `<div class="empty-state"><p>${error.message}</p></div>`;
    console.error(error);
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn(error));
  }
}

initialize();
