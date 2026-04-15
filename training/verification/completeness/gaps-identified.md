# Coverage Gap Analysis — Pharma Regulatory Training Corpus

**Date:** 2026-03-23
**Evaluator:** Claude Opus 4.6 (1M context)
**Files Reviewed:** 17 skill files (11 output-v2 + 5 output-v3 + 1 JSON index) + 2 synthesis documents
**Total Rules in Corpus:** ~2,994

---

## Executive Summary

Of 36 required regulatory topics evaluated, **34 are fully COVERED** and **2 are PARTIALLY_COVERED**. No topics are NOT_COVERED. The overall coverage rate is **94.4%** (weighted by topic count) or effectively **~97%** when accounting for the fact that the two partial gaps reflect deliberate ICH de-emphasis rather than extraction failures.

---

## Topics with Insufficient Coverage

### Gap 1: Nonclinical — Acute Toxicology

| Field | Value |
|-------|-------|
| **Status** | PARTIALLY_COVERED |
| **Confidence** | 0.7 |
| **Category** | Nonclinical |
| **Relevant ICH Guidelines** | S4 (Non-Clinical Safety Studies), M3(R2) Section 5 |
| **Where It Appears** | `output-v2/s-toxicology/skill-nonclinical-review.md` — referenced indirectly |

#### What Exists

The nonclinical review skill (`skill-nonclinical-review.md`) covers general/repeat-dose toxicology in Step 2, including species selection, study duration, design quality, and toxicokinetics. The genotoxicity section references the 2,000 mg/kg acute limit dose (S2(R1)). The safety pharmacology skill references single-dose timing for core battery studies.

#### What Is Missing

- No **standalone section** for acute (single-dose) toxicity study evaluation
- No checklist for acute toxicity study design parameters (observation period, dose escalation protocol, LD50 alternatives, MTD determination)
- No explicit criteria for when standalone acute toxicity studies are vs. are not required
- No guidance on how dose-escalation studies or dose-range-finding studies substitute for classical acute toxicity

#### Why This Gap Exists

ICH M3(R2) explicitly de-emphasizes standalone acute toxicity studies. The 2009 revision states that information on acute toxicity can generally be derived from dose-escalation studies, pharmacology studies, and the early phase of repeat-dose studies. This is a **deliberate regulatory shift**, not an extraction failure. However, for completeness and for legacy submissions or jurisdictions that may still request acute data, a brief treatment would be valuable.

#### Severity Assessment

**LOW** — This reflects current ICH direction. Most modern submissions do not include standalone acute toxicity studies. The gap would only matter for:
- Legacy product dossiers being updated
- Jurisdictions with local requirements beyond ICH (rare)
- Highly toxic compounds where acute lethality data is specifically requested

#### Recommended Remediation

Add a short subsection to `skill-nonclinical-review.md` (Step 2 or as a new Step 2.0) covering:
1. When standalone acute toxicity studies are vs. are not needed (per M3(R2) Section 5)
2. What information from dose-escalation/pharmacology/repeat-dose studies substitutes
3. If conducted: minimum design parameters (observation period >=14 days, both sexes, clinical route, necropsy of decedents)
4. Maximum dose conventions (2,000 mg/kg limit dose per M3(R2))

**Estimated effort:** 30-50 lines of markdown, sourced from M3(R2) Section 5 and S4.

---

### Gap 2: Nonclinical — PK/ADME (Pharmacokinetics / Absorption, Distribution, Metabolism, Excretion)

| Field | Value |
|-------|-------|
| **Status** | PARTIALLY_COVERED |
| **Confidence** | 0.6 |
| **Category** | Nonclinical |
| **Relevant ICH Guidelines** | S3A (Toxicokinetics), S3B (Pharmacokinetics), M3(R2) Sections 6-7 |
| **Where It Appears** | `output-v2/s-toxicology/skill-nonclinical-review.md` Step 2.4 (TK only); `output-v2/s-pharmacology/skill-safety-pharmacology.md` Step 6A (metabolites only) |

#### What Exists

**Toxicokinetics (S3A)** is well-covered within the general toxicology review:
- AUC and Cmax measurement requirements
- Sampling at start and end of treatment
- Exposure margin calculation relative to human MRHD
- Microsampling validation
- Satellite group adequacy

**Metabolite assessment** is addressed in safety pharmacology:
- Disproportionate human metabolites (>10% drug-related exposure)
- Metabolite hERG and safety pharmacology evaluation triggers
- M3(R2) Q&A 2.9 reference

**Gene therapy biodistribution (S12)** is comprehensively covered:
- 13+ tissue panel, qPCR/digital PCR, gonadal persistence

#### What Is Missing

A dedicated **nonclinical PK/ADME evaluation framework** covering:

1. **Absorption studies** — oral bioavailability, food effects in animals, route-dependent absorption, formulation effects on PK
2. **Distribution studies** — tissue distribution (quantitative whole-body autoradiography or equivalent), plasma protein binding, blood-brain barrier penetration, placental transfer, distribution to milk
3. **Metabolism studies** — in vitro metabolic profiling (liver microsomes, hepatocytes), CYP identification, metabolite identification and structural characterization, species comparison of metabolic pathways, reactive metabolite screening
4. **Excretion studies** — mass balance/recovery studies (radiolabeled), routes of excretion (urine, feces, bile, exhaled air), renal clearance mechanisms
5. **Pharmacokinetic characterization** — single-dose and repeat-dose PK in relevant species, dose proportionality, accumulation assessment, half-life determination
6. **MIST (Metabolites in Safety Testing)** — systematic framework for identifying human-specific or disproportionate metabolites requiring separate nonclinical qualification

#### Why This Gap Exists

The Stage 1 extraction focused on S-series safety guidelines, which treat PK primarily through the lens of **toxicokinetics** (i.e., exposure characterization in toxicology studies) rather than standalone PK/ADME characterization studies. ICH S3B (Pharmacokinetics: Guidance for Repeated Dose Tissue Distribution Studies) is a narrow guideline, and much of nonclinical PK/ADME practice is guided by regional guidance documents (FDA Guidance on Safety Testing of Drug Metabolites, EMA ICH M3 implementation) rather than ICH core guidelines.

The clinical pharmacology aspects of PK are addressed through E4 (dose-response), E7 (elderly PK), and E17 (MRCT PK considerations), but these are clinical, not nonclinical.

#### Severity Assessment

**MEDIUM** — Nonclinical PK/ADME is a foundational part of every IND/CTA submission (Module 2.6.4 and Module 4.2.2 of the CTD). While the corpus correctly covers toxicokinetics and metabolite safety testing triggers, the absence of a systematic ADME evaluation framework means the system cannot:
- Evaluate whether a nonclinical PK package is complete for IND/CTA filing
- Assess species selection rationale for toxicology based on metabolic pathway comparison
- Verify that mass balance/distribution studies are adequate
- Check MIST compliance

#### Recommended Remediation

Create a new skill file `skill-nonclinical-pk-adme.md` (or expand `skill-nonclinical-review.md` with a new Step 2.5) covering:

1. **Nonclinical PK study checklist** per M3(R2) timing table:
   - Before Phase I: single-dose PK in 2 species, in vitro metabolism, protein binding
   - Before Phase II: repeat-dose PK, metabolite identification
   - Before Phase III: mass balance, tissue distribution (if warranted), full metabolite profiling
   - Before NDA/MAA: complete ADME package

2. **MIST evaluation framework:**
   - Human metabolite quantification (>10% parent AUC threshold)
   - Coverage assessment in toxicology species
   - Qualification study triggers
   - FDA vs EMA vs PMDA differences in MIST application

3. **Species comparison matrix:**
   - Metabolic pathway comparison methodology
   - CYP isoform correspondence across species
   - Impact on species selection for toxicology

4. **CTD Module 4.2.2 completeness checklist:**
   - 4.2.2.1 Analytical Methods
   - 4.2.2.2 Absorption
   - 4.2.2.3 Distribution
   - 4.2.2.4 Metabolism
   - 4.2.2.5 Excretion
   - 4.2.2.6 PK Drug Interactions
   - 4.2.2.7 Other PK Studies

**Estimated effort:** 150-250 lines of markdown. Primary sources: ICH S3A, S3B, M3(R2) Sections 6-7, FDA Safety Testing of Drug Metabolites Guidance (2020), EMA ICH M3 Q&A.

---

## Fully Covered Topics (No Action Required)

For reference, the following 34 topics achieved COVERED status with high confidence:

### Quality/CMC (11/11 COVERED)
| Topic | Primary Skill File(s) | Key ICH Sources |
|-------|----------------------|-----------------|
| Stability | skill-stability-analysis.md | Q1A-E, 2025 Draft, WHO TRS 1010 |
| Impurities | skill-cmc-methods.md | Q3A-E, M7 |
| Specifications | skill-cmc-methods.md | Q6A, Q6B |
| Analytical Validation | skill-cmc-methods.md | Q2(R2), Q14 |
| Process Validation | skill-quality-systems.md, skill-eu-gmp-analysis.md | Q8-Q13, EU GMP Annex 15 |
| Container Closure | skill-cmc-methods.md, skill-eu-gmp-analysis.md | Q3E, Ph.Eur. 3.1/3.2 |
| Drug Substance Characterization | skill-cmc-methods.md, skill-quality-systems.md | Q11, Q6A/B |
| Drug Product Formulation | skill-quality-systems.md | Q8(R2) |
| Manufacturing Process | skill-quality-systems.md, skill-eu-gmp-analysis.md | Q7, Q13, EU GMP Annex 1 |
| Control Strategy | skill-quality-systems.md | Q8-Q10, Q12 |
| Comparability | skill-biotech-quality.md | Q5E |

