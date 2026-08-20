from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "theme-aqua.css").read_text(encoding="utf-8")
HOME_JS = (ROOT / "js" / "24-home.js").read_text(encoding="utf-8")
SERVICE_WORKER = (ROOT / "sw.js").read_text(encoding="utf-8")


class ReferenceHomeTests(unittest.TestCase):
    def test_reference_header_hooks_are_present(self):
        for hook in (
            'class="ax-header"',
            'class="ax-brand"',
            'id="axHomeBtn"',
            'aria-label="การแจ้งเตือน"',
            'aria-label="ช่วยเหลือ"',
            'id="axUserName"',
            'id="axUserRole"',
            'id="axUserMenu"',
        ):
            self.assertIn(hook, INDEX)

    def test_reference_home_sections_are_present(self):
        for hook in (
            'id="pageHome"',
            'class="ax-home"',
            'class="ax-hero ax-hero--reference"',
            'src="assets/home-calibration-banner.png"',
            'id="axTiles"',
        ):
            self.assertIn(hook, INDEX)
        self.assertTrue((ROOT / "assets" / "home-calibration-banner.png").is_file())

    def test_tile_order_and_destinations_match_current_system(self):
        expected = [
            ("dashboard", "Dashboard"),
            ("list", "รายการเครื่องมือ"),
            ("calrecs", "ติดตามผลสอบเทียบ"),
            ("cert", "ลำดับเลข Cert"),
            ("weights", "ใบ Cert Reference"),
            ("plan", "วางแผนสอบเทียบ"),
            ("soon", "ใบบันทึกประจำวันเครื่องชั่ง"),
            ("repairs", "งานซ่อม"),
            ("gate", "นำของออกนอกสถานที่"),
            ("weightjobs", "สอบเทียบตุ้มน้ำหนัก"),
        ]
        positions = []
        for page, title in expected:
            pattern = r"page:'" + re.escape(page) + r"'.*?t:'" + re.escape(title) + r"'"
            match = re.search(pattern, HOME_JS)
            self.assertIsNotNone(match, (page, title))
            positions.append(match.start())
        self.assertEqual(positions, sorted(positions))

    def test_existing_dynamic_integrations_remain(self):
        for token in (
            "syncAxTileBadges",
            "axSyncUser",
            "toggleAxUserMenu",
            "axLogout",
            "showPage",
        ):
            self.assertIn(token, HOME_JS)
        self.assertIn("AX_ART", HOME_JS)

    def test_responsive_grid_contract(self):
        self.assertRegex(CSS, r"\.ax-tiles\s*\{[^}]*repeat\(4")
        self.assertIn("@media (max-width: 1100px)", CSS)
        self.assertIn("@media (max-width: 680px)", CSS)
        self.assertRegex(
            CSS,
            r"@media \(max-width: 680px\)[\s\S]*?\.ax-tiles\s*\{[^}]*grid-template-columns:\s*1fr",
        )

    def test_reference_banner_is_available_offline(self):
        self.assertIn("./assets/home-calibration-banner.png", SERVICE_WORKER)
        self.assertIn("calibration-app-v134", SERVICE_WORKER)

    def test_user_menu_trigger_is_not_parent_of_menu_items(self):
        self.assertIn('class="ax-user-wrap"', INDEX)
        self.assertIn('<button type="button" class="ax-user" id="axUser"', INDEX)
        self.assertIn('<div class="ax-menu" id="axUserMenu" role="menu">', INDEX)
        self.assertIn('class="ax-menu-item" role="menuitem"', INDEX)


if __name__ == "__main__":
    unittest.main()
