"""Every JSON under web/public/data (mock or real) matches docs/contract/*.schema.json. Owner: Gümüş."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from nobetsu import config

CONTRACT_DIR = config.REPO_ROOT / "docs" / "contract"
CHECK_ORDER = ["mass_balance", "et0_fao56_ex18", "pse_literature", "trial_ratio", "precip_vs_mgm", "smap_anomaly"]


def schema_for(rel: Path) -> str:
    return rel.parent.name if rel.parent.name in ("results", "ledger", "smap", "agent", "explain") else rel.stem


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def validate_dir(data_dir: Path) -> list[Path]:
    files = sorted(data_dir.rglob("*.json"))
    for path in files:
        rel = path.relative_to(data_dir)
        schema = load(CONTRACT_DIR / f"{schema_for(rel)}.schema.json")
        errors = sorted(Draft202012Validator(schema).iter_errors(load(path)), key=lambda e: list(e.path))
        assert not errors, f"{rel}: " + "; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5])
    return files


def check_invariants(data_dir: Path) -> None:
    site = load(data_dir / "site_index.json")
    assert site["rotations"][0]["is_baseline"] is True, "baseline rotation must be first"
    assert sum(r["is_baseline"] for r in site["rotations"]) == 1
    assert site["start_years"] == [2001, 2024]
    assert site["scenarios"][0]["id"] == "baseline", "baseline scenario must be first"
    scenario_ids = [sc["id"] for sc in site["scenarios"][1:]]
    assert [c["id"] for c in load(data_dir / "validation.json")["checks"]] == CHECK_ORDER
    mocks = set()
    for loc in (l["id"] for l in site["locations"]):
        for kind in ("results", "ledger", "smap"):
            assert (data_dir / kind / f"{loc}.json").exists(), f"missing {kind}/{loc}.json"
        res = load(data_dir / "results" / f"{loc}.json")
        assert res["scenario_id"] == "baseline"
        for sid in scenario_ids:
            sres = load(data_dir / "results" / f"{loc}__{sid}.json")
            assert sres["scenario_id"] == sid and len(sres["sequences"]) == 216
        mocks.add(res["mock"])
        keys = {(s["rotation_id"], s["depth_id"], s["start_year"]) for s in res["sequences"]}
        assert len(keys) == 216, "need 3 rotations x 3 depths x 24 years, no duplicates"
        for s in res["sequences"]:
            assert sum(s["bare_by_month"]) == s["bare_days"]
            assert s["wind_exposed_bare_days"] <= s["bare_days"]
            if s["rotation_id"] == "fallow_wheat":
                assert s["first_crop"] is None and s["fallow_storage_efficiency"] is not None
            else:
                assert s["first_crop"] is not None and s["fallow_storage_efficiency"] is None
        smap = load(data_dir / "smap" / f"{loc}.json")
        if not smap["available"]:
            assert smap["latest"] is None
    mocks.add(site["mock"])
    assert len(mocks) == 1, "mixed mock and real files"


@pytest.mark.skipif(not (config.WEB_DATA_DIR / "site_index.json").exists(), reason="no data yet: run make mock")
def test_published_data_matches_contract():
    files = validate_dir(config.WEB_DATA_DIR)
    assert len(files) >= 3 + 3 * len(config.location_ids())
    check_invariants(config.WEB_DATA_DIR)


def test_schemas_are_valid():
    for path in CONTRACT_DIR.glob("*.schema.json"):
        Draft202012Validator.check_schema(load(path))
