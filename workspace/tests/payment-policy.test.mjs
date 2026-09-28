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


test("weekly overdue increments require completed seven-day blocks", async () => {
  const sql=await read("../supabase/migrations/038_remove_daily_overdue_fee.sql");
  assert.match(sql,/floor\(\(p_as_of - p_due_date\) \/ 7\.0\) \* 250/);
});

test("payment create and edit use the authenticated Workspace API, not direct financial RPC", async () => {
  const html=await read("index.html");
  const api=await read("api/suite.js");
  const paymentBlock=html.slice(html.indexOf("async function finalizePaymentRecord"),html.indexOf("async function setProjectRushFeeEnabled"));
  assert.match(paymentBlock,/action:'save-payment'/);
  assert.match(paymentBlock,/action:'delete-payment'/);
  assert.doesNotMatch(paymentBlock,/supabaseClient\.rpc\('refresh_juan_project_financials'/);
  assert.match(api,/if\(action==='save-payment'\)/);
  assert.match(api,/if\(action==='delete-payment'\)/);
  assert.match(api,/svc\.rpc\('refresh_juan_project_financials'/);
});

test("payment calculations stay compact", async () => {
  const html=await read("index.html");
  assert.doesNotMatch(html,/<span>Days Overdue<\/span>/);
  assert.doesNotMatch(html,/<span>Next Fee Date<\/span>/);
});

test("deliverable checklist saves before keeping the optimistic state and uses compact spacing", async () => {
  const html=await read("index.html");
  const block=html.slice(html.indexOf("async function toggleDeliverable"),html.indexOf("const WORKSPACE_PAYMENT_INSTITUTIONS"));
  assert.match(block,/await directProjectWrite\(proj,'Deliverable status update',\{structure:true\}\)/);
  assert.match(block,/Deliverable change was restored because it could not be saved to Supabase/);
  assert.match(html,/\.deliverable-checklist-row\{[^}]*min-height:48px[^}]*padding:6px 18px!important/);
  assert.match(html,/\.deliverable-child-row\{[^}]*margin-left:12px!important[^}]*padding-left:22px!important/);
  assert.match(html,/\.deliverable-child-row:after\{content:none!important\}/);
});


test("project detail helper notes use compact info buttons instead of technical backend prose", async () => {
  const html=await read("index.html");
  const ui=await read("js/workspace-unification-2026-09-22.js");
  const css=await read("css/workspace-unification-2026-09-22.css");
  assert.match(html,/class="jp-info-button"/);
  assert.match(html,/Autosave On/);
  assert.doesNotMatch(html,/Values are enforced by the JUAN PROJECT backend/);
  assert.doesNotMatch(html,/All changes save automatically/);
  assert.doesNotMatch(html,/Items added here are reflected automatically in Deliverables/);
  assert.doesNotMatch(html,/Payment due on the Project End \/ Deadline Date · 1-day grace period/);
  assert.doesNotMatch(ui,/Values are enforced by the JUAN PROJECT backend/);
  assert.doesNotMatch(ui,/Loading backend ledger/);
  assert.doesNotMatch(ui,/Backend financial event/);
  assert.match(ui,/About overdue fees/);
  assert.match(css,/\.jp-info-button\{/);
  assert.match(css,/content:attr\(data-info\)/);
});
