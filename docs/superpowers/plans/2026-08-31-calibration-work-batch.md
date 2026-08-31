# Calibration Work Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new PDF-first calibration work-batch module that manually groups instruments by one unit and one instrument type, tracks per-item planned dates/results/documents, versions every PDF, updates instrument Cert No./calibration date without changing Due Date, and surfaces batch progress in the instrument registry.

**Architecture:** An idempotent Supabase SQL package owns tables, RLS/policies, locking, audit, and transactional RPC state changes. A focused browser module `js/29-calibration-work.js` owns pure status derivation plus the new page, create wizard, document uploads, result editor, and signed-URL viewing; `js/10-router.js` and `js/26-list-ui.js` consume only public module hooks.

**Tech Stack:** PostgreSQL/Supabase SQL and Storage, browser JavaScript ES2020, existing Supabase client with `x-app-token`, HTML/CSS, plain HTML headless-Chrome test harness, PowerShell verification tools.

## Global Constraints

- Create a new **Calibration Work Batch** module; do not replace or migrate the existing FRM/legacy plan workflows.
- Users select instruments manually; do not auto-create or auto-select plan items.
- One batch contains exactly one `unit_code` and one `instrument_type`.
- Every item has its own `planned_date`.
- One instrument may belong to at most one active batch, enforced in the database.
- Result completion requires Cert No., calibration date, Certificate PDF, and overdue reason/PDF when required.
- Batch completion requires every item resolved and a closure PDF.
- Accept only PDF files up to exactly 50 MB.
- Keep every replaced document version with uploader, timestamp, replacement reason, size, MIME type, and SHA-256.
- Completing an item updates `instruments.cert_no` and `instruments.cal_date` atomically; never update `instruments.due_date`.
- Editor/Admin can mutate workflow state; Viewer/Owner are read-only.
- Use `Asia/Bangkok` for overdue date decisions.
- Desktop, tablet, and mobile must remain usable without unintended horizontal page overflow.
- Existing search, registry, FRM plan, legacy plan, and service-worker load order must continue to work.
- Deployment prerequisite: the Supabase database exposes `public.app_validate_token(text)` returning `username` and `role`; verify it before applying the new SQL.

---

### Task 1: Add schema, locking, storage metadata, audit, and transactional RPCs

**Files:**
- Create: `tools/sql/calibration-work-batches.sql`
- Create: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: existing `app_login` token model through request header `x-app-token`; existing `instruments(id, id_code, instrument_type, department, cert_no, cal_date, due_date)`.
- Produces: tables `calibration_work_batches`, `calibration_work_items`, `calibration_work_instrument_locks`, `calibration_work_documents`, `calibration_work_audit`; RPCs `cw_create_batch`, `cw_confirm_batch`, `cw_mutate_items`, `cw_register_document`, `cw_save_item_draft`, `cw_complete_item`, `cw_skip_item`, `cw_complete_batch`, `cw_cancel_batch`.

- [ ] **Step 1: Write the failing SQL contract test**

Create `tests/calibration-work-batch.test.html` using the existing `XMLHttpRequest` harness pattern and load `../tools/sql/calibration-work-batches.sql`. Add assertions:

```js
[
  'create table if not exists public.calibration_work_batches',
  'create table if not exists public.calibration_work_items',
  'create table if not exists public.calibration_work_instrument_locks',
  'create table if not exists public.calibration_work_documents',
  'create table if not exists public.calibration_work_audit',
  'instrument_id bigint primary key',
  'check (file_size > 0 and file_size <= 52428800)',
  "check (mime_type = 'application/pdf')",
  'create or replace function public.cw_create_batch',
  'create or replace function public.cw_complete_item',
  'create or replace function public.cw_complete_batch',
  'due_date'
].forEach(token => has(SQL.toLowerCase(), token.toLowerCase(), token));

ok(!/update\s+public\.instruments[\s\S]*?due_date\s*=/.test(SQL), 'RPC must never update due_date');
```

- [ ] **Step 2: Run the suite and verify RED**

Run: `powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1`

Expected: `calibration-work-batch.test.html` reports failure because the SQL file does not exist; all current test pages pass.

- [ ] **Step 3: Create idempotent tables and constraints**

