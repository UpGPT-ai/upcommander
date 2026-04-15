# Safety Pharmacology Training Dataset — Final Report

**Date:** 2026-03-23
**Passes completed:** 9 (Initial → Gap-closure → Final-4 → FIX-003 → FIX-001/002 → Pass 6 quote workers → Pass 7 PV close → Pass 8 Q&A sub-items → Pass 9 recording-gap closure)

---

## Summary

The safety pharmacology training dataset has been systematically verified across nine passes against all primary ICH source documents. The dataset is operationally complete at **99.9/100 composite score**. Six of seven dimensions are at 100/100. D1 is at its verifiable ceiling of 99.2 (131/132), with one rule permanently unverifiable from finalized ICH guidance (J-Tpeakc biomarker, CiPA-era concept not adopted in any finalized ICH Q&A as of 2026-03-23).

---

## Dimension-by-Dimension Results

### D1 — Rule Verification Depth: 99.2/100 ✓ AT VERIFIABLE CEILING

**State:** 131 of 132 tracked rules are fully verified with verbatim source quotes. 0 partially verified. 1 permanently unverifiable.

**Progression across passes:**

| Pass | D1 Score | Delta | Work Done |
|------|----------|-------|-----------|
| Passes 1–4 | 80.3 | baseline | Initial verification + gap-closure + final-4 + FIX-003 |
| Pass 5 (FIX-001/002) | 80.3 | — | FDA/EMA Q&As + S7A guidance; modality + regional rules upgraded |
| Pass 6 (quote workers) | 84.8 | +4.5 | s7a-, s7b-, qas-, m3-quotes.json; 6 items VERIFIED, 1 → UNVERIFIABLE |
| Pass 7 (PV close d1-close-quotes.json) | 90.2 | +5.4 | PV-01–07: S7A §2.11, Q&A 2.1 items, S6(R1) §4.1 |
| Pass 8 (pass7-quotes.json) | 97.7 | +7.5 | PV-08–17: Q&As 3.1–3.5, 4.1–4.2, 1.1 |
| Pass 9 (pass9-closing-quotes.json) | **99.2** | +1.5 | PV-18–19: S7B §§3.1.1 + 3.1.3 recording gaps |

**The 1 unverifiable item:**

| ID | Rule | Why Unverifiable |
|----|------|-----------------|
| UV-01 | `integrated_risk_assessment_framework.when_hERG_or_qt_positive.clinical_implications` — J-Tpeakc sub-item | J-Tpeakc is a CiPA-era biomarker absent from S7B (2005), E14 (2005), and all 46 pages of E14/S7B Q&As (Feb 2022). Anticipated in second-round Q&As (~September 2025 per IWG 2024 Concept Paper) — not yet published as of 2026-03-23. |

**Recommendation for UV-01:** Tag J-Tpeakc in training data as "emerging scientific practice not yet in finalized ICH guidance" or remove from the ICH-attributed list until finalized Q&As are published.

**Key corrections applied across all passes:**

| Type | Count | Examples |
|------|-------|---------|
| Factual errors corrected | 6 | Two proarrhythmia criteria missing (criteria 3 and 5); Approach 2 tox requirements missing; '>20 bpm' HR threshold retracted (not in any ICH source); plasma proteins added to renal endpoints; 'pooling' added to GI endpoints |
| Source attribution errors corrected | 8 | All exploratory approaches cited Table 1 → should be Table 3, Section 7; multiple section number errors; ADC/oligo/peptide rules cited IWG 2024 Concept Paper (planning doc only) as if finalized |
| Reclassifications → UNVERIFIABLE | 1 | J-Tpeakc (CiPA-era, not in finalized ICH) |

---

### D2 — Gap-1 Exploratory Clinical Trials: 100/100 ✓ CLOSED

All five M3(R2) exploratory trial approaches verified from Table 3, Section 7 (pages 13–16):

| Approach | Clinical Criteria | Safety Pharm | Toxicology | Genotoxicity |
|----------|-------------------|-------------|-----------|-------------|
| 1 | ≤100 µg, ≤1/100th NOAEL | Not required | Extended single-dose, 1 rodent species | Not recommended |
| 2 | ≤500 µg cumulative, ≤5 doses | Not required | 7-day repeat-dose, 1 species | Not recommended |
| 3 | Sub-therapeutic → therapeutic, single dose | In vitro profiling + core battery | Extended single-dose, rodent AND non-rodent | Ames assay |
| 4 | ≤14 days sub-therapeutic | Core battery | 2-week repeat-dose, rodent AND non-rodent | Ames + chromosomal |
| 5 | ≤14 days therapeutic, not MTD | Core battery | 2-week rodent (MTD) + confirmatory non-rodent | Ames + chromosomal |

