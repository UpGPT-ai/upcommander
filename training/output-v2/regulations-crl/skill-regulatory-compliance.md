# SKILL: Regulatory Compliance Checker

## Purpose

Check pharmaceutical submission compliance against US (FDA), EU (EMA), and Japan (PMDA) regulatory requirements. This skill validates eCTD submissions for completeness, cross-references between modules for consistency, and identifies potential deficiencies before filing based on analysis of 419 Complete Response Letters and the complete 21 CFR Title 21 regulations.

## When to Use

- Before filing an NDA, BLA, ANDA, MAA, or JNDA
- During eCTD assembly to validate module completeness
- When preparing responses to Complete Response Letters
- During regulatory strategy planning for multi-jurisdiction submissions
- When evaluating CMC changes for correct supplement category

## Compliance Check Framework

### Level 1: Structural Completeness (Fully Automatable)

These checks verify that required eCTD sections and documents exist. They catch the most common CRL deficiency categories (labeling = 92.7% of CRLs, safety update = 75.4%).

#### Module 1 — Administrative
- [ ] **Labeling (21 CFR 201.56/201.57):** Verify PI contains all 17 required sections per 201.57(c)
- [ ] **HOPI format:** Boxed warning summary <= 20 lines; Recent Major Changes within 12 months; revision date present
- [ ] **Container/carton labeling (21 CFR 201.10/201.17):** Manufacturer name, NDC, expiration date, lot number present
- [ ] **Bar code (21 CFR 201.25):** NDC bar code present meeting EAN/UCC or HIBCC standards
- [ ] **Medication Guide (21 CFR 208):** Present if product has REMS with MedGuide requirement
- [ ] **Financial disclosure (21 CFR Part 54):** Certification or disclosure for each clinical investigator
- [ ] **Patent certifications (21 CFR 314.52):** All Orange Book patents addressed (ANDA only)
- [ ] **User fee payment:** PDUFA/GDUFA fee confirmed
- [ ] **Environmental assessment or exclusion:** Per 21 CFR 25.40

#### Module 2 — Summaries
- [ ] **2.2 Introduction:** Product name, pharmacologic class, proposed indication, dosage form
- [ ] **2.3 Quality Overall Summary:** Present and consistent with Module 3 data
- [ ] **2.4 Nonclinical Overview:** Present and consistent with Module 4 data
- [ ] **2.5 Clinical Overview:** Present and consistent with Module 5 data
- [ ] **2.6 Nonclinical Written/Tabulated Summaries:** All subsections populated
- [ ] **2.7 Clinical Summary:** All subsections populated (2.7.1-2.7.6)

#### Module 3 — Quality
- [ ] **3.2.S Drug Substance:** Characterization, manufacturing, controls, stability data present
- [ ] **3.2.P Drug Product:** Description, development, manufacturing, controls, stability present
- [ ] **3.2.P.7 Container closure:** Extraction/leachable data present for high-risk routes (injection, inhalation)
- [ ] **3.2.P.8 Stability:** Minimum 3 batches, 12-month long-term data (25C/60%RH), 6-month accelerated (40C/75%RH)
- [ ] **Process validation:** PPQ report present (FDA Process Validation Guidance Stage 2)

#### Module 4 — Nonclinical
- [ ] **Safety pharmacology core battery (ICH S7A):** CNS, cardiovascular, respiratory studies present
- [ ] **Genotoxicity standard battery (ICH S2):** Bacterial reverse mutation + in vitro chromosome aberration + in vivo micronucleus
- [ ] **Carcinogenicity (ICH S1):** Required if treatment duration > 6 months; apply decision tree
- [ ] **Reproductive toxicity (ICH S5):** Required unless waived based on indication/population
- [ ] **GLP compliance statements (21 CFR Part 58):** Present for each pivotal nonclinical study

#### Module 5 — Clinical
- [ ] **Safety update (21 CFR 314.50(d)(5)(vi)(b)):** Present — required in 75.4% of CRLs
- [ ] **Adequate and well-controlled studies (21 CFR 314.126):** At least 2 pivotal studies present
- [ ] **Bioequivalence (ANDA, 21 CFR 320):** BE studies for all proposed strengths
- [ ] **Food effect study:** Present for all oral dosage forms
- [ ] **QT/TQT study or concentration-QT analysis (ICH E14):** Present or waiver justified
- [ ] **Drug-drug interaction studies:** Present per metabolic pathway (check CYP profile vs. required DDI list)
- [ ] **Renal impairment study:** Present if >= 30% renal elimination
- [ ] **Hepatic impairment study:** Present if hepatically metabolized
- [ ] **Pediatric data or iPSP/waiver/deferral (PREA):** Documented per 21 CFR 314.55

### Level 2: Cross-Reference Consistency (Partially Automatable)

