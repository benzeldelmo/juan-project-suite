import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("payment due date follows Project End / Deadline Date", async () => {
  const html=await read("index.html");
  const sql=await read("../supabase/migrations/035_payment_due_lifecycle_v2.sql");
  assert.match(html,/Project End \/ Deadline Date/);
  assert.match(html,/This date is also used as the payment due date/);
  assert.match(sql,/new\.payment_due_date:=derived_due/);
  assert.match(sql,/new\.deadline_date/);
});

test("overdue policy is 1-day grace, 500 on day 3, then 250 weekly with no daily fee", async () => {
  const html=await read("index.html");
  const terms=await read("../online/terms.html");
  const sql=await read("../supabase/migrations/038_remove_daily_overdue_fee.sql");
  assert.match(sql,/p_as_of - p_due_date < 3/);
  assert.match(sql,/500 \+ floor\(\(p_as_of - p_due_date\) \/ 7\.0\) \* 250/);
  assert.match(html,/₱500 applies on Day 3/);
  assert.match(html,/no daily fee/i);
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


test("Workspace page headers scroll normally while Project Details keeps the approved summary layout", async () => {
  const html=await read("index.html");
  const ui=await read("js/workspace-unification-2026-09-22.js");
  const css=await read("css/workspace-unification-2026-09-22.css");
  assert.match(css,/\.main-content>\.view>\.page-header,[\s\S]*?position:static!important/);
  assert.match(css,/#view-settings \.jp-settings-header/);
  assert.match(css,/#view-in-house-ads \.jp-ads-heading/);
  assert.match(css,/#view-project-details>\.page-header[\s\S]*?position:static!important/);
  assert.match(html,/class="project-progress-icon"/);
  assert.match(css,/#view-project-details #jpProjectFinanceSummary \.jp-finance-summary[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(ui,/class="jp-finance-icon mint"/);
  assert.match(ui,/class="jp-finance-icon danger"/);
  assert.match(html,/data-project-tab="deliverables"[\s\S]*?<svg/);
});

test("Deliverables use checkboxes instead of duplicate progress bars", async () => {
  const html=await read("index.html");
  const renderBlock=html.slice(html.indexOf("function renderProjectDeliverablesList"),html.indexOf("function toLocalDateTimeInput"));
  assert.doesNotMatch(html,/id="projDetailProgressBar"/);
  assert.doesNotMatch(renderBlock,/deliverable-item-progress/);
  assert.doesNotMatch(renderBlock,/Math\.round\(progress\)/);
});


test("Project Details uses desktop side navigation and returns to horizontal navigation on smaller screens", async () => {
  const html=await read("index.html");
  const css=await read("css/workspace-unification-2026-09-22.css");
  assert.match(html,/class="project-details-workspace"/);
  assert.match(html,/<aside class="tabs-nav project-details-tabs" aria-label="Project sections">/);
  assert.match(html,/class="project-details-content"/);
  assert.match(css,/grid-template-columns:224px minmax\(0,1fr\)!important/);
  assert.match(css,/#view-project-details \.project-details-tabs[\s\S]*?flex-direction:column!important/);
  assert.match(css,/@media\(max-width:960px\)[\s\S]*?#view-project-details \.project-details-tabs[\s\S]*?flex-direction:row!important/);
});

test("Project Details follows the 8px spacing system and one icon language", async () => {
  const css=await read("css/workspace-unification-2026-09-22.css");
  assert.match(css,/--pd-1:8px/);
  assert.match(css,/--pd-2:16px/);
  assert.match(css,/--pd-3:24px/);
  assert.match(css,/--pd-5:40px/);
  assert.match(css,/--pd-6:48px/);
  assert.match(css,/#view-project-details \.icon-svg,[\s\S]*?stroke-width:1\.8!important/);
  assert.match(css,/#view-project-details \.project-primary-actions>\.btn[\s\S]*?height:40px!important/);
  assert.match(css,/#view-project-details \.project-overall-progress[\s\S]*?padding:24px!important/);
  assert.match(css,/#view-project-details #jpProjectFinanceSummary \.jp-finance-icon[\s\S]*?width:40px!important/);
  assert.match(css,/#view-project-details \.payment-modular-grid[\s\S]*?gap:16px!important/);
});


test("custom Order Item pricing updates both local and canonical database fields", async () => {
  const html=await read("index.html");
  const saveBlock=html.slice(html.indexOf("function saveProjectOrderItem"),html.indexOf("function requestDeleteProjectOrderItem"));
  assert.match(saveBlock,/qty,quantity:qty,price,unit_price:price,type,item_type:type/);
  assert.match(html,/item\.price\?\?item\.unit_price/);
  assert.match(html,/item\.qty\?\?item\.quantity/);
  assert.doesNotMatch(html,/order-item-actions"><button class="btn btn-secondary btn-sm"[^>]*>Edit<\/button>/);
  assert.match(html,/Edit Item/);
});

test("new manual deliverables are saved before success and can use the normal checkbox path", async () => {
  const html=await read("index.html");
  const addBlock=html.slice(html.indexOf("async function saveProjectDeliverable"),html.indexOf("function removeProjectDeliverablesByIds"));
  const toggleBlock=html.slice(html.indexOf("async function toggleDeliverable"),html.indexOf("const WORKSPACE_PAYMENT_INSTITUTIONS"));
  assert.match(addBlock,/await directProjectWrite\(proj,'Deliverable added',\{structure:true\}\)/);
  assert.match(addBlock,/Deliverable was not added because it could not be saved to Supabase/);
  assert.match(toggleBlock,/normalizeProjectDeliverableHierarchy\(proj\)/);
  assert.match(toggleBlock,/await directProjectWrite\(proj,'Deliverable status update',\{structure:true\}\)/);
});

test("generic modals do not receive the Project finance summary", async () => {
  const ui=await read("js/workspace-unification-2026-09-22.js");
  assert.match(ui,/root\.dataset\.jpProjectFinanceContext!=='1'/);
  assert.doesNotMatch(ui,/forEach\(d=>\{enhanceProjectDialog\(d\);enhancePaymentReview\(d\)\}\)/);
});

test("Workspace buttons, sidebar navigation and tabs use one compact component geometry", async () => {
  const css=await read("css/workspace-unification-2026-09-22.css");
  assert.match(css,/\.btn\{[\s\S]*?min-height:40px!important[\s\S]*?border-radius:12px!important/);
  assert.match(css,/\.btn-sm\{[\s\S]*?min-height:32px!important[\s\S]*?border-radius:10px!important/);
  assert.match(css,/\.sidebar \.nav-item,[\s\S]*?min-height:40px!important[\s\S]*?border-radius:12px!important/);
  assert.match(css,/\.tabs-nav \.tab-btn,[\s\S]*?min-height:40px!important[\s\S]*?border-radius:12px!important/);
});
