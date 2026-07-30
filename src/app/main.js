import { buildMealQueue, mealSignature } from "../recommendations/engine.js";
import { LedgerStore, sampleLedger } from "../ledger/store.js";
import { deleteAllCloudData, createCloudClient, loadCloudSchedule, saveCloudSchedule } from "../storage/cloud.js";
import { clearNovelBiteData, readJson, storageKeys, writeJson } from "../storage/local.js";
import { emptySchedule, parseTime, shiftDurationHours, totalScheduledHours } from "../schedule/shifts.js";
import { readSchedule, renderLedger, renderMealDialog, renderPriorityQueue, renderSchedule } from "../ui/render.js";

const APP_VERSION = "1.0.0";
const config = window.APP_CONFIG || {};
const supabase = createCloudClient(config);
const storage = window.localStorage;
const todayKey = () => new Date().toISOString().slice(0, 10);
const dismissedStorageKey = () => `novelbite.dismissed.${todayKey()}`;

const state = {
  catalog: [],
  history: [],
  schedule: readJson(storage, storageKeys.schedule, emptySchedule()),
  mode: storage.getItem(storageKeys.mode),
  user: null,
  queue: [],
  selectedRanked: null,
  dismissedIds: readJson(storage, dismissedStorageKey(), []),
  lastDismissed: null
};