These checks detect inconsistencies between eCTD modules — the second highest-value automated check after completeness.

- [ ] **Module 2 summaries vs. Module 3/4/5 data:** Verify numbers, conclusions, and claims in summaries match source data
- [ ] **Stability claims vs. data:** Proposed shelf life in labeling must not exceed longest duration supported by stability data
- [ ] **Specifications in Module 3 vs. analytical results:** Verify all specification parameters have corresponding validated methods
- [ ] **Dose strengths in Module 3 vs. BE studies in Module 5:** Each strength either has BE data or valid biowaiver justification
- [ ] **Adverse events in clinical summaries vs. PI labeling:** Verify all significant AEs from Module 5 are reflected in PI Sections 5 (Warnings), 6 (Adverse Reactions)
- [ ] **Drug interactions in Module 5 vs. PI Section 7:** DDI study results reflected in labeling
- [ ] **Nonclinical findings in Module 4 vs. PI Section 13:** Carcinogenicity, genotoxicity, fertility results reflected
- [ ] **Clinical pharmacology data vs. PI Section 12:** PK parameters (Cmax, AUC, t1/2, Vd, CL) consistent

### Level 3: Jurisdiction-Specific Compliance

#### US FDA
- [ ] PI format: 17-section Highlights + FPI per 21 CFR 201.57
- [ ] eCTD v4.0 format per 21 CFR 314.50/601.14
- [ ] PREA compliance: iPSP filed 60 days after EOP2 or 210 days before NDA
- [ ] BE standard: 90% CI within 80-125% (NTI: 90-111.11%)
- [ ] BCS biowaiver: Class I only (Class III requires in vivo BE)
- [ ] No REMS required OR REMS with required elements submitted
- [ ] NDA/BLA supplement categories per 21 CFR 314.70/601.12

#### EU EMA
- [ ] SmPC format: 12-section QRD template
- [ ] Patient Information Leaflet (PIL) included separately
- [ ] Risk Management Plan (RMP) mandatory for all biologics
- [ ] Paediatric Investigation Plan (PIP) approved by PDCO before MAA
- [ ] BE standard: Same 80-125% but BCS Class III biowaiver accepted
- [ ] NTID: 90-111.11% for AUC; Cmax if clinically relevant
- [ ] HVDP: Scaled average BE with replicate crossover up to 69.84-143.19% for Cmax
- [ ] EMA variation classification for post-approval changes

#### Japan PMDA
- [ ] Japanese Package Insert (JPI) format per MHLW notification
- [ ] Foreign manufacturer accreditation (PAL Art. 13-3) current and valid
- [ ] Ethnic bridging study (ICH E5) present if clinical data predominantly from non-Japanese populations
- [ ] Japan-specific PK data in Japanese subjects (frequently required by PMDA)
- [ ] Drug use results survey plan for re-examination period
- [ ] CTD-JP Module 1 format requirements met
- [ ] Stability data covering appropriate ICH climate zones

### Level 4: CRL Risk Assessment (Expert Judgment Required)

Based on the 419-CRL deficiency database, these are the highest-risk areas requiring expert review:

| Risk Area | CRL Frequency | Expert Needed |
|-----------|--------------|---------------|
| Labeling format | 92.7% | Regulatory Affairs |
| Facility/GMP compliance | 44.5% | Quality/Manufacturing |
| CMC adequacy | 39.9% | CMC Reviewer |
| Clinical efficacy | 20.2% | Clinical/Medical |
| Nonclinical completeness | 12.2% | Toxicologist |
| Bioequivalence design | 8.0% | Clinical Pharmacologist |
| Clinical pharmacology | 5.1% | Clinical Pharmacologist |
| Human factors | 3.2% | Human Factors Engineer |

## Key Regulatory Timelines

| Event | Deadline | Authority |
|-------|----------|-----------|
| IND safety report (serious/unexpected) | 15 calendar days | 21 CFR 312.32 |
| IND safety report (fatal/life-threatening) | 7 calendar days | 21 CFR 312.32 |
| CRL response deadline | 1 year from CRL issuance | 21 CFR 314.110/601.3 |
| Annual report | 60 days from approval anniversary | 21 CFR 314.81 |
| Postmarketing study progress report | 60 days from approval anniversary | 21 CFR 601.70 |
| Manufacturing discontinuance notice | 6 months prior (or 5 business days) | 21 CFR 600.82 |
| Biologic product deviation report | 45 calendar days | 21 CFR 600.14 |
| Postmarketing AE (serious/unexpected) | 15 calendar days | 21 CFR 600.80/310.305 |
| iPSP submission (PREA) | 60 days after EOP2 | FD&C Act 505B(e) |
| FDA iPSP response | 90 calendar days | FD&C Act 505B(e) |
| Breakthrough Therapy designation response | 60 calendar days | FD&C Act 506(a) |
| Priority Review clock | 6 months | PDUFA |
| Standard Review clock | 10 months | PDUFA |
| Japan manufacturer change notification | 30 days | PAL Art. 100 |
| Japan manufacturer accreditation renewal | 5 years | PAL Art. 13-3 |