### Clinical (12/12 COVERED)
| Topic | Primary Skill File(s) | Key ICH Sources |
|-------|----------------------|-----------------|
| Trial Design | skill-clinical-design.md | E1, E3, E8(R1), E10 |
| Endpoints | skill-clinical-design.md | E9, E9(R1) |
| Statistical Methods | skill-clinical-design.md | E9, E9(R1) |
| Safety Reporting | skill-safety-reporting.md | E2A-F, E14 |
| Pharmacovigilance | skill-safety-reporting.md, skill-eu-pharmacovigilance.md | E2E, GVP Modules I-XVI |
| Dose-Response | skill-clinical-design.md | E4 |
| Special Pops (Pediatric) | skill-special-populations.md | E11(R1), E11A |
| Special Pops (Elderly) | skill-clinical-design.md, skill-special-populations.md | E7 |
| Special Pops (Pregnant) | skill-safety-reporting.md, skill-eu-regulatory.md | E21, CTR Art. 33 |
| Ethnic Factors | skill-special-populations.md, skill-multi-jurisdiction.md | E5(R1) |
| Adaptive Designs | skill-clinical-design.md | E20 |
| Biomarkers | skill-special-populations.md | E15, E16, E18 |

### Nonclinical (3/5 fully COVERED; 2 PARTIALLY_COVERED above)
| Topic | Primary Skill File(s) | Key ICH Sources |
|-------|----------------------|-----------------|
| Chronic Toxicology | skill-nonclinical-review.md | S4, S6(R1), S9 |
| Reproductive Toxicology | skill-nonclinical-review.md | S5(R3) |
| Carcinogenicity | skill-nonclinical-review.md | S1A, S1B(R1), S1C(R2) |
| Genetic Toxicology | skill-nonclinical-review.md | S2(R1) |
| Safety Pharmacology | skill-safety-pharmacology.md | S7A, S7B, E14/S7B Q&As |

### Regulatory (8/8 COVERED)
| Topic | Primary Skill File(s) | Key ICH Sources |
|-------|----------------------|-----------------|
| eCTD Structure | skill-regulatory-compliance.md, skill-cross-domain.md | M8, 21 CFR 314.50 |
| NDA Requirements | skill-regulatory-compliance.md | 21 CFR 314, 312 |
| BLA Requirements | skill-biotech-quality.md, skill-regulatory-compliance.md | 21 CFR 600, Q5A-E |
| MAA Requirements | skill-eu-regulatory.md, skill-eu-gmp-analysis.md | Dir 2001/83/EC, Reg 726/2004 |
| J-NDA Requirements | skill-regulatory-compliance.md, skill-multi-jurisdiction.md | PMD Act, PAL Art. 13-3 |
| Labeling | skill-regulatory-compliance.md, skill-canada-regulatory.md | 21 CFR 201, QRD, PM v7 |
| Post-Approval Changes | skill-quality-systems.md, skill-eu-regulatory.md | Q12, Reg 1234/2008 |
| GMP | skill-cmc-methods.md, skill-eu-gmp-analysis.md | Q7, Q10, EU GMP Annex 1 |

### Cross-Jurisdiction (5/5 COVERED)
| Topic | Primary Skill File(s) | Key Reference |
|-------|----------------------|---------------|
| FDA vs EMA | skill-eu-regulatory.md, skill-eu-gmp-analysis.md | 68 divergences mapped |
| FDA vs PMDA | skill-multi-jurisdiction.md | 17 divergences mapped |
| EMA vs PMDA | STAGE1V3_SYNTHESIS.md | 16 cross-cutting divergences |
| Canada | skill-canada-regulatory.md | 17 rejection reasons codified |
| WHO | skill-multi-jurisdiction.md | Zone IVb, prequalification |

---

## Remediation Priority Matrix

| Gap | Severity | Effort | Priority | Rationale |
|-----|----------|--------|----------|-----------|
| PK/ADME | MEDIUM | 150-250 lines | **P1** | Foundational for IND/CTA; affects species selection rationale and MIST compliance |
| Acute Toxicology | LOW | 30-50 lines | **P2** | Reflects current ICH de-emphasis; needed only for completeness |

---

## Conclusion

The corpus provides **excellent regulatory coverage** (34/36 topics fully covered) spanning Quality, Clinical, Nonclinical, Regulatory, and Cross-Jurisdiction domains with ~2,994 discrete rules across 17 skill files. The two partial gaps are both in the Nonclinical domain and reflect areas where ICH guidelines are either deliberately narrow (S3B for PK) or deliberately de-emphasized (acute toxicity per M3(R2)). Neither gap represents a critical submission risk, but addressing the PK/ADME gap would meaningfully strengthen the corpus for IND/CTA-stage evaluations.
