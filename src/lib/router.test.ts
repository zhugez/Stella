import assert from "node:assert/strict";
import { test } from "node:test";

test("dictionary assistance fires for direct navigation and browser Back hash navigation", async () => {
  const target = new EventTarget();
  Object.assign(globalThis, {
    window: target,
    location: { hash: "#/reading" },
    history: { pushState() {}, replaceState() {} },
  });
  const router = await import("./router");
  let lookups = 0;
  target.addEventListener("stella:dictionary", () => lookups++);
  router.openWord("library");
  assert.equal(lookups, 1);
  router.closeWord();
  assert.equal(lookups, 1);
  location.hash = "#/reading?w=library";
  target.dispatchEvent(new Event("hashchange"));
  assert.equal(lookups, 2);
  assert.equal(router.currentLocation().word, "library");
});