## Key Acceptance Criteria Quick Reference

### Bioequivalence
| Parameter | FDA | EMA | PMDA |
|-----------|-----|-----|------|
| Standard (AUC, Cmax) | 80-125% | 80-125% | 80-125% |
| NTI drugs | 90-111.11% | 90-111.11% | Case-by-case |
| HVDP (CV>=30%) | Reference-scaled | Scaled (up to 69.84-143.19%) | Standard 80-125% |
| Min subjects | 12 | 12 | Not specified |
| BCS Class III biowaiver | No (restricted) | Yes (with conditions) | Case-by-case |

### Stability (ICH Q1A)
| Study | Conditions | Min Duration |
|-------|-----------|-------------|
| Long-term | 25C/60%RH or 30C/65%RH | 12 months |
| Accelerated | 40C/75%RH | 6 months |
| Intermediate | 30C/65%RH | 6 months (if triggered) |
| Significant change | 5% assay loss, or degradation product > criterion | — |
| Batches | 3 minimum (2 pilot + 1 smaller acceptable) | — |

### Dissolution (BCS Biowaiver)
| Parameter | Criterion |
|-----------|----------|
| Very rapid dissolution | >= 85% in 15 min at pH 1.2, 4.5, 6.8 |
| Rapid dissolution | >= 85% in 30 min |
| Profile similarity (f2) | >= 50 |
| BCS Class I waiver | Very rapid dissolution at all 3 pH values |

### Analytical Validation
| Parameter | Criterion |
|-----------|----------|
| LOD | S/N >= 3:1 |
| LOQ | S/N >= 10:1 |
| Linearity | Min 5 levels; r-squared >= 0.999 |
| Accuracy | % recovery within predefined limits |

### Immunogenicity (Biologics)
| Parameter | Criterion |
|-----------|----------|
| Screening cut point | 95% drug-naive donors negative |
| Testing tiers | Screen -> Confirm -> Titer -> NAb |
| Chronic dosing sampling | Every 3 months minimum |
| Particle concern range | 2-10 micron subvisible |

## Automation Architecture

For integration into the Claude Commander regulatory engine, the following check categories should be implemented:

### Tier 1 — Automated (run on every submission)
```
check_pi_structure()       # 201.57 17-section validation
check_ectd_completeness()  # All required modules present
check_labeling_format()    # Container/carton per 201.10/201.17
check_safety_update()      # 314.50(d)(5)(vi)(b) section present
check_barcode()            # 201.25 NDC bar code
check_patent_certs()       # 314.52 for ANDAs
check_financial_disclosure() # Part 54 for each investigator
check_food_effect_study()  # For oral dosage forms
```

### Tier 2 — Semi-Automated (flag for review)
```
cross_ref_stability_vs_shelf_life()  # Duration >= claimed shelf life
cross_ref_strengths_vs_be()          # All strengths have BE or biowaiver
cross_ref_ae_vs_labeling()           # Module 5 AEs reflected in PI
cross_ref_ddi_vs_cyp_profile()       # Required DDI studies present
check_nonclinical_battery()          # ICH S2/S7/S1 decision trees
check_organ_impairment()             # Renal/hepatic studies per excretion path
check_facility_status()              # 483/PAI status from FDA database
check_pediatric_compliance()         # PREA waiver/deferral/plan
```

### Tier 3 — Expert Queue (route to specialist)
```
review_efficacy_evidence()           # Clinical reviewer
review_risk_benefit()                # Medical officer
review_cmc_adequacy()                # CMC reviewer
review_specifications()              # Analytical chemist
review_gmp_compliance()              # Quality systems expert
review_safety_signals()              # Safety reviewer
review_human_factors()               # HF engineer (combination products)
```

## Data Sources

- **Regulations:** 21 CFR Title 21, Parts 1-99, 200-299, 300-499, 600-799 (Rev. April 1, 2024)
- **EMA Guidelines:** Bioequivalence (CPMP/EWP/QWP/1401/98 Rev.1), Biosimilars (EMEA/CHMP/BMWP/42832/2005 Rev1)
- **PMDA Guidelines:** Foreign manufacturer accreditation, ICH S1 carcinogenicity, ICH E16 biomarkers, orphan drug framework
- **FDA Guidance:** Stability (ICH Q1A), Container closure, Process validation, Analytical validation, Dissolution, Immunogenicity, Bioequivalence, Adaptive designs, Pediatric study plans, Expedited programs
- **CRL Database:** 419 Complete Response Letters (2002-2026), 411 CRLs analyzed, 10 deficiency categories, 41 sub-types identified