Implement UUID-backed tables, check constraints for the exact status keys in the spec, foreign keys with explicit delete behavior, and indexes:

```sql
create extension if not exists pgcrypto;

create table if not exists public.calibration_work_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  title text not null,
  unit_code text not null,
  instrument_type text not null,
  status text not null default 'draft'
    check (status in ('draft','awaiting_acknowledgement_pdf','awaiting_calibration',
      'partially_completed','awaiting_closure_pdf','completed','cancelled')),
  created_by text not null,
  created_at timestamptz not null default now(),
  confirmed_by text, confirmed_at timestamptz,
  completed_by text, completed_at timestamptz,
  cancelled_by text, cancelled_at timestamptz, cancel_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.calibration_work_instrument_locks (
  instrument_id bigint primary key references public.instruments(id),
  batch_id uuid not null references public.calibration_work_batches(id) on delete cascade,
  item_id uuid not null unique,
  locked_at timestamptz not null default now()
);
```

Create `calibration_work_items` with unique `(batch_id,instrument_id)`, result status keys `in_progress/completed/skipped`, and result fields. Create documents with kinds `acknowledgement/closure/certificate/overdue`, `version_number > 0`, one partial unique index for the current version per batch/item/kind, PDF/50-MB checks, and SHA-256. Create audit rows with `before_data jsonb` and `after_data jsonb`.

- [ ] **Step 4: Add token/role guard and batch-number helper**

Verify the deployed token helper before applying the schema:

```sql
select to_regprocedure('public.app_validate_token(text)') is not null as token_helper_ready;
```

Expected: `token_helper_ready = true`. Then define one local wrapper with this exact signature:

```sql
create or replace function public.cw_actor(p_token text, p_write boolean default false)
returns table(username text, role text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select u.username, u.role
  from public.app_validate_token(p_token) u
  where not p_write or u.role in ('admin','editor');
  if not found then raise exception 'permission denied'; end if;
end;
$$;
```

Implement atomic `PLAN-YYYY-NNNN` numbering using an advisory transaction lock and `max()` for the current Bangkok year.

- [ ] **Step 5: Implement batch and item RPCs**

`cw_create_batch(p_token,p_title,p_unit_code,p_instrument_type,p_items jsonb)` must validate every JSON item has `instrument_id` and ISO `planned_date`, verify each instrument matches the chosen unit/type, insert the batch/items/locks in one transaction, and audit creation.

`cw_confirm_batch` requires `draft`, at least one item, and changes status to `awaiting_acknowledgement_pdf`.

`cw_mutate_items` accepts a complete JSON item set plus a reason. Before acknowledgement it replaces items/locks directly; afterward it requires a non-empty reason, rejects removal of items with saved result fields/documents, marks the current acknowledgement document non-current, and returns the batch to `awaiting_acknowledgement_pdf`.

`cw_cancel_batch` requires a reason, changes status to `cancelled`, deletes locks, and audits before/after state.

- [ ] **Step 6: Implement document and result RPCs**

`cw_register_document` receives metadata only after Storage upload. It validates document kind/scope/state, requires a replacement reason when a current version exists, increments version, switches `is_current` atomically, and derives the batch status. An acknowledgement document sets `awaiting_calibration`; a closure document is accepted only when every item is completed/skipped and sets `completed` while releasing locks.

`cw_save_item_draft` saves Cert No./calibration date/overdue reason without completing.

`cw_complete_item` verifies current certificate document; if calibration date is after planned date it also verifies overdue reason and current overdue document. In one transaction it updates only:

```sql
update public.instruments
set cert_no = v_item.cert_no,
    cal_date = v_item.calibration_date
where id = v_item.instrument_id;
```

Then it marks the item completed, derives the batch status, and audits. `cw_skip_item` requires a reason and never updates `instruments`.

- [ ] **Step 7: Add RLS/storage policies and grants**

Enable RLS on batches, items, locks, documents, and audit. Permit authenticated application-token reads for all roles and writes only through SECURITY DEFINER RPCs. Add Storage policies for bucket `calibration-work-batches` and paths rooted by batch UUID; client uploads are allowed only for Editor/Admin requests bearing a valid app token.

