"""Benchmark runner for executing and scoring the Claim Auditor against hard case datasets."""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from auditor import ClaimAuditor, VerdictType

HARD_CASES_DIR = Path(__file__).resolve().parent.parent / "hard_cases"


def run_benchmark() -> Dict[str, Any]:
    sys.stdout.reconfigure(encoding="utf-8")
    auditor = ClaimAuditor()
    json_files = list(HARD_CASES_DIR.glob("*.json"))

    total_cases = 0
    passed_cases = 0
    results: List[Dict[str, Any]] = []

    print("=" * 80)
    print("MEIPORUL CLAIM AUDITOR — HARD CASE ADVERSARIAL BENCHMARK")
    print("=" * 80)

    for jf in sorted(json_files):
        with open(jf, "r", encoding="utf-8") as f:
            cases = json.load(f)

        category = jf.stem.upper()
        print(f"\nEvaluating Category [{category}] ({len(cases)} test cases):")

        for c in cases:
            total_cases += 1
            cid = c.get("id", f"{category}_{total_cases}")
            name = c.get("name", "Unnamed")
            evidence = c.get("evidence", [])
            claim_text = c.get("claim", "")
            expected_verdict = c.get("expected_verdict", "SUPPORTED")

            audit_res = auditor.audit(claim_text, evidence)
            actual_verdict = audit_res.overall_verdict.value

            is_correct = (actual_verdict == expected_verdict)
            if is_correct:
                passed_cases += 1
                status_icon = "✅ PASS"
            else:
                status_icon = "❌ FAIL"

            print(f"  [{status_icon}] {cid}: {name}")
            print(f"        Expected: {expected_verdict} | Actual: {actual_verdict} | Stage: {audit_res.claims[0].stage_decided if audit_res.claims else 'N/A'}")
            if not is_correct and audit_res.claims:
                print(f"        Reason: {audit_res.claims[0].reason}")

            results.append({
                "id": cid,
                "category": category,
                "name": name,
                "passed": is_correct,
                "expected": expected_verdict,
                "actual": actual_verdict,
                "latency_ms": audit_res.metrics.total_audit_latency_ms,
            })

    accuracy = (passed_cases / total_cases * 100.0) if total_cases > 0 else 0.0
    print("\n" + "=" * 80)
    print(f"BENCHMARK SUMMARY: {passed_cases}/{total_cases} Passed ({accuracy:.1f}% Accuracy)")
    print("=" * 80)

    return {
        "total": total_cases,
        "passed": passed_cases,
        "accuracy": accuracy,
        "results": results,
    }


if __name__ == "__main__":
    report = run_benchmark()
    if report["passed"] != report["total"]:
        sys.exit(1)
