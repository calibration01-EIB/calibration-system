# Replace Legacy Calibration Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make **แผนสอบเทียบ** the single calibration-planning entry point backed only by `calibration_work_*`, with two PDF gates and no legacy FRM/Excel plan system.

**Architecture:** Reuse the completed `js/29-calibration-work.js` state engine and RPC layer, move its page shell under the existing `plan` route, and remove the legacy plan UI/scripts. Retire `frm_plans`, `calibration_plans`, `calibration_plan_items`, `plan_audit_log`, and their functions through a fail-closed migration that only runs when production still contains the confirmed three test rows and no legacy child/audit rows.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Postgres/RLS/RPC/Storage, PowerShell browser test runner.

## Global Constraints

- The visible menu title is exactly **แผนสอบเทียบ**.
- The page has exactly four primary sections: **เลือกเครื่อง**, **ชุดงาน**, **รอดำเนินการ**, and **ประวัติ**.
- The workflow uses PDF only: acknowledgement PDF before calibration and closure PDF after all items finish.
- Excel FRM1 generation, import, export, templates, and UI are removed; unrelated register-import Excel support remains.
- `Admin` and `Editor` can mutate work; other roles remain read-only according to the existing `calibration_work_*` authorization.
- Production legacy removal must fail and roll back unless `frm_plans = 3`, `calibration_plans = 0`, `calibration_plan_items = 0`, and `plan_audit_log = 0` at execution time.
- Never delete `calibration_work_*` rows, functions, policies, or Storage objects.

---

### Task 1: Lock the replacement contract with failing tests

**Files:**
- Modify: `tests/calibration-work-batch.test.html`
- Modify: `tests/plan-export.test.html`

**Interfaces:**
- Consumes: current `index.html`, router, service-worker manifest, and legacy scripts as text fixtures.
- Produces: executable requirements that reject legacy UI/data calls and require the unified plan route.

- [ ] **Step 1: Add failing shell and source-contract tests**

Add assertions to `tests/calibration-work-batch.test.html`:

```javascript
t('uses calibration work as the only plan page', () => {
  has(indexSource, '> แผนสอบเทียบ</span>', 'desktop menu title');
  has(routerSource, "plan: ['แผนสอบเทียบ','ติดตามชุดงาน เอกสาร และผลสอบเทียบรายเครื่อง']", 'route title');
  has(indexSource, 'id="pagePlan"', 'single plan page');
  has(indexSource, 'id="cwTabs"', 'work dashboard lives in plan page');
  lacks(indexSource, "showPage('calwork')", 'separate work route removed');
  lacks(routerSource, 'calwork:', 'separate route metadata removed');
});

t('removes every legacy calibration-plan surface', () => {
  ['แผน FRM', 'ระบบเก่า', 'ลงแผน FRM', 'FRM-EIB04'].forEach(token => lacks(indexSource, token, token));
  ['frm_plans', 'calibration_plans', 'calibration_plan_items'].forEach(token => {
    lacks(indexSource, token, token + ' HTML');
    lacks(planSource, token, token + ' JavaScript');
  });
  lacks(swSource, 'frm-eib04-template.xlsx', 'legacy template cache entry');
});
```

Change `tests/plan-export.test.html` into a retirement contract that loads repository sources and asserts:

```javascript
t('retires FRM Excel implementation without affecting general imports', () => {
  lacks(indexSource, 'js/15-plan-export.js', 'FRM exporter script');
  lacks(indexSource, 'js/17-frm-cross-month.js', 'cross-month FRM script');
  lacks(swSource, 'assets/frm-eib04-template.xlsx', 'FRM template cache');
  has(indexSource, 'id="importFileInput"', 'general register import remains');
  has(indexSource, 'handleImportFile(this.files[0])', 'general import handler remains');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
pwsh -File tools/run-tests.ps1
```

Expected: `calibration-work-batch.test.html` and `plan-export.test.html` fail because the old route, labels, scripts, and template still exist.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add tests/calibration-work-batch.test.html tests/plan-export.test.html
git commit -m "test: define unified calibration plan page"
```

---

### Task 2: Make the plan route render the work-batch page

**Files:**
- Modify: `index.html`
- Modify: `js/10-router.js`
- Modify: `js/29-calibration-work.js`
- Modify: `theme-aqua.css`
- Modify: `sw.js`
- Test: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: `loadCalibrationWorkPage(source)`, `cwRenderDashboard(model)`, and the existing `cw*` dialogs.
- Produces: `showPage('plan')` as the only navigation entry and the four visible sections.

- [ ] **Step 1: Replace the legacy `pagePlan` body with the calibration-work shell**

Keep `id="pagePlan"`, move the existing `cw*` dashboard/detail/dialog markup from the separate work page into it, and use this section navigation:

```html
<div class="cw-primary-tabs" id="cwPrimaryTabs" role="tablist" aria-label="ส่วนของแผนสอบเทียบ">
  <button type="button" role="tab" data-cw-primary="select" onclick="cwSetPrimaryTab('select')">เลือกเครื่อง</button>
  <button type="button" role="tab" data-cw-primary="batches" onclick="cwSetPrimaryTab('batches')">ชุดงาน</button>
  <button type="button" role="tab" data-cw-primary="waiting" onclick="cwSetPrimaryTab('waiting')">รอดำเนินการ</button>
  <button type="button" role="tab" data-cw-primary="history" onclick="cwSetPrimaryTab('history')">ประวัติ</button>