const ids = [
  "modeBadge", "accountButton", "tryDemoButton", "localModeButton", "heroSignInButton", "catalogStatus",
  "shiftLength", "goal", "serviceMoment", "naturalOnly", "priorityQueue", "contextChips", "queueToast",
  "scheduleGrid", "scheduleSummary", "saveScheduleButton", "clearScheduleButton", "scheduleMessage",
  "ledgerComposer", "ledgerForm", "ledgerMeal", "ledgerRating", "ledgerComment", "ledgerMessage", "ledgerSearch",
  "ledgerList", "ledgerCount", "exportButton", "deleteDataButton", "deleteAccountButton", "privacyMessage",
  "authDialog", "closeAuthButton", "authForm", "authEmail", "authMessage", "signOutButton",
  "mealDialog", "closeMealButton", "mealDialogCategory", "mealDialogName", "mealDialogAdditions", "mealDialogMeta",
  "reasonList", "chooseMealButton"
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const ledgerStore = new LedgerStore({
  storage,
  supabase,
  getUser: () => (state.mode === "cloud" ? state.user : null)
});

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

function currentContext() {
  const savedHours = todaysSavedShiftHours();
  return {
    shiftHours: savedHours ?? Number(el.shiftLength.value),
    goal: el.goal.value,
    serviceMoment: el.serviceMoment.value,
    naturalOnly: el.naturalOnly.checked
  };
}

function historyWithSignatures() {
  return state.history.map((entry) => ({ ...entry, signature: entry.signature || mealSignature(entry) }));
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
  renderMealOptions();
  updateRecommendations();
}

function renderMealOptions() {
  const selected = el.ledgerMeal.value;
  el.ledgerMeal.innerHTML = state.catalog
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    .map((meal) => `<option value="${meal.id}">${meal.name} · ${meal.additions.map((addition) => addition.name).join(", ")}</option>`)
    .join("");
  if (state.catalog.some((meal) => meal.id === selected)) el.ledgerMeal.value = selected;
  else if (state.queue[0]) el.ledgerMeal.value = state.queue[0].meal.id;
}

function updateContextChips(context) {
  const chips = [];
  const savedHours = todaysSavedShiftHours();
  if (savedHours) chips.push(`<span title="Today’s saved shift">◷ ${savedHours}h saved shift</span>`);
  chips.push(`<span title="Current goal">◎ ${context.goal}</span>`);
  chips.push(`<span title="Service moment">◉ ${context.serviceMoment}</span>`);
  if (context.naturalOnly) chips.push('<span title="Whole-food preference">⌁ whole-food preference</span>');
  el.contextChips.innerHTML = chips.join("");
}

function updateRecommendations() {
  if (!state.catalog.length) return;
  const context = currentContext();
  const pool = buildMealQueue(state.catalog, context, state.history, Math.min(state.catalog.length, 30));
  let queue = pool.filter((item) => !state.dismissedIds.includes(item.meal.id)).slice(0, 5);
  if (!queue.length) {
    state.dismissedIds = [];
    writeJson(storage, dismissedStorageKey(), []);
    queue = pool.slice(0, 5);
  }
  state.queue = queue;
  renderPriorityQueue(el.priorityQueue, queue, historyWithSignatures());
  updateContextChips(context);
}

function openMeal(mealId) {
  const ranked = state.queue.find((item) => item.meal.id === mealId) ||
    buildMealQueue(state.catalog, currentContext(), state.history, state.catalog.length).find((item) => item.meal.id === mealId);
  if (!ranked) return;
  state.selectedRanked = ranked;
  renderMealDialog({
    category: el.mealDialogCategory,
    name: el.mealDialogName,
    additions: el.mealDialogAdditions,
    meta: el.mealDialogMeta,
    reasons: el.reasonList
  }, ranked);
  el.mealDialog.showModal();
}

function rejectMeal(mealId) {
  const ranked = state.queue.find((item) => item.meal.id === mealId);
  if (!ranked) return;
  state.lastDismissed = ranked;
  if (!state.dismissedIds.includes(mealId)) state.dismissedIds.push(mealId);
  writeJson(storage, dismissedStorageKey(), state.dismissedIds);
  updateRecommendations();
  el.queueToast.hidden = false;
  el.queueToast.innerHTML = `<span><strong>${ranked.meal.name}</strong> hidden for today.</span><button type="button" id="undoReject">Undo</button>`;
  document.getElementById("undoReject").addEventListener("click", undoReject, { once: true });
}

function undoReject() {
  if (!state.lastDismissed) return;
  state.dismissedIds = state.dismissedIds.filter((id) => id !== state.lastDismissed.meal.id);
  writeJson(storage, dismissedStorageKey(), state.dismissedIds);
  state.lastDismissed = null;
  el.queueToast.hidden = true;
  updateRecommendations();
}

function renderScheduleSummary() {
  const hours = totalScheduledHours(state.schedule);
  el.scheduleSummary.textContent = hours ? `${hours} hours this week` : "No shifts saved";
}

async function loadCatalog() {
  const [catalogResponse, metaResponse] = await Promise.all([fetch("/data/catalog.json"), fetch("/data/catalog-meta.json")]);
  if (!catalogResponse.ok || !metaResponse.ok) throw new Error("The fictional demo catalogue could not be loaded.");
  const [catalog, meta] = await Promise.all([catalogResponse.json(), metaResponse.json()]);
  if (catalog.length !== meta.count || meta.schemaVersion !== 1) throw new Error("The catalogue failed its runtime integrity check.");
  state.catalog = catalog;
  el.catalogStatus.textContent = `${meta.count} fictional combinations · schema ${meta.schemaVersion}`;
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
  [el.mealDialog, el.authDialog].forEach((dialog) => {
    if (dialog?.open) dialog.close();
  });
}

function showPage(pageName, updateHash = true) {
  closeOpenDialogs();
  const valid = ["discover", "schedule", "ledger", "privacy"];
  const target = valid.includes(pageName) ? pageName : "discover";
  document.querySelectorAll(".page").forEach((page) => { page.hidden = page.id !== `${target}Page`; });
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === target));
  if (updateHash) history.replaceState(null, "", `#${target}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openAuth() {
  setMessage(el.authMessage, supabase ? "" : "Cloud sync is not configured. Guest and local modes are ready.", !supabase);
  el.authDialog.showModal();
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
      comment: el.ledgerComment.value.trim(),
      eatenAt: new Date().toISOString()
    });
    state.history = await ledgerStore.list();
    el.ledgerComment.value = "";
    el.ledgerComposer.open = false;
    renderAll();
    setMessage(el.ledgerMessage, state.mode === "cloud" && state.user ? "Saved to your private cloud ledger." : "Saved in this browser.");
  } catch (error) {
    setMessage(el.ledgerMessage, error.message, true);
  }
}

function exportData() {
  const payload = { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, mode: state.mode || "unselected", ledger: state.history, schedule: state.schedule, preferences: currentContext() };
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
  document.querySelectorAll("[data-tab-link]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); showPage(link.dataset.tabLink); }));
  el.tryDemoButton.addEventListener("click", () => setMode("demo"));
  el.localModeButton.addEventListener("click", () => setMode("local"));
  [el.accountButton, el.heroSignInButton].forEach((button) => button.addEventListener("click", openAuth));
  el.closeAuthButton.addEventListener("click", () => el.authDialog.close());
  el.closeMealButton.addEventListener("click", () => el.mealDialog.close());
  [el.authDialog, el.mealDialog].forEach((dialog) => {
    dialog.addEventListener("cancel", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOpenDialogs();
  });
  el.authForm.addEventListener("submit", signIn);
  el.signOutButton.addEventListener("click", async () => { await supabase?.auth.signOut(); await setMode("local"); el.authDialog.close(); });
  [el.shiftLength, el.goal, el.serviceMoment, el.naturalOnly].forEach((control) => control.addEventListener("change", updateRecommendations));
  el.priorityQueue.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "open-meal") openMeal(button.dataset.mealId);
    if (button.dataset.action === "reject-meal") rejectMeal(button.dataset.mealId);
  });
  el.chooseMealButton.addEventListener("click", () => {
    if (!state.selectedRanked) return;
    el.ledgerMeal.value = state.selectedRanked.meal.id;
    el.ledgerComposer.open = true;
    el.mealDialog.close();
    showPage("ledger");
    requestAnimationFrame(() => el.ledgerComposer.scrollIntoView({ behavior: "smooth", block: "start" }));
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
  el.ledgerForm.addEventListener("submit", addLedgerEntry);
  el.ledgerSearch.addEventListener("input", () => renderLedger(el.ledgerList, state.history, el.ledgerSearch.value));
  el.exportButton.addEventListener("click", exportData);
  el.deleteDataButton.addEventListener("click", deleteLedgerData);
  el.deleteAccountButton.addEventListener("click", deleteAccount);
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1), false));
}

async function initialize() {
  bindEvents();
  showPage(location.hash.slice(1) || "discover", false);
  renderSchedule(el.scheduleGrid, state.schedule);
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