- [ ] **Step 8: Run tests and SQL parser checks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1
git diff --check
```

Expected: all test pages pass and diff check is clean. Before applying to Supabase, execute the SQL in a disposable/staging database transaction and verify rollback leaves no objects.

- [ ] **Step 9: Commit**

```powershell
git add -- tools/sql/calibration-work-batches.sql tests/calibration-work-batch.test.html
git commit -m "feat: add calibration work batch schema"
```

### Task 2: Add pure status, validation, and document-path helpers

**Files:**
- Create: `js/29-calibration-work.js`
- Modify: `tests/calibration-work-batch.test.html`
- Modify: `index.html:4790`
- Modify: `sw.js:1-45`

**Interfaces:**
- Consumes: plain batch/item/document objects and ISO dates.
- Produces: `CW_STATUS`, `cwTodayISO() -> string`, `cwItemDisplayStatus(item,todayISO) -> string`, `cwBatchDerivedStatus(batch,items,docs) -> string`, `cwValidatePdf(file) -> string|null`, `cwDocumentPath(batchId,itemId,kind,version) -> string`.

- [ ] **Step 1: Add failing behavioral tests**

Load `../js/29-calibration-work.js` in the test page after defining `window.CW_TEST_MODE = true`. Add tests:

```js
eq(cwItemDisplayStatus({result_status:'completed'}, '2026-08-31'), 'completed');
eq(cwItemDisplayStatus({result_status:'in_progress',planned_date:'2026-08-30'}, '2026-08-31'), 'overdue');
eq(cwItemDisplayStatus({result_status:'in_progress',planned_date:'2026-09-01'}, '2026-08-31'), 'in_progress');
eq(cwBatchDerivedStatus({status:'awaiting_calibration'}, [
  {result_status:'completed'}, {result_status:'in_progress'}
], []), 'partially_completed');
eq(cwBatchDerivedStatus({status:'awaiting_calibration'}, [
  {result_status:'completed'}, {result_status:'skipped'}
], []), 'awaiting_closure_pdf');
eq(cwDocumentPath('b1', null, 'acknowledgement', 2),
  'calibration-work-batches/b1/batch/acknowledgement/v0002.pdf');
```

Test PDF rejection for wrong MIME/extension and `size > 52428800`.

- [ ] **Step 2: Verify RED**

Run the full test suite. Expected: the new behavior tests fail because helpers are undefined.

- [ ] **Step 3: Implement minimal pure helpers**

Implement immutable status maps with Thai labels/colors, Bangkok date formatting using `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'})`, status precedence, exact 50-MB PDF validation, zero-padded versions, and path validation that accepts only UUID-safe IDs and the four document kinds.

Expose helpers on `window` for the existing non-module script architecture.

- [ ] **Step 4: Register the script and offline cache**

Add `<script src="js/29-calibration-work.js?v=20260831-cw1"></script>` after `js/28-kpi.js`. Add `./js/29-calibration-work.js` to `APP_SHELL`, bump `CACHE_NAME`, and update existing cache-version tests to the new exact version.

- [ ] **Step 5: Verify GREEN**

Run `tools/run-tests.ps1`, `tools/verify-app-load.ps1`, `tools/syntax-check-js.ps1`, and `git diff --check`.

Expected: all helper cases pass, all scripts load, and no handler is missing.

- [ ] **Step 6: Commit**

```powershell
git add -- js/29-calibration-work.js index.html sw.js tests/calibration-work-batch.test.html tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "feat: add calibration work status engine"
```

### Task 3: Add navigation, dashboard, batch list, detail shell, and responsive design

**Files:**
- Modify: `index.html:2750`
- Modify: `index.html:3190`
- Modify: `js/10-router.js:1-85`
- Modify: `js/29-calibration-work.js`
- Modify: `theme-aqua.css`
- Modify: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: Supabase read queries for batches/items/current documents/audit and Task 2 helpers.
- Produces: `loadCalibrationWorkPage() -> Promise<void>`, `cwRenderDashboard(model) -> void`, `cwOpenBatch(batchId) -> Promise<void>`, page root `#pageCalwork`.

- [ ] **Step 1: Write failing page-contract and runtime-render tests**

