import { test } from "node:test";
import assert from "node:assert/strict";
import { mailtoHref } from "../src/lib/mailto";

test("mailto links preserve ordinary addresses and encode legacy query data", () => {
  assert.equal(mailtoHref("alex@example.com"), "mailto:alex@example.com");
  assert.equal(
    mailtoHref("victim@example.com?bcc=attacker@example.com"),
    "mailto:victim@example.com%3Fbcc%3Dattacker@example.com",
  );
  assert.equal(
    mailtoHref("victim@example.com%0abcc=attacker@example.com"),
    "mailto:victim@example.com%250abcc%3Dattacker@example.com",
  );
});
