# SKILL.md -- Nonclinical Data Review (Module 4)

## Purpose

Review Module 4 (Nonclinical Study Reports) of a CTD/eCTD submission for completeness, regulatory compliance, and scientific adequacy against all applicable ICH S-series guidelines.

## Trigger

Use this skill when:
- Reviewing Module 4 nonclinical data packages
- Assessing nonclinical study adequacy for IND/CTA/NDA/MAA/BLA submissions
- Evaluating whether a nonclinical program supports the intended clinical development plan
- Identifying gaps in nonclinical data before regulatory submission
- Preparing nonclinical overviews or summaries (Module 2.4/2.6)

## Inputs Required

Before running this review, gather:

1. **Product profile**: Drug type (small molecule / biologic / ADC / gene therapy / oligonucleotide), mechanism of action, target, route of administration
2. **Clinical plan**: Intended indication, patient population, treatment duration, dosing schedule, clinical phase being supported
3. **Module 4 study list**: All nonclinical studies available (study type, species, duration, GLP status)
4. **Key findings**: Summary of major toxicological findings, NOAEL values, exposure margins
5. **Genotoxicity results**: Ames, in vitro mammalian cell, in vivo results
6. **Reproductive toxicity data**: Available FEED, EFD, PPND/ePPND results

## Review Framework

### STEP 1: Determine Applicable Regulatory Framework

Based on product type and indication, identify which ICH guidelines apply:

| Product Type | Primary Guidelines | Modified Requirements |
|---|---|---|
| Small molecule (non-cancer) | S1-S5, S7A/B, S8, S10 + M3(R2) | Standard full program |
| Small molecule (advanced cancer) | S9 + modified S1-S5, S7, S8, S10 | Reduced program per S9 |
| Biologic / mAb | S6(R1) + modified S1, S5, S7, S8 | Species relevance-driven |
| ADC | S9 + S6(R1) + ADC-specific Q&As | Conjugate-specific requirements |
| Gene therapy | S12 + product-specific tox | Biodistribution mandatory |
| Oligonucleotide | S13 (when finalized) + current S-series | ONT-specific considerations |
| Paediatric extension | S11 + age-appropriate guidelines | JAS if WoE warrants |

### STEP 2: General Toxicology Assessment

Review repeat-dose toxicity studies against requirements:

#### 2.1 Species Selection
- [ ] **Small molecules**: Both rodent (rat) and non-rodent (dog or NHP) tested
- [ ] **Biologics (S6(R1))**: Only pharmacologically relevant species used; species relevance documented via receptor binding, functional assays, or tissue cross-reactivity
- [ ] **Biologics short-term**: Two relevant species for studies up to 1 month
- [ ] **Biologics long-term**: One relevant species sufficient if comparable toxicity profile in short-term
- [ ] **Cancer drugs (S9)**: Single rodent species acceptable for genotoxic drugs targeting rapidly dividing cells
- [ ] **Gene therapy (S12)**: Biologically relevant species supporting vector transfer and expression

#### 2.2 Study Duration
- [ ] **Standard (S4)**: 6-month rodent + 9-month non-rodent for chronic indications
- [ ] **Biologics (S6(R1))**: Maximum 6 months; longer studies not informative
- [ ] **Cancer drugs (S9)**: Maximum 3 months for advanced cancer; no 6/9-month required
- [ ] **Duration supports clinical plan**: Study duration >= clinical treatment duration per M3(R2) table

#### 2.3 Study Design Quality
- [ ] Both sexes included (unless justified)
- [ ] Adequate group sizes (non-rodent: >= 3/sex/group + recovery)
- [ ] Recovery groups included and reversibility assessed
- [ ] Route matches intended clinical route
- [ ] Dosing schedule mirrors clinical schedule (especially for S9)
- [ ] High dose selection justified (MTD, exposure multiple, MFD, or limit dose)

#### 2.4 Toxicokinetics (S3A)
- [ ] TK integrated into all repeat-dose studies
- [ ] Parameters measured: AUC, Cmax at minimum
- [ ] Sampling at start AND end of treatment period
- [ ] Exposure margins calculated relative to human MRHD exposure
- [ ] Both sexes sampled (unless justified)
- [ ] Microsampling validated if used (S3A Q&As)
- [ ] Satellite groups adequate if main study sampling not feasible

#### 2.5 Immunogenicity (S6(R1) -- biologics only)
- [ ] ADA measured throughout repeat-dose studies
- [ ] ADA impact on PK/PD/toxicity correlated
- [ ] Neutralizing antibody characterization when warranted
- [ ] ADA status considered when interpreting toxicity findings

### STEP 3: Safety Pharmacology (S7A/S7B)

