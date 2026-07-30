import { readJson, storageKeys, writeJson } from "../storage/local.js";

function nowIso() {
  return new Date().toISOString();
}

function localId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random()}`;
}

export function sampleLedger(catalog = []) {
  return catalog.slice(3, 6).map((meal, index) => ({
    id: `sample-${index + 1}`,
    mealId: meal.id,
    mealName: meal.name,
    category: meal.category,
    style: meal.style,
    repetitionFamily: meal.repetitionFamily,
    additions: meal.additions,
    rating: [4, 3, 5][index],
    comment: [
      "Bright and filling without slowing the afternoon down.",
      "Good texture; I would swap the egg next time.",
      "A strong repeat, especially after a longer shift."
    ][index],
    eatenAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
    source: "sample"
  }));
}

export class LedgerStore {
  constructor({ storage, supabase = null, getUser = () => null }) {
    this.storage = storage;
    this.supabase = supabase;
    this.getUser = getUser;
  }

  localEntries() {
    return readJson(this.storage, storageKeys.ledger, []);
  }

  saveLocal(entries) {
    return writeJson(this.storage, storageKeys.ledger, entries);
  }

  async list() {
    const user = this.getUser();
    if (!this.supabase || !user) return this.localEntries();

    const { data, error } = await this.supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("eaten_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(fromDatabase);
  }

  async add(entry) {
    const record = {
      ...entry,
      id: entry.id || localId(),
      eatenAt: entry.eatenAt || nowIso(),
      createdAt: entry.createdAt || nowIso()
    };
    const user = this.getUser();

    if (!this.supabase || !user) {
      this.saveLocal([record, ...this.localEntries()]);
      return record;
    }

    const payload = toDatabase(record, user.id);
    let response = await this.supabase
      .from("meal_logs")
      .insert(payload)
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (response.error && /feedback/i.test(response.error.message || "")) {
      const { feedback, ...legacyPayload } = payload;
      response = await this.supabase
        .from("meal_logs")
        .insert(legacyPayload)
        .select("*")
        .eq("user_id", user.id)
        .single();
    }
    if (response.error) throw response.error;
    return fromDatabase(response.data);
  }

  async removeAll() {
    const user = this.getUser();
    if (!this.supabase || !user) {
      this.storage.removeItem(storageKeys.ledger);
      return;
    }
    const { error } = await this.supabase
      .from("meal_logs")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;
  }
}

export function toDatabase(entry, userId) {
  return {
    user_id: userId,
    meal_id: entry.mealId,
    meal_name: entry.mealName,
    category: entry.category,
    style: entry.style || null,
    repetition_family: entry.repetitionFamily,
    additions: entry.additions || [],
    rating: Number(entry.rating),
    comment: entry.comment || "",
    feedback: {
      fullness: entry.fullness || "",
      wouldRepeat: entry.wouldRepeat ?? null,
      nextTime: entry.nextTime || ""
    },
    eaten_at: entry.eatenAt || nowIso(),
    source_version: "catalogue-schema-1-engine-1.1"
  };
}

export function fromDatabase(row) {
  return {
    id: row.id,
    mealId: row.meal_id,
    mealName: row.meal_name,
    category: row.category,
    style: row.style,
    repetitionFamily: row.repetition_family,
    additions: row.additions || [],
    rating: Number(row.rating),
    comment: row.comment || "",
    fullness: row.feedback?.fullness || "",
    wouldRepeat: row.feedback?.wouldRepeat ?? null,
    nextTime: row.feedback?.nextTime || "",
    eatenAt: row.eaten_at,
    createdAt: row.created_at,
    source: "cloud"
  };
}
