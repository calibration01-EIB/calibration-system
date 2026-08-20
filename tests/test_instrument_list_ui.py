from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
REPORTS_JS = (ROOT / "js" / "04-reports.js").read_text(encoding="utf-8")
CSS = (ROOT / "theme-aqua.css").read_text(encoding="utf-8")


class InstrumentListUITests(unittest.TestCase):
    def test_page_size_defaults_to_twenty_with_exact_options(self):
        self.assertRegex(REPORTS_JS, r"let\s+pageSize\s*=\s*20\s*;")
        select = re.search(
            r'<select\s+id="pageSizeSelect"[^>]*>(.*?)</select>',
            INDEX,
            re.S,
        )
        self.assertIsNotNone(select)
        options = re.findall(
            r'<option\s+value="(\d+)"([^>]*)>',
            select.group(1),
        )
        self.assertEqual([value for value, _ in options], ["20", "50", "100"])
        self.assertEqual(
            [value for value, attrs in options if "selected" in attrs],
            ["20"],
        )

    def test_page_size_change_resets_page_and_rerenders(self):
        body = re.search(
            r"function\s+changePageSize\(\)\s*\{(.*?)\}",
            REPORTS_JS,
            re.S,
        )
        self.assertIsNotNone(body)
        self.assertIn("pageSize = parseInt(document.getElementById('pageSizeSelect').value)", body.group(1))
        self.assertIn("currentPage = 1", body.group(1))
        self.assertIn("renderTable()", body.group(1))

    def test_hover_is_dark_clear_and_scoped_to_instrument_list(self):
        self.assertIn(
            "#app #pageList .ax-table td { transition: background-color 120ms ease; }",
            CSS,
        )
        self.assertIn(
            "#app #pageList .ax-table tbody tr:hover td { background: #dcefed !important; }",
            CSS,
        )
        self.assertIn(
            "#app #pageList .ax-table tbody tr:hover td:first-child { box-shadow: inset 4px 0 0 var(--accent); }",
            CSS,
        )


if __name__ == "__main__":
    unittest.main()
