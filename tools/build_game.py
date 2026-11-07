#!/usr/bin/env python3
"""Assemble index.html from src/ + db.json."""
import json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
db = json.load(open(root / "db.json"))
# compact rows: t=name, u=image, c=category, f=file, d=desc, w=wiki url
rows = [[i["t"], i["u"], i["c"], i.get("f", ""), i.get("d", ""), i.get("w", "")] for i in db]
dbjson = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
# decode compact rows back into objects at runtime
shim = ("const _RAW=" + dbjson + ";"
        "window.__DB__=_RAW.map(r=>({t:r[0],u:r[1],c:r[2],f:r[3],d:r[4],w:r[5]}));")

css = (src / "style.css").read_text()
body = (src / "body.html").read_text()
i18n = (src / "i18n.js").read_text()
app = (src / "app.js").read_text()

html = f"""<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07070e">
<meta name="description" content="Image Guesser — a worldwide image quiz. One real photo, four names, ten coins for the right answer. Items from Wikipedia and Wikimedia Commons.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Image Guesser">
<title>Image Guesser</title>
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{i18n}
</script>
<script>
{shim}
</script>
<script>
{app}
</script>
<script>
if (location.protocol.startsWith("http") && "serviceWorker" in navigator) {{
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{{}}));
}}
</script>
</body>
</html>
"""
out = root / "index.html"
out.write_text(html, encoding="utf-8")
print("wrote", out, len(html) // 1024, "KB,", len(db), "items")
