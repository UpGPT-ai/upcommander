# SKILL: Clinical Study Design Evaluator (Module 5)

## Purpose

Evaluate clinical study designs submitted in eCTD Module 5 (Clinical Study Reports) against ICH E-series requirements. This skill validates trial design, statistical methodology, endpoint selection, sample sizes, control group choices, population exposure, and reporting completeness.

## Source Authority

All rules derived from ICH guidelines:

| Guideline | Topic | Rules |
|-----------|-------|-------|
| ICH E1 | Extent of Population Exposure to Assess Clinical Safety | 18 |
| ICH E3 | Structure and Content of Clinical Study Reports | 86 |
| ICH E4 | Dose-Response Information to Support Drug Registration | 48 |
| ICH E7 | Studies in Support of Special Populations: Geriatrics | 63 |
| ICH E8(R1) | General Considerations for Clinical Studies | 140 |
| ICH E9 / E9(R1) | Statistical Principles for Clinical Trials / Estimands | 130 |
| ICH E10 | Choice of Control Group and Related Issues | 59 |
| ICH E20 | Adaptive Clinical Trials | 39 |
| **Total** | | **583** |

Rules database: `clinical-design-rules.json` (same directory)

---

## Evaluation Framework

### Phase 1: Study Design Architecture

Assess the fundamental design against ICH E8(R1) and E10.

#### 1.1 Study Objectives & Hypotheses
- [ ] **E8-005**: Study has clearly defined objectives aligned with the development stage and regulatory question
- [ ] **E8-010**: Primary objective maps to a specific estimand per E9(R1) framework
- [ ] **E9-004**: Confirmatory trials are adequately controlled, well-designed experiments that test pre-stated hypotheses
- [ ] **E9-005**: Each confirmatory trial addresses a small number of questions (hypotheses)

#### 1.2 Study Type Classification
- [ ] **E8-014/015/016**: Study correctly classified within the ICH taxonomy:
  - Human pharmacology (Phase 1)
  - Therapeutic exploratory (Phase 2)
  - Therapeutic confirmatory (Phase 3)
  - Therapeutic use (Phase 4)
- [ ] **E8-017**: Objectives for each study type match the expected scope:
  - Phase 1: Tolerability, PK/PD, drug interactions
  - Phase 2: Dose-finding, preliminary efficacy
  - Phase 3: Confirm efficacy, establish safety profile
  - Phase 4: Post-marketing commitments, optimization

#### 1.3 Target Population
- [ ] **E8-023**: Eligibility criteria are justified by the study objectives and do not unnecessarily exclude relevant subpopulations
- [ ] **E8-024**: Inclusion/exclusion criteria support generalizability of results to the intended treatment population
- [ ] **E7-001**: If drug is expected to be used in elderly, adequate representation of patients >= 65 years is included
- [ ] **E7-003**: Minimum 100 patients aged >= 65 in the database for drugs used in elderly
- [ ] **E7-006**: PK studies in elderly assess age-related changes in absorption, distribution, metabolism, elimination

#### 1.4 Control Group Selection (ICH E10)
- [ ] **E10-001**: Control group choice is explicitly justified considering available standard therapies, evidence adequacy, and ethics
- [ ] **E10-005**: Design type is appropriate — evaluate each:

| Control Type | When Appropriate | Key Requirement |
|-------------|-----------------|-----------------|
| Placebo | No proven effective treatment; or add-on design ethical | E10-010: Justified when withholding treatment poses no serious harm |
| Active (superiority) | Goal is to show test drug better than established therapy | E10-015: Adequate dose/regimen of active control |
| Active (non-inferiority) | Goal is to show test drug not unacceptably worse | E10-020: Non-inferiority margin pre-specified and justified |
| Active (equivalence) | Goal is to show similar efficacy | E10-025: Equivalence margins defined bilaterally |
| Dose-response | Internal control within same drug | E10-030: At least 3 dose levels recommended |
| No treatment | Objective endpoint, open-label acceptable | E10-035: Bias assessment required |
| Historical | Highly predictable disease course | E10-040: Stringent conditions for acceptability |

