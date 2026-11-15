"""Why this crop? — farmer-facing explanations for each district × depth × rotation.

Facts first, language second (15 Nov team decision):
1. `facts()` computes the comparisons in code from the site's own results (water left at wheat sowing,
   next wheat's share of its water-unlimited yield, bare and windy-dry days, the legume's bad years,
   nitrogen fixing, tillage, a 20 % drier climate). Each fact has fixed Turkish and English sentences.
2. A local model (Ollama) only rewrites the facts into plain, friendly sentences, citing which facts
   each sentence uses. `check_sentences()` allows in a sentence only numbers from the facts it cites,
   no forbidden words (AGENTS.md), and at least the water and wheat facts.
3. If the model's text fails the check twice, the fact sentences themselves are used (`source:
   template`), so every explanation shown is correct.

    python -m nobetsu.explain                      # all districts → web/public/data/explain/{id}.json
    python -m nobetsu.explain --only develi --model qwen2.5:7b
    python -m nobetsu.explain --no-llm             # template text only (fast, no model)
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
            f"Nadas yılı yağışı toprakta biriktirir: buğday ekiminde ortanca {R['water']} mm su kalıyor; "
            + ", ".join(f"{CROP[rots[r]['crops'][0]]['tr']} sonrasında {w} mm" for r, w in ow.items()) + ".",
            f"The fallow year stores rain in the soil: about {R['water']} mm is left at wheat sowing (median); "
            + ", ".join(f"after {CROP[rots[r]['crops'][0]]['en']} {w} mm" for r, w in ow.items()) + ".")
    else:
        add("water", [R["water"], B["water"]],
            f"{leg['tr'].capitalize()} toprağın suyunu kullanır: buğday ekiminde ortanca {R['water']} mm su kalıyor, nadastan sonra {B['water']} mm.",
            f"{leg['en'].capitalize()} uses the soil's water: about {R['water']} mm is left at wheat sowing (median), {B['water']} mm after fallow.")
    add("wheat", [R["wheat"]] + ([] if is_base else [B["wheat"]]),
        f"Sonraki buğday, su kısıtı olmasaydı alacağı verimin ortanca %{R['wheat']} kadarını alıyor"
        + ("." if is_base else f"; nadastan sonra bu oran %{B['wheat']} düzeyinde."),
        f"The next wheat reaches about {R['wheat']} % of its water-unlimited yield (median)"
        + ("." if is_base else f"; after fallow {B['wheat']} %."))
    add("soil", [R["bare"], R["windy"]] + ([] if is_base else [B["bare"], B["windy"]]),
        f"İki yılda tarla ortanca {R['bare']} gün çıplak kalıyor, bunun {R['windy']} günü rüzgârlı ve kuru"
        + ("." if is_base else f"; nadasta {B['bare']} gün ve {B['windy']} gün."),
        f"Over two years the field is bare about {R['bare']} days, {R['windy']} of them windy and dry"
        + ("." if is_base else f"; with fallow {B['bare']} and {B['windy']} days."))
    if R["legume_p50"] is not None:
        add("legume", [R["legume_p50"], R["legume_p10"]],
            f"{leg['tr'].capitalize()} ortanca yılda suyun izin verdiği verimin %{R['legume_p50']} kadarını alıyor; kötü yıllarda (10 yılda 1) %{R['legume_p10']} düzeyine düşüyor.",
            f"{leg['en'].capitalize()} reaches about {R['legume_p50']} % of its water-limited potential in a median year and {R['legume_p10']} % in a bad year (1 in 10).")
    if rots[rot]["soil_traits"]["n_fixing"]:
        add("nitrogen", [],
            f"{leg['tr'].capitalize()} havadaki azotu toprağa bağlar; ne kadar bağladığını toprak tahlili gösterir.",
            f"{leg['en'].capitalize()} fixes nitrogen from the air; a soil test shows how much.")
    till = rots[rot]["soil_traits"]["tillage_passes"]["value"]
    till_b = rots[BASELINE]["soil_traits"]["tillage_passes"]["value"]
    if till is not None and till_b is not None and not is_base:
        add("tillage", [till, till_b],
            f"Yılda yaklaşık {till} kez toprak işleniyor; nadasta {till_b} kez.",
            f"The soil is tilled about {till} times a year; {till_b} times with fallow.")
    if dry:
        D = _stats(dry, rot, depth)
        add("dry", [20, D["wheat"]],
            f"Yağış %20 azalırsa sonraki buğdayın oranı %{D['wheat']} düzeyine iner.",
            f"If rain were 20 % lower, the next wheat would reach about {D['wheat']} %.")
    return out


def template_text(fs: list[dict], lang: str) -> str:
    return " ".join(f[lang] for f in fs)


def check_sentences(sentences: list[dict], fs: list[dict], lang: str) -> list[str]:
    """Problems with model sentences (empty = usable)."""
    problems = []
    by_id = {f["id"]: f for f in fs}
    cited = set()
    for i, s in enumerate(sentences):
        ids = [x for x in s.get("fact_ids", []) if x in by_id]
        if not ids:
            problems.append(f"sentence {i + 1} cites no valid fact id")
            continue
        cited |= set(ids)
        allowed = {n for x in ids for n in by_id[x]["numbers"]} | {1, 2, 10}   # "2 yıl", "10 yılda 1"
        bad = [n for n in numbers_in(s.get("text", "")) if abs(n) not in allowed]
        if bad:
            problems.append(f"sentence {i + 1} has numbers {bad} not in its facts {ids}")
    low = " ".join(s.get("text", "") for s in sentences).lower()
    hit = [w for w in FORBIDDEN if re.search(rf"(?<!\w){re.escape(w)}", low)]
    if hit:
        problems.append(f"forbidden words {hit}")
    missing = {"water", "wheat"} - cited
    if missing:
        problems.append(f"must use facts {sorted(missing)}")
    if not sentences or len(sentences) > 6:
        problems.append("write 2–6 sentences")
    return problems


PROMPT = {
    "tr": ("Sen NöbetSu'nun çiftçi rehberisin. Aşağıdaki doğru bilgileri, köydeki bir çiftçiye anlatır gibi sade "
           "ve sıcak Türkçeyle 3-5 cümleye dönüştür. İlk cümle bu tarlada neden '{crop}' ekildiğinin özeti olsun. "
           "Kurallar: sadece verilen bilgileri kullan; yeni sayı, yüzde, fiyat ya da para yazma; sayıları aynen yaz; "
           "'kesin', 'garanti', 'yasak' deme; her cümlede hangi bilgi id'lerini kullandığını fact_ids'e yaz.\n\nBilgiler:\n{facts}"),
    "en": ("You are NöbetSu's farmer guide. Turn the true facts below into 3-5 plain, warm sentences for a "
           "farmer. The first sentence sums up why '{crop}' is planted on this field. Rules: use only the facts; no "
           "new numbers, percentages, prices or money; copy numbers exactly; never say 'certain', 'guaranteed' or "
           "'banned'; list the fact ids each sentence uses in fact_ids.\n\nFacts:\n{facts}"),
}
SCHEMA = {"type": "object", "properties": {"sentences": {"type": "array", "items": {"type": "object", "properties": {
    "text": {"type": "string"}, "fact_ids": {"type": "array", "items": {"type": "string"}}},
    "required": ["text", "fact_ids"]}}}, "required": ["sentences"]}


def ollama_chat(model, messages, fmt=None, timeout=600):
    import requests
    body = {"model": model, "messages": messages, "stream": False, "format": fmt,
            "options": {"temperature": 0.3, "num_ctx": 4096}}
    r = requests.post(OLLAMA_URL, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()["message"]


def phrase(fs: list[dict], lang: str, crop_name: str, model: str, chat=ollama_chat) -> dict:
    """Model text if it passes the checks, else the template."""
    listing = "\n".join(f"- id={f['id']}: {f[lang]}" for f in fs)
    msgs = [{"role": "user", "content": PROMPT[lang].format(crop=crop_name, facts=listing)}]
    problems = ["not tried"]
    for attempt in range(MAX_TRIES):
        content = ""
        try:
            content = chat(model, msgs, fmt=SCHEMA).get("content") or "{}"
            sentences = json.loads(content).get("sentences", [])
        except Exception as e:  # noqa: BLE001 — model or JSON failure → retry, then template
            sentences, problems = [], [f"model error: {e}"]
        else:
            problems = check_sentences(sentences, fs, lang)
        if not problems:
            return {"text": " ".join(s["text"].strip() for s in sentences), "sentences": sentences,
                    "source": "model", "tries": attempt + 1}
        msgs += [{"role": "assistant", "content": content},
                 {"role": "user", "content": "Fix and return the whole JSON again: " + "; ".join(problems)}]
    return {"text": template_text(fs, lang), "sentences": [{"text": f[lang], "fact_ids": [f["id"]]} for f in fs],
            "source": "template", "tries": MAX_TRIES, "model_problems": problems}


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
            crop = rot["crops"][0]
            entry = {"facts": fs}
            for lang in ("tr", "en"):
                name = CROP.get(crop, CROP["fallow"])[lang]
                entry[lang] = (phrase(fs, lang, name, model, chat) if model
                               else {"text": template_text(fs, lang), "sentences": [{"text": f[lang], "fact_ids": [f["id"]]} for f in fs],
                                     "source": "template", "tries": 0})
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
