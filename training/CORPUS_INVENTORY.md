# Regulatory Corpus Inventory — 2026-03-24

## Summary

| Metric | Count |
|--------|-------|
| Total source documents | ~737 |
| Documents with extracted rules | ~200 (est.) |
| Documents with NO extracted rules | ~537 |
| Estimated rules extracted so far | ~4,800+ |
| Estimated rules remaining to extract | ~5,000-8,000 |
| Safety Pharmacology (D1) verified | 132/132 = 100% |

---

## ICH Guidelines (Harmonized — All 4 Markets)

| Code | Title | Source PDF | Rules Extracted? | Confidence | Notes |
|------|-------|-----------|-----------------|------------|-------|
| **E1** | Population Exposure | ✅ ich-complete | ✅ output-v4 | 90% | In e1-e2-pharmacovigilance, e1-e9r1-exposure |
| **E2A** | Clinical Safety Data Mgmt (Definitions) | ✅ ich-complete | ✅ output-v4 | 90% | In e1-e2a-e2c rules |
| **E2B(R3)** | Electronic Transmission of ICSRs | ✅ ich-complete (2025) | ❌ NOT EXTRACTED | — | Very new (June 2025). Needs processing |
| **E2C(R2)** | Periodic Benefit-Risk (PBRER) | ✅ ich-complete | ✅ output-v4 | 85% | In e1-e2a-e2c rules |
| **E2D(R1)** | Post-Approval Safety Reporting | ✅ ich-complete (2025) | ✅ output-v4 | 80% | In e19-e2d-m9 rules. New R1 version — verify current |
| **E2E** | Pharmacovigilance Planning | ✅ ich-complete | ⚠️ SHALLOW | 40% | May be in v2 clinical-design only |
| **E2F** | Development Safety Update Report | ✅ ich-complete | ⚠️ SHALLOW | 40% | May be in v2 clinical-design only |
| **E3** | Clinical Study Reports | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e3-e4-e7 rules |
| **E4** | Dose-Response Info | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e3-e4-e7 rules |
| **E5(R1)** | Ethnic Factors / Bridging | ✅ ich-complete | ✅ output-v4 | 85% | In e5-e8-e9 rules |
| **E6(R3)** | Good Clinical Practice | ✅ ich-complete (2025) | ✅ output-v4 | 80% | In e3-e4-e7-e17-e6r3 + m11-e6r3. New version — verify |
| **E7** | Elderly Studies | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e3-e4-e7 rules |
| **E8(R1)** | General Considerations Clinical Studies | ✅ ich-complete | ✅ output-v4 | 80% | In e5-e8-e9 rules |
| **E9(R1)** | Statistical Principles / Estimands | ✅ ich-complete | ✅ output-v4 | 85% | In e1-e9r1, e5-e8-e9 rules |
| **E10** | Choice of Control Group | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e10-e15-e16 rules |
| **E11(R1)** | Pediatric Populations | ✅ ich-complete | ✅ output-v2 | 75% | In e-special-pops. R1 addendum present |
| **E11A** | Pediatric Extrapolation | ✅ ich-complete (2024) | ✅ output-v4 | 80% | In e1-e2a-e2c, e5-e8-e9 rules |
| **E12** | Clinical Evaluation by Indication | ✅ ich-complete | ⚠️ SHALLOW | 40% | May be in v2 only |
| **E14** | QT/QTc Evaluation | ✅ ich-complete | ✅ DEEP (D1) | 100% | Safety pharm D1 — fully verified |
| **E15** | Pharmacogenomics Definitions | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e10-e15-e16 rules |
| **E16** | Biomarker Qualification | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e10-e15-e16 rules |
| **E17** | Multi-Regional Clinical Trials | ✅ ich-complete + advanced | ✅ output-v4 | 85% | In e3-e4-e7-e14-e17 rules |
| **E18** | Genomic Sampling in Clinical Trials | ✅ ich-complete | ✅ output-v4 | 80% | In e10-e15-e16-e18 rules |
| **E19** | Optimization of Safety Data Collection | ✅ ich-complete (2022) | ✅ output-v4 | 85% | In e19-e2d-m9 rules |
| **E22** | Clinical Pharmacology Studies (DRAFT) | ✅ ich-complete (2025) | ❌ NOT EXTRACTED | — | Step 2 draft. Extract but flag as draft |
| **M3(R2)** | Nonclinical Safety Study Timing | ✅ ich-complete + safety-full | ✅ DEEP (D1) | 100% | Safety pharm D1 — fully verified |
| **M4Q/S/E** | CTD Format (Quality/Safety/Efficacy) | ✅ ich-complete | ✅ output-v4 | 80% | M4S in m4s-q5d rules |
| **M7(R2)** | Mutagenic Impurities | ✅ ich-complete (2023) | ✅ output-v4 | 85% | In m7r2-q9r1-q3d rules |
| **M9** | BCS-Based Biowaivers | ✅ ich-complete | ✅ output-v4 | 85% | In e19-e2d-m9 rules |
| **M10** | Bioanalytical Method Validation | ✅ ich-complete | ✅ output-v4 | 80% | In q5b-q6-q7-q8-q12-m10 rules |
| **M11** | Clinical Electronic Structured Harmonised Protocol | ✅ ich-complete | ✅ output-v4 | 80% | In m11-e6r3, q10-q11-m11 rules |
| **M12** | Drug Interaction Studies | ✅ ich-complete (2024) | ✅ output-v4 | 85% | In m12-ddi rules |
| **M13A** | Bioequivalence for IR Solid Oral | ✅ ich-complete (2024) | ✅ output-v4 | 85% | In m13a-bioequivalence rules |
| **M14** | Use of Real-World Data | ✅ ich-complete (2025) | ✅ output-v4 | 80% | In m14-m15-q5a-q2 rules |
| **M15** | General Principles for Model-Informed | ✅ ich-complete (2026) | ✅ output-v4 | 80% | In m14-m15-q5a-q2 rules. Very new |
| **Q1A-E** | Stability Testing | ✅ ich-complete + quality-adv | ✅ output-v4 | 85% | In q1-stability, q1-q4b-q6a rules |
| **Q2(R2)** | Analytical Validation | ✅ ich-complete (2023) | ✅ output-v4 | 85% | In m14-m15-q5a-q2 rules |
| **Q3A/B** | Impurities (Drug Substance/Product) | ✅ ich-complete | ✅ output-v4 | 85% | In q3a-q3b-impurity rules |
| **Q3C(R9)** | Residual Solvents | ✅ ich-complete (2024) | ✅ output-v4 | 80% | In m4s-q5d-q3c rules |
| **Q3D(R2)** | Elemental Impurities | ✅ ich-complete | ✅ output-v4 | 85% | In m7r2-q9r1-q3d rules |
| **Q4B** | Pharmacopoeial Interchangeability | ✅ ich-complete + quality-adv | ✅ output-v4 | 80% | In q1-q4b-q6a rules |
| **Q5A-E** | Biologics Quality | ✅ ich-complete | ✅ output-v4 | 85% | In q5-biologics, q5b-q6 rules |
| **Q6A/B** | Specifications (Chemical/Biotech) | ✅ ich-complete | ✅ output-v4 | 85% | In q1-q4b-q6a, q5b-q6 rules |
| **Q7** | GMP for APIs | ✅ ich-complete | ✅ output-v4 | 80% | In q5b-q6-q7-q8 rules |
| **Q8(R2)** | Pharmaceutical Development | ✅ ich-complete | ✅ output-v4 | 85% | In q8-q12, q5b-q6-q7-q8 rules |
| **Q9(R1)** | Quality Risk Management | ✅ ich-complete + quality-adv | ✅ output-v4 | 85% | In m7r2-q9r1-q3d rules |
| **Q10** | Pharmaceutical Quality System | ✅ ich-complete + quality-adv | ✅ output-v4 | 85% | In q10-q11-m11, s1-s4-s8-q10 rules |
| **Q11** | Drug Substance Development | ✅ ich-complete + quality-adv | ✅ output-v4 | 85% | In q10-q11-m11 rules |
| **Q12** | Lifecycle Management | ✅ ich-complete | ✅ output-v4 | 80% | In q5b-q6-q7-q8-q12, q8-q12 rules |
| **Q13** | Continuous Manufacturing | ✅ ich-complete (2022) | ❌ NOT EXTRACTED | — | Needs processing |
| **Q14** | Analytical Procedure Development | ✅ ich-complete (2023) | ❌ NOT EXTRACTED | — | Needs processing |
| **S1A/B/C** | Carcinogenicity | ✅ ich-complete + safety-full | ✅ output-v4 | 85% | In s1-s5-s8, s11-s1b rules |
| **S2(R1)** | Genotoxicity | ✅ ich-complete + safety-full | ⚠️ SHALLOW | 50% | May be in v2 s-toxicology only |
| **S3A/B** | Toxicokinetics / PK Repeated Dose | ✅ ich-complete + safety-full | ⚠️ SHALLOW | 50% | May be in v2 s-toxicology only |
| **S4** | Duration Chronic Toxicity Studies | ✅ ich-complete + safety-full | ✅ output-v4 | 80% | In s1-s4-s8 rules |
| **S5(R3)** | Reproductive Toxicology | ✅ ich-complete | ✅ output-v4 | 80% | In s1-s5-s8, q8-q12-q5e-s5r3 rules |
| **S6(R1)** | Preclinical Safety Biologics | ✅ ich-complete | ✅ DEEP (D1) | 95% | Referenced in D1 safety pharm |
| **S7A** | Safety Pharmacology Core Battery | ✅ ich-complete | ✅ DEEP (D1) | 100% | Safety pharm D1 — fully verified |
| **S7B** | S7B QT Nonclinical Evaluation | ✅ ich-complete | ✅ DEEP (D1) | 100% | Safety pharm D1 — fully verified |
| **S8** | Immunotoxicity Studies | ✅ ich-complete + safety-full | ✅ output-v4 | 80% | In s1-s4-s8, s1-s5-s8 rules |
| **S9** | Nonclinical for Oncology | ✅ ich-complete + safety-full | ⚠️ SHALLOW | 50% | May be in v2 s-toxicology only |
| **S10** | Photosafety Evaluation | ✅ ich-complete + safety-full | ⚠️ SHALLOW | 50% | May be in v2 s-toxicology only |
| **S11** | Nonclinical Pediatric Safety | ✅ ich-complete | ✅ output-v4 | 80% | In s11-s1b rules |