#### 3.1 Core Battery (required before FIH for non-cancer drugs)
- [ ] **CNS**: Motor activity, behavior, coordination, reflexes, body temperature assessed (FOB/Irwin)
- [ ] **Cardiovascular**: Blood pressure, heart rate, ECG in appropriate species
- [ ] **Respiratory**: Respiratory rate, tidal volume, SpO2 by quantitative methods (not just clinical observation)
- [ ] All core battery studies GLP-compliant

#### 3.2 Cardiac Safety / QT (S7B)
- [ ] **In vitro hERG assay**: Performed in hERG-expressing cells (NOT rat/mouse cells); IC50 determined; concentrations span therapeutic range
- [ ] **In vivo QT study**: Performed in appropriate species (dog/monkey/etc., NOT rat/mouse); QTc measured with justified correction formula
- [ ] **Integrated risk assessment**: All QT data synthesized; safety margin vs therapeutic exposure calculated
- [ ] Positive controls included and validated

#### 3.3 Cancer Drugs (S9 Exemptions)
- [ ] Stand-alone S7A/S7B NOT required; safety pharmacology endpoints incorporated into general tox
- [ ] ECG assessment in non-rodent tox study adequate

#### 3.4 Biologics (S6(R1))
- [ ] For highly specific receptor targeting: safety pharmacology in tox/PD studies acceptable
- [ ] For novel class: more extensive evaluation warranted

### STEP 4: Genotoxicity (S2(R1))

#### 4.1 Standard Battery Completeness
- [ ] **Option 1 complete**: Ames + in vitro mammalian cell assay + in vivo micronucleus
- [ ] **OR Option 2 complete**: Ames + in vivo two-tissue assessment (micronucleus + Comet/other)
- [ ] Ames test: all 5 required strains tested; with and without S9
- [ ] In vitro mammalian: top concentration 1 mM or 0.5 mg/mL (whichever lower)
- [ ] In vivo: adequate dose levels; exposure demonstrated for negative results

#### 4.2 Follow-up for Positive Results
- [ ] Positive in vitro (Ames negative): WoE assessment documented; mechanistic studies or two in vivo assays with exposure demonstration
- [ ] Positive Ames: extensive follow-up and risk-benefit documented
- [ ] Positive in vivo MN: non-genotoxic confounders evaluated; centromere analysis if warranted

#### 4.3 Biologics (S6(R1))
- [ ] Genotoxicity NOT required for standard biologics
- [ ] Exception: organic linker/non-protein components (ADCs) -- standard battery required

#### 4.4 Cancer Drugs (S9)
- [ ] Not essential for clinical trials; required for marketing
- [ ] Positive Ames: in vivo follow-up NOT warranted

### STEP 5: Carcinogenicity (S1A/S1B/S1B(R1))

#### 5.1 Need Assessment
- [ ] Continuous clinical use >= 6 months triggers requirement
- [ ] Cause-for-concern triggers evaluated (SAR, class effects, preneoplastic lesions, tissue retention)
- [ ] Exemptions properly justified (short-duration use, limited life expectancy, replacement therapy)

#### 5.2 Weight of Evidence (S1B(R1) Addendum)
- [ ] WoE assessment completed evaluating all 6 factors (target biology, secondary pharmacology, histopathology, hormonal perturbation, genotoxicity, immune modulation)
- [ ] Regulatory consultation documented for WoE-based waiver of 2-year rat study
- [ ] If WoE supports waiver: mouse study (rasH2-Tg or 2-year) still recommended

#### 5.3 Study Adequacy
- [ ] **2-year rat study** (if required): adequate strains, 90-day dose-ranging completed, high dose per S1C(R2) criteria
- [ ] **rasH2-Tg mouse** (if used): 6-month duration, high dose at 50-fold AUC ratio
- [ ] **Dose selection per S1C(R2)**: one of 6 high-dose criteria used and justified; mid/low doses provide human relevance data
- [ ] Dose-ranging study: 90 days minimum, both sexes, same strain as bioassay

#### 5.4 Cancer Drugs (S9) and Biologics (S6(R1))
- [ ] Cancer drugs (advanced): carcinogenicity NOT warranted
- [ ] Cancer drugs (adjuvant, high cure rate): likely needed before marketing
- [ ] Biologics: WoE approach; standard 2-year bioassays generally inappropriate

### STEP 6: Reproductive and Developmental Toxicity (S5(R3))

#### 6.1 Fertility (FEED)
- [ ] Conducted in rodent (rat preferred), >= 16/sex, 4 dose groups
- [ ] Male treatment >= 2 weeks pre-cohabitation (10 weeks if testicular toxicity in repeat-dose)
- [ ] Female treatment through implantation
- [ ] Cesarean section with corpora lutea, implantation sites, live/dead embryos
- [ ] For NHP-only biologics: reproductive tract histopathology from 3-month repeat-dose acceptable