Require navigation hooks `id="nav-calwork"`, `data-page="calwork"`, `id="pageCalwork"`, and router title/loading calls. In a DOM fixture call `cwRenderDashboard` with two batches and assert tabs, counts, overdue count, progress, PDF states, and escaped batch title.

- [ ] **Step 2: Verify RED**

Run the suite. Expected: failures for missing page/router/render functions.

- [ ] **Step 3: Add page shell and navigation**

Add desktop sidebar item “ชุดงานสอบเทียบ” and mobile navigation item. Add a dedicated page containing:

```html
<div id="pageCalwork" class="page-content" style="display:none">
  <section class="cw-page-head">
    <div><h1>ชุดงานสอบเทียบ</h1><p>ติดตามแผน เอกสาร และผลสอบเทียบรายเครื่อง</p></div>
    <button type="button" onclick="cwOpenCreate()">สร้างชุดงานใหม่</button>
  </section>
  <nav id="cwTabs" class="cw-tabs" aria-label="มุมมองชุดงาน"></nav>
  <div id="cwMetrics" class="cw-metrics"></div>
  <div id="cwBatchList"></div>
  <div id="cwBatchDetail" hidden></div>
</div>
```

Extend router pages/titles and call `loadCalibrationWorkPage()` after waiting for `allData`.

- [ ] **Step 4: Implement read model and renderers**

Query batches with items and current documents, then normalize to a view model. Render active, waiting-document, completed, and history tabs. Metrics show active batches, completed/total instruments, overdue instruments, and batches waiting for closure PDFs. Batch cards open details with no mutation.

Detail renders header, progress, item table/cards, current batch PDFs, document version list, and audit timeline. Escape all database text.

- [ ] **Step 5: Add scoped responsive CSS**

Use `#app #pageCalwork .cw-*` selectors. Desktop detail uses item content plus document side panel; at `max-width:1100px` it stacks constrained panels; at `max-width:767px` it becomes one column with 44px touch targets and no page-level overflow.

- [ ] **Step 6: Verify and commit**

Run full tests, app-load, syntax, and diff checks.

```powershell
git add -- index.html js/10-router.js js/29-calibration-work.js theme-aqua.css tests/calibration-work-batch.test.html
git commit -m "feat: add calibration work dashboard"
```

### Task 4: Implement the three-step manual creation wizard and lock-aware editing

**Files:**
- Modify: `index.html` (calibration-work create dialog)
- Modify: `js/29-calibration-work.js`
- Modify: `theme-aqua.css`
- Modify: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: `allData`, lock read model, RPCs `cw_create_batch`, `cw_confirm_batch`, `cw_mutate_items`.
- Produces: `cwOpenCreate()`, `cwSetCreateGroup(unitCode,instrumentType)`, `cwToggleCreateItem(instrumentId,selected)`, `cwSetCreatePlannedDate(instrumentId,date)`, `cwSubmitCreate() -> Promise<void>`, `cwEditBatchItems(batchId) -> Promise<void>`, `cwCancelBatch(batchId,reason) -> Promise<void>`.

- [ ] **Step 1: Add failing wizard-state tests**

Test that group filtering keeps only exact unit/type, locked instruments remain visible but disabled with owner batch number, selection rejects mismatched/locked rows, every selected item requires a planned date, bulk date fills selected items, and payload is:

```js
{
  p_token: 'token',
  p_title: 'WRM1 เครื่องชั่ง กันยายน 2026',
  p_unit_code: 'WRM1',
  p_instrument_type: 'เครื่องชั่ง (Electronic Balance)',
  p_items: [
    { instrument_id: 11, planned_date: '2026-09-03' },
    { instrument_id: 12, planned_date: '2026-09-05' }
  ]
}
```

- [ ] **Step 2: Verify RED**

Run tests and confirm failures name the missing wizard helpers.

- [ ] **Step 3: Implement wizard state and semantic UI**

Use one in-memory state object reset on open. Step 1 requires group values; Step 2 renders exact group matches, search, checkboxes, lock explanations, per-item date, and bulk date; Step 3 renders review. Disable confirmation until every date is valid. Use native inputs/buttons and visible errors.

- [ ] **Step 4: Connect create/confirm RPCs**

Call `cw_create_batch`, refresh the page, open the returned batch, and expose “ยืนยันรายการแผน”. Confirmation calls `cw_confirm_batch` and moves the UI to acknowledgement upload.