### ICH Summary
- **67 finalized guidelines**: All source PDFs present
- **~50 with rules extracted** (v2 or v4), but many are SHALLOW (bundled in broad topic files)
- **4 confirmed NOT extracted**: E2B(R3), E22, Q13, Q14
- **~6 likely SHALLOW**: E2E, E2F, E12, S2, S3A/B, S9, S10
- **3 at 100% DEEP verification**: S7A, S7B, E14 (safety pharmacology)

---

## US (FDA) Sources

| Category | Source Folder | Files | Rules Extracted? | Confidence | Notes |
|----------|-------------|-------|-----------------|------------|-------|
| FDA Guidance (Batch 1) | fda-guidance/ | 19 | ✅ output-v4 | 80% | fda-guidance-rules.json, fda-labeling-be.json |
| FDA Guidance (Batch 2) | fda-guidance-v2/ | 72 | ❌ NOT EXTRACTED | — | **Needs full swarm processing** |
| FDA CBER (Biologics) | fda-cber/ | 3 | ❌ NOT EXTRACTED | — | Cell substrates, potency, cancer vaccines |
| 21 CFR Title 21 | regulations/ | 5 | ✅ output-v2 | 70% | In regulations-crl. Broad, may need deeper |
| CRL Database | crl-database/ | scripts | ✅ output-v2 | 75% | Deficiency taxonomy extracted |
| PIC/S Data Integrity | pics-guidelines/ | 2 | ✅ output-v4 | 80% | pics-pi041 rules |
| FDA Data Integrity | (within fda-guidance) | — | ✅ output-v4 | 80% | fda-data-integrity-rules.json |

