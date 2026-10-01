import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Workspace keeps Deliverables inside Project Detail and has no standalone Tasks/Deliverables pages", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /id="view-tasks"/);
  assert.doesNotMatch(html, /id="view-deliverables"/);
  assert.doesNotMatch(html, /state\.activeView === "tasks"/);
  assert.doesNotMatch(html, /state\.activeView === "deliverables"/);
  assert.match(html, /id="projTab-deliverables"/);
  assert.match(html, /id="projectDeliverablesList"/);
  assert.match(html, /data-project-tab="deliverables"/);
});

test("Project Detail is the main working area", async () => {
  const html = await read("index.html");
  for (const tab of ["project-data","deliverables","payment-tracker","files","notes"]) {
    assert.match(html, new RegExp(`data-project-tab="${tab}"`));
    assert.match(html, new RegExp(`id="projTab-${tab}"`));
  }
  assert.match(html, />Overview<\/span>/);
  assert.match(html, />Finance<\/span>/);
  assert.match(html, />Files<\/span>/);
  assert.match(html, />Notes & Activity<\/span>/);
  assert.match(html, /id="invoicePaperPrintable"/);
  assert.doesNotMatch(html, /data-project-tab="invoice"/);
  assert.match(html, /function openProjectDetails\(projId,initialTab='project-data'\)/);
});

test("Dashboard is attention-focused and has no duplicate mini calendar", async () => {
  const html = await read("index.html");
  const renderStart=html.indexOf("function renderOverviewDashboard");
  const renderEnd=html.indexOf("function renderOverviewRevenueChart",renderStart);
  const render=html.slice(renderStart,renderEnd);
  assert.match(render, /Overdue Projects/);
  assert.match(render, /Due in 7 Days/);
  assert.match(render, /Open Deliverables/);
  assert.doesNotMatch(render, /Active Projects<\/div>/);
  assert.doesNotMatch(html, /id="overviewMiniCalendar"/);
  assert.match(html, /Upcoming Deliverables/);
  assert.match(html, /app\.navigateTo\('projects'\)">View Projects/);
});

test("Financial Analytics duplicate page is removed and Reports remains", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /id="view-analytics"/);
  assert.doesNotMatch(html, /state\.activeView === "analytics"/);
  assert.match(html, /id="view-reports"/);
  const renderStart=html.indexOf("function renderReportsView");
  const renderEnd=html.indexOf("function setReportsRange",renderStart);
  const render=html.slice(renderStart,renderEnd);
  assert.match(render, /<span>Outstanding<\/span>/);
  assert.match(render, /<span>Total Receivables<\/span>/);
  assert.match(render, /<span>Collected<\/span>/);
  assert.match(render, /Recent Payments/);
  assert.match(render, /Payment Status/);
  assert.doesNotMatch(render, /report-chart-card-v2/);
});

test("desktop navigation contains only the agreed business groups", async () => {
  const js = await read("js/v1-2-ux.js");
  for (const group of ["WORK","FINANCE","BUSINESS","PORTAL","SYSTEM"]) {
    assert.ok(js.includes(`makeGroup('${group}'`), `missing ${group} group`);
  }
  assert.doesNotMatch(js, /makeGroup\('OPERATIONS'/);
  assert.doesNotMatch(js, /items\.tasks/);
  assert.doesNotMatch(js, /items\.deliverables/);
  assert.match(js, /Flyers & Campaigns/);
});

test("mobile navigation keeps high-frequency destinations and removes Tasks/Deliverables", async () => {
  const js = await read("js/v1-3-ux.js");
  for (const view of ["my-works","projects","clients","payments"]) assert.ok(js.includes(`data-v="${view}"`));
  assert.match(js, /data-more aria-expanded="false"/);
  assert.match(js, /Flyers & Campaigns/);
  assert.match(js, /Deadline Calendar/);
  assert.doesNotMatch(js, /\['tasks','Tasks'\]/);
  assert.doesNotMatch(js, /\['deliverables','Deliverables'\]/);
});

test("Projects archive instead of destructive delete", async () => {
  const html = await read("index.html");
  assert.match(html, /function archiveCurrentProject\(\)/);
  assert.match(html, /\.update\(\{archived_at:archivedAt/);
  assert.match(html, /Archive Project/);
  assert.match(html, /const names=\["All","Active","Completed","Archived"\]/);
});

test("New Order presents a clear three-step flow", async () => {
  const html = await read("index.html");
  assert.match(html, /STEP 1[\s\S]*Project & Client/);
  assert.match(html, /STEP 2[\s\S]*Services & Packages/);
  assert.match(html, /STEP 3[\s\S]*Schedule & Review/);
  assert.match(html, /Select Existing Client/);
  assert.match(html, /Existing/);
  assert.match(html, /New/);
});

test("Workspace campaign manager supports Web flyers, Web surveys, and Online promotions", async () => {
  const js = await read("js/general-update.js");
  const api = await read("api/suite.js");
  assert.match(js, /Flyers & Campaigns/);
  assert.match(js, /JUAN Web/);
  assert.match(js, /JUAN PROJECT Online/);
  assert.match(js, /Survey Questions/);
  assert.match(js, /survey-responses/);
  assert.match(js, /View Responses/);
  assert.match(api, /\.eq\('channel','online'\)/);
  assert.match(api, /action==='survey-responses'/);
  assert.match(api, /channel==='web'/);
  assert.match(api, /contentType==='survey'/);
});

test("Workspace API retries once after refreshing an expired session", async () => {
  const js = await read("js/suite-prod.js");
  assert.match(js, /if\(r\.status===401&&__JUAN_SB\?\.auth\?\.refreshSession\)/);
  assert.match(js, /await __JUAN_SB\.auth\.refreshSession\(\)/);
});

test("Workspace login validates required fields before consuming rate limits and provides retry guidance", async () => {
  const login = await read("api/login.js");
  const lib = await read("api/_lib.js");
  const html = await read("index.html");
  const required=login.indexOf("if(!email||!password)");
  const ipLimit=login.indexOf("workspace-login-ip");
  assert.ok(required>=0 && required<ipLimit);
  assert.match(lib, /Retry-After/);
  assert.match(lib, /retry_after_seconds/);
  assert.match(html, /Too many sign-in attempts\. Try again in about/);
});

test("navigation guard prevents silent blank screens", async () => {
  const js = await read("js/v1-2-ux.js");
  assert.match(js, /const target=q\('#view-'\+view\)/);
  assert.match(js, /This Workspace section is not available yet/);
  assert.match(js, /return false/);
});
