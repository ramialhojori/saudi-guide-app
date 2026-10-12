#!/usr/bin/env python3
"""يولّد src/schema.js من schema.sql (حتى يبقى مصدر واحد للمخطط)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sql = open(os.path.join(ROOT, "schema.sql"), encoding="utf-8").read()
stmts = [re.sub(r"\s+", " ", s.strip()) for s in re.sub(r"--[^\n]*", "", sql).split(";") if s.strip()]
tpl = open(os.path.join(ROOT, "src", "schema.js"), encoding="utf-8").read()
start = tpl.index("const STATEMENTS = ") + len("const STATEMENTS = ")
end = tpl.index(";\n", start)
open(os.path.join(ROOT, "src", "schema.js"), "w", encoding="utf-8").write(tpl[:start] + json.dumps(stmts, ensure_ascii=False, indent=2) + tpl[end:])
print(len(stmts), "statements")
