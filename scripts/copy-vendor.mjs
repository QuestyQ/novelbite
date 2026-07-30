import fs from "node:fs";
import path from "node:path";

const source = path.resolve("node_modules/@supabase/supabase-js/dist/umd/supabase.js");
const output = path.resolve("public/vendor/supabase.js");
if (!fs.existsSync(source)) throw new Error("Supabase browser bundle is missing. Run npm ci first.");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(source, output);
console.log(`Copied browser-safe Supabase bundle to ${output}.`);