### FDA — Known Missing Documents (not yet in corpus)
- MaPPs (Manual of Policies & Procedures) — ~50 CDER procedural docs
- CBER guidances — we have 3 of ~80+
- Compliance Program Guidance Manuals
- FDA Warning Letter precedent database
- 505(b)(2) specific guidance
- REMS guidance (detailed)
- Combination product guidances (drug-device, drug-biologic)

---

## EU (EMA) Sources

| Category | Source Folder | Files | Rules Extracted? | Confidence | Notes |
|----------|-------------|-------|-----------------|------------|-------|
| EMA Scientific Guidelines (Batch 1) | ema-guidelines/ | 12 | ✅ output-v3 | 70% | Broad extraction |
| EMA Scientific Guidelines (Batch 2) | ema-guidelines-v2/ | 41 | ❌ NOT EXTRACTED | — | **21 new from today + 20 prior. Needs swarm** |
| EMA GVP (Batch 1) | ema-gvp/ | 12 | ✅ output-v3 + v4 | 80% | Multiple extraction passes |
| EMA GVP (Batch 2) | ema-gvp-v2/ | 3 | ✅ output-v4 | 75% | Modules VI, VIII, X |
| EU GMP (Eudralex Vol 4) | eu-gmp/ | 32 | ✅ output-v3 + v4 | 80% | Chapters + Annexes. Annex 1 deep in v4 |
| EU Legislation | regulations-eu/ | 8 | ✅ output-v3 | 75% | Directive 2001/83, Reg 726/2004, etc. |
| Biosimilar Guidelines | biosimilar-guidelines/ | 5 | ❌ NOT EXTRACTED | — | **Needs swarm processing** |