- [ ] **E10-044**: For non-inferiority trials, the non-inferiority margin is based on a fraction of the effect the active control is reliably expected to have (constancy assumption)
- [ ] **E10-045**: Assay sensitivity is established — the trial is capable of detecting a difference if one exists

### Phase 2: Statistical Design (ICH E9 / E9(R1))

#### 2.1 Estimands Framework (E9(R1) Addendum)
- [ ] **E9-R1-001**: Each study objective is linked to a precisely defined estimand with all 5 attributes:
  1. **Population**: The patients targeted by the scientific question
  2. **Variable (endpoint)**: The outcome measure
  3. **Intercurrent events**: Events that affect interpretation (treatment discontinuation, rescue medication, etc.)
  4. **Population-level summary**: How patient-level values are aggregated (mean difference, risk ratio, etc.)
  5. **Strategy for intercurrent events**: How each intercurrent event is handled

- [ ] **E9-R1-002**: Intercurrent event strategies are explicitly defined — one of:
  - **Treatment policy**: Observe outcome regardless of intercurrent event
  - **Composite**: Incorporate intercurrent event into the variable definition
  - **Hypothetical**: Estimate outcome had the intercurrent event not occurred
  - **Principal stratum**: Estimate effect in subpopulation defined by intercurrent event behavior
  - **While on treatment**: Observe outcome only while on treatment before intercurrent event

- [ ] **E9-R1-003**: Sensitivity analyses are pre-specified to explore robustness of primary analysis to assumptions about intercurrent events

#### 2.2 Sample Size
- [ ] **E9-020**: Sample size is justified based on the primary objective of the trial
- [ ] **E9-021**: Justification includes: effect size, variability estimate, significance level, power, and any adjustment for multiplicity or interim analyses
- [ ] **E9-022**: Assumptions underlying sample size are stated and their sources documented
- [ ] **E9-023**: For superiority trials, power >= 80% (typically 80-90%) at two-sided alpha = 0.05
- [ ] **E9-024**: Allowance for dropouts is explicitly stated and justified

**Population Exposure Minimums (ICH E1)**:
| Criterion | Minimum |
|-----------|---------|
| Total safety database | >= 1,500 patients exposed to the drug |
| 6-month exposure | >= 300-600 patients |
| 12-month exposure | >= 100 patients |
| Elderly (>= 65) subset | >= 100 patients (E7) |

#### 2.3 Randomization & Blinding
- [ ] **E9-030**: Method of randomization is described (simple, blocked, stratified, adaptive)
- [ ] **E9-031**: Stratification factors are pre-specified, limited in number, and clinically justified
- [ ] **E9-032**: Blinding level is appropriate (double-blind preferred for confirmatory trials)
- [ ] **E9-033**: Emergency unblinding procedures are defined
- [ ] **E9-034**: Measures to maintain blinding are described (matching placebos, blinded assessors)
- [ ] **E8-032**: Randomization ratio is justified (1:1 default; departures require justification)

#### 2.4 Multiplicity
- [ ] **E9-040**: Multiple comparisons are addressed with pre-specified strategy
- [ ] **E9-041**: Family-wise error rate is controlled at the specified alpha level
- [ ] **E9-042**: Hierarchical testing, gatekeeping, or graphical approaches are defined if multiple primary endpoints or dose groups
- [ ] **E9-043**: Distinction between confirmatory and exploratory analyses is clear

#### 2.5 Interim Analyses & Data Monitoring
- [ ] **E9-050**: Interim analyses are pre-specified in the protocol with clear decision rules
- [ ] **E9-051**: Alpha spending function or comparable method accounts for repeated testing
- [ ] **E9-052**: Independent Data Monitoring Committee (IDMC) charter is in place
- [ ] **E9-053**: IDMC membership, responsibilities, and operating procedures are documented
- [ ] **E9-054**: Conditional power or predictive probability methods for futility are pre-specified if used

