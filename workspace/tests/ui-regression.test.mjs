import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global sidebar keeps breathable navigation spacing", async () => {
  const css = await read("css/consistency-pass.css");
  assert.match(css, /\.sidebar \.nav-item\{[^}]*min-height:42px!important/);
  assert.match(css, /\.sidebar \.nav-menu\{[^}]*gap:4px!important/);
  assert.match(css, /\.sidebar \.nav-section-label\{[^}]*margin-top:14px!important/);
});

test("client recent-project table contains all six columns", async () => {
  const css = await read("css/consistency-pass.css");
  assert.match(css, /\.jp-client-recent table\{[^}]*table-layout:fixed!important/);
  assert.match(css, /\.jp-client-recent th:nth-child\(6\)\{width:12%\}/);
  assert.match(css, /\.jp-client-recent th,.jp-client-recent td\{[^}]*overflow:hidden!important/);
});

test("Settings uses persistent segmented navigation", async () => {
  const js = await read("js/consistency-pass.js");
  const css = await read("css/consistency-pass.css");
  assert.match(js, /id="jpSettingsSegments"/);
  assert.match(js, /bindSettingsTabs\(\)/);
  assert.match(js, /SETTINGS_TAB_KEY/);
  assert.match(css, /\.jp-settings-layout\{[^}]*grid-template-columns:260px minmax\(0,1fr\)/);
  assert.match(css, /\.jp-settings-segment\{display:none\}/);
  assert.match(css, /\.jp-settings-segment\.active\{display:block\}/);
});