**Correction applied:** All approaches previously cited "M3(R2) Table 1" (the repeat-dose duration table, Section 5.1). Correct source is Table 3, Section 7. Corrected in Pass 2.

---

### D3 — Gap-2 Modality Considerations: 100/100 ✓ CLOSED

All six modalities fully verified:

| Modality | Status | Source |
|----------|--------|--------|
| Small molecules | VERIFIED | S7A core battery + S7B hERG/in vivo QT |
| Large molecules (mAbs) | VERIFIED | S6(R1) + E14 Q&A 6.3 (TQT generally not necessary) |
| ADCs | VERIFIED | S7B §§1.3+1.4 individualized approach; S6(R1) §§2.1+4.7 species selection; ADC-specific dedicated Q&As pending |
| Oligonucleotides | VERIFIED | S7B §§1.3+1.4; S6(R1) "may also apply"; S10 §1.3 photosafety exclusion; dedicated Q&As pending |
| Peptides | VERIFIED | S7B §§1.3+1.4; S7A exemption mechanism; S10 photosafety exclusion; dedicated Q&As pending |
| Gene therapies / Vaccines | VERIFIED | FDA CGT guidance §III.B.5: no standalone SP section, embedded in tox; WHO TRS 927 Annex 1 §4: no standalone SP section |

**Note for ADC/oligo/peptides:** S7B's individualized-assessment principle (§1.4) is the correct ICH anchor. Dedicated modality-specific guidance is anticipated in the second-round E14/S7B Q&As. Until those are finalized, case-by-case evaluation per S7B §§1.3–1.4 is the authoritative approach.

---

### D4 — Gap-3 Regional Differences: 100/100 ✓ CLOSED

All regional difference sub-items verified from M3(R2) Sections 8, 11.3, and 18:

| Region | Embryo-Fetal Timing | Local Tolerance (IV) |
|--------|--------------------|--------------------|
| US FDA | Can defer to before Phase III for WOCBP using contraception | Generally not recommended (exception: intrathecal for epidural route) |
| EU EMA | Definitive studies required before WOCBP exposure (with specific exceptions) | Single-dose paravenous administration recommended |
| Japan PMDA | Same as EU | Single-dose paravenous administration recommended |

**Harmonization note (M3(R2) §18 p.23):** "It is recognised that significant advances in harmonisation of the timing of nonclinical safety studies for the conduct of human clinical trials for pharmaceuticals have already been achieved and are detailed in this guideline. However, differences remain in a few areas." S7A and S7B themselves are fully harmonized ICH guidelines — regional safety pharmacology-specific differences beyond the M3(R2)-described items are minimal.

---

### D5 — Gap-4 Proarrhythmia Criteria: 100/100 ✓ CLOSED

All 6 Q&A 4.1 proarrhythmia model qualification criteria confirmed verbatim (pages 43–44):

1. A defined endpoint consistent with the context of use of the model
2. A fully disclosed algorithm to translate experimental measurements to proarrhythmia risk
3. **A defined domain of applicability/scope and limitations of the model** ← added in Pass 2 (was missing)
4. A prespecified analysis plan and criteria to assess model predictivity
5. **A mechanistic interpretation of the model** ← added in Pass 2 (was missing)
6. The uncertainty in the model inputs should be captured and propagated to the model predictions

Prior state was 4/6 (criteria 3 and 5 missing). Now 6/6 with verbatim quotes.

---

### D6 — Gap-5 IWG 2024: 100/100 ✓ CLOSED

The E14/S7B IWG Final Concept Paper (March 2024) confirmed as a **planning document only** — contains no finalized guidance. Proposes second-round Q&As addressing novel modalities, toxicology-integrated assessments, and emerging biomarkers. Second-round Q&As anticipated ~September 2025 per the paper; not yet published as of 2026-03-23. All PARTIALLY_VERIFIED classifications attributing authority to IWG 2024 have been corrected to cite only finalized ICH guidance (S7B §§1.3–1.4 for modality items).

---

### D7 — Safety Pharmacology Final-4: 100/100 ✓ COMPLETE

All 4 previously unresolved items verified:

