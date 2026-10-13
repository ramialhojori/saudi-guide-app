#!/usr/bin/env python3
"""يحوّل panel/panel.html إلى src/panel.js (الوركر يرجعه على /panel)"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, "panel", "panel.html"), encoding="utf-8").read()
open(os.path.join(ROOT, "src", "panel.js"), "w", encoding="utf-8").write(
    "/* مولّد تلقائياً من panel/panel.html — لا تعدّله يدوياً (شغّل: python3 scripts/build_panel.py) */\nexport const PANEL_HTML = " + json.dumps(html, ensure_ascii=False) + ";\n")
print(len(html), "chars")
