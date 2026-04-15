# SKILL.md — Cross-Domain Analysis Requirements

## Skill Identity

- **Name:** `cross-domain-analysis`
- **Version:** 2.0
- **Domain:** ICH Multidisciplinary Guidelines (M-series)
- **Purpose:** Enforce cross-domain quality-safety-efficacy requirements extracted from ICH M1, M2, M7, M8, M9, M10, M11, M12, M13A/B/C, M14, and eCTD specifications

## Scope

This skill governs regulatory submissions and analyses that span **two or more** of the four ICH domains:

| Domain | What It Covers |
|--------|---------------|
| **Quality** | Manufacturing, analytical methods, dissolution, data integrity, formulation, excipients, batch specifications, terminology coding |
| **Safety** | Genotoxicity, mutagenicity, drug interactions, adverse events, NTI drugs, post-market surveillance, MedDRA coding, toxicokinetics |
| **Efficacy** | Bioequivalence, bioavailability, PK/PD, clinical endpoints, bioanalytical validation, clinical protocol design, study populations |
| **Regulatory** | eCTD submission structure, GCP/GLP compliance, terminology governance, lifecycle management, RWD evidence standards, reporting obligations |

## Rules Database

All 249 extracted rules are in `multidisciplinary-rules.json` (same directory). Each rule includes:
- `id` — Unique identifier (e.g., M7-001, M13A-014)
- `source` — Source ICH PDF document
- `requirement` — The specific requirement text
- `domains` — Which domains it bridges
- `cross_references` — Other ICH guidelines referenced
- `rationale` — Why this is multidisciplinary

## Guideline Coverage

| Guideline | Rules | Primary Cross-Domain Bridge |
|-----------|-------|-----------------------------|
| **ICH M1** (MedDRA) | 12 | Quality ↔ Safety ↔ Regulatory: MedDRA coding quality directly affects safety signal detection and regulatory reporting |
| **ICH M2** (Electronic Standards) | 23 | All four domains: Terminology governance and electronic data exchange standards span every ICH guideline series |
| **ICH M7(R2)** (Mutagenic Impurities) | 60 | Quality ↔ Safety: Impurity control limits (quality) derived from genotoxicity risk assessment (safety); (Q)SAR predictions (quality) determine testing requirements (safety) |
| **ICH M8** (eCTD) | 3 | All four domains: eCTD structure is the physical integration of quality (Module 3), safety (Module 4), and efficacy (Module 5) data |
| **ICH M9** (BCS Biowaivers) | 16 | Quality ↔ Efficacy: In vitro dissolution (quality) substitutes for in vivo bioequivalence (efficacy); NTI exclusion adds safety bridge |
| **ICH M10** (Bioanalytical Validation) | 22 | Quality ↔ Safety ↔ Efficacy: Single validation framework governs methods for both GLP nonclinical (safety) and GCP clinical (efficacy) studies |
| **ICH M11** (CeSHarP Protocol) | 20 | Quality ↔ Safety ↔ Efficacy: Structured protocol template integrates safety monitoring, efficacy endpoints, and data quality standards in a single document |
| **ICH M12** (Drug Interactions) | 45 | Quality ↔ Safety ↔ Efficacy: In vitro DDI assays (quality) predict clinical DDI risk (safety) and inform dose adjustment (efficacy) |
| **ICH M13A** (BE Studies) | 22 | Quality ↔ Safety ↔ Efficacy: BE acceptance criterion (80–125%) is simultaneously a quality standard, efficacy standard, and safety standard |
| **ICH M13B** (Biowaiver Strengths) | 9 | Quality ↔ Efficacy: Formulation proportionality (quality) determines whether dissolution data can substitute for in vivo BE (efficacy) |
| **ICH M13C** (HVD/NTI BE) | 1 | Quality ↔ Safety ↔ Efficacy: HVD/NTI categories defined by intersection of PK variability (quality), safety margin, and therapeutic failure risk |
| **ICH M14** (RWD for Safety) | 11 | Quality ↔ Safety ↔ Regulatory: Fit-for-use RWD requirements bridge data quality, safety assessment, and regulatory evidence standards |
| **eCTD Specs** | 4 | All four domains: Submission format enforces integrated quality-safety-efficacy dossier with version control and integrity verification |

