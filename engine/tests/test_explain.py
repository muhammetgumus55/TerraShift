"""Why-this-crop explanations: facts from the data, model wording checked per cited fact, template fallback.
No LLM, no network (scripted fake model). Reads the committed web/public/data."""

import json

import pytest

from nobetsu import explain
from nobetsu.agent_tools import numbers_in

LOC, DEPTH = "karapinar", "medium"


@pytest.fixture(scope="module")
def fs():
    return explain.facts(LOC, DEPTH, "chickpea_wheat")


def test_every_number_in_a_fact_sentence_is_declared(fs):
    for f in fs:
        for lang in ("tr", "en"):
            for n in numbers_in(f[lang]):
                assert abs(n) in set(f["numbers"]) | {1, 2, 10}, (f["id"], lang, n)


def test_legume_rotation_has_legume_nitrogen_and_baseline_comparisons(fs):
    ids = [f["id"] for f in fs]
    assert ids[:3] == ["water", "wheat", "soil"] and "legume" in ids and "nitrogen" in ids
    assert "nadastan sonra" in fs[0]["tr"] and "after fallow" in fs[0]["en"]


def test_fallow_has_no_legume_or_nitrogen_fact():
    ids = [f["id"] for f in explain.facts(LOC, DEPTH, "fallow_wheat")]
    assert "legume" not in ids and "nitrogen" not in ids and ids[0] == "water"


def _ok(fs, lang="tr"):
    water = [f for f in fs if f["id"] == "water"][0]
    wheat = [f for f in fs if f["id"] == "wheat"][0]
    return [{"text": water[lang], "fact_ids": ["water"]}, {"text": wheat[lang], "fact_ids": ["wheat"]}]


def test_check_accepts_sentences_built_from_cited_facts(fs):
    assert explain.check_sentences(_ok(fs), fs, "tr") == []


def test_check_rejects_numbers_from_an_uncited_fact(fs):
    s = _ok(fs)
    soil = [f for f in fs if f["id"] == "soil"][0]
    s[0]["text"] += f" Tarla {soil['numbers'][-1]} gün çıplak."          # soil number in a water-only sentence
    assert any("not in its facts" in p for p in explain.check_sentences(s, fs, "tr"))


def test_check_rejects_invented_numbers_forbidden_words_and_missing_core_facts(fs):
    s = _ok(fs); s[1]["text"] += " Verim 999 kg/da olur."
    assert any("999" in p for p in explain.check_sentences(s, fs, "tr"))
    s = _ok(fs); s[0]["text"] += " Bu kesin doğrudur."
    assert any("forbidden" in p for p in explain.check_sentences(s, fs, "tr"))
    assert any("must use facts" in p for p in explain.check_sentences(_ok(fs)[:1], fs, "tr"))


class Fake:
    def __init__(self, replies):
        self.replies = list(replies)

    def __call__(self, model, messages, fmt=None):
        return {"content": json.dumps({"sentences": self.replies.pop(0)}, ensure_ascii=False)}


def test_phrase_uses_model_text_when_it_passes(fs):
    out = explain.phrase(fs, "tr", "nohut", "fake", chat=Fake([_ok(fs)]))
    assert out["source"] == "model" and out["tries"] == 1


def test_phrase_falls_back_to_template_when_model_keeps_failing(fs):
    bad = [{"text": "Nohut ekin, 999 mm su kalır.", "fact_ids": ["water"]}]
    out = explain.phrase(fs, "tr", "nohut", "fake", chat=Fake([bad] * explain.MAX_TRIES))
    assert out["source"] == "template" and out["text"] == explain.template_text(fs, "tr")


def test_build_location_template_only_covers_every_depth_and_rotation():
    rec = explain.build_location(LOC, None)
    ex = rec["explanations"]
    assert set(ex) == {"shallow", "medium", "deep"}
    assert all(set(d) == {"fallow_wheat", "chickpea_wheat", "lentil_wheat"} for d in ex.values())
    assert ex["medium"]["chickpea_wheat"]["tr"]["source"] == "template" and rec["mock"] is False


def test_phrase_survives_model_errors(fs):
    def broken(model, messages, fmt=None):
        raise ConnectionError("ollama down")
    out = explain.phrase(fs, "en", "chickpea", "fake", chat=broken)
    assert out["source"] == "template" and "model error" in out["model_problems"][0]
