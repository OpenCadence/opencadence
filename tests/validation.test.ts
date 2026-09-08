import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDate } from "../src/mcp/schemas";
import {
  text,
  date,
  choice,
  email,
  localDate,
  isCalendarDate,
} from "../src/lib/validation";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
test("required text is trimmed and bounded", () => {
  assert.equal(
    text(form({ title: "  A good idea  " }), "title", 30, true),
    "A good idea",
  );
  assert.throws(
    () => text(form({ title: "  " }), "title", 30, true),
    /Please enter/,
  );
  assert.throws(
    () => text(form({ title: "x".repeat(201) }), "title", 200),
    /200 characters/,
  );
  assert.equal(text(form({}), "body"), "");
});
test("files cannot be submitted as text", () => {
  const data = new FormData();
  data.set("title", new Blob(["a"]), "file.txt");
  assert.throws(() => text(data, "title"), /Invalid/);
});
test("dates accept empty values and real calendar dates only", () => {
  for (const value of ["", "2026-09-05", "2024-02-29"])
    assert.equal(date(form({ due: value }), "due"), value);
  for (const value of [
    "2025-02-29",
    "2026-02-30",
    "2026-13-01",
    "not-a-date",
    "09/05/2026",
  ])
    assert.throws(() => date(form({ due: value }), "due"));
});
test("choices reject arbitrary and prototype values", () => {
  assert.equal(choice(form({ stage: "Won" }), "stage", ["Won", "Lost"]), "Won");
  for (const value of ["", "Other", "__proto__", "constructor"])
    assert.throws(() =>
      choice(form({ stage: value }), "stage", ["Won", "Lost"]),
    );
});
test("email is optional but validated when present", () => {
  assert.equal(
    email(form({ email: " alex@example.com " })),
    "alex@example.com",
  );
  assert.equal(email(form({})), "");
  for (const value of [
    "nope",
    "a@",
    "a b@c.com",
    "x@y",
    "victim@example.com?bcc=attacker@example.com",
    "victim@example.com%0abcc=attacker@example.com",
  ])
    assert.throws(() => email(form({ email: value })));
});
test("local dates use padded calendar components", () => {
  assert.equal(localDate(new Date(2026, 0, 3, 23, 59)), "2026-01-03");
});

test("preserved text validates raw length and type without trimming whitespace", () => {
  for (const body of ["\n  indented\t\n\n", " \t\n", "", " ".repeat(50000)]) {
    assert.equal(text(form({ body }), "body", 50000, false, "preserve"), body);
  }
  assert.throws(
    () =>
      text(form({ body: " ".repeat(50001) }), "body", 50000, false, "preserve"),
    /50000 characters/,
  );
  const file = new FormData();
  file.set("body", new Blob(["text"]), "note.txt");
  assert.throws(
    () => text(file, "body", 50000, false, "preserve"),
    /Invalid body/,
  );
});

test("web and MCP share calendar validity without sharing empty or trimming semantics", () => {
  for (const [value, valid] of [
    ["2024-02-29", true],
    ["2000-02-29", true],
    ["2026-12-31", true],
    ["1900-02-29", false],
    ["2025-02-29", false],
    ["2026-04-31", false],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["not-a-date", false],
  ] as const) {
    assert.equal(isCalendarDate(value), valid, value);
    assert.equal(calendarDate.safeParse(value).success, valid, value);
    if (valid) assert.equal(date(form({ due: value }), "due"), value);
    else assert.throws(() => date(form({ due: value }), "due"));
  }
  assert.equal(date(form({ due: " 2024-02-29 " }), "due"), "2024-02-29");
  assert.equal(date(form({ due: "" }), "due"), "");
  assert.equal(calendarDate.safeParse("").success, false);
  assert.equal(calendarDate.safeParse(" 2024-02-29 ").success, false);
});