### Phase 3: Endpoint Assessment

#### 3.1 Primary Endpoints
- [ ] **E9-060**: Primary endpoint is directly related to the primary objective
- [ ] **E9-061**: Primary endpoint is clinically meaningful or an accepted validated surrogate
- [ ] **E9-062**: Measurement properties (reliability, validity, responsiveness) are documented
- [ ] **E9-063**: Timing of primary endpoint assessment is appropriate for the mechanism of action
- [ ] **E9-064**: For composite endpoints, each component is clinically relevant and directionally consistent

#### 3.2 Secondary & Exploratory Endpoints
- [ ] **E9-065**: Secondary endpoints support the primary or address additional clinical questions
- [ ] **E9-066**: Hierarchy of secondary endpoints is pre-specified if formal inference is intended
- [ ] **E9-067**: Patient-reported outcomes use validated instruments with defined minimal clinically important difference (MCID)

#### 3.3 Safety Endpoints
- [ ] **E9-070**: Adverse event collection, coding, and analysis methods are pre-specified
- [ ] **E9-071**: Exposure-adjusted incidence rates are planned for safety analysis
- [ ] **E1-010**: Safety analysis plan includes assessment of both dose-response and duration-response for adverse events
- [ ] **E1-012**: Serious adverse events, adverse events leading to discontinuation, and deaths are analyzed separately

### Phase 4: Dose-Response Design (ICH E4)

#### 4.1 Study Design for Dose-Response
- [ ] **E4-010**: Dose-response relationship is formally studied (not inferred from single-dose selection)
- [ ] **E4-011**: At least 3 dose levels are tested to characterize the dose-response curve shape
- [ ] **E4-012**: Design type is appropriate:

| Design | Strengths | Key Requirement |
|--------|-----------|-----------------|
| Parallel dose-response | Gold standard; clear attribution | Sufficient patients per arm |
| Crossover | Reduced variability; fewer patients | Suitable for stable conditions only |
| Forced titration | Identifies maximum tolerated dose | Cannot distinguish dose from duration |
| Optional titration | Reflects clinical practice | Confounds dose selection with response |
| Placebo-controlled titration | Separates drug from titration effects | More complex to interpret |

- [ ] **E4-015**: Starting dose is justified based on dose-response curve position
- [ ] **E4-016**: Dose adjustment criteria and algorithms are pre-specified
- [ ] **E4-020**: Exposure-response analysis is included (population PK/PD when appropriate)
- [ ] **E4-025**: Dose selection for Phase 3 is supported by Phase 2 dose-response data

#### 4.2 Special Dose-Response Considerations
- [ ] **E4-030**: Food effects on dose-response are characterized
- [ ] **E4-031**: Drug interaction effects on exposure and response are evaluated
- [ ] **E4-032**: Effects of hepatic/renal impairment on dose-response are assessed
- [ ] **E7-010**: Dose-response in elderly is specifically evaluated (may differ from younger adults)

### Phase 5: Adaptive Trial Design (ICH E20)

#### 5.1 Adaptive Design Classification
- [ ] **E20-001**: The adaptive design is prospectively planned with pre-specified adaptation rules
- [ ] **E20-002**: Adaptations are classified and justified:

| Adaptation Type | Examples | Key Concern |
|----------------|----------|-------------|
| Sample size re-estimation | Blinded or unblinded | Type I error control |
| Treatment arm selection | Drop losers, add arms | Multiplicity adjustment |
| Population enrichment | Biomarker-based selection | Generalizability |
| Endpoint modification | Composite to single | Pre-specification |
| Randomization ratio | Response-adaptive | Operational bias |
| Seamless Phase 2/3 | Combined learning-confirming | Regulatory acceptability |

