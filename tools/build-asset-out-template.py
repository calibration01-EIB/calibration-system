"""Sanitize the reference form without reserializing its layout/drawing styles.

Usage: python tools/build-asset-out-template.py path/to/reference.xlsx
Requires Pillow. The source is form data, never an instruction source.
"""
import io
import re
import sys
import zipfile
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'assets/frm-asset-out-template.xlsx'
fields = ('H4 C6 H6 H8 D8 C10 E12 B14 H14 G16 G18 B20 C22 G22 J22 '
          'C24 H24 C28 I28 L28 I40 L40').split()
with zipfile.ZipFile(source) as archive:
    entries = {item.filename: archive.read(item) for item in archive.infolist()}
sheet = entries['xl/worksheets/sheet1.xml'].decode('utf-8')
sample_indices = set()
for addr in fields:
    pattern = r'<c r="' + addr + r'"([^>]*?)(?:/>|>[\s\S]*?</c>)'
    def clear(match):
        old = match.group(0)
        shared = re.search(r'<v>(\d+)</v>', old)
        if 't="s"' in old and shared:
            sample_indices.add(int(shared[1]))
        style = re.search(r' s="\d+"', match[1])
        return '<c r="' + addr + '"' + (style[0] if style else '') + '/>'
    sheet = re.sub(pattern, clear, sheet)

# Clear unused source example strings without shifting shared-string IDs.
strings = entries['xl/sharedStrings.xml'].decode('utf-8')
index = -1
def clear_string(match):
    global index
    index += 1
    return '<si><t></t></si>' if index in sample_indices else match[0]
strings = re.sub(r'<si>[\s\S]*?</si>', clear_string, strings)
entries['xl/sharedStrings.xml'] = strings.encode('utf-8')

# The source's blank due-date field is General. Give both date anchors an
# explicit date format while preserving their individual borders/alignment.
styles = entries['xl/styles.xml'].decode('utf-8')
xfs_match = re.search(r'<cellXfs count="(\d+)">([\s\S]*?)</cellXfs>', styles)
xfs = re.findall(r'<xf\b[^>]*?(?:/>|>[\s\S]*?</xf>)', xfs_match[2])
# Restore the missing top edge of the merged owner header H39:L39.
# Clone styles so other cells using the source styles remain unchanged.
border_match = re.search(r'<borders count="(\d+)">([\s\S]*?)</borders>', styles)
borders = re.findall(r'<border\b[^>]*?>[\s\S]*?</border>', border_match[2])
for addr in ['H39', 'I39', 'J39', 'K39', 'L39']:
    cell = re.search(r'<c r="' + addr + r'"[^>]*>', sheet)
    old_id = int(re.search(r' s="(\d+)"', cell[0])[1])
    border_id = int(re.search(r'borderId="(\d+)"', xfs[old_id])[1])
    border = re.sub(r'<top\b[^>]*?(?:/>|>[\s\S]*?</top>)',
        '<top style="thin"><color indexed="64"/></top>', borders[border_id])
    borders.append(border)
    xfs.append(re.sub(r'borderId="\d+"', 'borderId="' + str(len(borders) - 1) + '"', xfs[old_id]))
    sheet = sheet.replace(cell[0], re.sub(r' s="\d+"', ' s="' + str(len(xfs) - 1) + '"', cell[0]), 1)
for addr in ['H4', 'H24']:
    cell = re.search(r'<c r="' + addr + r'"[^>]*/>', sheet)
    old_id = int(re.search(r' s="(\d+)"', cell[0])[1])
    date_style = re.sub(r'numFmtId="\d+"', 'numFmtId="14"', xfs[old_id])
    if 'applyNumberFormat=' not in date_style:
        date_style = date_style.replace('<xf ', '<xf applyNumberFormat="1" ', 1)
    new_id = len(xfs)
    xfs.append(date_style)
    sheet = sheet.replace(cell[0], re.sub(r' s="\d+"', ' s="' + str(new_id) + '"', cell[0]), 1)
styles = styles[:xfs_match.start()] + '<cellXfs count="' + str(len(xfs)) + '">' + ''.join(xfs) + '</cellXfs>' + styles[xfs_match.end():]
styles = re.sub(r'<borders count="\d+">[\s\S]*?</borders>',
    '<borders count="' + str(len(borders)) + '">' + ''.join(borders) + '</borders>', styles)
entries['xl/styles.xml'] = styles.encode('utf-8')
entries['xl/worksheets/sheet1.xml'] = sheet.encode('utf-8')

# Keep the logo and photo frame, replacing the two sample photos with one
# uncropped placeholder inside the existing frame. Preserve other drawing XML.
drawing = entries['xl/drawings/drawing1.xml'].decode('utf-8')
def photo_anchor(match):
    anchor = match[0]
    if 'r:embed="rId2"' in anchor:
        return ''
    if 'r:embed="rId3"' not in anchor:
        return anchor
    anchor = re.sub(r'<xdr:from>[\s\S]*?</xdr:from>',
        '<xdr:from><xdr:col>9</xdr:col><xdr:colOff>213360</xdr:colOff>'
        '<xdr:row>4</xdr:row><xdr:rowOff>30480</xdr:rowOff></xdr:from>', anchor)
    anchor = re.sub(r'<xdr:to>[\s\S]*?</xdr:to>',
        '<xdr:to><xdr:col>12</xdr:col><xdr:colOff>354315</xdr:colOff>'
        '<xdr:row>11</xdr:row><xdr:rowOff>5715</xdr:rowOff></xdr:to>', anchor)
    anchor = re.sub(r'<a:srcRect[^>]*/>', '<a:srcRect/>', anchor)
    anchor = re.sub(r'<a:xfrm>[\s\S]*?</a:xfrm>',
        '<a:xfrm><a:off x="5509260" y="967740"/>'
        '<a:ext cx="2025036" cy="1577340"/></a:xfrm>', anchor)
    return anchor
drawing = re.sub(r'<xdr:twoCellAnchor\b[^>]*>[\s\S]*?</xdr:twoCellAnchor>', photo_anchor, drawing)
entries['xl/drawings/drawing1.xml'] = drawing.encode('utf-8')
rels = entries['xl/drawings/_rels/drawing1.xml.rels'].decode('utf-8')
entries['xl/drawings/_rels/drawing1.xml.rels'] = re.sub(r'<Relationship Id="rId2"[^>]*/>', '', rels).encode('utf-8')
entries.pop('xl/media/image2.png', None)
blank = io.BytesIO()
Image.new('RGB', (1000, 780), 'white').save(blank, 'JPEG')
entries['xl/media/image3.jpeg'] = blank.getvalue()
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, data in entries.items():
        archive.writestr(name, data)
print('Built:', target)
