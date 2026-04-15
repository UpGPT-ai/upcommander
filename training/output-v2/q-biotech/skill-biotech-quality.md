# SKILL.md — BLA Quality Section Analyzer (ICH Q5 Series)

## Purpose

Analyze the Quality (CMC) sections of Biologics License Applications (BLAs) and marketing authorization dossiers for compliance with ICH Q5A(R2), Q5B, Q5C, Q5D, and Q5E requirements. This skill evaluates viral safety programs, cell bank characterisation, expression construct analysis, biotech-specific stability programs, and manufacturing comparability exercises.

## When to Use

- Reviewing Module 3.2.S / 3.2.P of a CTD for a biological product
- Auditing a BLA quality section before submission
- Evaluating a comparability protocol for a manufacturing process change
- Assessing viral safety strategy for a new biologic or biosimilar
- Reviewing cell bank characterisation documentation
- Evaluating stability programs for protein therapeutics, mAbs, ADCs, or vaccines

## Source Documents

| Guideline | Title | Version |
|-----------|-------|---------|
| Q5A(R2) | Viral Safety Evaluation of Biotechnology Products Derived from Cell Lines of Human or Animal Origin | Step 4, November 2023 |
| Q5B | Analysis of the Expression Construct in Cells Used for Production of r-DNA Derived Protein Products | Step 4, November 1995 |
| Q5C | Stability Testing of Biotechnological/Biological Products | Step 4, November 1995 |
| Q5D | Derivation and Characterisation of Cell Substrates Used for Production of Biotechnological/Biological Products | Step 4, July 1997 |
| Q5E | Comparability of Biotechnological/Biological Products Subject to Changes in Their Manufacturing Process | Step 4, November 2004 |

## Rule Database

Load `biotech-quality-rules.json` from the same directory. It contains 147 enforceable rules across 5 domains:
- **VS** (54 rules) — Viral Safety
- **EC** (12 rules) — Expression Construct
- **BS** (23 rules) — Biotech Stability
- **CS** (24 rules) — Cell Substrate
- **CP** (23 rules) — Comparability

## Scope of Products Covered

- Recombinant proteins and polypeptides (e.g., mAbs, Fc-fusion proteins, cytokines, growth factors, enzymes, insulins)
- Conjugated products (ADCs, PEGylated proteins)
- Monoclonal antibodies (including bispecific, half-antibody, antibody fragments)
- Vaccines consisting of well-characterised proteins or polypeptides
- Viral vectors (AAV, lentiviral, adenoviral) and viral vector-derived products
- Virus-like particles (VLPs) and nanoparticle-based protein vaccines
- Products derived from baculovirus/insect cell expression systems
- Products from hybridoma cell lines

**Not in scope**: Antibiotics, vitamins, allergenic extracts, heparins, whole blood, cellular blood components, conventional vaccines (without well-characterised protein), gene therapy products with limited purification (consult regional guidance).

## Analysis Framework

### Phase 1 — Product Classification

Determine product type and applicable rule subsets:

1. **Expression system**: CHO, NS0, SP2/0, HEK293, insect/baculovirus, E. coli, yeast, hybridoma, other
2. **Product class**: mAb, bispecific, ADC, Fc-fusion, cytokine, enzyme, vaccine subunit, VLP, viral vector, other
3. **Manufacturing mode**: Batch, fed-batch, perfusion, continuous manufacturing
4. **Regulatory pathway**: Original BLA, biosimilar 351(k), supplement/variation, IND/CTA
5. **Cell bank tier**: MCB → WCB → production cells → LIVCA

Classify the product into Q5A(R2) Table 4 case (A through F) based on viral testing results.

### Phase 2 — Viral Safety Evaluation (Q5A(R2))

Evaluate the three-pronged viral safety approach:

