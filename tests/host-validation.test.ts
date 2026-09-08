import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedRequestHost } from "../src/lib/host-validation";

test("request hosts default to loopback addresses only", () => {
  for (const host of [
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "[::1]",
    "[::1]:3000",
  ]) {
    assert.equal(isAllowedRequestHost(host, ""), true, host);
  }
  for (const host of [
    null,
    "",
    "attacker.example",
    "localhost.attacker.example",
    "localhost@attacker.example",
    "localhost,attacker.example",
    "localhost\\attacker.example",
  ]) {
    assert.equal(isAllowedRequestHost(host, ""), false, String(host));
  }
});

test("additional request hosts require an explicit exact allowlist entry", () => {
  const configured = "workspace.example.com, internal.example:8443";
  assert.equal(isAllowedRequestHost("workspace.example.com", configured), true);
  assert.equal(
    isAllowedRequestHost("workspace.example.com:443", configured),
    true,
  );
  assert.equal(isAllowedRequestHost("internal.example", configured), true);
  assert.equal(
    isAllowedRequestHost("sub.workspace.example.com", configured),
    false,
  );
});