## Critical Cross-Domain Patterns

### Pattern 1: Quality-as-Surrogate-for-Efficacy
**Trigger:** BCS biowaiver (M9), strength biowaiver (M13B), dissolution-based decisions
**Rule:** In vitro quality measurements (dissolution, solubility, permeability) are accepted as surrogates for in vivo clinical efficacy demonstrations ONLY when specific conditions are met:
- BCS Class I/III classification confirmed
- Not an NTI drug (safety gate)
- Excipients qualified (safety/quality gate)
- Dissolution similarity demonstrated (quality metric with efficacy threshold)

**Key rules:** M9-001 through M9-016, M13B-001 through M13B-009

### Pattern 2: Safety-Gates-on-Quality-Decisions
**Trigger:** Impurity control (M7), NTI exclusion (M9/M13), drug interactions (M12)
**Rule:** Quality decisions (impurity limits, formulation changes, excipient selection) are gated by safety assessments:
- Mutagenic impurity limits set by TTC/cancer risk (M7)
- NTI drugs excluded from quality-based biowaivers (M9, M13)
- DDI risk assessment required before formulation changes affecting metabolism (M12)
- Subject selection for BE studies limited by drug toxicity (M13A)

**Key rules:** M7-001 through M7-060, M9-007, M9-011, M13A-003, M13A-004, M12-001 through M12-045

### Pattern 3: Single-Validation-Framework-Spanning-Domains
**Trigger:** Bioanalytical method validation (M10), clinical protocol design (M11)
**Rule:** A single quality framework governs measurements used in both safety and efficacy contexts:
- M10 validation requirements apply identically to GLP (safety) and GCP (efficacy) studies
- ISR failures in either domain trigger investigation across both domains
- M11 protocol template integrates safety monitoring, efficacy endpoints, and data quality in one document

**Key rules:** M10-001 through M10-022, M11-001 through M11-020

### Pattern 4: Terminology-and-Data-Integrity-Across-Domains
**Trigger:** MedDRA coding (M1), electronic data exchange (M2), eCTD structure (M8)
**Rule:** Terminology consistency and data integrity are cross-domain infrastructure requirements:
- MedDRA coding quality affects safety signal detection and quality complaint reporting
- M2 terminology governance covers all ICH guideline series
- eCTD lifecycle management requires coherent updates across quality/safety/efficacy modules
- Deprecation-over-deletion preserves historical safety and quality audit trails

**Key rules:** M1-001 through M1-012, M2-001 through M2-023, M8-001 through M8-003, ECTD-001 through ECTD-004

### Pattern 5: Post-Market-Evidence-Quality-for-Safety
**Trigger:** Real-world data studies (M14), post-marketing safety surveillance
**Rule:** Post-market safety evidence must meet defined data quality standards:
- Fit-for-use assessment requires data relevance AND data reliability
- Variable validation (sensitivity, specificity, PPV, NPV) required for safety outcomes
- Product quality complaints identified during safety studies trigger regulatory reporting
- ALCOA-equivalent audit trails required for RWD studies
- Multidisciplinary team mandatory

**Key rules:** M14-001 through M14-011

## Decision Matrix

When evaluating a regulatory submission or analysis, apply this decision tree:

