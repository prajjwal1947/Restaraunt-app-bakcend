import assert from "node:assert/strict";
import { test } from "node:test";
import { customerAppUrl, tableCustomerUrl } from "./customerAppUrl";

const local = "http://localhost:5174";
const production = "https://restaurent-app-frontend-n5yh-six.vercel.app";

test("uses the local customer app while developing when both origins are configured", () => {
  assert.equal(customerAppUrl(`${local},${production}`, false), local);
});

test("uses the deployed customer app in production when origins are comma-separated", () => {
  assert.equal(customerAppUrl(`${local},${production}`, true), production);
});

test("normalizes origins and ignores invalid configured values", () => {
  assert.equal(customerAppUrl(`not-a-url, ${production}/`, true), production);
});

test("builds an encoded table route against the selected origin", () => {
  assert.equal(tableCustomerUrl("table token", `${local},${production}`, true), `${production}/t/table%20token`);
});

test("uses safe environment defaults when no origin is configured", () => {
  assert.equal(customerAppUrl(undefined, false), local);
  assert.equal(customerAppUrl(undefined, true), production);
});