- [ ] **E20-005**: Type I error rate is controlled across all adaptations
- [ ] **E20-006**: Estimation methods account for the adaptive nature (bias-adjusted estimates)
- [ ] **E20-007**: Operational integrity is maintained — firewalls between DMC and sponsor

#### 5.2 Adaptive Design Documentation
- [ ] **E20-010**: Statistical Analysis Plan covers all possible adaptation paths
- [ ] **E20-011**: Simulations demonstrate operating characteristics (Type I error, power, bias)
- [ ] **E20-012**: Decision criteria for each adaptation are fully pre-specified
- [ ] **E20-013**: Interim analysis procedures and data flow are described
- [ ] **E20-015**: Regulatory interaction strategy is documented (pre-submission meetings recommended)

### Phase 6: Clinical Study Report Completeness (ICH E3)

#### 6.1 Report Structure
- [ ] **E3-001**: Report follows the ICH E3 mandated structure with all required sections:
  1. Title page
  2. Synopsis (standalone, max 3 pages for simple studies)
  3. Table of contents
  4. List of abbreviations
  5. Ethics (IRB/IEC, informed consent, monitoring)
  6. Investigators and study administrative structure
  7. Introduction
  8. Study objectives
  9. Investigational plan (study design, discussion of design, selection of study population, treatments, efficacy/safety variables, data quality assurance, statistical methods)
  10. Study patients (disposition, protocol deviations)
  11. Efficacy evaluation
  12. Safety evaluation
  13. Discussion and overall conclusions
  14. Tables, figures, graphs (in text or Section 14)
  15. Reference list
  16. Appendices (patient data listings, CRFs, publications, etc.)

#### 6.2 Synopsis Requirements
- [ ] **E3-005**: Synopsis is a standalone document containing: study identifiers, objectives, methodology, number of patients, diagnosis/criteria, test products, duration, endpoints, statistical methods, and results summary
- [ ] **E3-006**: Synopsis includes both efficacy and safety results summaries
- [ ] **E3-007**: Synopsis includes conclusions

#### 6.3 Statistical Analysis Reporting
- [ ] **E3-010**: Statistical and analytical plans are described including: pre-specified analyses, sample size determination, significance levels, endpoints, missing data handling, and subgroup analyses
- [ ] **E3-011**: Adjustments for covariates are described and justified
- [ ] **E3-012**: Interim analyses are fully reported including timing, results, and impact on final analysis
- [ ] **E3-013**: Multi-center studies report treatment-by-center interactions
- [ ] **E3-014**: Multiple comparison procedures are documented
- [ ] **E3-015**: All changes from the original statistical plan are documented with rationale

#### 6.4 Safety Reporting
- [ ] **E3-020**: Extent of exposure is reported (duration, dose, patient-time)
- [ ] **E3-021**: Adverse events are presented by system organ class and preferred term
- [ ] **E3-022**: Deaths, serious adverse events, and AEs leading to discontinuation are individually listed
- [ ] **E3-023**: Clinical laboratory evaluations include individual patient shifts and clinically notable values
- [ ] **E3-024**: Vital signs and physical findings are reported
- [ ] **E3-025**: Safety analyses include subgroup analyses (age, sex, race) where appropriate

#### 6.5 Electronic Submissions
- [ ] **E3-030**: Report is formatted for electronic submission per regional requirements
- [ ] **E3-031**: Datasets are provided in required format (CDISC standards where applicable)
- [ ] **E3-032**: Hyperlinked PDF with bookmarks for all sections and appendices

### Phase 7: Special Populations — Elderly (ICH E7)

#### 7.1 Inclusion Requirements
- [ ] **E7-001**: Drugs expected to have significant use in elderly include patients >= 65 in clinical trials
- [ ] **E7-002**: No arbitrary upper age limit unless justified by safety concerns
- [ ] **E7-003**: Minimum of 100 elderly patients in the safety database
- [ ] **E7-004**: Geriatric patients are not excluded from pivotal trials unless medically justified
- [ ] **E7-005**: Age-stratified randomization is considered to ensure balanced elderly representation