**Prong 1 — Cell Bank & Raw Material Testing**

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| MCB retrovirus testing | VS-001, VS-010, VS-011, VS-012 | TEM performed? RT/PERT assay done? Infectivity follow-up for positives? |
| MCB adventitious virus testing | VS-002, VS-003, VS-005, VS-006 | In vitro assay panel adequate (species-of-origin, MRC-5, Vero)? 28-day observation? NGS considered? |
| Specific virus testing | VS-007, VS-008, VS-009 | Risk assessment documented? MAP/RAP/HAP or NAT/NGS for rodent lines? Bovine/porcine virus testing if serum/trypsin used? |
| WCB testing | VS-002 | Limited in vitro testing performed? |
| LIVCA testing | VS-001, VS-002, VS-003 | Retrovirus and adventitious testing at production cell age limit? |
| NGS methodology | VS-013, VS-014 | Method validated? Four workflow steps addressed? Bioinformatics against comprehensive database? |

**Prong 2 — Unprocessed Bulk Testing**

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Routine adventitious testing | VS-015, VS-016, VS-017 | Each bulk harvest tested? 28-day observation (or 14-day with justification)? |
| Contamination response | VS-018 | Action plan for positive results? Root cause analysis procedure? |
| CM-specific considerations | VS-019, VS-050, VS-051 | Extended culture monitoring? Sampling strategy justified? |

**Prong 3 — Viral Clearance**

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Study design | VS-020, VS-021, VS-022, VS-023, VS-024 | Separate lab? Scale-down model representative? ≥3 model viruses with differing properties? |
| Step-wise evaluation | VS-025, VS-026, VS-027 | Each step individually assessed? Inactivation kinetics with time curve? ≥2 independent experiments? |
| Reduction factor calculation | VS-029, VS-030, VS-031, VS-033, VS-034 | <1 log10 steps excluded? No double-counting of similar mechanisms? 95% CIs calculated? |
| Overall clearance adequacy | VS-028, VS-032 | ≥4 log10 per effective step? ≥2 complementary orthogonal steps? Non-enveloped coverage? |
| Resin lifetime | VS-035 | Resin use limits defined? Clearance studies support reuse claim? |
| Platform validation | VS-043, VS-044, VS-045, VS-046, VS-047, VS-048 | Justified by prior knowledge? Platform conditions met? Product-specific confirmation for virus filtration? |
| Re-evaluation triggers | VS-049 | Process changes assessed for viral clearance impact? |

**Special Products**

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Viral vectors | VS-052, VS-053, VS-054 | Table A-5 testing scheme followed? RCV testing at multiple stages? Production virus quantified from ≥3 lots? |
| Case classification | VS-036 through VS-042 | Correct Table 4 case assigned? Action plan complete? |
| Particles per dose | VS-038 | CHO RVLP ≤10⁻⁴ particles/dose threshold met? |

### Phase 3 — Expression Construct Analysis (Q5B)

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Vector characterisation | EC-001, EC-002, EC-003, EC-004 | Origin described? Annotated map + full sequence? All elements identified? Coding region + flanking junctions sequenced? |
| MCB construct analysis | EC-005, EC-006, EC-007 | Copy number determined? Integration sites mapped? Sequence verified? (Extrachromosomal: % retention?) |
| Production cell verification | EC-008, EC-009, EC-010 | Coding sequence confirmed at production cell level? Cell age limit data-supported? |
| Method validation | EC-011 | LOD for variants documented? |

### Phase 4 — Stability Program (Q5C)

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Batch selection | BS-001, BS-002, BS-003 | ≥3 batches for DS and DP? Representative of manufacturing scale? ≥6 months data at submission? |
| Stability-indicating profile | BS-006, BS-007, BS-010, BS-011 | Identity, purity, and potency covered? Multiple purity methods? Methods validated? |
| Potency testing | BS-008, BS-009 | Bioassay included? Reference standard calibrated? Conjugate dissociation examined? |
| Degradation monitoring | BS-010, BS-012 | Deamidation, oxidation, aggregation, fragmentation monitored? Acceptable limits justified from clinical material? |
| Storage conditions | BS-015, BS-016, BS-017, BS-018 | Real-time at proposed temperature? Accelerated/stress case-by-case? Inverted/horizontal samples for liquids? Multi-dose closure qualified? |
| Special forms | BS-019 | Reconstituted lyophilized stability demonstrated? |
| Testing frequency | BS-020 | Intervals match Q5C Section 7 requirements? |
| Specifications | BS-021, BS-022 | Release vs. shelf-life specs defined? Storage recommendations on label? |
| Intermediates | BS-005 | Critical intermediate hold times justified? |