- [ ] **Step 5: Implement edit invalidation rules**

Before an acknowledgement PDF, submit the full item set without a reason. After one exists, require a reason dialog and tell the user the current acknowledgement becomes historical. Reject removal in UI when an item has result fields/documents and surface the RPC error if concurrent state changed.

Add a cancel action for non-completed batches. Require a non-blank reason, call `cw_cancel_batch`, refresh the page, and verify every instrument lock is released before showing success.

- [ ] **Step 6: Verify and commit**

Run full tests, app-load, syntax, and diff checks.

```powershell
git add -- index.html js/29-calibration-work.js theme-aqua.css tests/calibration-work-batch.test.html
git commit -m "feat: add calibration work batch creation"
```

### Task 5: Implement versioned PDF uploads and acknowledgement gate

**Files:**
- Modify: `js/29-calibration-work.js`
- Modify: `index.html` (document upload dialog)
- Modify: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: `cwValidatePdf`, `cwDocumentPath`, Storage bucket `calibration-work-batches`, RPC `cw_register_document`.
- Produces: `cwUploadDocument({batchId,itemId,kind,file,replacementReason}) -> Promise<object>`, `cwOpenDocument(documentId) -> Promise<void>`, `cwRenderDocumentVersions(documents) -> string`.

- [ ] **Step 1: Add failing upload orchestration tests**

Use a fake Storage/RPC adapter and assert: validation occurs before upload; replacement requires a reason; SHA-256 is computed; upload path matches the next version; RPC metadata contains exact MIME/size/hash; RPC failure removes the just-uploaded orphan path; old current documents are never deleted; signed URL is requested fresh when opening.

- [ ] **Step 2: Verify RED**

Run tests. Expected: upload orchestration tests fail with missing functions.

- [ ] **Step 3: Implement adapter-driven upload**

Hash with `crypto.subtle.digest('SHA-256', await file.arrayBuffer())`. Query current versions, compute next integer, upload with `upsert:false`, then call `cw_register_document`. On RPC failure call Storage `remove([path])`; if cleanup fails, log a visible orphan-cleanup error without claiming success.

- [ ] **Step 4: Build upload dialog and gate**

The acknowledgement upload action appears only after confirmation. A successful acknowledgement refreshes the batch to `awaiting_calibration` and enables item result controls. Closure upload stays disabled until the batch is `awaiting_closure_pdf`. Render every version with current/historical label, uploader, Bangkok timestamp, filename, and replacement reason.

- [ ] **Step 5: Verify and commit**

Run full tests and verification commands.

```powershell
git add -- index.html js/29-calibration-work.js tests/calibration-work-batch.test.html
git commit -m "feat: add calibration work PDF evidence"
```

### Task 6: Implement item drafts, overdue evidence, certificates, skips, and atomic completion

**Files:**
- Modify: `index.html` (result editor and skip dialog)
- Modify: `js/29-calibration-work.js`
- Modify: `theme-aqua.css`
- Modify: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: Task 5 document uploader; RPCs `cw_save_item_draft`, `cw_complete_item`, `cw_skip_item`.
- Produces: `cwOpenItemResult(itemId)`, `cwSaveItemDraft() -> Promise<void>`, `cwCompleteItem() -> Promise<void>`, `cwSkipItem(itemId,reason) -> Promise<void>`, `cwItemRequirements(item,todayISO) -> {certificateRequired:boolean,overdueRequired:boolean,missing:string[]}`.

- [ ] **Step 1: Add failing requirement tests**

Cover: incomplete without Cert No.; incomplete without calibration date; incomplete without current Certificate PDF; overdue required when today exceeds planned date; overdue required when calibration date exceeds planned date; overdue not required when calibration date is on/before plan even if entered later; completed only when every required field/current document exists; skipped requires non-blank reason.

- [ ] **Step 2: Verify RED**

Run tests and confirm the required cases fail for missing implementation.

- [ ] **Step 3: Implement result editor and draft saving**

Show read-only ID/planned date, editable Cert No./calibration date, Certificate upload, and conditional overdue reason/document section. Allow drafts without changing completion status. Keep errors scoped to this item.