#### 7.2 Pharmacokinetic Assessment
- [ ] **E7-006**: PK studies in elderly are conducted to assess age-related changes
- [ ] **E7-007**: Renal function impact on PK is assessed (GFR/creatinine clearance)
- [ ] **E7-008**: Hepatic function impact on PK is assessed
- [ ] **E7-009**: Protein binding changes in elderly are evaluated where relevant
- [ ] **E7-012**: Drug-drug interaction potential is specifically assessed in elderly (polypharmacy context)

#### 7.3 Efficacy & Safety in Elderly
- [ ] **E7-015**: Efficacy in elderly subgroup is analyzed and reported
- [ ] **E7-016**: Safety in elderly subgroup is analyzed separately with attention to:
  - Falls and fractures
  - Cognitive effects
  - Cardiovascular events
  - Renal and hepatic adverse events
- [ ] **E7-017**: Dose recommendations for elderly are derived from PK/PD and clinical data
- [ ] **E7-018**: Labeling includes specific geriatric use information

---

## Scoring Methodology

### Severity Levels

| Level | Label | Description |
|-------|-------|-------------|
| 0 | **Critical** | Violation of a mandatory ICH requirement that could result in regulatory rejection or clinical hold |
| 1 | **Major** | Missing or inadequate compliance with a mandatory requirement; requires remediation before submission |
| 2 | **Moderate** | Partial compliance with a recommended requirement; may trigger regulatory questions |
| 3 | **Minor** | Best practice not followed; no regulatory impact but quality improvement opportunity |
| 4 | **Observation** | Informational finding; optional enhancement |

### Category Weights

| Category | Weight | Rationale |
|----------|--------|-----------|
| Study Design Architecture | 25% | Foundation — flawed design invalidates everything downstream |
| Statistical Methodology | 25% | Regulatory agencies scrutinize statistical validity intensely |
| Endpoint Assessment | 15% | Endpoints must be clinically meaningful and validated |
| Dose-Response | 10% | Required for labeling; critical for benefit-risk |
| Population Exposure | 10% | Hard regulatory thresholds (E1 numbers) |
| Control Group Choice | 5% | Already embedded in design but separate ethical considerations |
| Study Report Completeness | 5% | Formatting issues are fixable but cause review delays |
| Special Populations | 5% | Required but often a subset analysis |

### Overall Score Calculation

```
Score = SUM(category_weight * category_score) / 100

Where category_score = (rules_passed / total_applicable_rules) * 100
```

**Rating Scale:**
| Score Range | Rating | Recommendation |
|-------------|--------|----------------|
| 95-100 | Exemplary | Ready for submission |
| 85-94 | Compliant | Minor items to address; submittable |
| 70-84 | Needs Work | Moderate deficiencies; remediation required |
| 50-69 | Deficient | Major redesign or additional studies needed |
| < 50 | Non-Compliant | Fundamental design issues; regulatory risk is high |

---

## Evaluation Procedure

### Step 1: Document Intake
1. Receive Module 5 clinical study report(s) or protocol(s)
2. Identify study type, phase, therapeutic area, and target population
3. Determine which ICH guidelines are applicable (all E-series apply to most studies; E7 only if elderly use expected; E20 only if adaptive design)

### Step 2: Systematic Checklist Review
1. Walk through each applicable Phase (1-7) of the evaluation framework above
2. For each checkpoint, determine: PASS / FAIL / NOT APPLICABLE / INSUFFICIENT INFORMATION
3. Assign severity level to each finding
4. Cross-reference findings with `clinical-design-rules.json` using rule_ids

### Step 3: Cross-Guideline Consistency
1. Verify that design choices in E8/E10 are reflected in statistical methods per E9
2. Verify that dose-response (E4) is consistent with efficacy claims
3. Verify that population exposure (E1) thresholds are met given the safety database
4. Verify that elderly considerations (E7) are integrated, not bolted on
5. If adaptive (E20), verify that all adaptations are harmonized with E9 statistical framework

