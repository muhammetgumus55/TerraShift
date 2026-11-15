"""Why-this-crop explanations: computed fact sentences + an AI intro sentence checked for contradictions,
with a template fallback. No LLM, no network (scripted fake model). Reads the committed web/public/data."""

import json

import pytest

from nobetsu import explain
from nobetsu.agent_tools import numbers_in

LOC, DEPTH = "karapinar", "medium"


@pytest.fixture(scope="module")
def fs():
    return explain.facts(LOC, DEPTH, "chickpea_wheat")


@pytest.fixture(scope="module")
def pts():
    return explain.key_points(LOC, DEPTH, "chickpea_wheat")


def test_every_number_in_a_fact_sentence_is_declared(fs):
    for f in fs:
        for lang in ("tr", "en"):
            for n in numbers_in(f[lang]):
                assert abs(n) in set(f["numbers"]) | {1, 2, 10}, (f["id"], lang, n)


def test_legume_rotation_facts_and_points(fs, pts):
    ids = [f["id"] for f in fs]
    assert ids[:3] == ["water", "wheat", "soil"] and "legume" in ids and "nitrogen" in ids
    assert "nadastan sonra" in fs[0]["tr"] and "after fallow" in fs[0]["en"]
    pids = [p["id"] for p in pts]
    assert pids[0] == "harvest" and "nitrogen" in pids
    assert all(not any(ch.isdigit() for ch in p["tr"] + p["en"]) for p in pts)     # points carry no numbers


def test_fallow_has_no_legume_points_or_facts():
    ids = [f["id"] for f in explain.facts(LOC, DEPTH, "fallow_wheat")]
    pids = [p["id"] for p in explain.key_points(LOC, DEPTH, "fallow_wheat")]
    assert "legume" not in ids and "nitrogen" not in ids
    assert "nitrogen" not in pids and "harvest" not in pids and "bare_long" in pids


def test_check_intro_accepts_a_plain_true_sentence(pts):
    s = "Bu tarlada nohut iyi bir seçim gibi duruyor, çünkü boş kalacak yılda tarladan bir ürün alınır ve havadaki azotu toprağa bağlar."
    assert explain.check_intro(s, "nohut", "legume", ["harvest", "nitrogen"], pts) == []


@pytest.mark.parametrize("sentence,reason", [
    ("Nohut buğdaya daha çok su bırakır.", "contradicts"),
    ("Nohut verimi %39 artırır.", "no numbers"),
    ("Chickpea saves water for the wheat.", "contradicts"),
    ("Bu tarlada mercimek iyi olur.", "must contain"),
    ("Nohut kesin kazandırır.", "forbidden"),
    ("Nohut azot bağlar (point_id: nitrogen).", "no ids"),
])
def test_check_intro_rejects_bad_sentences(sentence, reason, pts):
    crop = "chickpea" if sentence.startswith("Chickpea") else "nohut"
    problems = explain.check_intro(sentence, crop, "legume", ["nitrogen"], pts)
    assert any(reason in p for p in problems), problems


def test_fallow_intro_may_not_claim_nitrogen_or_less_bare():
    pts = explain.key_points(LOC, DEPTH, "fallow_wheat")
    assert explain.check_intro("Nadas toprağa azot kazandırır.", "nadas", "fallow", ["bare_long"], pts)
    assert explain.check_intro("Nadas ile tarla daha az gün çıplak kalır.", "nadas", "fallow", ["bare_long"], pts)


class Fake:
    def __init__(self, replies):
        self.replies = list(replies)

    def __call__(self, model, messages, fmt=None):
        return {"content": json.dumps(self.replies.pop(0), ensure_ascii=False)}


def test_intro_uses_model_sentence_when_it_passes(pts):
    good = {"sentence": "Bu tarlada nohut öne çıkıyor; havadaki azotu toprağa bağlar.", "point_ids": ["nitrogen"]}
    out = explain.intro(pts, "tr", "nohut", "legume", "fake", chat=Fake([good]))
    assert out["source"] == "model" and out["text"] == good["sentence"]


def test_intro_falls_back_to_template_after_bad_answers(pts):
    bad = {"sentence": "Nohut daha çok su bırakır.", "point_ids": ["nitrogen"]}
    out = explain.intro(pts, "tr", "nohut", "legume", "fake", chat=Fake([bad] * explain.MAX_TRIES))
    assert out["source"] == "template" and "nohut" in out["text"] and out["model_problems"]


def test_intro_survives_model_errors(pts):
    def broken(model, messages, fmt=None):
        raise ConnectionError("ollama down")
    out = explain.intro(pts, "en", "chickpea", "legume", "fake", chat=broken)
    assert out["source"] == "template" and "model error" in out["model_problems"][0]


def test_compose_keeps_fact_sentences_verbatim(fs, pts):
    first = {"text": "Bu tarlada nohut öne çıkıyor.", "source": "model", "tries": 1}
    out = explain.compose(fs, first, "tr")
    assert out["sentences"][0]["fact_ids"] == ["intro"]
    assert [s["text"] for s in out["sentences"][1:]] == [f["tr"] for f in fs]


def test_build_location_template_only_covers_every_depth_and_rotation():
    rec = explain.build_location(LOC, None)
    ex = rec["explanations"]
    assert set(ex) == {"shallow", "medium", "deep"}
    assert all(set(d) == {"fallow_wheat", "chickpea_wheat", "lentil_wheat"} for d in ex.values())
    e = ex["medium"]["chickpea_wheat"]
    assert e["tr"]["source"] == "template" and e["tr"]["sentences"][0]["fact_ids"] == ["intro"] and rec["mock"] is False
