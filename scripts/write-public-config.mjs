import fs from "node:fs";
import path from "node:path";

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  SUPPORT_URL: process.env.SUPPORT_URL || ""
};

const output = path.resolve("public/config.js");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `window.APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`, "utf8");
console.log(`Wrote ${output} (${config.SUPABASE_URL ? "cloud demo enabled" : "guest/local only"}).`);