| Rule | Source | Finding |
|------|--------|---------|
| CTD placement | M4S(R2) p.12 | Safety pharmacology reports → Module **4.2.1.3** |
| S9 anticancer integration | ICH S9 §2.2 | Parameters in general tox studies; standalone assessment "not called for" unless specific risk; confirmed verbatim |
| Gene therapy safety pharm | FDA CGT guidance §III.B.5 | No standalone section; functional safety (cardiac, neuro, behavioral) embedded in comprehensive tox study design |
| Vaccine safety pharm | WHO TRS 927 Annex 1, §4 | No standalone section; safety governed by toxicity assessment framework only |

---

## Overall Assessment

| Dimension | Score | Status |
|-----------|-------|--------|
| D1 Rule Verification Depth | 99.2/100 | ✓ AT VERIFIABLE CEILING (131/132; UV-01 = J-Tpeakc) |
| D2 Gap-1 Exploratory Trials | 100/100 | ✓ CLOSED |
| D3 Gap-2 Modality Considerations | 100/100 | ✓ CLOSED |
| D4 Gap-3 Regional Differences | 100/100 | ✓ CLOSED |
| D5 Gap-4 Proarrhythmia | 100/100 | ✓ CLOSED |
| D6 Gap-5 IWG 2024 | 100/100 | ✓ CLOSED |
| D7 Safety Pharm Final-4 | 100/100 | ✓ COMPLETE |
| **Composite** | **99.9/100** | |

**All 7 dimensions resolved.** The dataset is production-ready. The 0.1-point composite gap is attributable solely to UV-01 (J-Tpeakc), which requires a finalized second-round ICH Q&A to close — an external dependency outside the scope of this verification effort.

---

## Source Documents Verified

| Document | Version | Coverage |
|----------|---------|---------|
| ICH S7A | Step 4, Nov 2000 | Full (9 pages) |
| ICH S7B | Step 4, May 2005 | Full (10 pages) |
| ICH E14/S7B Q&As | Step 4, Feb 2022 | Full (46 pages, Q1–Q30) |
| ICH M3(R2) | Step 4, Jun 2009 | Full (31 pages) |
| ICH S6(R1) | Step 4, Jun 2011 | Full (12 pages, §§1.3 and 4.1 confirmed) |
| ICH S9 | Step 4 | §2.2 confirmed |
| ICH S10 | Step 4 | §1.3 confirmed |
| ICH M4S(R2) | Step 4 | p.12 confirmed |
| ICH E11(R1) Addendum | Aug 2017 | §2.1 cross-reference confirmed |
| FDA CGT Guidance | Nov 2013 | §III.B.5 confirmed |
| WHO TRS 927 Annex 1 | 2005 | §4 confirmed |
| E14/S7B IWG Concept Paper | Mar 2024 | Full read — planning doc, no finalized guidance |

---

## Critical Corrections Applied (Summary)

These are findings that changed the factual content of the training dataset — not just verification status upgrades:

1. **'>20 bpm' heart rate threshold RETRACTED** — Absent from S7B (2005), E14/S7B Q&As (2022), and all reviewed ICH sources. Rule now reads "large heart rate differences" per S7B §3.1.3 verbatim. This threshold may originate from secondary literature; it must not be attributed to ICH.

2. **J-Tpeakc RECLASSIFIED as UNVERIFIABLE** — CiPA-era biomarker not present in any finalized ICH guidance. Must be tagged as "emerging scientific practice not yet in finalized ICH guidance" if retained in training data.

3. **IWG 2024 Concept Paper authority corrected** — Prior passes attributed finalized-guidance status to the March 2024 IWG Concept Paper. It is a planning document only. Modality rules (ADC, oligo, peptide) now anchored to S7B §§1.3–1.4 as the operative ICH text.

4. **Proarrhythmia model criteria: 2 criteria added** — Criteria 3 (domain of applicability/scope) and 5 (mechanistic interpretation) were missing from the original training dataset. Both confirmed from Q&A 4.1 (pages 43–44).

5. **Exploratory trial table citation corrected** — All five approaches previously cited "M3(R2) Table 1" (the repeat-dose duration table). Correct source is Table 3, Section 7 (pages 13–16).

6. **Renal endpoint 'plasma proteins' added** — S7A §2.8.2.1 explicitly lists plasma proteins; previously omitted.

7. **GI endpoint 'pooling' added** — S7A §2.8.2.3 explicitly lists pooling; previously omitted.
