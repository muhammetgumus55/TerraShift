"""Arksus district agent: a local LLM reads the pipeline's results with tools and writes a farmer-facing,
source-bound explanation for one district (build time, no server, no API key).

    ollama pull qwen2.5:14b                 # once (free, local)
    python -m nobetsu.agent                 # all districts → web/public/data/agent/{id}.json
    python -m nobetsu.agent --only develi --model qwen2.5:14b

How it works
1. Tool loop: the model calls read-only tools (nobetsu.agent_tools: district, rotations, scenarios,
   soil, satellites, checks) until it has what it needs (at most MAX_STEPS calls).
2. Report: one more call with a JSON schema (Ollama structured output) produces the report.
3. Guards, then up to MAX_FIXES rewrites with the problems listed:
   - every number in the report must be one a tool returned (Registry; small years/months exempt),
   - no "recommended / best / banned / profit guaranteed" wording (AGENTS.md honest-language rule),
   - every rotation id present.
   A report that still fails is written with `guards.passed: false` and the UI must not show it.
The agent explains trade-offs under the farmer's priorities; it never picks a rotation for them.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone

import requests

from nobetsu import config
from nobetsu.agent_tools import ROTATIONS, TOOL_SPECS, Registry, Tools, numbers_in

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen2.5:14b"
MAX_STEPS = 1
MAX_FIXES = 2
NUM_CTX = 8192        # 16k pushed a 24 GB Mac into swap (1.7 tok/s); reports need ~5k tokens
TOOL_STEP_TOKENS = 300  # without a cap the model wrote a 1k-token essay inside the tool loop (~7 min at 3 tok/s)
REPORT_TOKENS = 2800    # allows a full report without truncating JSON mid-string
EXEMPT_NUMBERS = {float(x) for x in range(0, 13)} | {24.0, 100.0}   # counts, months, "24 years", "%100"
BANNED = ("önerilen", "öneririm", "tavsiye", "en iyi", "en iyisi", "yasak", "kâr garantili", "kar garantili",
          "recommended", "recommend", "best choice", "the best", "banned", "profit guaranteed")

SYSTEM = """You are Arksus's district analyst for Central Anatolian dryland farmers.
You explain, with numbers from the tools only, how three two-year rotations compare in ONE district:
fallow → wheat (current practice), chickpea → wheat, lentil → wheat.
Rules:
- Call the tools first. Use every tool at least once (district, rotations, scenarios, soil, satellites, checks).
- Every number you write must come from a tool result. Never estimate, round differently or invent numbers,
  yields in kg/da, prices or money. If something is not in the tools, say it is not known.
- Do not choose for the farmer. Never write "recommended", "best", "banned", "profit guaranteed"
  (Turkish: "önerilen", "en iyi", "yasak", "kâr garantili"). Describe trade-offs: water vs bare soil vs wheat.