### Phase 5 — Cell Substrate Characterisation (Q5D)

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Cell history | CS-001, CS-002, CS-003, CS-004 | Complete documentation? Donor/source info? Media/reagent exposure documented? |
| Cell banking | CS-005, CS-006, CS-007, CS-008, CS-009 | Two-tiered system? Procedures documented? Anti-contamination measures? Catastrophic event protection? |
| Identity testing | CS-010, CS-011 | MCB identity confirmed? Method appropriate for species? |
| Purity testing | CS-012, CS-013, CS-014, CS-015 | Bioburden on ≥2 containers (≥1% of bank)? Mycoplasma by dual method? Virus screening per Q5A? |
| Stability | CS-016, CS-017, CS-018 | Two time-point evaluation? Expression construct verified at LIVCA? Storage stability monitored? |
| Tumorigenicity | CS-019, CS-020 | New diploid lines characterised? Highly purified products exempt if HCD limits met? |

### Phase 6 — Comparability (Q5E) — If Applicable

Trigger: Any manufacturing process change for drug substance or drug product.

| Check | Rule IDs | What to Verify |
|-------|----------|----------------|
| Exercise design | CP-001, CP-002, CP-003, CP-004, CP-005 | Scope defined? Evaluation at appropriate process step(s)? Analytical techniques selected to detect relevant differences? |
| Characterisation | CP-006, CP-007, CP-008, CP-009, CP-010 | All five quality dimensions compared? Higher order structure assessed? Multi-activity products: all functions tested? |
| Specifications | CP-011, CP-012 | Acceptance criteria unchanged or justified? Historical trends evaluated? |
| Stability | CP-013, CP-014 | RT/RT studies initiated for post-change product? Accelerated/stress for degradation profile comparison? |
| Process controls | CP-015, CP-016, CP-017, CP-018 | Post-change process revalidated? Viral safety retested? Side-by-side process comparison prepared? |
| Drift monitoring | CP-023 | Cumulative impact of serial changes assessed? |
| Nonclinical/clinical need | CP-020, CP-021, CP-022 | Decision tree for bridging studies applied? Factors evaluated (complexity, immunogenicity, therapeutic window)? |

## Output Format

Generate a structured compliance report:

```
## BLA Quality Section — ICH Q5 Compliance Report

### Product: [Name]
### Product Class: [e.g., mAb, ADC, viral vector]
### Expression System: [e.g., CHO-K1]
### Q5A Case Classification: [A/B/C/D/E/F]

---

### Executive Summary
- Total rules evaluated: X / 147
- Compliant: X
- Gaps identified: X (Y critical, Z recommended)
- Overall assessment: [PASS / CONDITIONAL / FAIL]

---

### Domain Scores

| Domain | Rules Evaluated | Compliant | Gaps | Critical Gaps |
|--------|----------------|-----------|------|---------------|
| Viral Safety (VS) | /54 | | | |
| Expression Construct (EC) | /12 | | | |
| Biotech Stability (BS) | /23 | | | |
| Cell Substrate (CS) | /24 | | | |
| Comparability (CP) | /23 | | | |

---

### Critical Findings

[For each critical gap:]

**Finding [N]: [Title]**
- Rule ID: [VS-XXX]
- Severity: CRITICAL
- Requirement: [What ICH requires]
- Current State: [What was found / what is missing]
- Regulatory Risk: [Impact if unaddressed]
- Remediation: [Specific action to close the gap]

---

### Recommendations (Priority-Ordered)

1. [Highest priority item]
2. [Next priority]
...

---

### Cross-Reference to CTD Sections

| Q5 Domain | CTD Module 3 Section |
|-----------|---------------------|
| Q5A Viral Safety | 3.2.S.2.3 (Controls), 3.2.A.2 (Adventitious Agents) |
| Q5B Expression Construct | 3.2.S.2.2 (Description of Manufacturing Process), 3.2.S.2.6 (Manufacturing Process Development) |
| Q5C Stability | 3.2.S.7 (Stability), 3.2.P.8 (Stability) |
| Q5D Cell Substrate | 3.2.S.2.3 (Control of Materials), 3.2.A.2 (Cell Bank) |
| Q5E Comparability | 3.2.S.2.6 (Manufacturing Process Development), 3.2.P.2.6 |
```

