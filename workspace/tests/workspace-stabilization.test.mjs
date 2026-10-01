import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("core Workspace sections have native render targets", async () => {
  const html = await read("index.html");
  const general = await read("js/general-update.js");
  for (const id of [
    "view-my-works","view-projects","view-orders","view-clients","view-payments","view-reports",
    "view-tasks","view-deliverables","view-calendar","view-pricelist","view-online-portal","view-settings"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
  }
  assert.match(general, /function ensureOrdersView\(\)/);
  assert.match(general, /ordersRefreshBtn/);
  assert.match(general, /ordersPageSearch/);
  assert.match(general, /async function renderOrders\(reload\)/);
});

test("Operations Tasks and Deliverables render from the base Workspace", async () => {
  const html = await read("index.html");
  const js = await read("js/v1-2-ux.js");
  const css = await read("css/v1-2-ux.css");
  assert.match(html, /id="view-tasks"/);
  assert.match(html, /id="tasksList"/);
  assert.match(html, /id="view-deliverables"/);
  assert.match(html, /id="allDeliverablesByProject"/);
  assert.match(html, /state\.activeView === "tasks"\) renderTasks\(\)/);
  assert.match(html, /state\.activeView === "deliverables"\) renderDeliverablesView\(\)/);
  assert.doesNotMatch(js, /function ensureOperationalViews/);
  assert.match(css, /#view-tasks\.active,#view-deliverables\.active\{display:block!important\}/);
});

test("desktop navigation is grouped to reduce sidebar congestion", async () => {
  const js = await read("js/v1-2-ux.js");
  for (const group of ["WORKSPACE","FINANCE","OPERATIONS","SHOP & ONLINE","SYSTEM"]) {
    assert.ok(js.includes(`makeGroup('${group}'`), `missing ${group} group`);
  }
  assert.match(js, /jp-nav-group-toggle/);
  assert.match(js, /aria-expanded/);
});

test("mobile navigation uses four primary destinations plus More", async () => {
  const js = await read("js/v1-3-ux.js");
  const css = await read("css/v1-3-ux.css");
  for (const view of ["my-works","projects","clients","payments"]) assert.ok(js.includes(`data-v="${view}"`));
  assert.match(js, /data-more aria-expanded="false"/);
  assert.match(js, /data-more-v="\$\{v\}"/);
  assert.match(css, /\.mobile-workspace-more\.show/);
  assert.match(css, /\.mobile-more-grid/);
});

test("mobile Workspace reuses the canonical Supabase session", async () => {
  const js = await read("js/v1-3-ux.js");
  assert.match(js, /window\.JuanSuiteRuntime\?\.getSession/);
  assert.match(js, /window\.supabaseClient/);
  assert.doesNotMatch(js, /__jpV13Sb/);
  assert.doesNotMatch(js, /supabase\.createClient\(cfg/);
});

test("Workspace API retries once after refreshing an expired session", async () => {
  const js = await read("js/suite-prod.js");
  assert.match(js, /if\(r\.status===401&&__JUAN_SB\?\.auth\?\.refreshSession\)/);
  assert.match(js, /await __JUAN_SB\.auth\.refreshSession\(\)/);
  assert.match(js, /Your Workspace session expired\. Please sign in again\./);
});

test("Reports render three KPIs, Recent Payments, then full-width Payment Status at source", async () => {
  const html = await read("index.html");
  const js = await read("js/v1-2-ux.js");
  const css = await read("css/v1-2-ux.css");
  const renderStart=html.indexOf("function renderReportsView");
  const renderEnd=html.indexOf("function setReportsRange",renderStart);
  const render=html.slice(renderStart,renderEnd);
  const outstanding=render.indexOf("<span>Outstanding</span>");
  const receivables=render.indexOf("<span>Total Receivables</span>");
  const collected=render.indexOf("<span>Collected</span>");
  const recent=render.indexOf('class="card report-recent-v2"');
  const status=render.indexOf('class="card report-status-card-v2 report-status-full"');
  assert.ok(outstanding>=0 && outstanding<receivables && receivables<collected);
  assert.ok(recent>=0 && status>recent);
  assert.doesNotMatch(render, /class="card report-chart-card-v2"/);
  assert.doesNotMatch(js, /function simplifyReports/);
  assert.doesNotMatch(js, /MutationObserver\(.*simplifyReports/);
  assert.match(css, /report-recent-v2 \.table-responsive\{max-height:360px;overflow-y:auto/);
});

test("navigation guard prevents missing destinations from becoming silent blank screens", async () => {
  const js = await read("js/v1-2-ux.js");
  assert.match(js, /const target=q\('#view-'\+view\)/);
  assert.match(js, /This Workspace section is not available yet/);
  assert.match(js, /return false/);
});
