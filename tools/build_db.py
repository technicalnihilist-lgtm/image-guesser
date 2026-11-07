#!/usr/bin/env python3
import json, urllib.parse, urllib.request, sys, re
from seeds import SEEDS

API = "https://en.wikipedia.org/w/api.php"
UA = "ImageGuesserGame/1.0 (educational quiz app; contact: nihaonihao54059@gmail.com)"

def q(params):
    params = dict(params); params.update({"action": "query", "format": "json", "origin": "*"})
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

def resolve_map(d):
    m = {}
    for n in d.get("query", {}).get("normalized", []) or []:
        m[n["from"]] = n["to"]
    for r in d.get("query", {}).get("redirects", []) or []:
        m[r["from"]] = r["to"]
    return m

def chain(m, t):
    seen = set()
    while t in m and t not in seen:
        seen.add(t); t = m[t]
    return t

out, seen_names = [], set()
stats = {}

for cat, blob in SEEDS.items():
    toks = [t.strip() for t in blob.split("\n") for t in [t.strip()] if t.strip()]
    # split each line into tokens: multiword titles contain spaces, so lines are already token-per-line-ish
    toks = []
    for line in blob.split("\n"):
        line = line.strip()
        if line:
            toks.extend([x.strip() for x in line.split("|") if x.strip()])
    toks = [t for t in toks if "dup" not in t.lower()]
    # dedupe preserving order
    seen_tok, uniq = set(), []
    for t in toks:
        if t.lower() not in seen_tok:
            seen_tok.add(t.lower()); uniq.append(t)
    got = 0
    for i in range(0, len(uniq), 40):
        batch = uniq[i:i+40]
        try:
            d = q({"titles": "|".join(batch), "prop": "pageimages|description|pageprops",
                   "piprop": "thumbnail|name", "pithumbsize": 900, "redirects": 1})
        except Exception as e:
            print("ERR", cat, e, file=sys.stderr); continue
        rm = resolve_map(d)
        pages = d.get("query", {}).get("pages", {}) or {}
        by_title = {}
        for pid, p in pages.items():
            if pid == "-1":
                continue
            by_title[p.get("title", "")] = p
        for tok in batch:
            key = chain(rm, tok)
            p = by_title.get(key)
            if not p or "missing" in p:
                continue
            if "disambiguation" in (p.get("pageprops") or {}):
                continue
            th = (p.get("thumbnail") or {}).get("source")
            if not th:
                continue
            title = p["title"]
            if title.startswith("List of") or ":" in title:
                continue
            display = re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()
            if not display or len(display) > 42:
                continue
            low = display.lower()
            if low in seen_names:
                continue
            seen_names.add(low)
            out.append({"t": display, "u": th, "c": cat, "f": p.get("pageimage") or "",
                        "d": (p.get("description") or "").strip()[:120],
                        "w": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))})
            got += 1
    stats[cat] = got
    print(cat, got, len(uniq))

print("TOTAL", len(out))
print(json.dumps(stats))
json.dump(out, open(__import__("os").path.join(__import__("os").path.dirname(__file__), "..", "db.json"), "w"), ensure_ascii=False)