## Key Decision Trees

### Decision Tree 1: Is NGS Acceptable as Replacement?

```
NGS proposed as replacement for conventional assay?
├── Replacing in vivo assay? → YES, non-targeted NGS can replace without head-to-head comparison
├── Replacing in vitro cell culture assay? → YES, non-targeted NGS can supplement or replace
├── Replacing virus-specific PCR/antibody production tests? → YES, targeted or non-targeted NGS can replace without head-to-head comparison
└── For all cases: Method validation/qualification required per ICH Q2 principles with matrix-specific verification
```

### Decision Tree 2: Does This Process Change Require a Comparability Exercise?

```
Manufacturing process change made?
├── Change in cell culture process (media, feed, conditions)? → YES, comparability per Q5E
├── Change in purification process? → YES, comparability per Q5E + re-evaluate viral clearance per Q5A 6.7
├── Change in formulation/fill-finish? → YES, comparability (primarily stability focus)
├── New cell bank (WCB from same MCB)? → Characterise per Q5D; limited comparability
├── New MCB? → Full Q5D characterisation + Q5E comparability + Q5A viral testing
├── Scale change only? → Comparability; extent proportional to change significance
└── Site transfer? → Full comparability exercise; process validation at new site
```

### Decision Tree 3: Viral Clearance Re-evaluation Triggers

```
Process change impacts downstream purification?
├── Change in dedicated viral clearance step parameters? → Re-evaluate specific step
├── Change in chromatography conditions/resin? → Assess impact; may need new clearance study
├── Change in cell line/MCB? → Full viral safety re-evaluation including Table 1 testing
├── Addition/removal of process step? → Re-evaluate overall clearance strategy
├── Scale change with identical parameters? → Prior knowledge may suffice if scale-down model validated
└── No change to downstream? → Document rationale; no re-evaluation needed
```

## Common Deficiency Patterns

Based on regulatory experience, these are the most frequently cited deficiencies in BLA quality sections related to Q5 compliance:

1. **Inadequate viral clearance panel** — Using only 2 model viruses instead of ≥3 with differing physicochemical properties
2. **Missing inactivation kinetics** — Providing only endpoint data without time-course for inactivation steps
3. **Scale-down model not justified** — Chromatography parameters not demonstrated to match commercial scale
4. **Incomplete LIVCA testing** — Retrovirus and adventitious testing not performed at the actual production cell age limit
5. **No NGS method qualification** — Using NGS without documented validation per Q2 principles
6. **Stability profile gaps** — Missing potency in stability-indicating panel; single purity method for biotech product
7. **Comparability drift** — Cumulative effect of multiple process changes not assessed over product lifecycle
8. **Cell bank catastrophic protection** — No documented plan for redundant storage, backup power, or MCB regeneration
9. **Expression construct analysis at wrong tier** — Analysing WCB instead of MCB without justification
10. **Insufficient batches** — Submitting stability data on <3 representative manufacturing-scale batches

## Integration with Other ICH Guidelines

This skill should be used alongside:

| Guideline | When |
|-----------|------|
| Q1A(R2) / Q1B / Q1D | General stability design, photostability, bracketing/matrixing |
| Q2(R2)/Q14 | Analytical method validation (referenced by Q5C, Q5E) |
| Q6B | Specifications for biotech products (referenced by Q5E characterisation) |
| Q7 | GMP for starting materials |
| Q8(R2) / Q11 | Pharmaceutical development / DS manufacturing process development |
| Q12 | Lifecycle management / post-approval changes |
| Q13 | Continuous manufacturing (referenced by Q5A Section 7) |
| S6(R1) | Preclinical safety evaluation of biotech products |
| M4Q(R1) | CTD Quality module structure |