- Results are for a typical field in the district under 24 past climates, not the farmer's own field.
- Satellites cannot tell phosphorus, potassium, micronutrients or compaction: say a soil test is needed.
- MERRA-2 is a NASA model, not a measurement; scenarios are sensitivity steps, not forecasts.
- Keep every array concise (2–3 short items per section). Plain words a farmer understands. Turkish first; the English text says the same thing."""

LT = {"type": "object", "properties": {"tr": {"type": "string"}, "en": {"type": "string"}}, "required": ["tr", "en"]}
def _arr(max_items: int = 2) -> dict:
    return {"type": "array", "items": LT, "minItems": 1, "maxItems": max_items}


REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": LT,
        "rotations": {"type": "array", "minItems": 3, "maxItems": 3, "items": {"type": "object", "properties": {
            "rotation_id": {"type": "string", "enum": list(ROTATIONS)},
            "strengths": _arr(2), "risks": _arr(2)},
            "required": ["rotation_id", "strengths", "risks"]}},
        "soil_health": _arr(2),
        "satellites": _arr(2),
        "climate_scenarios": _arr(3),
        "uncertainties": _arr(2),
        "ask_local_expert": _arr(2),
    },
    "required": ["headline", "rotations", "soil_health", "satellites", "climate_scenarios", "uncertainties",
                 "ask_local_expert"],
}


def ollama_chat(model: str, messages: list[dict], tools: list[dict] | None = None, fmt: dict | None = None,
                timeout: int = 900) -> dict:
    body = {"model": model, "messages": messages, "stream": False, "options": {"temperature": 0.2, "num_ctx": NUM_CTX}}
    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
        body["options"]["num_predict"] = TOOL_STEP_TOKENS   # a tool step is a few calls, never the report
    if fmt:
        body["format"] = fmt
        body["options"]["num_predict"] = REPORT_TOKENS
    r = requests.post(OLLAMA_URL, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()["message"]


def _texts(report: dict) -> list[str]:
    out = []
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("tr", "en") and isinstance(v, str):
                    out.append(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(report)
    return out


def check_report(report: dict, registry: Registry) -> list[str]:
    """Problems that make a report unusable (empty list = passes)."""
    problems = []
    known = registry.numbers | EXEMPT_NUMBERS | {round(k * 100, 2) for k in registry.numbers if 0 <= abs(k) <= 1.5}
    unknown = sorted({x for t in _texts(report) for x in numbers_in(t)
                      if not any(abs(x - k) <= max(0.011, 0.005 * abs(k)) for k in known)})
    if unknown:
        problems.append(f"Numbers not returned by any tool: {unknown}. Use only tool numbers, or remove them.")
    low = " ".join(_texts(report)).lower()
    bad = [w for w in BANNED if re.search(rf"(?<!\w){re.escape(w)}(?!\w)", low)]
    if bad:
        problems.append(f"Forbidden wording: {bad}. Describe trade-offs; do not choose for the farmer.")
    ids = {r.get("rotation_id") for r in report.get("rotations", [])}
    if ids != set(ROTATIONS):
        problems.append(f"rotations must cover exactly {list(ROTATIONS)}; got {sorted(i for i in ids if i)}.")
    return problems


def _log(location_id: str, msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {location_id}: {msg}", file=sys.stderr, flush=True)


def report_prompt(location_id: str, depth_id: str, facts: dict[str, str]) -> str:
    """The report request: tool results inlined once, so every attempt has the same, bounded size."""
    body = "\n".join(f"### {name}\n{text}" for name, text in facts.items())
    return (f"District id: {location_id}. Depth class: {depth_id}.\nTool results:\n{body}\n\n"
            "Write the report now as JSON matching the schema. Every number from the tool results above; "
            "Turkish and English; trade-offs, no choice for the farmer.")


def run_district(location_id: str, model: str = DEFAULT_MODEL, depth_id: str = "medium", chat=ollama_chat) -> dict:
    reg = Registry()
    tools = Tools(location_id, depth_id, reg)
    msgs = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"District id: {location_id}. Depth class: {depth_id}. "
                                        "Gather the facts with the tools, then say you are ready."}]
    used = []
    facts: dict[str, str] = {}          # tool name → last result (JSON text), for the report prompt
    for step in range(MAX_STEPS):
        _log(location_id, f"tool step {step + 1} ({len(facts)}/{len(TOOL_SPECS)} sources read)…")
        m = chat(model, msgs, tools=TOOL_SPECS)
        msgs.append({"role": "assistant", "content": m.get("content", ""), "tool_calls": m.get("tool_calls") or []})
        calls = m.get("tool_calls") or []
        if not calls:
            break
        for c in calls:
            fn = c["function"]["name"]
            args = c["function"].get("arguments") or {}
            if isinstance(args, str):
                args = json.loads(args or "{}")
            try:
                fn_obj = getattr(tools, fn) if fn in {t["name"] for t in TOOL_SPECS} else None
                if fn_obj is None:
                    result = {"error": f"unknown tool {fn}"}
                else:
                    valid_args = {k: v for k, v in args.items()
                                  if k in next(t for t in TOOL_SPECS if t["name"] == fn)["parameters"]["properties"]}
                    result = fn_obj(**valid_args)
            except Exception as e:  # noqa: BLE001 — tool errors go back to the model
                result = {"error": str(e)}
            used.append({"tool": fn, "args": args})
            text = json.dumps(result, ensure_ascii=False)
            if "error" not in result:
                facts[fn] = text
            msgs.append({"role": "tool", "content": text, "tool_name": fn})
        if all(t["name"] in facts for t in TOOL_SPECS):
            break                       # every source read; another step only repeats calls or starts writing
    # make sure every source was read even if the model skipped one
    for t in TOOL_SPECS:
        if t["name"] not in facts:
            facts[t["name"]] = json.dumps(getattr(tools, t["name"])(), ensure_ascii=False)
            used.append({"tool": t["name"], "args": {}, "forced": True})

    # Report phase: a fresh, fixed-size prompt each attempt (rules + tool results + problems of the last
    # attempt). Re-sending the whole conversation grew 4.6k → 6.1k → 8.1k tokens and overflowed the 8k context.
    base = report_prompt(location_id, depth_id, facts)
    report, problems, history = None, ["not generated"], []
    for attempt in range(MAX_FIXES + 1):
        msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": base}]
        if history:
            msgs.append({"role": "user", "content": "Your previous attempt was rejected. Write the whole JSON again and "
                                                    "avoid these problems:\n- " + "\n- ".join(history[-1])})
        _log(location_id, f"report attempt {attempt + 1}/{MAX_FIXES + 1}…")
        m = chat(model, msgs, fmt=REPORT_SCHEMA)
        try:
            report = json.loads(m.get("content") or "{}")
        except json.JSONDecodeError as e:
            report, problems = None, [f"Invalid JSON: {e}"]
        else:
            problems = check_report(report, reg)
        if not problems:
            break
        _log(location_id, "guards: " + " | ".join(problems))
        history.append(problems)

    return {
        "schema_version": "1.0", "mock": False,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "location_id": location_id, "depth_id": depth_id,
        "model": f"{model} (Ollama, local)", "type": "model",
        "report": report,
        "tools_used": used,
        "guards": {"passed": not problems, "problems": problems, "rewrites": attempt},
        "disclaimer": {"tr": "Yapay zekâ yorumu: yalnızca bu sitedeki verilerden üretildi; çiftçinin ve yerel uzmanın kararının yerine geçmez.",
                       "en": "AI commentary generated only from this site's data; it does not replace the farmer's and local experts' judgment."},
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--depth", default="medium")
    ap.add_argument("--force", action="store_true", help="re-run even when a passing report already exists")
    a = ap.parse_args()
    out_dir = config.WEB_DATA_DIR / "agent"
    out_dir.mkdir(parents=True, exist_ok=True)
    for loc in config.location_ids():
        if a.only and loc not in a.only:
            continue
        out_path = out_dir / f"{loc}.json"
        if not a.force and not a.only and out_path.exists():
            try:
                old = json.loads(out_path.read_text(encoding="utf-8"))
                if old.get("guards", {}).get("passed") and old.get("report"):
                    print(f"{loc}: already passed (skip; use --force to regenerate)", flush=True)
                    continue
            except Exception:  # noqa: BLE001
                pass
        rec = run_district(loc, a.model, a.depth)
        out_path.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        g = rec["guards"]
        print(f"{loc}: guards {'ok' if g['passed'] else 'FAILED'} (rewrites {g['rewrites']}, tools {len(rec['tools_used'])})"
              + ("" if g["passed"] else f" — {g['problems']}"), flush=True)


if __name__ == "__main__":
    main()
