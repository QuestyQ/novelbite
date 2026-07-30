import assert from "node:assert/strict";
import test from "node:test";
import { parseTime, shiftDurationHours } from "../src/schedule/shifts.js";

test("24-hour time parsing accepts 0930 and converts it to 09:30", () => {
  assert.equal(parseTime("0930"), "09:30");
  assert.equal(parseTime("930"), "09:30");
  assert.equal(parseTime("09:30"), "09:30");
});

test("overnight shifts calculate correctly", () => {
  assert.equal(shiftDurationHours("22:30", "06:30"), 8);
});
