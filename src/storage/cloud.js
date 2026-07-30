export function validPublicConfig(config = {}) {
  return Boolean(
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.SUPABASE_URL || "") &&
      /^(sb_publishable_|eyJ)/.test(config.SUPABASE_PUBLISHABLE_KEY || "")
  );
}

export function createCloudClient(config = {}) {
  if (!validPublicConfig(config)) return null;
  const createClient = globalThis.supabase?.createClient;
  if (!createClient) return null;
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export async function loadCloudPreferences(client, userId) {
  const { data, error } = await client
    .from("preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCloudPreferences(client, userId, preferences) {
  const { data, error } = await client
    .from("preferences")
    .upsert({ ...preferences, user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function loadCloudSchedule(client, userId, weekStart) {
  const { data, error } = await client
    .from("weekly_schedules")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCloudSchedule(client, userId, weekStart, shifts) {
  const { data, error } = await client
    .from("weekly_schedules")
    .upsert(
      { user_id: userId, week_start: weekStart, shifts },
      { onConflict: "user_id,week_start" }
    )
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAllCloudData(client, userId) {
  for (const table of ["meal_logs", "preferences", "weekly_schedules"]) {
    const { error } = await client.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
}
