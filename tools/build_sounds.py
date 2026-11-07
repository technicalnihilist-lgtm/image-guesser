import json, re, sys, urllib.parse, urllib.request
API="https://commons.wikimedia.org/w/api.php"; UA="ImageGuesserGame/2.0 (quiz; nihaonihao54059@gmail.com)"
def q(p):
    p=dict(p); p.update({"action":"query","format":"json"})
    r=urllib.request.Request(API+"?"+urllib.parse.urlencode(p), headers={"User-Agent":UA})
    return json.loads(urllib.request.urlopen(r, timeout=45).read().decode())

# (category, answer, search query, substring that must appear in the chosen file title)
PICK = [
 ("animals","Dog","dog barking","dog barking"),
 ("animals","Cat","meow siamese cat freemaster","meow"),
 ("animals","Frog","frogs croaking pipe thailand","frog"),
 ("animals","Owl","Strix aluco tawny owl","tawny owl"),
 ("animals","Lion","lionroar","lionroar"),
 ("animals","Seagull","Chroicocephalus serranus Andean Gull","gull"),
 ("animals","Crow","Corvus corone carrion crow","crow"),
 ("animals","Cicada","Northern Dog-day Cicada singing","cicada"),
 ("animals","Monkey","Brown woolly monkey alarm call","monkey"),
 ("animals","Rooster","Kokrhajici slepice a kohout","kohout"),
 ("animals","Bee","mehilainen tarhamehilainen","mehil"),
 ("animals","Duck","Paradise-duck-song","duck"),
 ("instruments","Flute","Flute Melody","flute"),
 ("instruments","Trumpet","Lick Trumpet","trumpet"),
 ("instruments","Drum","Satch Hoyt Slit Drum","drum"),
 ("instruments","Saxophone","Lick Tenor Sax","sax"),
 ("instruments","Clarinet","Lick Bass Clarinet","clarinet"),
 ("instruments","Xylophone","Xylophone jingle","xylophone"),
 ("instruments","Bells","Sosnicowice church bell ringing","bell"),
 ("instruments","Guitar","spanish guitar chords","guitar"),
 ("instruments","Harmonica","Jail Harmonica Blues","harmonica"),
 ("instruments","Organ","Bach Toccata in F BWV 540","toccata"),
 ("vehicles","Car","Ferrari 599 GTB Fiorano engine exhaust","ferrari"),
 ("vehicles","Train","JP-Train horn","train"),
 ("vehicles","Bicycle","Bicycle-bell-3","bicycle"),
 ("vehicles","Ambulance","AmbulanceSound1","ambulance"),
 ("vehicles","Motorcycle","Jawa350","jawa"),
 ("vehicles","Airplane","inspectorj airplane boeing flyby","airplane"),
 ("household","Toilet","Toilet flush stereo low-flow","toilet"),
 ("household","Clock","klankbeeld pendulum ten o clock","clock"),
 ("machines","Typewriter","stubb typewriter ding","typewriter"),
 ("machines","Air conditioner","Air conditioner hum Gravity Sound","conditioner"),
 ("machines","Metronome","Metronome 60bpm","metronome"),
 ("machines","Camera","D7100 shot sound continuous high","d7100"),
 ("machines","Chainsaw","Druzhba-4","druzhba"),
 ("nature","River","River flowing Gravity Sound","river"),
 ("nature","Thunder","Very close thunder cracks","thunder"),
 ("nature","Ocean waves","Sea waves","sea waves"),
 ("nature","Waterfall","Catarata Pacchacc","catarata"),
 ("nature","Storm","Storm in Quebec August 10 2023","storm"),
 ("nature","Forest birds","Dawn Chorus 2020-05-06","dawn chorus"),
 ("nature","Rain","Bourne woods rain 2020-05-10","rain"),
 ("human","Laughter","lonemonk approx 800 laugh","laugh"),
 ("human","Footsteps","Footstep on Gravel Gravity Sound","footstep"),
 ("human","Coughing","Woman coughing three times","cough"),
 ("human","Heartbeat","Heartbeat speedsup","heartbeat"),
 ("human","Snoring","Young man snoring","snor"),
 ("human","Keyboard typing","dustin-davis typing","typing"),
 ("everyday","Coins","Coins 4 Gravity Sound","coins"),
 ("everyday","Cash register","Cha Ching Register Muska666","register"),
 ("everyday","Applause","F1 Race Crowd Applause Air Horns","applause"),
 ("everyday","Water drop","Water drips Treak Cliff Cavern","drip"),
 ("everyday","Fireworks","Nyarsafton i Malmo 2020","nyarsafton"),
]
BAD = re.compile(r"^LL-|pronunciation|spoken|language\b|jammer|drill ?call|\.mid$", re.I)

def search(s, limit=14):
    try:
        d=q({"list":"search","srsearch":f"{s} filemime:audio","srnamespace":6,"srlimit":limit})
        return [h["title"] for h in d.get("query",{}).get("search",[])]
    except Exception as e:
        return []

def meta(titles):
    out={}
    for i in range(0,len(titles),25):
        try:
            d=q({"titles":"|".join(titles[i:i+25]),"prop":"imageinfo",
                 "iiprop":"url|size|mime|extmetadata","iiextmetadatafilter":"Artist|LicenseShortName"})
        except Exception: continue
        for p in (d.get("query",{}).get("pages",{}) or {}).values():
            out[p.get("title","")]=(p.get("imageinfo") or [{}])[0]
    return out

def clean(v): return re.sub(r"<[^>]*>","",str(v or "")).replace("&amp;","&").strip()

# gather candidates per pick, then one metadata pass
cand=[]
for cat,ans,query,need in PICK:
    hits=[t for t in search(query) if need.lower() in t.lower() and not BAD.search(t.split(":",1)[-1])]
    if not hits:
        hits=[t for t in search(ans) if need.lower() in t.lower() and not BAD.search(t.split(":",1)[-1])]
    if hits: cand.append((cat,ans,need,hits[:6]))
    else: print("--", ans, "no candidate")

alltitles=sorted({t for _,_,_,hs in cand for t in hs})
md=meta(alltitles)
items, used = [], set()
for cat,ans,need,hs in cand:
    best=None
    for t in hs:
        ii=md.get(t) or {}
        mime=(ii.get("mime") or "").lower(); size=ii.get("size") or 0
        if not mime.startswith("audio/"): continue
        if not (4000 < size < 3_000_000): continue
        ext=t.rsplit(".",1)[-1].lower()
        if ext not in ("ogg","oga","opus","mp3","wav","webm","flac"): continue
        score=(3 if ext in ("ogg","oga","opus","mp3") else 2) + (1 if size<900_000 else 0)
        if best is None or score>best[0]: best=(score,t,ii)
    if not best: print("--",ans,"no playable file"); continue
    _,t,ii=best
    if t in used: continue
    used.add(t)
    em=ii.get("extmetadata") or {}
    items.append({"t":ans,"c":cat,"u":ii.get("url",""),"f":t.replace("File:",""),
        "w":"https://commons.wikimedia.org/wiki/"+urllib.parse.quote(t.replace(" ","_")),
        "a":clean((em.get("Artist") or {}).get("value"))[:70],
        "l":clean((em.get("LicenseShortName") or {}).get("value"))[:30],
        "s":ii.get("size",0),"m":ii.get("mime","")})
    print("OK",f"{cat:12s}",f"{ans:18s}",t.replace("File:","")[:60],"|",items[-1]["l"])

print("TOTAL",len(items))
from collections import Counter
print(Counter(i["c"] for i in items))
json.dump(items,open("/scratch/work/sounds.json","w"),ensure_ascii=False)