#### 6.2 Embryo-Fetal Development (EFD)
- [ ] **Two species** for small molecules (rat + rabbit); single species acceptable per S9 for cancer drugs
- [ ] **Definitive studies GLP-compliant** with >= 16 pregnant females/group
- [ ] Treatment period covers organogenesis (species-appropriate gestational days)
- [ ] Full fetal evaluation: external, soft tissue, skeletal
- [ ] TK in pregnant animals included
- [ ] For biologics (NHP only): ePPND can substitute

#### 6.3 Pre/Postnatal Development (PPND)
- [ ] At least 16 litters in rodent
- [ ] F1 assessment through sexual maturity including behavioral/functional tests
- [ ] Neurobehavioral assessment (motor activity, learning/memory, startle)
- [ ] F1 reproductive performance evaluated

#### 6.4 Cancer Drugs (S9 Exemptions)
- [ ] FEED: NOT warranted; reproductive organ evaluation in general tox sufficient
- [ ] EFD: NOT required for clinical trials; available at marketing (exceptions for genotoxic class)
- [ ] PPND: NOT warranted

### STEP 7: Immunotoxicity (S8)

#### 7.1 Tier 1 Screening (All Compounds)
- [ ] Hematology with absolute differential leukocyte counts in repeat-dose studies
- [ ] Lymphoid organ weights (thymus, spleen) and histopathology
- [ ] Globulin levels monitored
- [ ] Bone marrow evaluation if hematologic or histopathologic findings warrant

#### 7.2 Tier 2 (If WoE Triggers Concern)
- [ ] Trigger factors evaluated: STS findings, pharmacology, patient population, structural similarity, drug disposition, clinical signs
- [ ] TDAR (T-cell dependent antibody response) if triggered -- completed before Phase III
- [ ] Immunophenotyping (flow cytometry) if triggered
- [ ] NK cell activity, host resistance, macrophage function, DTH as warranted

### STEP 8: Photosafety (S10)

#### 8.1 Initial Assessment
- [ ] UV-vis absorption spectrum (290-700 nm) characterized
- [ ] If MEC < 1000 at all wavelengths: no further testing (documented)
- [ ] If MEC >= 1000: proceed to experimental evaluation

#### 8.2 Experimental Evaluation (If Triggered)
- [ ] 3T3 NRU-PT or reconstructed skin model performed (systemic drugs)
- [ ] If positive in vitro: in vivo or clinical assessment conducted
- [ ] Evidence hierarchy respected: clinical > in vivo > in vitro
- [ ] For dermal products: photoallergy clinical assessment in Phase 3

#### 8.3 Excluded Products
- [ ] Peptides, proteins, mAbs, ADCs, oligonucleotides -- S10 does NOT apply

### STEP 9: Paediatric-Specific (S11)

#### 9.1 JAS Necessity
- [ ] WoE assessment completed before paediatric trial
- [ ] Decision to conduct or waive JAS justified based on age, developing organ concerns, existing data, target biology, selectivity, treatment duration

#### 9.2 JAS Adequacy (If Conducted)
- [ ] Species appropriate (rat preferred); age at initiation corresponds to youngest patient
- [ ] Core endpoints present: growth (weight + bone length), sexual development, clinical pathology, anatomic pathology, TK
- [ ] Additional endpoints included based on specific organ concerns (CNS, bone, reproductive, immune)
- [ ] Post-treatment period adequate for reversibility/delayed onset assessment
- [ ] GLP-compliant
- [ ] For paediatric-first/only: two species JAS

### STEP 10: Gene Therapy Specific (S12)

#### 10.1 Biodistribution
- [ ] BD study completed BEFORE FIH
- [ ] Biologically relevant species/model used
- [ ] Mandatory tissue panel assessed (injection site, gonads, adrenals, brain, spinal cord, liver, kidney, lung, heart, spleen, blood)
- [ ] Multiple time points covering peak, steady-state, and clearance
- [ ] qPCR/digital PCR as primary method with validated spike-and-recovery
- [ ] Group sizes adequate (>= 5 rodents or >= 3 non-rodents per sex/group/timepoint)

#### 10.2 Gonadal Assessment
- [ ] Both sexes evaluated for gonadal BD
- [ ] If persistent presence in gonads: germ cell vs non-germline cell determination performed

#### 10.3 Test Article Representativeness
- [ ] Test article representative of clinical GT product (manufacturing process, formulation, titre)

### STEP 11: Exposure Margin Assessment

