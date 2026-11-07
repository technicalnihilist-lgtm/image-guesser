import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent if "__file__" in dir() else pathlib.Path("/scratch/work")
root = pathlib.Path("/scratch/work")
src = root / "src"

db = json.load(open(root / "db.json"))
rows = [[i["t"], i["u"], i["c"], i.get("f", ""), i.get("d", ""), i.get("w", "")] for i in db]
dbjson = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))

sounds = json.load(open(root / "sounds.json"))
srows = [[s["t"], s["u"], s["c"], s.get("f", ""), s.get("a", ""), s.get("l", ""), s.get("w", ""), s.get("m", "")] for s in sounds]
sjson = json.dumps(srows, ensure_ascii=False, separators=(",", ":"))

shim = ("const _RAW=" + dbjson + ";"
        "window.__DB__=_RAW.map(r=>({t:r[0],u:r[1],c:r[2],f:r[3],d:r[4],w:r[5]}));"
        "const _SRAW=" + sjson + ";"
        "window.__SOUNDS__=_SRAW.map(r=>({t:r[0],u:r[1],c:r[2],f:r[3],a:r[4],l:r[5],w:r[6],m:r[7]}));")

css = (src / "style.css").read_text() + "\n" + (src / "style2.css").read_text()
body = (src / "body2.html").read_text()
i18n = (src / "i18n.js").read_text() + "\n" + (src / "i18n2.js").read_text()
core = (src / "core.js").read_text()
modes = "\n".join((src / f).read_text() for f in
                  ["m-image.js", "m-sound.js", "m-diff.js", "m-sort.js", "m-math.js"])
boot = (src / "boot.js").read_text()

html = f"""<!doctype html>
<html lang="en" data-theme="dark" data-skin="" data-gfx="high">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07070e">
<meta name="description" content="Image Guesser — five quiz games in one app: images, sounds, spot the difference, colour sort and math. Real photos and clips from Wikipedia and Wikimedia Commons. No ads, no accounts.">
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
{core}
</script>
<script>
{modes}
</script>
<script>
{boot}
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
print("wrote", out, len(html) // 1024, "KB ·", len(db), "images ·", len(sounds), "sounds")