</div>
```

Remove the `nav-calwork` entry. Change desktop and mobile plan labels to `แผนสอบเทียบ` and keep both pointing to `showPage('plan')`.

- [ ] **Step 2: Route plan initialization to the work engine**

Change router metadata to:

```javascript
plan: ['แผนสอบเทียบ', 'ติดตามชุดงาน เอกสาร และผลสอบเทียบรายเครื่อง'],
```

In the `plan` route branch call:

```javascript
if (id === 'plan' && typeof loadCalibrationWorkPage === 'function') {
  loadCalibrationWorkPage();
}
```

Remove the `calwork` route branch. In `js/29-calibration-work.js`, change navigation helpers from `showPage('calwork')` to `showPage('plan')`.

- [ ] **Step 3: Map the four sections to existing work states**

Add a single public selector:

```javascript
function cwSetPrimaryTab(tab) {
  if (!['select', 'batches', 'waiting', 'history'].includes(tab)) return false;
  cwPrimaryTab = tab;
  if (tab === 'select') return cwOpenCreate();
  cwSetDashboardTab(tab === 'batches' ? 'active' : tab);
  cwRenderPrimaryTabs();
  return true;
}
```

`waiting` includes acknowledgement, calibration, and closure queues; `history` includes completed and cancelled batches. Keep the existing inner status filters only if they do not duplicate the four primary labels.

- [ ] **Step 4: Update cache generation and scoped styles**

Increment `CACHE_NAME`, update query versions for `index.html`, `js/10-router.js`, `js/29-calibration-work.js`, and `theme-aqua.css`, and ensure exact query-qualified URLs match between `index.html` and `APP_SHELL`.

- [ ] **Step 5: Run tests and verify GREEN for the unified shell**

```powershell
pwsh -File tools/run-tests.ps1
pwsh -File tools/verify-app-load.ps1
```

Expected: all page tests pass; 28 or fewer declared scripts load with zero runtime errors.

- [ ] **Step 6: Commit**

```powershell
git add index.html js/10-router.js js/29-calibration-work.js theme-aqua.css sw.js tests/calibration-work-batch.test.html
git commit -m "feat: make work batches the calibration plan page"
```

---

### Task 3: Remove legacy FRM and Excel code

**Files:**
- Delete: `js/15-plan-export.js`
- Delete: `js/17-frm-cross-month.js`
- Delete: `assets/frm-eib04-template.xlsx`
- Modify: `js/06-plan.js`
- Modify: `index.html`
- Modify: `sw.js`
- Test: `tests/plan-export.test.html`
- Test: `tests/frm-cross-month.test.html`

**Interfaces:**
- Consumes: retirement contracts from Task 1.
- Produces: repository with no runtime reference to legacy plan tables or FRM Excel assets.

- [ ] **Step 1: Remove legacy plan functions from `js/06-plan.js`**

Delete plan-only state, filtering, CRUD, approval, history, result, badge, and Excel export functions. Retain only code used by non-plan pages. Confirm mechanically:

```powershell
rg -n "frm_plans|calibration_plans|calibration_plan_items|frmPlan|FRM-EIB04|exportPlanExcel" js index.html sw.js
```

Expected: no matches.

- [ ] **Step 2: Remove legacy scripts, template, and markup**

Delete the two scripts and FRM template with `apply_patch`, remove their `<script>` tags and `APP_SHELL` entries, and remove the obsolete FRM editor modal/containers. Do not remove SheetJS or `importFileInput`, because register import still uses them.

- [ ] **Step 3: Retire obsolete tests**

Keep `tests/plan-export.test.html` as the source-retirement regression from Task 1. Replace `tests/frm-cross-month.test.html` assertions with:

```javascript
t('cross-month FRM runtime is absent', () => {
  lacks(indexSource, 'js/17-frm-cross-month.js', 'runtime script');
  lacks(swSource, 'js/17-frm-cross-month.js', 'offline script');
});
```

- [ ] **Step 4: Run the full suite**

```powershell
pwsh -File tools/run-tests.ps1
pwsh -File tools/syntax-check-js.ps1
```

Expected: all test pages and remaining JavaScript files pass with zero problems.

- [ ] **Step 5: Commit**

```powershell
git add -A -- js/06-plan.js js/15-plan-export.js js/17-frm-cross-month.js assets/frm-eib04-template.xlsx index.html sw.js tests/plan-export.test.html tests/frm-cross-month.test.html
git commit -m "refactor: remove legacy FRM planning runtime"
```

---

### Task 4: Add a fail-closed database retirement migration

**Files:**
- Create: `tools/sql/remove-legacy-calibration-plans.sql`
- Modify: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: confirmed production counts and existing named legacy objects.
- Produces: idempotence-aware destructive migration that aborts on drift.

- [ ] **Step 1: Add failing SQL contract tests**

Load the new SQL file and assert exact preconditions and targets:

```javascript
t('legacy retirement migration fails closed before destructive DDL', () => {
  has(retireSql, 'if v_frm_count <> 3', 'exact FRM precondition');
  has(retireSql, 'if v_legacy_count <> 0 or v_item_count <> 0 or v_audit_count <> 0', 'empty legacy precondition');
  has(retireSql, "raise exception 'legacy calibration plan precondition failed", 'abort message');
  const guard = retireSql.indexOf('legacy calibration plan precondition failed');
  ['drop table public.plan_audit_log', 'drop table public.calibration_plan_items',
   'drop table public.calibration_plans', 'drop table public.frm_plans']
    .forEach(token => ok(retireSql.indexOf(token) > guard, token + ' occurs after guard'));
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
pwsh -File tools/run-tests.ps1
```

Expected: calibration work contract fails because the migration does not exist.

- [ ] **Step 3: Write the guarded migration**

Use a transaction and explicit names:

```sql
begin;

do $$
declare
  v_frm_count bigint;
  v_legacy_count bigint;
  v_item_count bigint;
  v_audit_count bigint;
begin
  select count(*) into v_frm_count from public.frm_plans;
  select count(*) into v_legacy_count from public.calibration_plans;
  select count(*) into v_item_count from public.calibration_plan_items;
  select count(*) into v_audit_count from public.plan_audit_log;
  if v_frm_count <> 3 then
    raise exception 'legacy calibration plan precondition failed: expected 3 frm_plans rows, found %', v_frm_count;
  end if;
  if v_legacy_count <> 0 or v_item_count <> 0 or v_audit_count <> 0 then
    raise exception 'legacy calibration plan precondition failed: expected empty legacy child/audit tables';
  end if;
end;
$$;

drop function if exists public.frm_plan_acknowledge(uuid, uuid);
drop function if exists public.frm_plan_approve(uuid, uuid);
drop function if exists public.frm_plan_confirm_results(uuid, uuid);
drop function if exists public.frm_plan_mark_exported(uuid, uuid);
drop function if exists public.frm_plan_reject(uuid, uuid, text);
drop function if exists public.frm_plan_submit(uuid, uuid);
drop function if exists public.frm_plan_submit_results(uuid, uuid);
drop function if exists public.frm_plan_guard(uuid, uuid);

drop table public.plan_audit_log;
drop table public.calibration_plan_items;
drop table public.calibration_plans;
drop table public.frm_plans;

commit;
```

Before finalizing, execute this catalog check and add each returned function/trigger by explicit name. Do not use `CASCADE`:

```sql
select 'function' as kind, p.proname as object_name,
       pg_get_function_identity_arguments(p.oid) as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'frm_plan%'
       or pg_get_functiondef(p.oid) ~ '\\m(frm_plans|calibration_plans|calibration_plan_items|plan_audit_log)\\M')
union all
select 'trigger', t.tgname, c.relname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname = 'public'
  and c.relname in ('frm_plans','calibration_plans','calibration_plan_items','plan_audit_log')
order by kind, object_name;
```

Expected functions are exactly `frm_plan_acknowledge`, `frm_plan_approve`, `frm_plan_confirm_results`, `frm_plan_guard`, `frm_plan_mark_exported`, `frm_plan_reject`, `frm_plan_submit`, and `frm_plan_submit_results`. Any additional result is migration drift and must be reviewed before proceeding.

- [ ] **Step 4: Verify RED-to-GREEN and transaction rehearsal**

```powershell
pwsh -File tools/run-tests.ps1
git diff --check
```

Run the full SQL against production inside `BEGIN ... ROLLBACK` using Supabase `execute_sql`. Expected: success, followed by counts still equal to 3/0/0/0.

- [ ] **Step 5: Commit**

```powershell
git add tools/sql/remove-legacy-calibration-plans.sql tests/calibration-work-batch.test.html
git commit -m "db: add guarded legacy plan retirement"
```

---

### Task 5: Verify the complete application and review the branch

**Files:**
- No source changes planned; if review finds a defect, return to the owning task and add its failing test before editing that task's files.

**Interfaces:**
- Consumes: completed unified UI and migration.
- Produces: reviewed, release-ready branch.

- [ ] **Step 1: Run every verification command**

```powershell
pwsh -File tools/run-tests.ps1
pwsh -File tools/verify-app-load.ps1
pwsh -File tools/syntax-check-js.ps1
git diff --check
git status --short
```

Expected: zero failing test pages, zero load errors, zero syntax problems, clean diff, and no uncommitted files.

- [ ] **Step 2: Review legacy absence and new-system presence**

```powershell
rg -n "frm_plans|calibration_plans|calibration_plan_items|FRM-EIB04|frm-eib04-template" index.html js sw.js
rg -n "calibration_work_batches|calibration-work-batches|js/29-calibration-work.js" index.html js/29-calibration-work.js sw.js tools/sql
```

Expected: first command has no matches; second command finds the work module, Storage bucket, and SQL objects.

- [ ] **Step 3: Request code review**

Use `requesting-code-review` and require findings to cover route consolidation, non-plan Excel regressions, destructive SQL ordering, production preconditions, authorization, and two-PDF state gates. Fix each verified issue with a new RED/GREEN test cycle.

- [ ] **Step 4: Re-run all verification after review fixes**

Run the commands from Step 1 again and record their exact passing summaries.

---

### Task 6: Push, deploy compatible frontend, apply migration, and verify production

**Files:**
- No new source files unless a production verification exposes a defect.

**Interfaces:**
- Consumes: reviewed branch and guarded SQL migration.
- Produces: GitHub `main` and Supabase production running only the new plan system.

- [ ] **Step 1: Push a `codex/` branch and create a PR**

```powershell
git push -u origin codex/replace-legacy-calibration-plan
```

Create a PR targeting `main` with test summaries and the exact destructive objects listed.

- [ ] **Step 2: Merge and verify the compatible frontend first**

Merge only after source checks pass. Fetch `origin/main`, verify the merge commit, rerun
`tools/run-tests.ps1` from updated local `main`, and confirm GitHub Pages serves the new
`20260904-plan3` application shell. The deployed frontend must contain no live caller for
the four retired tables before any database object is removed.

- [ ] **Step 3: Coordinate reload, then recheck production preconditions immediately before apply**

Use a short maintenance/reload window so open or cached legacy clients are closed or
refreshed to the verified frontend. Then run:

Run:

```sql
select 'frm_plans', count(*) from public.frm_plans
union all select 'calibration_plans', count(*) from public.calibration_plans
union all select 'calibration_plan_items', count(*) from public.calibration_plan_items
union all select 'plan_audit_log', count(*) from public.plan_audit_log;
```

Expected exactly: `3, 0, 0, 0`. Stop without mutation on any difference.

- [ ] **Step 4: Apply the reviewed migration**

Use Supabase `apply_migration` with name `remove_legacy_calibration_plans` and the exact committed SQL. Do not paste a modified ad-hoc variant.

- [ ] **Step 5: Verify production postconditions**

```sql
select
  to_regclass('public.frm_plans') is null as frm_removed,
  to_regclass('public.calibration_plans') is null as legacy_removed,
  to_regclass('public.calibration_plan_items') is null as items_removed,
  to_regclass('public.plan_audit_log') is null as audit_removed,
  to_regclass('public.calibration_work_batches') is not null as work_batches_present,
  to_regprocedure('public.cw_create_batch(text,text,text,text,jsonb)') is not null as create_rpc_present;
```

Expected: all values `true`. Then run Supabase security and performance advisors and review only newly introduced findings.

- [ ] **Step 6: Manual smoke test without test pollution**

Log in as `Admin`/`Editor`, open **แผนสอบเทียบ**, verify the four tabs and open the create dialog. Do not confirm a real batch unless the user supplies the intended instrument; cancel the draft if one was created solely for smoke testing.

---

## Self-Review Results

- Spec coverage: route/name, four tabs, PDF-only workflow, two PDF gates, locking, history, legacy code removal, guarded production deletion, tests, review, deployment, and advisor checks are each assigned to a task.
- Destructive scope: four legacy tables and eight `frm_plan_*` functions are explicit; discovery forbids `CASCADE` and requires abort on drift.
- Type consistency: the plan route uses the existing `loadCalibrationWorkPage`, `cwOpenCreate`, and `cwSetDashboardTab` interfaces; the migration signatures match production catalog output.
- Non-plan Excel protection: SheetJS and register-import UI remain explicitly covered by regression tests.