test("command center is floating, dismissible, and non-modal", async () => {
  const css = await read("css/consistency-pass.css");
  const js = await read("js/keyboard-shortcuts.js");
  assert.match(css, /\.jp-command-overlay\{[^}]*pointer-events:none!important/);
  assert.match(css, /\.jp-command-overlay\{[^}]*background:transparent!important/);
  assert.match(css, /\.jp-command-overlay\{[^}]*backdrop-filter:none!important/);
  assert.match(js, /id="jpCommandClose"/);
  assert.match(js, /aria-modal="false"/);
  assert.doesNotMatch(js, /function nav\(view\)\{closePalette\(\);/);
  assert.match(js, /then\(function\(\)\{closePalette\(\);\}\)/);
  assert.match(css, /\.jp-command-helper\{display:none!important\}/);
  assert.match(js, /if\(palette\)\{if\(e\.key==="Escape"\)\{e\.preventDefault\(\);closePalette\(\);return;\}/);
});

test("repeated command-center opens cannot leave stacked overlays", async () => {
  const js = await read("js/keyboard-shortcuts.js");
  assert.match(js, /paletteRequest=0/);
  assert.match(js, /document\.querySelectorAll\("\.jp-command-overlay"\)\.forEach/);
  assert.match(js, /var request=\+\+paletteRequest/);
  assert.match(js, /if\(request!==paletteRequest\)return/);
});


test("client ID is visible but immutable in Edit Client", async () => {
  const html = await read("index.html");
  assert.match(html, /id="editClientCode" readonly aria-readonly="true"/);
  assert.match(html, /editClientCode"\)\.value = formatClientId\(client\)/);
  const editBlock = html.slice(html.indexOf("async function submitEditClient"), html.indexOf("function openProjectDetails", html.indexOf("async function submitEditClient")));
  assert.doesNotMatch(editBlock, /client_code\s*:/);
});

test("In-House Ads editor exposes audience and Online placements", async () => {
  const js = await read("js/general-update.js");
  assert.match(js, /id="adAudience"/);
  assert.match(js, /guest_home_banner/);
  assert.match(js, /guest_shop_banner/);
  assert.match(js, /client_home_banner/);
  assert.match(js, /client_home_popup/);
});

test("Online API supports the full eight-stage tracker", async () => {
  const api = await read("../online/api/suite.js");
  assert.match(api, /'Downpayment Confirmed'/);
  assert.match(api, /'Quality Assessment'/);
  assert.match(api, /'Delivered'/);
  assert.match(api, /delivery_status=stage===7\?'Delivered':'Pending'/);
});


test("Settings tab activation uses collection selectors and initializes content first", async () => {
  const js = await read("js/consistency-pass.js");
  assert.ok(js.includes('$$(".jp-settings-nav-item").forEach'));
  assert.ok(js.includes('$$(".jp-settings-segment").forEach'));
  assert.ok(js.includes('const tabs=$$(".jp-settings-nav-item")'));
  assert.ok(js.includes('$$("[data-search-index]",box).forEach'));
  assert.ok(js.includes('settingsBuilt=true;settingsDirty=false;bindSettingsTabs();try{bindSettings();}'));
});


test("Settings mirrors the approved reference layout and staged save behavior", async () => {
  const js = await read("js/consistency-pass.js");
  const css = await read("css/consistency-pass.css");
  assert.ok(js.includes('jp-ref-photo-row'));
  assert.ok(js.includes('jp-settings-action-bar'));
  assert.ok(js.includes('id="jpSettingsSave"'));
  assert.ok(js.includes('id="jpSettingsDiscard"'));
  assert.ok(js.includes('function saveActiveSettings()'));
  assert.ok(js.includes('function discardActiveSettings()'));
  assert.ok(js.includes('Save or discard your Settings changes before switching sections.'));
  assert.ok(js.includes('Device biometric / passkey login'));
  assert.ok(js.includes('A database-wide delete workflow is not exposed until it can be verified safely.'));
  assert.match(css, /Reference-aligned Settings UI/);
  assert.match(css, /\.jp-settings-nav-item\{[^}]*grid-template-columns:4px 24px/);
  assert.match(css, /\.jp-settings-action-bar\{/);
});


test("In-House Ads is a standalone Workspace page with permanent deletion", async () => {
  const html = await read("index.html");
  const js = await read("js/general-update.js");
  const css = await read("css/general-update.css");
  const api = await read("../online/api/suite.js");
  assert.match(html, /data-view="in-house-ads"/);
  assert.match(html, /id="view-in-house-ads"/);
  assert.match(js, /function ensureAdsPage/);
  assert.match(js, /data-adelete/);
  assert.match(js, /Delete permanently/);
  assert.match(css, /Standalone In-House Ads page/);
  assert.doesNotMatch(api, /Only unused draft ads can be permanently deleted/);
  assert.match(api, /In-house ad permanently deleted/);
});

test("JUAN PROJECT Online refreshes and cache-busts in-house ads", async () => {
  const ads = await read("../online/js/ads.js");
  const sw = await read("../online/sw.js");
  const html = await read("../online/index.html");
  assert.match(ads, /lastLoadedAt/);
  assert.match(ads, /juan-ads-refresh/);
  assert.match(sw, /const CACHE='juan-online-[^']+'/);
  assert.match(sw, /networkFirst/);
  assert.match(html, /\/js\/ads\.js\?v=\d{8}-[a-z0-9-]+/);
  assert.match(html, /updateViaCache:"none"/);
});


test("Workspace Ads API also permits authenticated permanent deletion", async () => {
  const api = await read("api/suite.js");
  assert.doesNotMatch(api, /Only unused draft ads can be permanently deleted/);
  assert.match(api, /In-house ad permanently deleted/);
  assert.match(api, /juan-ad-assets/);
});


test("Client Home keeps its compact viewport layout, footer and 1800x600 ad format", async () => {
  const app = await read("../online/js/app.js");
  const mobile = await read("../online/css/mobile-redesign.css");
  const ads = await read("../online/css/ads.css");
  const workspaceAds = await read("js/general-update.js");
  assert.match(mobile, /\.jp-home-only-footer/);
  assert.match(mobile, /body:has\(\.app\.route-home\)/);
  assert.match(app, /route-\$\{esc\(state\.route\|\|'home'\)\}/);
  assert.match(mobile, /\.app\.route-home\{height:100dvh;min-height:0;padding-bottom:0;overflow:hidden/);
  assert.match(mobile, /bottom:calc\(66px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(ads, /aspect-ratio:3\/1/);
  assert.match(workspaceAds, /canvas\.width=1800;canvas\.height=600/);
  assert.match(workspaceAds, /1800 × 600 px/);
});


test("legacy sidebar enhancement preserves In-House Ads and future navigation items", async () => {
  const js = await read("js/v1-2-ux.js");
  assert.ok(js.includes("append(labels.operations,['calendar','pricelist','online-portal','in-house-ads'])"));
  assert.ok(js.includes("const placed=new Set()"));
  assert.ok(js.includes("if(!placed.has(key))menu.append(el)"));
});


test("Workspace typography is SF Pro only and uses weight hierarchy", async () => {
  const html = await read("index.html");
  const css = await read("css/typography-sf-pro.css");
  assert.match(html, /typography-sf-pro\.css\?v=20260923-1/);
  assert.match(html, /--font-system: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont;/);
  assert.doesNotMatch(html, /\bInter\b/);
  assert.doesNotMatch(html, /font-family=['"]Arial/);
  assert.doesNotMatch(html, /font-family=['"]sans-serif/);
  assert.match(css, /--fw-regular:400/);
  assert.match(css, /--fw-medium:500/);
  assert.match(css, /--fw-semibold:600/);
  assert.match(css, /--fw-bold:700/);
  assert.match(css, /--fw-heavy:800/);
  assert.match(css, /body \*\{[\s\S]*font-weight:var\(--fw-regular\)!important/);
});


test("legacy Workspace layers do not reintroduce non-SF fonts", async () => {
  const files = [
    await read("css/redesign-2026-09-20.css"),
    await read("css/suite.css"),
    await read("js/suite-prod.js")
  ].join("\n");
  assert.doesNotMatch(files, /\bInter\b/);
  assert.doesNotMatch(files, /\bArial\b/);
  assert.doesNotMatch(files, /\bHelvetica\b/);
  assert.doesNotMatch(files, /\bmonospace\b/);
  assert.doesNotMatch(files, /\bsystem-ui\b/);
  assert.match(files, /SF Pro/);
});


test("maintenance fee follows subtotal-ending-99 rule everywhere", async () => {
  const workspace = await read("index.html");
  const online = await read("../online/js/app.js");
  assert.match(workspace, /return Math\.abs\(Math\.round\(subtotal\)\)%100===99\?26:25/);
  assert.doesNotMatch(workspace, /projectNo\)>=54/);
  assert.doesNotMatch(workspace, /\?31:30/);
  assert.match(workspace, /Unpaid and partially paid projects always follow the current subtotal-based rule/);
  assert.match(workspace, /proj\.system_maintenance_fee=maintenanceFeeForRecalculation\(proj,items,subtotal\)/);
  assert.match(online, /return Math\.abs\(Math\.round\(value\)\)%100===99\?26:25/);
  assert.match(online, /fullySettled=storedTotal>0&&paid>=storedTotal-0\.005/);
});


test("2026-09-23 consolidated UI update keeps modal, ads, home and calendar rules aligned", async () => {
  const ws = await read("index.html");
  const general = await read("js/general-update.js");
  const generalCss = await read("css/general-update.css");
  const online = await read("../online/js/app.js");
  const onlineAds = await read("../online/js/ads.js");
  const onlineCss = await read("../online/css/app.css");
  const onlineAdsCss = await read("../online/css/ads.css");

  assert.doesNotMatch(onlineCss, /SF Pro Rounded|ui-rounded/);
  assert.match(onlineCss, /SF Pro Text/);
  assert.match(online, /Balance Due/);
  assert.match(online, /Project Progress/);
  assert.match(online, /scheduleClientMessageAfterAds/);
  assert.match(online, /animatePaymentReminderBalance/);
  assert.match(onlineAds, /juan-ad-popup-settled/);
  assert.match(onlineAds, /__JUAN_AD_POPUP_ACTIVE/);
  assert.match(onlineAdsCss, /jp-popup-close[\s\S]*background:transparent/);

  assert.match(general, /Delete Campaign/);
  assert.match(general, /JUAN PROJECT Page/);
  assert.match(general, /External Website/);
  assert.match(general, /jp-field-error/);
  assert.match(general, /Delete permanently/);
  assert.match(generalCss, /jp-general-x[\s\S]*background:transparent/);

  assert.match(ws, /<div>SUN<\/div><div>MON<\/div>/);
  assert.match(ws, /function philippineHoliday/);
  assert.match(ws, /for\(let slot=0;slot<42;slot\+\+\)/);
  assert.match(generalCss, /deadline-calendar-card/);
  assert.match(generalCss, /report-recent-v2[\s\S]*border-bottom-left-radius:18px/);
  assert.match(ws, /toast-container \{ position: fixed; top:/);
});