- [ ] **Step 4: Implement completion and skip actions**

Before `cw_complete_item`, run client validation for immediate feedback, then rely on RPC validation for authority. Refresh `allData` and batch detail after success so registry Cert/date changes appear. Skip dialog requires a reason and displays skipped items in closure summary.

- [ ] **Step 5: Render completion readiness**

When all items are completed/skipped, render the closure summary and enable closure PDF. Completed items are read-only except an explicit Admin/Editor “ล้างผล” action backed by a reasoned audited RPC added to Task 1 SQL as `cw_reset_item_result`.

- [ ] **Step 6: Verify and commit**

Run full tests, app-load, syntax, and diff checks.

```powershell
git add -- tools/sql/calibration-work-batches.sql index.html js/29-calibration-work.js theme-aqua.css tests/calibration-work-batch.test.html
git commit -m "feat: add calibration work item results"
```

### Task 7: Integrate registry status, notifications, history, cache version, and final QA

**Files:**
- Modify: `js/29-calibration-work.js`
- Modify: `js/26-list-ui.js`
- Modify: `js/02-dashboard.js`
- Modify: `index.html`
- Modify: `theme-aqua.css`
- Modify: `sw.js`
- Modify: `tests/calibration-work-batch.test.html`
- Modify: `tests/instrument-list-ui.test.html`
- Modify: `tests/login-b3-ui.test.html`
- Modify: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: active work-item query and existing `planStatusMap` presentation.
- Produces: `calibrationWorkStatusMap: Record<number,{batchId,batchNo,title,plannedDate,status}>`, `loadCalibrationWorkStatusMap() -> Promise<void>`, `cwLoadNotifications() -> Promise<object>`, registry shortcut `cwOpenBatchFromInstrument(instrumentId)`.

- [ ] **Step 1: Add failing integration tests**

Assert precedence `completed > overdue > in_progress > awaiting_acknowledgement_pdf > none`; registry markup contains batch number/date/status and opens the correct batch; notifications count awaiting acknowledgement, due today, overdue missing evidence, and awaiting closure; FRM `planStatusMap` remains intact.

- [ ] **Step 2: Verify RED**

Run tests. Expected: new integration assertions fail while previous functionality passes.

- [ ] **Step 3: Load and render active work status**

Query locks/items/batches and fill `calibrationWorkStatusMap`. Extend the existing list action/status area with a separate “ชุดงาน” badge/shortcut; do not overwrite legacy/FRM state. Reload this map after data load and after every work mutation.

- [ ] **Step 4: Add internal notification counters**

Render counters and links for awaiting acknowledgement PDFs, instruments due today, overdue instruments missing reason/document, and batches awaiting closure PDF. Links open the new module with the matching tab/filter. Do not send external messages.

- [ ] **Step 5: Final accessibility and responsive QA**

Verify keyboard access to tabs, dialogs, uploads, wizard, result actions, and document links. Check focus return after dialogs. At widths 1440, 900, and 390 verify the dashboard, wizard, detail, item editor, document history, and registry have no unintended overflow.

- [ ] **Step 6: Bump cache and run fresh verification**

Bump script/style query keys and service-worker cache version, then run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1
powershell -ExecutionPolicy Bypass -File tools/verify-app-load.ps1
powershell -ExecutionPolicy Bypass -File tools/syntax-check-js.ps1
git diff --check
git status --short --untracked-files=all
```

Expected: every test page passes, all scripts parse/load, all inline handlers resolve, diff check is clean, and only intended files are modified.

- [ ] **Step 7: Perform staging Supabase workflow QA**

Apply `tools/sql/calibration-work-batches.sql` to staging and verify: create exact group; duplicate-instrument lock rejection; confirmation; acknowledgement versioning; partial results; overdue evidence enforcement; skip reason; Cert/date update with unchanged Due Date; closure versioning; completion releases locks; Viewer/Owner mutations rejected; signed URL renewal; audit sequence complete.

- [ ] **Step 8: Commit**

```powershell
git add -- index.html js/02-dashboard.js js/26-list-ui.js js/29-calibration-work.js theme-aqua.css sw.js tests/calibration-work-batch.test.html tests/instrument-list-ui.test.html tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "feat: integrate calibration work batches"
```
