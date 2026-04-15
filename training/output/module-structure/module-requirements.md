# ICH eCTD Module Structure — Exhaustive Requirements Map

**Source Documents:** ICH M4 (Organisation), M4Q(R1) (Quality), M4S(R2) (Safety), M4E(R2) (Efficacy)
**eCTD Versions:** v3.2.2 and v4.0
**Extraction Date:** 2026-03-22

---

## Table of Contents

- [Format Requirements](#format-requirements)
- [Module 1 — Regional Administrative Information](#module-1--regional-administrative-information)
- [Module 2 — CTD Summaries](#module-2--ctd-summaries)
- [Module 3 — Quality](#module-3--quality)
- [Module 4 — Nonclinical Study Reports](#module-4--nonclinical-study-reports)
- [Module 5 — Clinical Study Reports](#module-5--clinical-study-reports)
- [Global Cross-Reference Map](#global-cross-reference-map)

---

## Format Requirements

| Requirement | Specification |
|---|---|
| Paper size | A4 or 8.5 × 11 inches |
| Font | Times New Roman, minimum 12 point |
| Margins | Sufficient for readability |
| Page numbering | Sequential within each section/volume |
| Orientation | Portrait preferred; landscape for wide tables |
| Pagination | Each Module 2–5 section starts on a new page |
| TOC | Required for each module, generated per module |
| Citation format | ICMJE (Vancouver) style, sequential as they appear |
| Tables/Figures | Embedded in text; lengthy tables in appendix at end of section |

### Species Ordering (for Modules 4 and 2.6)

Mouse → Rat → Hamster → Other Rodent → Rabbit → Dog → Non-human Primate → Other Non-rodent → Non-mammals

### Route Ordering (for Modules 4 and 2.6)

Intended clinical route (first) → Oral → IV → IM → IP → SC → Inhalation → Topical → Other

### eCTD v4 Keywords

| Keyword | Purpose | Sections Affected |
|---|---|---|
| `substance` | Identifies drug substance (INN/code) | 3.2.S, 2.3.S |
| `manufacturer` | Identifies manufacturer | 3.2.S, 3.2.P |
| `product` | Identifies drug product | 3.2.P, 2.3.P |
| `dosage_form` | Identifies dosage form | 3.2.P |
| `excipient` | Optional; identifies excipient | 3.2.P.4, 3.2.A.3 |
| `descriptor` | Optional; differentiates stability data | 3.2.S.7.3, 3.2.P.8.3 |
| `container` | Optional; per container closure system | 3.2.P.7 |
| `facility` | Optional; per manufacturing site | 2.3.A.1, 3.2.A.1 |
| `component` | Optional; per drug substance component | 2.3.A.2, 3.2.A.2 |

---

## Module 1 — Regional Administrative Information

**Not harmonised.** Structure defined by each regional authority (FDA, EMA, PMDA).

| Section | Title |
|---|---|
| 1.0 | Cover Letter |
| 1.1 | Comprehensive Table of Contents |
| 1.2 | Application Form(s) |
| 1.3 | Product Information (1.3.1 Prescribing Info, 1.3.2 Patient Info, 1.3.3 Labelling, 1.3.4 Sample Labels) |
| 1.4 | Information on Experts / Certifications |
| 1.5 | Region-Specific Requirements |

---

## Module 2 — CTD Summaries

The central review module. Contains overviews and summaries of Modules 3, 4, and 5.

### 2.1 CTD Table of Contents
Complete TOC for Modules 2–5 with page references.

### 2.2 CTD Introduction
- Pharmacological class, mode of action, proposed clinical use

### 2.3 Quality Overall Summary (QOS)

Summarises Module 3. Each subsection must cross-reference the corresponding 3.2.X section.

**ICH Guidelines Referenced:** Q1A, Q1B, Q2, Q3A–D, Q5A–D, Q6A–B, Q8–Q12

#### Drug Substance (2.3.S)

| Section | Title | Key Data Elements |
|---|---|---|
| 2.3.S.1 | General Information | Nomenclature, structure, general properties |
| 2.3.S.2 | Manufacture | Manufacturer, process, materials, controls, validation |
| 2.3.S.3 | Characterisation | Structure elucidation, impurities |
| 2.3.S.4 | Control of Drug Substance | Specification, analytical procedures, validation, batch analyses, justification |
| 2.3.S.5 | Reference Standards | Primary/secondary reference standards |
| 2.3.S.6 | Container Closure System | Description, suitability |
| 2.3.S.7 | Stability | Summary, post-approval protocol, data |

#### Drug Product (2.3.P)

| Section | Title | Key Data Elements |
|---|---|---|
| 2.3.P.1 | Description and Composition | Dosage form, composition table, container/closure |
| 2.3.P.2 | Pharmaceutical Development | Components, formulation, process development, container, micro, compatibility |
| 2.3.P.3 | Manufacture | Manufacturer, batch formula, process, controls, validation |
| 2.3.P.4 | Control of Excipients | Specifications, analytical procedures, human/animal origin, novel excipients |
| 2.3.P.5 | Control of Drug Product | Specification, analytical procedures, validation, batches, impurities, justification |
| 2.3.P.6 | Reference Standards | Reference standards for product testing |
| 2.3.P.7 | Container Closure System | Description, suitability studies |
| 2.3.P.8 | Stability | Summary, post-approval protocol, data |

#### Appendices (2.3.A)

| Section | Title |
|---|---|
| 2.3.A.1 | Facilities and Equipment |
| 2.3.A.2 | Adventitious Agents Safety Evaluation |
| 2.3.A.3 | Excipients |

#### 2.3.R — Regional Information

**Cross-references:** 2.3.S.x → 3.2.S.x, 2.3.P.x → 3.2.P.x, 2.3.A.x → 3.2.A.x (all mandatory)

---

### 2.4 Nonclinical Overview

Interpretive narrative (not a data summary). Content sequence:

1. Overview of nonclinical testing strategy
2. Pharmacology
3. Pharmacokinetics
4. Toxicology
5. Integrated overview and conclusions
6. List of literature references

**Cross-references:**
- 2.4 → 2.6 (Written/Tabulated Summaries) — mandatory
- 2.4 → Module 4 (Study Reports) — mandatory
- 2.4 (impurities discussion) → 2.3/Module 3 (Quality) — conditional

---

### 2.5 Clinical Overview

Critical analysis providing benefit-risk perspective.

| Section | Title | Key Data Elements |
|---|---|---|
| 2.5.1 | Product Development Rationale | Pharmacological class, indication, regulatory history, GCP compliance |
| 2.5.2 | Overview of Biopharmaceutics | Formulation development, BA data, dissolution, clinical vs marketed formulation |
| 2.5.3 | Overview of Clinical Pharmacology | PK, PD, PK/PD relationships, immunogenicity |
| 2.5.4 | Overview of Efficacy | Study designs, endpoints, efficacy results, dose-response, subgroup analyses |
| 2.5.5 | Overview of Safety | Exposure, AEs, deaths/SAEs, interactions, special populations, overdose, abuse |
| 2.5.6 | Benefits and Risks Conclusions | — |
| 2.5.6.1 | Context for Assessment | 2.5.6.1.1 Disease/Condition, 2.5.6.1.2 Current Therapies |
| 2.5.6.2 | Summary of Benefits | Key efficacy results |
| 2.5.6.3 | Summary of Risks | Key safety findings |
| 2.5.6.4 | Risk Management | REMS, risk mitigation |
| 2.5.6.5 | Conclusions | Overall benefit-risk assessment |
| 2.5.7 | Literature References | All references cited |

**Cross-references:**
- 2.5 → 2.7 (Clinical Summary) — mandatory
- 2.5 → Module 5 (Study Reports) — mandatory
- 2.5.5 → 2.4/Module 4 (Nonclinical) — conditional
- 2.5.5 → 2.3/Module 3 (Quality) — conditional

---

### 2.6 Nonclinical Written and Tabulated Summaries

#### 2.6.1 Introduction
- Drug substance description, pharmacological class, testing strategy

#### 2.6.2 Pharmacology Written Summary

| Section | Title |
|---|---|
| 2.6.2.1 | Brief Summary |
| 2.6.2.2 | Primary Pharmacodynamics |
| 2.6.2.3 | Secondary Pharmacodynamics |
| 2.6.2.4 | Safety Pharmacology (CV, CNS, Respiratory, Other) |
| 2.6.2.5 | Pharmacodynamic Drug Interactions |
| 2.6.2.6 | Discussion and Conclusions |
| 2.6.2.7 | Tables and Figures |

#### 2.6.3 Pharmacology Tabulated Summary

| Section | Title | Tabulated Summary |
|---|---|---|
| 2.6.3.1 | Pharmacology: Overview | Required |
| 2.6.3.2 | Primary Pharmacodynamics | Optional |
| 2.6.3.3 | Secondary Pharmacodynamics | Optional |
| 2.6.3.4 | Safety Pharmacology | Required |
| 2.6.3.5 | Pharmacodynamic Drug Interactions | Optional |

#### 2.6.4 Pharmacokinetics Written Summary

| Section | Title |
|---|---|
| 2.6.4.1 | Brief Summary |
| 2.6.4.2 | Methods of Analysis |
| 2.6.4.3 | Absorption |
| 2.6.4.4 | Distribution |
| 2.6.4.5 | Metabolism |
| 2.6.4.6 | Excretion |
| 2.6.4.7 | Pharmacokinetic Drug Interactions |
| 2.6.4.8 | Other Pharmacokinetic Studies |
| 2.6.4.9 | Discussion and Conclusions |
| 2.6.4.10 | Tables and Figures |

#### 2.6.5 Pharmacokinetics Tabulated Summary

| Section | Title |
|---|---|
| 2.6.5.1 | Overview |
| 2.6.5.2 | Analytical Methods and Validation Reports (optional) |
| 2.6.5.3 | Absorption after a Single Dose |
| 2.6.5.4 | Absorption after Repeated Doses |
| 2.6.5.5 | Organ Distribution |
| 2.6.5.6 | Plasma Protein Binding |
| 2.6.5.7 | Study in Pregnant or Nursing Animals |
| 2.6.5.8 | Other Distribution Study |
| 2.6.5.9 | Metabolism In Vivo |
| 2.6.5.10 | Metabolism In Vitro |
| 2.6.5.11 | Possible Metabolic Pathways |
| 2.6.5.12 | Induction/Inhibition of Drug-Metabolizing Enzymes |
| 2.6.5.13 | Excretion |
| 2.6.5.14 | Excretion into Bile |
| 2.6.5.15 | Drug-Drug Interactions |
| 2.6.5.16 | Other |

#### 2.6.6 Toxicology Written Summary

| Section | Title |
|---|---|
| 2.6.6.1 | Brief Summary |
| 2.6.6.2 | Single-Dose Toxicity |
| 2.6.6.3 | Repeat-Dose Toxicity |
| 2.6.6.4 | Genotoxicity |
| 2.6.6.5 | Carcinogenicity |
| 2.6.6.6 | Reproductive and Developmental Toxicity |
| 2.6.6.7 | Local Tolerance |
| 2.6.6.8 | Other Toxicity Studies (antigenicity, dependence, metabolites, impurities, phototoxicity) |
| 2.6.6.9 | Discussion and Conclusions |
| 2.6.6.10 | Tables and Figures |

#### 2.6.7 Toxicology Tabulated Summary

| Section | Title |
|---|---|
| 2.6.7.1 | Overview |
| 2.6.7.2 | Toxicokinetics: Overview of Studies |
| 2.6.7.3 | Toxicokinetics: Overview of Data |
| 2.6.7.4 | Drug Substance |
| 2.6.7.5 | Single-Dose Toxicity |
| 2.6.7.6 | Repeat-Dose Toxicity: Non-Pivotal |
| 2.6.7.7 | Repeat-Dose Toxicity: Pivotal |
| 2.6.7.8 | Genotoxicity: In Vitro |
| 2.6.7.9 | Genotoxicity: In Vivo |
| 2.6.7.10 | Carcinogenicity |
| 2.6.7.11 | Reproductive/Developmental Toxicity: Non-Pivotal |
| 2.6.7.12 | Repro Tox: Fertility and Early Embryonic Development (Pivotal) |
| 2.6.7.13 | Repro Tox: Embryo-Fetal Development (Pivotal) |
| 2.6.7.14 | Repro Tox: Pre/Postnatal Development incl. Maternal Function (Pivotal) |
| 2.6.7.15 | Studies in Juvenile Animals |
| 2.6.7.16 | Local Tolerance |
| 2.6.7.17 | Other Toxicity Studies |

**Cross-references:**
- 2.6 (all) → Module 4 study reports — mandatory
- 2.6 (impurity qualification) → 2.3/Module 3 — conditional
- Tabulated summaries must include Location in CTD (Vol/Section) per study

---

### 2.7 Clinical Summary

Detailed factual summaries bridging Clinical Overview (2.5) and Module 5.

#### 2.7.1 Summary of Biopharmaceutic Studies

| Section | Title |
|---|---|
| 2.7.1.1 | Background and Overview |
| 2.7.1.2 | Summary of Results of Individual Studies |
| 2.7.1.3 | Comparison and Analyses of Results Across Studies |
| 2.7.1.4 | Appendix (Tables 2.7.1.1, 2.7.1.2) |

#### 2.7.2 Summary of Clinical Pharmacology Studies

| Section | Title |
|---|---|
| 2.7.2.1 | Background and Overview |
| 2.7.2.2 | Summary of Results of Individual Studies |
| 2.7.2.3 | Comparison and Analyses of Results Across Studies |
| 2.7.2.4 | Special Studies (immunogenicity, clinical microbiology) |
| 2.7.2.5 | Appendix (Table 2.7.2.1) |

#### 2.7.3 Summary of Clinical Efficacy

Separate section per indication. Label as "2.7.3 [indication]" when multiple.

| Section | Title |
|---|---|
| 2.7.3.1 | Background and Overview of Clinical Efficacy |
| 2.7.3.2 | Summary of Results of Individual Studies |
| 2.7.3.3 | Comparison and Analyses of Results Across Studies |
| 2.7.3.3.1 | Study Populations |
| 2.7.3.3.2 | Comparison of Efficacy Results of All Studies |
| 2.7.3.3.3 | Comparison of Results in Sub-populations |
| 2.7.3.4 | Analysis of Clinical Information Relevant to Dosing Recommendations |
| 2.7.3.5 | Persistence of Efficacy and/or Tolerance Effects |
| 2.7.3.6 | Appendix (Tables 2.7.3.1, 2.7.3.2) |

#### 2.7.4 Summary of Clinical Safety

| Section | Title |
|---|---|
| **2.7.4.1** | **Exposure to the Drug** |
| 2.7.4.1.1 | Overall Safety Evaluation Plan and Narratives of Safety Studies |
| 2.7.4.1.2 | Overall Extent of Exposure (Table 2.7.4.1) |
| 2.7.4.1.3 | Demographic and Other Characteristics (Table 2.7.4.2) |
| **2.7.4.2** | **Adverse Events** |
| 2.7.4.2.1 | Analysis of Adverse Events |
| 2.7.4.2.1.1 | Common Adverse Events (Tables 2.7.4.3, 2.7.4.4) |
| 2.7.4.2.1.2 | Deaths (Table 2.7.4.6) |
| 2.7.4.2.1.3 | Other Serious Adverse Events |
| 2.7.4.2.1.4 | Other Significant Adverse Events |
| 2.7.4.2.1.5 | Analysis of AEs by Organ System or Syndrome (subsections 2.7.4.2.1.5.1, .2, etc.) |
| 2.7.4.2.2 | Narratives |
| **2.7.4.3** | **Clinical Laboratory Evaluations** |
| **2.7.4.4** | **Vital Signs, Physical Findings, Other Observations** |
| **2.7.4.5** | **Safety in Special Groups and Situations** |
| 2.7.4.5.1 | Intrinsic Factors (age, sex, weight, genetics, organ dysfunction) |
| 2.7.4.5.2 | Extrinsic Factors (environment, tobacco, alcohol, food) |
| 2.7.4.5.3 | Drug Interactions (cross-ref → 2.7.2) |
| 2.7.4.5.4 | Use in Pregnancy and Lactation |
| 2.7.4.5.5 | Overdose |
| 2.7.4.5.6 | Drug Abuse (cross-ref → 2.6 nonclinical) |
| 2.7.4.5.7 | Withdrawal and Rebound |
| 2.7.4.5.8 | Effects on Ability to Drive/Operate Machinery |
| **2.7.4.6** | **Post-marketing Data** |
| **2.7.4.7** | **Appendix** (Tables 2.7.4.1–2.7.4.6) |

#### 2.7.5 Literature References

All references cited in Clinical Summary. Indicate which are available in Module 5, Section 5.4.

#### 2.7.6 Synopses of Individual Studies

- Listing of Clinical Studies table
- Individual study synopses (ICH E3 format, 3–10 pages each)
- Same sequence as study reports in Module 5

**Cross-references:**
- 2.7 (all) → Module 5 study reports — mandatory
- 2.7.3.3 → 2.7.2 (PK/PD evidence for dosing) — mandatory
- 2.7.4.5.3 → 2.7.2 (PK interactions) — mandatory
- 2.7.4.5.6 → 2.6 (nonclinical dependence) — mandatory
- 2.7.6 → Module 5 (same sequence) — mandatory

---

## Module 3 — Quality

Body of data supporting the QOS (Section 2.3).

### 3.1 Table of Contents

### 3.2 Body of Data

#### Drug Substance (3.2.S) — repeat per substance

| Section | Title | Subsections |
|---|---|---|
| 3.2.S.1 | General Information | .1.1 Nomenclature, .1.2 Structure, .1.3 General Properties |
| 3.2.S.2 | Manufacture | .2.1 Manufacturer(s), .2.2 Process Description, .2.3 Control of Materials, .2.4 Controls of Critical Steps, .2.5 Process Validation, .2.6 Manufacturing Process Development |
| 3.2.S.3 | Characterisation | .3.1 Elucidation of Structure, .3.2 Impurities |
| 3.2.S.4 | Control of Drug Substance | .4.1 Specification, .4.2 Analytical Procedures, .4.3 Validation, .4.4 Batch Analyses, .4.5 Justification of Specification |
| 3.2.S.5 | Reference Standards | — |
| 3.2.S.6 | Container Closure System | — |
| 3.2.S.7 | Stability | .7.1 Summary & Conclusions, .7.2 Post-Approval Protocol, .7.3 Stability Data |

#### Drug Product (3.2.P) — repeat per product/dosage form

| Section | Title | Subsections |
|---|---|---|
| 3.2.P.1 | Description and Composition | — |
| 3.2.P.2 | Pharmaceutical Development | .2.1 Components (.2.1.1 Drug Substance, .2.1.2 Excipients), .2.2 Drug Product (.2.2.1 Formulation Dev, .2.2.2 Overages, .2.2.3 Physicochemical Properties), .2.3 Manufacturing Process Dev, .2.4 Container Closure, .2.5 Microbiological Attributes, .2.6 Compatibility |
| 3.2.P.3 | Manufacture | .3.1 Manufacturer(s), .3.2 Batch Formula, .3.3 Process Description, .3.4 Controls of Critical Steps, .3.5 Process Validation |
| 3.2.P.4 | Control of Excipients | .4.1 Specifications, .4.2 Analytical Procedures, .4.3 Validation, .4.4 Justification, .4.5 Human/Animal Origin, .4.6 Novel Excipients |
| 3.2.P.5 | Control of Drug Product | .5.1 Specification(s), .5.2 Analytical Procedures, .5.3 Validation, .5.4 Batch Analyses, .5.5 Characterisation of Impurities, .5.6 Justification |
| 3.2.P.6 | Reference Standards | — |
| 3.2.P.7 | Container Closure System | — |
| 3.2.P.8 | Stability | .8.1 Summary & Conclusion, .8.2 Post-Approval Protocol, .8.3 Stability Data |

#### Appendices (3.2.A)

| Section | Title |
|---|---|
| 3.2.A.1 | Facilities and Equipment |
| 3.2.A.2 | Adventitious Agents Safety Evaluation |
| 3.2.A.3 | Excipients |

#### 3.2.R — Regional Information

### 3.3 Literature References

**ICH Guidelines:** Q1A(R2), Q1B, Q2(R1), Q3A(R2), Q3B(R2), Q3C(R8), Q3D(R2), Q5A-D, Q6A-B, Q8(R2), Q9(R1), Q10, Q11, Q12

---

## Module 4 — Nonclinical Study Reports

Full study reports supporting Sections 2.4 and 2.6.

### 4.1 Table of Contents

### 4.2 Study Reports

#### 4.2.1 Pharmacology

| Section | Title |
|---|---|
| 4.2.1.1 | Primary Pharmacodynamics |
| 4.2.1.2 | Secondary Pharmacodynamics |
| 4.2.1.3 | Safety Pharmacology |
| 4.2.1.4 | Pharmacodynamic Drug Interactions |

#### 4.2.2 Pharmacokinetics

| Section | Title |
|---|---|
| 4.2.2.1 | Analytical Methods and Validation Reports |
| 4.2.2.2 | Absorption |
| 4.2.2.3 | Distribution |
| 4.2.2.4 | Metabolism |
| 4.2.2.5 | Excretion |
| 4.2.2.6 | Pharmacokinetic Drug Interactions |
| 4.2.2.7 | Other Pharmacokinetic Studies |

#### 4.2.3 Toxicology

| Section | Title |
|---|---|
| 4.2.3.1 | Single-Dose Toxicity |
| 4.2.3.2 | Repeat-Dose Toxicity |
| 4.2.3.3 | Genotoxicity (4.2.3.3.1 In Vitro, 4.2.3.3.2 In Vivo) |
| 4.2.3.4 | Carcinogenicity (4.2.3.4.1 Long-term, 4.2.3.4.2 Short/Medium-term, 4.2.3.4.3 Other) |
| 4.2.3.5 | Reproductive/Developmental Tox (4.2.3.5.1 Fertility, 4.2.3.5.2 Embryo-Fetal, 4.2.3.5.3 Pre/Postnatal, 4.2.3.5.4 Juvenile Animals) |
| 4.2.3.6 | Local Tolerance |
| 4.2.3.7 | Other Toxicity Studies (4.2.3.7.1 Antigenicity, .7.2 Immunotoxicity, .7.3 Mechanistic, .7.4 Dependence, .7.5 Metabolites, .7.6 Impurities, .7.7 Other) |

### 4.3 Literature References

**Study ordering:** Species order → Route order → Duration (shortest to longest)

**ICH Guidelines:** S1A-C, S2(R1), S3A, S4, S5(R3), S6(R1), S7A-B, S8, S9, S10, S11, M3(R2)

---

## Module 5 — Clinical Study Reports

Full study reports (ICH E3 format) supporting Sections 2.5 and 2.7.

### 5.1 Table of Contents (including Listing of Clinical Studies table)

### 5.2 Tabular Listing of All Clinical Studies
- Study number, design, objective, dosing, subjects, status, report type, location

### 5.3 Clinical Study Reports

#### 5.3.1 Biopharmaceutic Studies

| Section | Title |
|---|---|
| 5.3.1.1 | Bioavailability (BA) Study Reports |
| 5.3.1.2 | Comparative BA and Bioequivalence (BE) Study Reports |
| 5.3.1.3 | In Vitro – In Vivo Correlation Study Reports |
| 5.3.1.4 | Bioanalytical and Analytical Methods for Human Studies |

#### 5.3.2 Studies Using Human Biomaterials

| Section | Title |
|---|---|
| 5.3.2.1 | Plasma Protein Binding Study Reports |
| 5.3.2.2 | Hepatic Metabolism and Drug Interaction Studies |
| 5.3.2.3 | Studies Using Other Human Biomaterials |

#### 5.3.3 Human PK Studies

| Section | Title |
|---|---|
| 5.3.3.1 | Healthy Subject PK and Initial Tolerability |
| 5.3.3.2 | Patient PK and Initial Tolerability |
| 5.3.3.3 | Intrinsic Factor PK (renal, hepatic, age, sex, race, genetics) |
| 5.3.3.4 | Extrinsic Factor PK (DDI, food effect) |
| 5.3.3.5 | Population PK |

#### 5.3.4 Human PD Studies

| Section | Title |
|---|---|
| 5.3.4.1 | Healthy Subject PD and PK/PD |
| 5.3.4.2 | Patient PD and PK/PD |

#### 5.3.5 Efficacy and Safety Studies

| Section | Title |
|---|---|
| 5.3.5.1 | Controlled Clinical Studies (pivotal and supportive) |
| 5.3.5.2 | Uncontrolled Clinical Studies |
| 5.3.5.3 | Analyses of Data from More than One Study (ISS, ISE, meta-analyses) |
| 5.3.5.4 | Other Study Reports |

#### 5.3.6 Post-Marketing Experience

#### 5.3.7 Case Report Forms and Individual Patient Listings

### 5.4 Literature References
Copies of all important references cited in 2.5, 2.7, and Module 5.

**Study report format:** ICH E3 (full technical report, abbreviated, or synopsis only; synopses 3–10 pages)

**ICH Guidelines:** E1–E4, E5(R1), E6(R3), E7, E8(R1), E9(R1), E10, E11(R1), E14, E17

---

## Global Cross-Reference Map

The CTD has a pyramid structure where Module 2 summaries reference detailed data in Modules 3, 4, and 5.

```
Module 1 (Regional) ← region-specific, not harmonised
    │
Module 2 (Summaries)
    ├── 2.3 QOS ←→ Module 3 (Quality)
    ├── 2.4 Nonclinical Overview → 2.6 → Module 4
    ├── 2.5 Clinical Overview → 2.7 → Module 5
    ├── 2.6 Nonclinical Summaries → Module 4
    └── 2.7 Clinical Summary → Module 5
    │
Module 3 (Quality Body of Data)
    │
Module 4 (Nonclinical Study Reports)
    │
Module 5 (Clinical Study Reports)
```

### Mandatory Cross-References

| From | To | Description |
|---|---|---|
| 2.3.S.x | 3.2.S.x | Each QOS Drug Substance subsection → corresponding Module 3 section |
| 2.3.P.x | 3.2.P.x | Each QOS Drug Product subsection → corresponding Module 3 section |
| 2.3.A.x | 3.2.A.x | Each QOS Appendix → corresponding Module 3 appendix |
| 2.4 | 2.6, Module 4 | Nonclinical Overview → Summaries and Study Reports |
| 2.5 | 2.7, Module 5 | Clinical Overview → Summary and Study Reports |
| 2.6 (all) | Module 4 | Written/Tabulated Summaries → Study Reports (with Vol/Section location) |
| 2.7 (all) | Module 5 | Clinical Summary → Study Reports |
| 2.7.6 | Module 5 | Synopses in same sequence as Module 5 reports |
| 5.4 | 2.5.7, 2.7.5 | Literature copies ↔ reference lists |

### Conditional Cross-References

| From | To | Condition |
|---|---|---|
| 2.4 (impurities) | 2.3/Module 3 | When discussing impurity qualification |
| 2.5.5 (safety) | 2.4/Module 4 | When nonclinical findings relevant to clinical safety |
| 2.5.5 (safety) | 2.3/Module 3 | When quality data relevant to clinical safety |
| 2.6 (impurity qualification) | 2.3/Module 3 | When toxicology studies qualify impurities |
| 2.7.3.3 | 2.7.2 | Efficacy comparison must reference PK/PD evidence for dosing |
| 2.7.4.5.3 | 2.7.2 | Drug interaction safety → PK interaction data |
| 2.7.4.5.6 | 2.6 | Drug abuse section → nonclinical dependence studies |
| 3.2.S.3.2 | Module 4 | Impurity characterisation → nonclinical qualification |
| 4.2.3.7.6 | 3.2.S.3.2/3.2.P.5.5 | Impurity studies → quality impurity data |

---

*Generated from ICH M4, M4Q(R1), M4S(R2), M4E(R2) guidelines.*
