"""Why this crop? — farmer-facing explanations for each district × depth × rotation.

Facts first, language second (15 Nov team decision):
1. `facts()` computes the comparisons in code from the site's own results (water left at wheat sowing,
   next wheat's share of its water-unlimited yield, bare and windy-dry days, the legume's bad years,
   nitrogen fixing, tillage, a 20 % drier climate). Each fact has fixed Turkish and English sentences.
2. A local model (Ollama) writes only the opening sentence, from direction-only key points (no numbers),
   e.g. 'fixes nitrogen', 'less water is left for wheat'. check_intro() rejects numbers, a missing crop
   name, forbidden words and claims that contradict the facts (e.g. 'more water' for a legume).
   The fact sentences themselves are never reworded (a 7b model distorted their meaning in tests).
3. If the intro fails the check twice, a template intro is used (source: template).
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
from datetime import datetime, timezone

from nobetsu import config
from nobetsu.agent_tools import numbers_in

DEFAULT_MODEL = "qwen2.5:7b"
OLLAMA_URL = "http://localhost:11434/api/chat"
BASELINE = "fallow_wheat"
DRY_SCENARIO = "dry20"
MAX_TRIES = 2
MAX_INTRO_TOKENS = 200   # one sentence; without a cap the model sometimes ran on for thousands of tokens in JSON mode
FORBIDDEN = ("kâr garantili", "kar garantili", "profit guaranteed", "kesin", "certain", "yasak", "banned",
             "garanti", "guarantee")
CROP = {"chickpea": {"tr": "nohut", "en": "chickpea"}, "lentil": {"tr": "mercimek", "en": "lentil"},
        "wheat": {"tr": "buğday", "en": "wheat"}, "fallow": {"tr": "nadas", "en": "fallow"}}


def _web(rel: str) -> dict:
    with (config.WEB_DATA_DIR / rel).open(encoding="utf-8") as f:
        return json.load(f)


def _q(values, p):
    s = sorted(values)
    h = (len(s) - 1) * p
    lo, hi = int(h), min(int(h) + 1, len(s) - 1)
    return s[lo] + (h - lo) * (s[hi] - s[lo])


def _pct(x) -> int:
    return int(round(100 * float(x)))


def _stats(results: dict, rot: str, depth: str) -> dict:
    rows = [s for s in results["sequences"] if s["rotation_id"] == rot and s["depth_id"] == depth]
    first = [s["first_crop"]["yield_ratio"] for s in rows if s.get("first_crop")]
    return {
        "water": int(round(statistics.median(s["water_at_wheat_sowing_mm"] for s in rows))),
        "wheat": _pct(statistics.median(s["wheat"]["yield_ratio"] for s in rows)),
        "bare": int(round(statistics.median(s["bare_days"] for s in rows))),
        "windy": int(round(statistics.median(s["wind_exposed_bare_days"] for s in rows))),
        "legume_p50": _pct(statistics.median(first)) if first else None,
        "legume_p10": _pct(_q(first, 0.1)) if first else None,
    }


def facts(location_id: str, depth: str, rot: str, site: dict | None = None,
          results: dict | None = None, dry: dict | None = None) -> list[dict]:
    """Fact list for one rotation; every number is an integer the sentence states as is."""
    site = site or _web("site_index.json")
    results = results or _web(f"results/{location_id}.json")
    try:
        dry = dry if dry is not None else _web(f"results/{location_id}__{DRY_SCENARIO}.json")
    except FileNotFoundError:
        dry = None
    rots = {r["id"]: r for r in site["rotations"]}
    R, B = _stats(results, rot, depth), _stats(results, BASELINE, depth)
    first = rots[rot]["crops"][0]
    is_base = rot == BASELINE
    leg = CROP.get(first, CROP["fallow"])
    out = []

    def add(fid, nums, tr, en):
        out.append({"id": fid, "numbers": sorted(set(int(n) for n in nums)), "tr": tr, "en": en})

    if is_base:
        others = [r for r in rots if r != BASELINE]
        ow = {r: _stats(results, r, depth)["water"] for r in others}
        add("water", [R["water"], *ow.values()],
            f"Nadas yılında tarla boş bırakılır ve yağmur suyu toprakta birikir: buğday ekimine ortanca {R['water']} mm su kalır; "
            + ", ".join(f"{CROP[rots[r]['crops'][0]]['tr']} sonrasında {w} mm" for r, w in ow.items()) + ".",
            f"In the fallow year the field rests and rain is stored in the soil: about {R['water']} mm is left when wheat is sown (median); "
            + ", ".join(f"after {CROP[rots[r]['crops'][0]]['en']} {w} mm" for r, w in ow.items()) + ".")
    else:
        add("water", [R["water"], B["water"]],
            f"{leg['tr'].capitalize()} toprağın suyunun bir kısmını kendisi kullanır; bu yüzden buğday ekimine ortanca {R['water']} mm su kalır, nadastan sonra ise {B['water']} mm.",
            f"{leg['en'].capitalize()} uses part of the soil's water itself, so about {R['water']} mm is left when wheat is sown (median), against {B['water']} mm after fallow.")
    add("wheat", [R["wheat"]] + ([] if is_base else [B["wheat"]]),
        f"Ardından ekilen buğday, suyu yetseydi alacağı ürünün ortanca %{R['wheat']} kadarını alır"
        + ("." if is_base else f"; nadastan sonra bu oran %{B['wheat']}."),
        f"The wheat that follows gets about {R['wheat']} % of the crop it would give with enough water (median)"
        + ("." if is_base else f"; after fallow {B['wheat']} %."))
    add("soil", [R["bare"], R["windy"]] + ([] if is_base else [B["bare"], B["windy"]]),
        f"İki yıl içinde tarla ortanca {R['bare']} gün boş ve çıplak kalır, bunun {R['windy']} günü rüzgârlı ve kurudur"
        + ("." if is_base else f"; nadasta bu sayılar {B['bare']} ve {B['windy']} gün."),
        f"Over two years the field lies bare about {R['bare']} days, {R['windy']} of them windy and dry"
        + ("." if is_base else f"; with fallow {B['bare']} and {B['windy']} days."))
    if R["legume_p50"] is not None:
        add("legume", [R["legume_p50"], R["legume_p10"]],
            f"{leg['tr'].capitalize()} normal bir yılda suyun izin verdiği ürünün %{R['legume_p50']} kadarını verir; on yılda bir gelen kötü yıllarda %{R['legume_p10']} düzeyine iner.",
            f"In a normal year {leg['en']} gives about {R['legume_p50']} % of what the water allows; in the bad year that comes once in ten, about {R['legume_p10']} %.")
    if rots[rot]["soil_traits"]["n_fixing"]:
        add("nitrogen", [],
            f"{leg['tr'].capitalize()} kökleriyle havadaki azotu toprağa bağlar; ne kadar bağladığını toprak tahlili gösterir.",
            f"{leg['en'].capitalize()} fixes nitrogen from the air with its roots; a soil test shows how much.")
    till = rots[rot]["soil_traits"]["tillage_passes"]["value"]
    till_b = rots[BASELINE]["soil_traits"]["tillage_passes"]["value"]
    if till is not None and till_b is not None and not is_base:
        add("tillage", [till, till_b],
            f"Toprak yılda yaklaşık {till} kez işlenir; nadasta {till_b} kez.",
            f"The soil is worked about {till} times a year; {till_b} times with fallow.")
    if dry:
        D = _stats(dry, rot, depth)
        add("dry", [20, D["wheat"]],
            f"Yağmur %20 az yağsa, ardından gelen buğdayın oranı %{D['wheat']} düzeyine iner.",
            f"If rain were 20 % lower, the following wheat would get about {D['wheat']} %.")
    return out


def key_points(location_id: str, depth: str, rot: str, site: dict | None = None, results: dict | None = None) -> list[dict]:
    """Direction-only points (no numbers) the intro sentence may use; all derived from the same statistics."""
    site = site or _web("site_index.json")
    results = results or _web(f"results/{location_id}.json")
    rots = {r["id"]: r for r in site["rotations"]}
    S = {r: _stats(results, r, depth) for r in rots}
    R, B = S[rot], S[BASELINE]
    pts = []
    if rot == BASELINE:
        if R["water"] >= max(v["water"] for v in S.values()):
            pts.append({"id": "most_water", "tr": "buğday ekimine en çok suyu bırakır", "en": "leaves the most water for wheat sowing"})
        if R["wheat"] >= max(v["wheat"] for v in S.values()):
            pts.append({"id": "best_wheat", "tr": "ardından gelen buğday en yüksek oranı alır", "en": "the following wheat gets the highest share"})
        pts.append({"id": "bare_long", "tr": "tarla uzun süre boş ve çıplak kalır", "en": "the field lies bare for a long time"})
    else:
        leg = CROP[rots[rot]["crops"][0]]
        pts.append({"id": "harvest", "tr": "boş kalacak yılda tarladan bir ürün alınır", "en": "the field gives a crop in the year it would otherwise rest"})
        if rots[rot]["soil_traits"]["n_fixing"]:
            pts.append({"id": "nitrogen", "tr": "havadaki azotu toprağa bağlar", "en": "fixes nitrogen from the air"})
        if R["bare"] < B["bare"]:
            pts.append({"id": "less_bare", "tr": "tarla nadasa göre daha az gün çıplak kalır", "en": "the field lies bare fewer days than with fallow"})
        if R["water"] < B["water"]:
            pts.append({"id": "less_water", "tr": "buğday ekimine nadasa göre daha az su kalır", "en": "less water is left for wheat than after fallow"})
    return pts


# Claims an intro must not make for a rotation (they would contradict the facts).
CONTRADICTIONS = {
    "legume": [r"(daha (çok|fazla)|en çok|artır\w*|biriktir\w*|kazandır\w*)\s+\w*\s*su\b", r"\bsu\w*\s+(artır|biriktir|kazandır)",
               r"\bmore water\b", r"\b(saves?|stores?|keeps?|adds?)\s+(more\s+)?water\b", r"\bmost water\b",
               r"\bverim\w*\s+(artır|yükselt)", r"\b(increases?|boosts?|raises?)\s+(the\s+)?(wheat\s+)?yield"],
    "fallow": [r"\bazot\b", r"\bnitrogen\b", r"daha az\s+(gün\s+)?(çıplak|boş)", r"\bless bare\b", r"\bfewer (bare )?days\b",
               r"\b(ürün|hasat)\s+(alınır|verir)", r"\bgives a crop\b"],
}
INTRO_PROMPT = {
    "tr": ("Sen NöbetSu'nun çiftçi rehberisin. Bu tarla için '{crop}' öne çıktı. Aşağıdaki doğru noktalardan 1 ya da 2 "
           "tanesini kullanarak, köydeki bir çiftçiye söyler gibi sıcak ve sade TEK bir Türkçe cümle yaz. Cümle '{crop}' "
           "kelimesini içersin. Sayı, yüzde, fiyat, para yazma; noktalarda olmayan bir şey söyleme; 'kesin', 'garanti', "
           "'yasak' deme.\n\nNoktalar:\n{points}"),
    "en": ("You are NöbetSu's farmer guide. For this field '{crop}' came out on top. Using 1 or 2 of the true points below, "
           "write ONE warm, plain English sentence as you would say it to a farmer. The sentence must contain the word "
           "'{crop}'. No numbers, percentages, prices or money; say nothing that is not in the points; never say "
           "'certain', 'guaranteed' or 'banned'.\n\nPoints:\n{points}"),
}
INTRO_SCHEMA = {"type": "object", "properties": {"sentence": {"type": "string"},
                                                  "point_ids": {"type": "array", "items": {"type": "string"}}},
                "required": ["sentence", "point_ids"]}


def check_intro(sentence: str, crop_name: str, kind: str, point_ids: list[str], pts: list[dict]) -> list[str]:
    """Problems with an intro sentence (empty = usable)."""
    problems = []
    s = (sentence or "").strip()
    low = s.lower()
    if not s or len(s) > 240:
        problems.append("write one sentence of at most 240 characters")
    if re.search(r"\d", s):
        problems.append("no numbers in the intro")
    if crop_name.lower() not in low:
        problems.append(f"the sentence must contain '{crop_name}'")
    hit = [w for w in FORBIDDEN if re.search(rf"(?<!\w){re.escape(w)}", low)]
    if hit:
        problems.append(f"forbidden words {hit}")
    bad = [p for p in CONTRADICTIONS[kind] if re.search(p, low)]
    if bad:
        problems.append("it contradicts the facts (for example about water, yield, bare days or nitrogen)")
    valid = {p["id"] for p in pts}
    if not point_ids or any(i not in valid for i in point_ids):
        problems.append(f"point_ids must come from {sorted(valid)}")
    if s.count(".") + s.count("!") > 2 or "fact_id" in low or "point_id" in low:
        problems.append("one plain sentence, no ids in the text")
    return problems


def template_intro(crop_name: str, pts: list[dict], lang: str) -> str:
    first = pts[:2]
    if lang == "tr":
        return f"Bu tarlada {crop_name} öne çıkıyor: " + " ve ".join(p["tr"] for p in first) + "."
    return f"{crop_name.capitalize()} comes out on top for this field: " + " and ".join(p["en"] for p in first) + "."


def ollama_chat(model, messages, fmt=None, timeout=600):
    import requests
    body = {"model": model, "messages": messages, "stream": False, "format": fmt,
            "options": {"temperature": 0.4, "num_ctx": 4096, "num_predict": MAX_INTRO_TOKENS}}
    r = requests.post(OLLAMA_URL, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()["message"]


def intro(pts: list[dict], lang: str, crop_name: str, kind: str, model: str, chat=ollama_chat) -> dict:
    """AI intro sentence if it passes the checks, else a template intro."""
    listing = "\n".join(f"- id={p['id']}: {p[lang]}" for p in pts)
    msgs = [{"role": "user", "content": INTRO_PROMPT[lang].format(crop=crop_name, points=listing)}]
    problems = ["not tried"]
    for attempt in range(MAX_TRIES):
        content = ""
        try:
            content = chat(model, msgs, fmt=INTRO_SCHEMA).get("content") or "{}"
            d = json.loads(content)
            sentence, ids = d.get("sentence", "").strip(), d.get("point_ids", [])
        except Exception as e:  # noqa: BLE001 — model or JSON failure → retry, then template
            sentence, ids, problems = "", [], [f"model error: {e}"]
        else:
            problems = check_intro(sentence, crop_name, kind, ids, pts)
        if not problems:
            return {"text": sentence, "point_ids": ids, "source": "model", "tries": attempt + 1}
        msgs += [{"role": "assistant", "content": content},
                 {"role": "user", "content": "Fix and return the JSON again: " + "; ".join(problems)}]
    return {"text": template_intro(crop_name, pts, lang), "point_ids": [p["id"] for p in pts[:2]],
            "source": "template", "tries": MAX_TRIES, "model_problems": problems}


def compose(fs: list[dict], first: dict, lang: str) -> dict:
    """Intro (AI or template) + the fact sentences (always computed, never reworded)."""
    sentences = [{"text": first["text"], "fact_ids": ["intro"]}] + [{"text": f[lang], "fact_ids": [f["id"]]} for f in fs]
    out = {"text": " ".join(s["text"] for s in sentences), "sentences": sentences,
           "source": first["source"], "tries": first["tries"]}
    if first.get("model_problems"):
        out["model_problems"] = first["model_problems"]
    return out


def template_text(fs: list[dict], lang: str) -> str:
    return " ".join(f[lang] for f in fs)


def build_location(location_id: str, model: str | None, chat=ollama_chat) -> dict:
    site = _web("site_index.json")
    results = _web(f"results/{location_id}.json")
    try:
        dry = _web(f"results/{location_id}__{DRY_SCENARIO}.json")
    except FileNotFoundError:
        dry = None
    out = {}
    for depth in [d["id"] for d in site["depth_classes"]]:
        out[depth] = {}
        for rot in site["rotations"]:
            fs = facts(location_id, depth, rot["id"], site, results, dry)
            pts = key_points(location_id, depth, rot["id"], site, results)
            crop = rot["crops"][0]
            kind = "fallow" if rot["id"] == BASELINE else "legume"
            entry = {"facts": fs, "points": pts}
            for lang in ("tr", "en"):
                name = CROP.get(crop, CROP["fallow"])[lang]
                first = (intro(pts, lang, name, kind, model, chat) if model
                         else {"text": template_intro(name, pts, lang), "point_ids": [p["id"] for p in pts[:2]],
                               "source": "template", "tries": 0})
                entry[lang] = compose(fs, first, lang)
            out[depth][rot["id"]] = entry
    return {"schema_version": "1.0", "mock": False,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "location_id": location_id, "model": f"{model} (Ollama, local)" if model else None,
            "type": "model", "explanations": out}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--no-llm", action="store_true")
    a = ap.parse_args()
    out_dir = config.WEB_DATA_DIR / "explain"
    out_dir.mkdir(parents=True, exist_ok=True)
    for loc in config.location_ids():
        if a.only and loc not in a.only:
            continue
        rec = build_location(loc, None if a.no_llm else a.model)
        (out_dir / f"{loc}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        srcs = [e[l]["source"] for d in rec["explanations"].values() for e in d.values() for l in ("tr", "en")]
        print(f"{loc}: model {srcs.count('model')}, template {srcs.count('template')}", flush=True)


if __name__ == "__main__":
    main()