### Step 4: Report Generation
Generate a structured evaluation report with:
1. **Executive Summary**: Overall rating, top 3 critical findings, recommendation
2. **Category Scorecards**: Score per category with pass/fail counts
3. **Finding Details**: Each finding with rule_id, severity, evidence, remediation action
4. **Cross-Reference Matrix**: How findings relate across guidelines
5. **Remediation Roadmap**: Prioritized list of actions sorted by severity then effort

---

## Critical Thresholds Quick Reference

### Population Exposure (ICH E1)
| Metric | Threshold | Citation |
|--------|-----------|----------|
| Total safety database | >= 1,500 patients | E1-005 |
| 6-month exposure | >= 300 patients (minimum); 600 preferred | E1-006, E1-007 |
| 12-month exposure | >= 100 patients | E1-008 |
| Short-term event detection | ~1% cumulative 3-month incidence | E1-003 |

### Elderly (ICH E7)
| Metric | Threshold | Citation |
|--------|-----------|----------|
| Minimum elderly patients | >= 100 patients aged >= 65 | E7-003 |
| No arbitrary upper age limit | Must justify any exclusion | E7-002 |

### Statistical (ICH E9)
| Metric | Threshold | Citation |
|--------|-----------|----------|
| Two-sided significance level | alpha = 0.05 (standard) | E9-023 |
| Power | >= 80% (typically 80-90%) | E9-023 |
| Alpha spending for interim | O'Brien-Fleming or equivalent | E9-051 |

### Dose-Response (ICH E4)
| Metric | Threshold | Citation |
|--------|-----------|----------|
| Minimum dose levels | >= 3 to characterize curve | E4-011 |
| Placebo group | Required unless ethically unjustifiable | E4-010 |

---

## Integration Points

### Upstream Dependencies
- **Module 2.5** (Clinical Overview): Design rationale should align with what is evaluated here
- **Module 2.7** (Clinical Summary): Population summaries should match E1 thresholds checked here
- **Module 4** (Nonclinical): Safety margins should inform dose-response evaluation (E4)

### Downstream Consumers
- **Regulatory reviewers**: Findings map directly to common FDA/EMA deficiency letter topics
- **Submission managers**: Report completeness (E3) findings feed into publishing QC
- **Medical writers**: Remediation actions provide specific content requirements
- **Biostatisticians**: Statistical findings (E9) require SAP amendments

### Related Skills
- `skill-nonclinical.md`: Nonclinical study evaluation (Modules 2.4/4)
- `skill-quality.md`: CMC/pharmaceutical quality evaluation (Module 3)
- `skill-ctd-structure.md`: Overall eCTD structure validation

---

## Usage Examples

### Example 1: Evaluate a Phase 3 Confirmatory Trial Protocol
```
Input: Phase 3 protocol for chronic NSAID
Applicable: E1 (chronic use), E3, E4, E7 (elderly use expected), E8(R1), E9, E10
Skip: E20 (not adaptive)
Focus: Population exposure thresholds, elderly inclusion, control group (active + placebo)
```

### Example 2: Evaluate an Adaptive Seamless Phase 2/3 Design
```
Input: Adaptive design protocol for oncology
Applicable: E3, E4, E8(R1), E9, E9(R1), E10, E20
Focus: Adaptation rules, Type I error control, simulation evidence, IDMC charter
Skip: E1 (life-threatening), E7 (pediatric oncology)
```

### Example 3: Evaluate a Clinical Study Report for Submission
```
Input: Completed CSR for cardiovascular drug
Applicable: All (E1, E3, E4, E7, E8(R1), E9, E10)
Focus: Report completeness (E3), safety database size (E1), elderly subgroup (E7)
Skip: E20 (fixed design)
```