For each pivotal nonclinical study, calculate and evaluate:

| Parameter | Calculation | Adequacy Threshold |
|---|---|---|
| NOAEL exposure margin | Animal AUC or Cmax at NOAEL / Human AUC or Cmax at MRHD | Context-dependent (see below) |
| High dose exposure | Document achievable vs target multiples | Per S1C(R2): 25x AUC for carcinogenicity |

**Exposure margin interpretation (S5(R3) framework):**
- < 4-fold: Known teratogen range (NOAEL)
- < 10-fold: Increased concern
- 10-25 fold: Moderate margin
- > 25-fold: Effects usually of minor clinical concern

### STEP 12: Gap Analysis and Risk Communication

After completing Steps 1-11, produce:

1. **Compliance matrix**: Each required study type mapped to available data, with pass/gap/partial status
2. **Gap list**: Missing or inadequate studies with regulatory risk level (Critical / Major / Minor)
3. **Risk mitigation recommendations**: For each gap, recommend either:
   - Conduct the study (with timeline impact)
   - Justify waiver (with regulatory precedent)
   - Accept risk with clinical monitoring plan
4. **Cross-reference check**: Ensure Module 2.4 (Nonclinical Overview) and Module 2.6 (Nonclinical Written Summary) accurately reflect Module 4 data

## Output Format

```markdown
# Module 4 Nonclinical Review Report

## Product Profile
- Drug: [name]
- Type: [small molecule / biologic / ADC / gene therapy / ONT]
- Indication: [indication]
- Route: [route]
- Target Population: [population, including age range]
- Clinical Phase Supported: [Phase I / II / III / NDA/MAA]

## Applicable Guidelines
[List ICH guidelines with version/year]

## Compliance Matrix

| Study Category | Required? | Available? | Adequate? | Gap Level | Notes |
|---|---|---|---|---|---|
| [category] | [Yes/No/Conditional] | [Yes/No/Partial] | [Yes/No/Partial] | [Critical/Major/Minor/None] | [details] |

## Key Findings
[Bullet list of significant toxicological findings and their clinical relevance]

## Exposure Margins
| Study | Species | NOAEL | NOAEL Exposure | Human Exposure (MRHD) | Margin | Assessment |
|---|---|---|---|---|---|---|

## Identified Gaps
### Critical Gaps (block submission)
### Major Gaps (may delay approval)
### Minor Gaps (addressable post-submission)

## Recommendations
[Prioritized action items with rationale]

## Regulatory Risk Assessment
[Overall assessment of nonclinical package adequacy for intended submission]
```

## Reference Data

Key numerical thresholds referenced throughout this review:

| Threshold | Value | Source |
|---|---|---|
| Carcinogenicity trigger duration | >= 6 months continuous clinical use | S1A |
| Dose-ranging study minimum | 90 days | S1C(R2) |
| High dose AUC ratio (standard carcinogenicity) | 25-fold | S1C(R2) |
| High dose AUC ratio (rasH2-Tg mouse) | 50-fold | S1B(R1) |
| Body weight decrease limit at MTD | <= 10% vs controls | S1C(R2) |
| Limit dose (carcinogenicity) | 1500 mg/kg/day (human dose <= 500 mg/day) | S1C(R2) |
| Limit dose (genotoxicity, acute) | 2000 mg/kg | S2(R1) |
| Limit dose (genotoxicity, 14+ days) | 1000 mg/kg | S2(R1) |
| In vitro mammalian cell top concentration | 1 mM or 0.5 mg/mL | S2(R1) |
| MEC photosafety threshold | 1000 L/mol/cm | S10 |
| Chronic tox rodent duration | 6 months | S4 |
| Chronic tox non-rodent duration | 9 months | S4 |
| Chronic tox biologic maximum | 6 months | S6(R1) |
| Chronic tox cancer maximum | 3 months | S9 |
| EFD group size | >= 16 pregnant females | S5(R3) |
| FEED group size | >= 16 per sex | S5(R3) |
| PPND group size | >= 16 litters | S5(R3) |
| EFD exposure concern threshold | NOAEL < 10-fold human | S5(R3) |
| EFD minor concern threshold | Effects > 25-fold human | S5(R3) |
| Repro tox high dose target | >= 25-fold AUC at MRHD | S5(R3) |
| Repro tox limit dose | 1 g/kg/day | S5(R3) |
| Biologic high dose | Max PD effect OR ~10-fold exposure | S6(R1) |
| BD rodent group size (gene therapy) | >= 5 per sex/group/timepoint | S12 |
| BD non-rodent group size (gene therapy) | >= 3 per sex/group/timepoint | S12 |
| JAS minimum dose groups | 3 + control | S11 |
