import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("payment due date follows Project End / Deadline Date", async () => {
  const html=await read("index.html");
  const sql=await read("../supabase/migrations/035_payment_due_lifecycle_v2.sql");
  assert.match(html,/Project End \/ Deadline Date/);
  assert.match(html,/This date is also the payment due date/);
  assert.match(sql,/new\.payment_due_date:=derived_due/);
  assert.match(sql,/new\.deadline_date/);
});

test("overdue policy is 1-day grace, 500 on day 3, then 250 weekly with no daily fee", async () => {
  const html=await read("index.html");
  const terms=await read("../online/terms.html");
  const sql=await read("../supabase/migrations/038_remove_daily_overdue_fee.sql");
  assert.match(sql,/p_as_of - p_due_date < 3/);
  assert.match(sql,/500 \+ floor\(\(p_as_of - p_due_date\) \/ 7\.0\) \* 250/);
  assert.match(html,/₱500 on day 3 if unpaid/);
  assert.match(html,/no daily fee/);
  assert.match(terms,/No Daily Fee/);
  assert.doesNotMatch(terms,/₱35 per day/);
});

test("workspace refresh restores the persisted Supabase session without a second auth client", async () => {
  const html=await read("index.html");
  const runtime=await read("js/suite-prod.js");
  assert.match(html,/waitForWorkspaceSession\(supabaseClient\)/);
  assert.match(html,/persistSession: true/);
  assert.match(runtime,/if\(__JUAN_APP==='workspace'\)/);
  assert.match(runtime,/shared=window\.supabaseClient/);
});
