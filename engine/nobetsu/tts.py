"""Voice for the NöbetSu farmer guide: text-to-speech for the why-this-crop explanations, at build time.

Default engine: Piper (free, local, open source; 15 Nov team decision). Voices (≈63 MB each) live outside
the repo in ~/.local/share/nobetsu/piper/ — from huggingface.co/rhasspy/piper-voices:
    tr: tr_TR-dfki-medium      en: en_US-ryan-medium
    pip install piper-tts==1.8.0 ; needs ffmpeg for MP3
    python -m nobetsu.tts                    # dry run: how many clips
    python -m nobetsu.tts --yes              # make the clips → web/public/data/audio/{loc}/{depth}/{rot}.{lang}.mp3

ElevenLabs stays available (paid plan needed for library voices and > 10 k characters/month):
    python -m nobetsu.tts --engine elevenlabs --voices
    python -m nobetsu.tts --engine elevenlabs --voice <id> --yes   # key from env or the git-ignored .env

The clip path is written into explain/{loc}.json (`audio`), so the site plays it with "Listen" and falls
back to the browser voice where there is none. A clip is re-made only when its text changes (sha1 sidecar).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from nobetsu import config

import shutil
import subprocess
import tempfile
import wave

API = "https://api.elevenlabs.io/v1"
PIPER_DIR = Path.home() / ".local" / "share" / "nobetsu" / "piper"
PIPER_VOICES = {"tr": "tr_TR-dfki-medium", "en": "en_US-ryan-medium"}
_piper_cache: dict = {}


def piper_synthesize(lang: str, text: str) -> bytes:
    """MP3 bytes from Piper (local). WAV from Piper → MP3 64 kbit/s mono with ffmpeg."""
    from piper import PiperVoice
    name = PIPER_VOICES[lang]
    if name not in _piper_cache:
        model = PIPER_DIR / f"{name}.onnx"
        if not model.exists():
            raise SystemExit(f"Piper voice missing: {model} (see the module docstring)")
        _piper_cache[name] = PiperVoice.load(str(model))
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is needed to turn Piper's WAV into MP3")
    with tempfile.TemporaryDirectory() as d:
        wav, mp3 = Path(d) / "a.wav", Path(d) / "a.mp3"
        with wave.open(str(wav), "wb") as wf:
            _piper_cache[name].synthesize_wav(text, wf)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ac", "1", "-b:a", "64k", str(mp3)], check=True)
        return mp3.read_bytes()
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_22050_32"


def api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        env = config.REPO_ROOT / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("ELEVENLABS_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        raise SystemExit("ELEVENLABS_API_KEY is not set (environment or repo .env).")
    return key


def list_voices(key: str) -> list[dict]:
    import requests
    r = requests.get(f"{API}/voices", headers={"xi-api-key": key}, timeout=60)
    r.raise_for_status()
    return [{"voice_id": v["voice_id"], "name": v["name"], "labels": v.get("labels", {})} for v in r.json()["voices"]]


def synthesize(key: str, voice_id: str, text: str) -> bytes:
    import requests
    r = requests.post(f"{API}/text-to-speech/{voice_id}", params={"output_format": OUTPUT_FORMAT},
                      headers={"xi-api-key": key, "Content-Type": "application/json"},
                      json={"text": text, "model_id": MODEL_ID}, timeout=180)
    r.raise_for_status()
    return r.content


def clip_rel(loc: str, depth: str, rot: str, lang: str) -> str:
    return f"audio/{loc}/{depth}/{rot}.{lang}.mp3"


def spoken_text(entry: dict) -> str:
    return " ".join(s["text"].strip() for s in entry["sentences"])


def plan(locations: list[str], langs: tuple[str, ...]) -> list[dict]:
    """Clips that are missing or whose text changed."""
    jobs = []
    for loc in locations:
        path = config.WEB_DATA_DIR / "explain" / f"{loc}.json"
        if not path.exists():
            continue
        ex = json.loads(path.read_text(encoding="utf-8"))["explanations"]
        for depth, rots in ex.items():
            for rot, entry in rots.items():
                for lang in langs:
                    text = spoken_text(entry[lang])
                    rel = clip_rel(loc, depth, rot, lang)
                    sha = hashlib.sha1(text.encode("utf-8")).hexdigest()
                    mp3 = config.WEB_DATA_DIR / rel
                    side = mp3.with_suffix(".sha1")
                    fresh = mp3.exists() and side.exists() and side.read_text().strip() == sha
                    jobs.append({"loc": loc, "depth": depth, "rot": rot, "lang": lang, "text": text, "rel": rel,
                                 "sha": sha, "fresh": fresh})
    return jobs


def link_audio(locations: list[str], langs: tuple[str, ...]) -> None:
    """Write `audio` into explain/{loc}.json for every clip that exists and matches its text."""
    for loc in locations:
        path = config.WEB_DATA_DIR / "explain" / f"{loc}.json"
        if not path.exists():
            continue
        rec = json.loads(path.read_text(encoding="utf-8"))
        for depth, rots in rec["explanations"].items():
            for rot, entry in rots.items():
                for lang in langs:
                    rel = clip_rel(loc, depth, rot, lang)
                    mp3 = config.WEB_DATA_DIR / rel
                    side = mp3.with_suffix(".sha1")
                    sha = hashlib.sha1(spoken_text(entry[lang]).encode("utf-8")).hexdigest()
                    if mp3.exists() and side.exists() and side.read_text().strip() == sha:
                        entry[lang]["audio"] = rel
                    else:
                        entry[lang].pop("audio", None)
        path.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", choices=["piper", "elevenlabs"], default="piper")
    ap.add_argument("--voices", action="store_true", help="ElevenLabs: list voices and exit")
    ap.add_argument("--voice", help="ElevenLabs voice id")
    ap.add_argument("--only", nargs="*", help="location ids")
    ap.add_argument("--lang", nargs="*", default=["tr", "en"])
    ap.add_argument("--yes", action="store_true", help="actually call the API (spends characters)")
    a = ap.parse_args()
    locs = [l for l in config.location_ids() if not a.only or l in a.only]
    langs = tuple(a.lang)
    if a.voices and a.engine == "elevenlabs":
        for v in list_voices(api_key()):
            print(v["voice_id"], v["name"], json.dumps(v["labels"], ensure_ascii=False))
        return
    jobs = [j for j in plan(locs, langs) if not j["fresh"]]
    chars = sum(len(j["text"]) for j in jobs)
    print(f"{len(jobs)} clips to make, {chars} characters ({len(locs)} districts, languages {list(langs)}, engine {a.engine}).")
    if not a.yes:
        print("Dry run. Add --voice <id> --yes to make them.")
        return
    if a.engine == "elevenlabs" and not a.voice:
        raise SystemExit("--voice <id> is required with ElevenLabs (see --voices).")
    key = api_key() if a.engine == "elevenlabs" else None
    for i, j in enumerate(jobs, 1):
        mp3 = config.WEB_DATA_DIR / j["rel"]
        mp3.parent.mkdir(parents=True, exist_ok=True)
        audio = synthesize(key, a.voice, j["text"]) if key else piper_synthesize(j["lang"], j["text"])
        mp3.write_bytes(audio)
        mp3.with_suffix(".sha1").write_text(j["sha"])
        print(f"[{i}/{len(jobs)}] {j['rel']}", flush=True)
    link_audio(locs, langs)


if __name__ == "__main__":
    main()
