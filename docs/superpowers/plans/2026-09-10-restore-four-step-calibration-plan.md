# Restore Four-Step Calibration Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore “แผนสอบเทียบ” to its original four primary sections and retire the separate results/signed-scan workflow without changing instruments or batch-history documents.

**Architecture:** Remove the fifth results surface and its legacy script from the application shell, simplify calibration-work routing/state back to four tabs, and route old `calrecs` links to Plan History. Remove only notification and dashboard integrations that depend on `calibration_records`; keep the batch workflow and `calibration_work_documents` history unchanged.

**Tech Stack:** Static HTML, browser JavaScript, CSS, service worker cache, HTML-based regression tests.

## Global Constraints

- Keep all instrument records unchanged.
- Keep the four Plan sections: เลือกเครื่อง, ชุดงาน, รอดำเนินการ, ประวัติ.
- Preserve all batch detail, batch history, and `calibration_work_documents` PDF behavior.
- Remove the results/signed-scan UI, notification, dashboard card, and legacy cached script.
- Old `calrecs` navigation must open Plan History.

---

### Task 1: Lock the retired workflow behavior with regression tests

**Files:**
- Modify: `tests/calibration-work-batch.test.html`
- Modify: `tests/plan-export.test.html`

**Interfaces:**
- Consumes: application source files loaded as text by the existing HTML test harness.
- Produces: assertions requiring four Plan tabs, no results surface or scan notification, no legacy script load/cache entry, and a `calrecs` alias to History.

- [ ] **Step 1: Write source-level assertions**

```js
eq(primaryTabs.length, 4, 'four primary plan sections');
lacks(indexSource, 'data-cw-primary="results"', 'results tab removed');
lacks(indexSource, 'id="cwResultsSurface"', 'results surface removed');
lacks(indexSource, 'id="scanNotifWrapper"', 'scan notification removed');
lacks(indexSource, 'js/23-cal-records.js', 'legacy results script removed');
lacks(swSource, 'js/23-cal-records.js', 'legacy results script not cached');
has(routerSource, "cwSetPrimaryTab('history')", 'legacy route opens history');
```

- [ ] **Step 2: Run focused tests and verify RED**

Run the existing browser-test runner against `tests/calibration-work-batch.test.html` and `tests/plan-export.test.html`.

Expected: FAIL because the retired workflow still exists.

### Task 2: Restore the four-section Plan shell

**Files:**
- Modify: `index.html`
- Modify: `js/29-calibration-work.js`
- Modify: `js/10-router.js`
- Modify: `js/02-dashboard.js`
- Modify: `js/06b-import-register.js`
- Modify: `js/07-notifications.js`
- Modify: `js/25-dashboard-ui.js`
- Modify: `sw.js`
- Delete: `js/23-cal-records.js`

**Interfaces:**
- Consumes: `cwSetPrimaryTab(tab)`, `cwRenderDashboard(model, options)`, and `showPage(page)`.
- Produces: four-value `CW_PRIMARY_TABS`, History fallback for legacy `calrecs`, and a Plan badge based only on active batch work.

- [ ] **Step 1: Remove retired HTML and script references**

Delete the scan notification wrapper, fifth primary tab, complete `cwResultsSurface`, `js/23-cal-records.js` script tag, and single-purpose scan badge rule.

- [ ] **Step 2: Simplify calibration-work state**

```js
const CW_PRIMARY_TABS = Object.freeze(['select', 'batches', 'waiting', 'history']);
```

Remove results switching/loading, scan badge aggregation, and return-to-results branches while leaving batch History and document handling unchanged.

- [ ] **Step 3: Redirect old links to History**

```js
if (requestedHistory && typeof cwSetPrimaryTab === 'function') cwSetPrimaryTab('history');
```

- [ ] **Step 4: Remove dependent notification/dashboard calls**

Remove `renderPendingCertWidget()`, scan dropdown behavior, role-based scan wrapper behavior, and the dashboard scan card.

- [ ] **Step 5: Stop shipping the legacy module**

Delete `js/23-cal-records.js`, remove its service-worker entry, and increment the cache version.

- [ ] **Step 6: Run focused tests and verify GREEN**

Expected: all focused assertions pass.

- [ ] **Step 7: Commit**

```bash
git add index.html js/29-calibration-work.js js/10-router.js js/02-dashboard.js js/06b-import-register.js js/07-notifications.js js/25-dashboard-ui.js sw.js tests/calibration-work-batch.test.html tests/plan-export.test.html docs/superpowers/plans/2026-09-10-restore-four-step-calibration-plan.md
git add -u js/23-cal-records.js
git commit -m "refactor: restore four-step calibration plan"
```

### Task 3: Verify and deploy

**Files:**
- Verify only: all changed files and the live GitHub Pages site.

**Interfaces:**
- Consumes: main branch GitHub Pages workflow.
- Produces: deployed four-section Plan with no results/signed-scan surface.

- [ ] **Step 1: Run full regression checks**

Run all nine HTML test pages, JavaScript syntax checks, and `git diff --check`.

- [ ] **Step 2: Verify the diff is scoped**

Confirm History and `calibration_work_documents` remain intact and no instrument-data mutation exists.

- [ ] **Step 3: Push main and wait for Pages**

```bash
git push origin main
```

- [ ] **Step 4: Verify production**

Confirm four Plan tabs, History details/PDF links, no results tab, and no scan notification.
