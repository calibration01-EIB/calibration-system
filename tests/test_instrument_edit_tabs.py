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
