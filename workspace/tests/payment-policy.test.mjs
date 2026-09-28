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

test("overdue policy is 1-day grace, 35 daily from day 2, 500 on day 3, then 250 weekly", async () => {
  const html=await read("index.html");
  const terms=await read("../online/terms.html");
  const sql=await read("../supabase/migrations/037_overdue_daily_fee_v3.sql");
  assert.match(sql,/days_after_due <= 1/);
  assert.match(sql,/\(days_after_due - 1\) \* 35/);
  assert.match(sql,/when days_after_due >= 3 then 500/);
  assert.match(sql,/floor\(days_after_due \/ 7\.0\) \* 250/);
  assert.match(html,/₱35\/day beginning on day 2/);
  assert.match(html,/\+₱500 on day 3/);
  assert.match(terms,/Beginning on Day 2 after the due date/);
  assert.match(terms,/₱35 per day/);
  assert.match(terms,/₱570 in total overdue charges/);
});

test("workspace refresh restores the persisted Supabase session without a second auth client", async () => {
  const html=await read("index.html");
  const runtime=await read("js/suite-prod.js");
  assert.match(html,/waitForWorkspaceSession\(supabaseClient\)/);
  assert.match(html,/persistSession: true/);
  assert.match(runtime,/if\(__JUAN_APP==='workspace'\)/);
  assert.match(runtime,/shared=window\.supabaseClient/);
});
