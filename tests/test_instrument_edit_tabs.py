from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "theme-aqua.css").read_text(encoding="utf-8")
JS = (ROOT / "js" / "03-instruments.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def panel_html(panel_id):
    match = re.search(
        rf'<section[^>]+id="{re.escape(panel_id)}"[^>]*>(.*?)</section>',
        INDEX,
        re.S,
    )
    if not match:
        raise AssertionError(f"Missing panel: {panel_id}")
    return match.group(1)


def function_body(function_name):
    match = re.search(
        rf"function {re.escape(function_name)}\([^)]*\) \{{(.*?)(?=\n\}}\n\nfunction )",
        JS,
        re.S,
    )
    if not match:
        raise AssertionError(f"Missing function: {function_name}")
    return match.group(1)


class InstrumentEditTabbedFormTests(unittest.TestCase):
    def test_modal_has_three_accessible_tabs_and_panels(self):
        self.assertIn('id="instrumentTabList" role="tablist"', INDEX)
        expected = [
            ("info", "instrumentTabInfo", "instrumentPanelInfo"),
            ("spec", "instrumentTabSpec", "instrumentPanelSpec"),
            ("calibration", "instrumentTabCalibration", "instrumentPanelCalibration"),
        ]
        for key, tab_id, panel_id in expected:
            self.assertRegex(
                INDEX,
                rf'<button[^>]+id="{tab_id}"[^>]+role="tab"[^>]+'
                rf'data-instrument-tab="{key}"[^>]+aria-controls="{panel_id}"',
            )
            self.assertRegex(
                INDEX,
                rf'<section[^>]+id="{panel_id}"[^>]+role="tabpanel"[^>]+'
                rf'aria-labelledby="{tab_id}"',
            )
        self.assertEqual(INDEX.count('class="instrument-tab-icon"'), 3)

    def test_fields_are_grouped_under_the_correct_panels(self):
        groups = {
            "instrumentPanelInfo": [
                "iCategory", "iProductGroup", "iName", "iMachineName",
                "iIdCode", "iSerial", "iBrand", "iModel", "iDept",
                "iDivision", "iCostCenter", "iAssetNo",
            ],
            "instrumentPanelSpec": [
                "iCapacity", "iCapacityUnit", "iRange", "iRangeUnit",
                "iRes1", "iRes2", "iRes3", "iResUnit",
                "iTol1", "iTol2", "iTol3", "iTolUnit",
                "iUsageMin1", "iUsageMin2", "iUsageMin3", "iUsageMinUnit",
                "iUsageMax1", "iUsageMax2", "iUsageMax3", "iUsageMaxUnit",
                "iUsageFreq", "iUspType", "iBalanceType",
            ],
            "instrumentPanelCalibration": [
                "iCalFrequency", "iCalType", "iLocation", "iCertNo",
                "iCalDate", "iDueDate", "iPrevCertNo", "iPrevCalDate", "iRemark",
            ],
        }
        for panel_id, ids in groups.items():
            markup = panel_html(panel_id)
            for field_id in ids:
                self.assertIn(f'id="{field_id}"', markup, (panel_id, field_id))

    def test_modal_shell_has_identity_progress_scroll_region_and_footer(self):
        for hook in (
            'class="modal-box instrument-modal-box"',
            'id="instrumentModalCode"',
            'id="instrumentModalStatus"',
            'id="instrumentTabProgressLabel"',
            'class="modal-body instrument-modal-content"',
            'class="modal-footer instrument-modal-footer"',
            'id="saveInstrumentBtn"',
        ):
            self.assertIn(hook, INDEX)
        content_end = INDEX.index('</div>\n    <div class="modal-footer instrument-modal-footer"', INDEX.index('id="instrumentModal"'))
        save_pos = INDEX.index('id="saveInstrumentBtn"', INDEX.index('id="instrumentModal"'))
        self.assertGreater(save_pos, content_end)

    def test_modal_css_is_scoped_and_responsive(self):
        self.assertIn("#instrumentModal .instrument-modal-box", CSS)
        self.assertRegex(CSS, r"#instrumentModal\s+\.instrument-form-grid\s*\{[^}]*repeat\(3")
        self.assertRegex(
            CSS,
            r"@media \(max-width: 1199px\)[\s\S]*?#instrumentModal\s+\.instrument-form-grid\s*\{[^}]*repeat\(2",
        )
        self.assertRegex(
            CSS,
            r"@media \(max-width: 767px\)[\s\S]*?#instrumentModal\s+\.instrument-form-grid\s*\{[^}]*1fr",
        )
        self.assertIn("@media (prefers-reduced-motion: reduce)", CSS)

    def test_duplicate_warning_uses_hidden_attribute_for_each_visibility_branch(self):
        clear_body = function_body("clearInstrumentDuplicateWarning")
        self.assertIn("box.hidden = true;", clear_body)
        self.assertNotIn("box.style.display", clear_body)

        render_body = function_body("renderInstrumentDuplicateWarning")
        self.assertRegex(
            render_body,
            r"if \(!matches\.length\) \{\s*box\.hidden = true;[\s\S]*?return;\s*\}"
            r"\s*box\.hidden = false;",
        )
        self.assertNotIn("box.style.display", render_body)

    def test_tab_controller_updates_accessibility_visibility_and_progress(self):
        for token in (
            "const INSTRUMENT_MODAL_TABS = ['info', 'spec', 'calibration']",
            "function setInstrumentModalTab(tabKey, options = {})",
            "function handleInstrumentTabKeydown(event)",
            "function initInstrumentModalTabs()",
            "button.setAttribute('aria-selected', String(isActive))",
            "panel.hidden = !isActive",
            "instrumentTabProgressLabel",
        ):
            self.assertIn(token, JS)

    def test_open_resets_first_tab_and_updates_identity_chip(self):
        body = re.search(r"function openInstrumentModal\(instrumentId\)\s*\{(.*?)\n\}", JS, re.S)
        self.assertIsNotNone(body)
        self.assertIn("initInstrumentModalTabs()", body.group(1))
        self.assertIn("setInstrumentModalTab('info')", body.group(1))
        self.assertIn("instrumentModalCode", body.group(1))
        self.assertIn("saveInstrumentBtn", body.group(1))

    def test_missing_id_code_reveals_and_focuses_info_field(self):
        guard = re.search(r"if \(!payload\.id_code\)\s*\{(.*?)\}", JS, re.S)
        self.assertIsNotNone(guard)
        self.assertIn("setInstrumentModalTab('info')", guard.group(1))
        self.assertIn("document.getElementById('iIdCode').focus()", guard.group(1))

    def test_close_resets_presentation_state_without_resetting_fields(self):
        body = re.search(r"function closeInstrumentModal\(\)\s*\{(.*?)\n\}", JS, re.S)
        self.assertIsNotNone(body)
        self.assertIn("setInstrumentModalTab('info')", body.group(1))
        self.assertNotIn(".value = ''", body.group(1))