### EU — Known Missing Documents (not yet in corpus)
- **Annex I to Directive 2001/83/EC** — THE dossier structure definition. CRITICAL.
- EMA Quality guidelines (~40 more): stability, nitrosamines, extractables/leachables, process validation
- EMA Safety guidelines (~15 more)
- EMA Efficacy/Clinical guidelines (~60 more): therapeutic area-specific
- CMDh procedural guidance (~30 docs)
- QRD templates (SmPC, Package Leaflet)
- EMA GVP Modules XI, XII, XIII, XIV (we have ~12 of 16)
- European Pharmacopoeia — **paywalled**

---

## Japan (PMDA) Sources

| Category | Source Folder | Files | Rules Extracted? | Confidence | Notes |
|----------|-------------|-------|-----------------|------------|-------|
| PMDA Guidelines (Batch 1) | pmda-guidelines/ | 7 | ✅ output-v3 | 60% | Broad Japan extraction |
| PMDA Guidelines (Batch 2) | pmda-guidelines-v2/ | 12 | ❌ NOT EXTRACTED | — | **Needs swarm processing** |
| Japanese Pharmacopoeia | pmda-guidelines/ | 1 | ⚠️ SHALLOW | 30% | JP18 present but huge, needs targeted extraction |

### Japan — Known Missing Documents (not yet in corpus)
- MHLW Ministerial Ordinances (GMP Ord 179, GCP Ord 28, GVP Ord 135)
- PMDA Administrative Notices (事務連絡) — ~40-50 critical ones
- Module 1.12 Japan-specific CTD requirements
- Ethnic bridging study detailed guidance (beyond ICH E5)
- SAKIGAKE/Conditional Approval framework (full set)
- PMDA consultation process guidance

---

## Canada (Health Canada) Sources

| Category | Source Folder | Files | Rules Extracted? | Confidence | Notes |
|----------|-------------|-------|-----------------|------------|-------|
| Health Canada Guidance | health-canada/ | 14 | ✅ output-v3 | 60% | Mix of PDF + saved HTML |
| Food & Drug Act + Regulations | health-canada/ | 2 PDF | ✅ output-v3 | 65% | Act + full regulations |

### Canada — Known Missing Documents (not yet in corpus)
- HC Drug Submission guidance documents (~100+ total, we have ~10)
- Product Monograph template and guidance — CRITICAL for Canadian filing
- NOC/c (Notice of Compliance with conditions) guidance
- Priority Review pathway guidance
- Post-NOC changes guidance (Canadian SUPAC equivalent)
- Drug Identification Number guidance
- C.08 Division 8 detailed requirements

---

## Specialty / Cross-Cutting Sources

| Category | Source Folder | Files | Rules Extracted? | Confidence | Notes |
|----------|-------------|-------|-----------------|------------|-------|
| Gene Therapy (FDA + EMA) | gap-fill/ | ~20 | ⚠️ SHALLOW | 50% | Referenced in gap-close work |
| Vaccines (FDA + WHO) | gap-fill/ | ~10 | ⚠️ SHALLOW | 50% | Referenced in gap-close work |
| eCTD Specifications | ectd-specs/ | 3 | ⚠️ SHALLOW | 40% | May be in v2 multidisciplinary |
| WHO Guidelines | who-guidelines/ + v2 | 7 | ✅ output-v3 | 65% | WHO reqs extracted |

---

## Processing Status Summary

| Status | Documents | % of Corpus |
|--------|-----------|-------------|
| ✅ **DEEP verified (100%)** | ~5 (S7A, S7B, E14, M3(R2), E14/S7B Q&As) | <1% |
| ✅ **Extracted with rules (v4, good confidence)** | ~160 | 22% |
| ✅ **Extracted but shallow (v2/v3, broad passes)** | ~40 | 5% |
| ❌ **In corpus, NOT extracted** | ~130 | 18% |
| ❌ **NOT in corpus, identified as needed** | ~400+ | 54% |
| **TOTAL needed for full coverage** | ~737+ | 100% |

---

## What This Swarm Will Process

Documents in corpus with NO extracted rules (priority order):

1. **fda-guidance-v2/** — 72 FDA guidances (highest ROI)
2. **ema-guidelines-v2/** — 41 EMA scientific guidelines (21 new today)
3. **pmda-guidelines-v2/** — 12 PMDA guidances
4. **biosimilar-guidelines/** — 5 EMA biosimilar guidelines
5. **fda-cber/** — 3 CBER biologics guidances
6. **ich-complete/** — ~10 ICH guidelines confirmed not extracted (E2B(R3), E22, Q13, Q14, plus re-extract shallow ones: E2E, E2F, E12, S2, S3, S9, S10)
7. **gap-fill/** — 30 specialty docs (verify what was extracted vs not)

**Total for this swarm: ~173 documents**
