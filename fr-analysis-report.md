# Release 1D - FR Cross-Reference Analysis Report

Generated: 2025-12-23

## Executive Summary

| Metric | Value |
|--------|-------|
| Total R1D Issues | 185 |
| Issues with FR References | 110 (59%) |
| Total FR-Issue Pairings | 272 |
| **Good Matches (≥40%)** | **18 (7%)** |
| Partial Matches (20-39%) | 43 (16%) |
| **Low Matches (<20%)** | **211 (78%)** |

> ⚠️ **Critical Finding:** Only 7% of FR-to-issue pairings show strong alignment between the FR definition and the issue content.

---

## FR Accuracy Breakdown

| FR | Accuracy | Good | Partial | Low | Assessment |
|----|----------|------|---------|-----|------------|
| FR780 | 31% | 11 | 10 | 15 | ⚠️ Best performer |
| FR601 | 100% | 1 | 0 | 0 | ❌ MISMATCHED (Carbon Risk on Inflation epic) |
| FR511 | 0% | 0 | 9 | 3 | ⚠️ Partial - Carbon fallback |
| FR870 | 7% | 1 | 1 | 12 | ❌ Poor match |
| FR890 | 6% | 1 | 3 | 13 | ❌ Poor match |
| FR880 | 7% | 1 | 0 | 13 | ❌ Poor match |
| FR150 | 7% | 1 | 0 | 13 | ❌ Poor match |
| FR782 | 4% | 2 | 7 | 45 | ❌ Very poor - bulk tagged |
| FR1170 | 0% | 0 | 4 | 14 | ❌ Poor match |
| FR820 | 0% | 0 | 4 | 16 | ❌ Poor match |
| FR1340 | 0% | 0 | 2 | 1 | ❌ Poor match |
| FR830 | 0% | 0 | 1 | 20 | ❌ Very poor |
| FR90 | 0% | 0 | 1 | 13 | ❌ WRONG - Do-something/Do-minimum on Inflation |
| FR180 | 0% | 0 | 1 | 0 | ⚠️ Partial only |
| FR930 | 0% | 0 | 0 | 14 | ❌ NO matches |
| FR1490 | 0% | 0 | 0 | 14 | ❌ NO matches - Report generation on Inflation |
| FR2230 | 0% | 0 | 0 | 3 | ❌ NO matches |
| FR110 | 0% | 0 | 0 | 2 | ❌ NO matches |

---

## Critical Issues Identified

### 1. FRs Incorrectly Tagged on Inflation Epic (VER10-8570)

The following FRs are tagged on the Inflation epic but their definitions do not match:

| FR | FR Definition | Why Wrong |
|----|---------------|-----------|
| FR90 | Identify estimate as do-something/do-minimum scenario | Inflation has nothing to do with scenario selection |
| FR601 | Carbon risk allowance override, PAS 2080 B2-B5 | Carbon RISK ≠ Inflation |
| FR930 | View costs in real terms with relative price growth | Too vague for inflation CRUD stories |
| FR1490 | Generate reports for Do-Min/Do-Something/Incremental | Report generation ≠ Index configuration |

### 2. Bulk-Tagged FRs with Low Accuracy

| FR | Issues Tagged | Good Matches | Likely Issue |
|----|---------------|--------------|--------------|
| FR782 | 54 | 2 (4%) | FR tagged at epic level, inherited by all stories regardless of relevance |
| FR830 | 21 | 0 (0%) | Template library stories don't relate to O&M Cost Elements |
| FR820 | 20 | 0 (0%) | Template library stories don't relate to M&R WBS structure |

---

## Recommendations

1. **Immediate:** Remove FR90, FR601, FR930, FR1490 from VER10-8570 (Inflation epic)
2. **Review:** All FR tags on epics - consider tagging at story level only
3. **Audit:** FR782, FR830, FR820 - appears to be bulk-tagged without verification
4. **Process:** Add FR definition visibility in JIRA to prevent future mismatches
5. **Training:** Ensure team understands FR definitions before tagging