```
1. Does the work involve data from TWO OR MORE eCTD modules?
   → YES: Apply Pattern 4 (data integrity) + check all relevant guideline-specific rules

2. Does the work involve substituting in vitro data for in vivo studies?
   → YES: Apply Pattern 1 (quality-as-surrogate)
   → Check: Is this an NTI drug? → If YES, surrogate NOT permitted (Pattern 2)

3. Does the work involve impurity limits, DDI assessment, or formulation changes?
   → YES: Apply Pattern 2 (safety-gates)
   → Specific: M7 for mutagenic impurities, M12 for DDI, M9/M13 for biowaivers

4. Does the work involve bioanalytical method validation or protocol design?
   → YES: Apply Pattern 3 (single-validation-framework)
   → Check: Are methods used in BOTH nonclinical and clinical studies? → Full M10 applies

5. Does the work involve post-market safety evidence from real-world data?
   → YES: Apply Pattern 5 (RWD evidence quality)
   → Check: Were product quality complaints identified? → ICH E2D reporting triggered

6. Does the work involve MedDRA coding, terminology changes, or electronic data exchange?
   → YES: Apply Pattern 4 (terminology governance)
   → Check: Is this a terminology deprecation? → Deprecation-over-deletion required
```

## Domain Interaction Statistics

From 249 extracted rules:
- **Quality** appears in 239 rules (96%)
- **Safety** appears in 221 rules (89%)
- **Regulatory** appears in 183 rules (74%)
- **Efficacy** appears in 157 rules (63%)

Most common domain combinations:
1. Quality + Safety + Regulatory (without Efficacy): ~80 rules
2. Quality + Safety + Efficacy + Regulatory (all four): ~70 rules
3. Quality + Safety + Efficacy (without Regulatory): ~50 rules
4. Quality + Efficacy (without Safety or Regulatory): ~30 rules
5. Quality + Safety (two-domain): ~15 rules

## Cross-Reference Map

These ICH guidelines are most frequently cross-referenced across multidisciplinary rules:

| Cross-Reference | Times Cited | Why |
|-----------------|-------------|-----|
| ICH E6 (GCP) | 80+ | GCP compliance is the safety-quality bridge for all clinical studies |
| ICH Q3A/Q3B (Impurities) | 40+ | Impurity thresholds are the quality-safety bridge for drug substance/product |
| ICH S2(R1) (Genotoxicity) | 30+ | Genotoxicity testing is the safety validation for quality impurity decisions |
| ICH M4 (CTD Structure) | 25+ | CTD modules define the structural quality-safety-efficacy integration |
| ICH M10 (Bioanalytical) | 20+ | Bioanalytical validation is referenced by M9, M12, M13A as the quality foundation |
| ICH M9 (BCS Biowaivers) | 15+ | BCS framework referenced by M13B, M13C for quality-efficacy substitution rules |
| ICH Q6A (Specifications) | 15+ | Quality specifications underpin dissolution/solubility decisions with efficacy implications |
| ICH E2B/E2D (Safety Reporting) | 10+ | Safety reporting standards bridge safety events to regulatory obligations |

## Implementation Notes

1. **Always check both directions:** A quality change may have safety implications AND a safety finding may require quality control changes. Never evaluate one domain in isolation.

2. **NTI drugs are always multidisciplinary:** Any analysis involving narrow therapeutic index drugs automatically triggers quality + safety + efficacy review regardless of the specific question.

3. **Bioanalytical validation is cross-domain by definition:** M10 explicitly unifies GLP (safety) and GCP (efficacy) under a single quality framework. Never treat nonclinical and clinical bioanalytical validation as separate domains.

4. **Terminology changes cascade:** A MedDRA term change, deprecation, or addition affects safety reporting, quality complaint coding, and regulatory submission integrity simultaneously. Apply M2 governance rules.

5. **Post-market evidence has pre-market quality standards:** ICH M14 applies GCP-equivalent data integrity standards to post-market RWD safety studies. Do not treat post-market evidence as lower quality than clinical trial evidence.

6. **eCTD lifecycle management is multidisciplinary by structure:** Any manufacturing change (Module 3) must be evaluated for impact on nonclinical (Module 4) and clinical (Module 5) data. The eCTD structure enforces this integration.
