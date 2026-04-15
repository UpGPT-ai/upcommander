# SKILL: Safety Pharmacology Evaluation

## Purpose
Evaluate nonclinical safety pharmacology data packages for compliance with ICH S7A, S7B, M3(R2), and the E14/S7B Q&As (2022). Assess completeness of the core battery, adequacy of cardiac safety (proarrhythmia) evaluation, timing alignment with clinical development stage, and identify gaps requiring resolution before regulatory submission.

## Source Guidelines
- **ICH S7A** (Nov 2000): Safety Pharmacology Studies for Human Pharmaceuticals
- **ICH S7B** (May 2005): Nonclinical Evaluation of the Potential for Delayed Ventricular Repolarization (QT Interval Prolongation)
- **ICH M3(R2)** (Jun 2009): Guidance on Nonclinical Safety Studies for Clinical Trials and Marketing Authorization
- **ICH E14/S7B Q&As** (Feb 2022): Integrated nonclinical-clinical proarrhythmia risk assessment
- **ICH E14/S7B IWG Concept Paper** (Mar 2024): Round 2 Q&As for novel modalities

---

## Evaluation Framework

### STEP 1: Determine Scope and Modality

**Question:** What type of pharmaceutical is being evaluated?

| Modality | Safety Pharmacology Approach |
|----------|------------------------------|
| Small molecule (NCE) | Full S7A core battery + S7B hERG + in vivo QT required |
| Monoclonal antibody | Reduced package acceptable; TQT not required unless target-related cardiac risk (E14 Q6.3) |
| Large targeted protein | Same as mAb per E14 Q6.3 |
| Antibody-drug conjugate | Assess both antibody (reduced) and payload (full if small molecule); hybrid approach |
| Oligonucleotide (ASO/siRNA) | Evolving; assess based on PK/PD profile, off-target potential, regional guidance |
| Peptide | Case-by-case; consider membrane permeability and ion channel interaction potential |
| Gene therapy / vaccine | Generally low direct ion channel risk; assess target-related cardiac effects |

**Key Rule:** If the modality has increased target specificity and low probability of off-target ion channel interaction, a justified reduced safety pharmacology package may be acceptable (ICH S7A Section 2.9, E14 Q6.3).

**Flag if:** No justification provided for omitting standard assessments for any modality.

---

### STEP 2: Evaluate Core Battery Completeness

The core battery must be completed **before first-in-human (FIH) dosing**. Check each organ system:

#### 2A. Central Nervous System (CNS)
- [ ] **Motor activity** assessed (quantitative, e.g., locomotor activity counts)
- [ ] **Behavioral changes** evaluated (FOB, Irwin, or modified Irwin test)
- [ ] **Coordination** tested (e.g., rotarod, balance beam)
- [ ] **Sensory/motor reflex responses** assessed
- [ ] **Body temperature** measured
- [ ] Study conducted via **clinical route** or justified alternative
- [ ] **Multiple dose levels** tested to establish dose-response
- [ ] Dose levels include and **exceed anticipated therapeutic range**
- [ ] **GLP compliant**

**Common deficiency:** Clinical observation only, without quantitative assessment. Per S7A, qualitative behavioral observation alone is generally insufficient.

#### 2B. Cardiovascular System (CV)
- [ ] **Blood pressure** measured (systolic, diastolic, mean arterial)
- [ ] **Heart rate** measured
- [ ] **ECG** recorded (including QT/QTc interval)
- [ ] Conscious freely moving **telemetered** animal model used (or justified alternative)
- [ ] **Appropriate non-rodent species** (typically dog or NHP)
- [ ] Exposures include and **exceed anticipated therapeutic concentrations**
- [ ] **Heart rate correction** method described and justified
- [ ] **GLP compliant**

**S7B-Specific Cardiac Safety (see Step 3 for detailed evaluation)**

#### 2C. Respiratory System
- [ ] **Respiratory rate** measured quantitatively
- [ ] **Tidal volume** OR **hemoglobin oxygen saturation** measured
- [ ] **NOT** relying on clinical observation alone (S7A explicitly states this is inadequate)
- [ ] Appropriate species and dose levels
- [ ] **GLP compliant**

**Verdict for Step 2:**
- All items checked = **PASS: Core battery complete**
- Any critical gap = **FAIL: Identify specific missing endpoint(s)**
- Note: Individual endpoints may be incorporated into toxicology studies if rigor equivalent to standalone (M3(R2) Q&A 5.1)

---

### STEP 3: Cardiac Safety / Proarrhythmia Assessment (S7B)

This is the most complex and scrutinized component. Evaluate systematically:

#### 3A. In Vitro hERG (IKr) Assay
- [ ] **hERG assay conducted** using cells heterologously expressing hKv11.1
- [ ] **Best practice conditions met:**
  - [ ] Near physiological temperature (35-37 C)
  - [ ] Stimulation frequency 0.2-1 Hz
  - [ ] Adequate baseline stability before drug application
  - [ ] Steady-state drug effect achieved before measurement
  - [ ] Seal resistance and recording quality documented
  - [ ] Series resistance compensation noted
- [ ] **IC50 reported** in both micromolar and ng/mL with Hill coefficient
- [ ] **Concentration verification** performed (nominal vs. measured)
- [ ] **Positive control** included (reference drug with known TdP risk, e.g., dofetilide, cisapride)
  - [ ] Positive control achieves 20-80% block
  - [ ] Results consistent with reference data
- [ ] **Vehicle (negative) control** included
- [ ] **Safety margin calculated:**
  - Free drug IC50 / estimated free Cmax,ss at high clinical exposure
  - If protein binding <1% experimentally, use 1% as floor
  - Compare to threshold derived from reference drugs tested under same protocol

**hERG Safety Margin Interpretation:**
| Safety Margin | Risk Level | Action |
|---------------|-----------|--------|
| Well above reference drug threshold | Low risk | Supports low proarrhythmic liability |
| Near threshold | Uncertain | Follow-up studies recommended |
| Below threshold | Elevated risk | Follow-up studies required; clinical implications |

#### 3B. In Vivo QT Study
- [ ] Conducted in **conscious telemetered non-rodent** (preferred) or justified alternative
- [ ] **Same species as toxicology** studies used (preferred, per S7B Q&A 3.1)
- [ ] **Exposures cover anticipated high clinical exposure** scenario
- [ ] **Heart rate correction:**
  - [ ] Method described (individual correction preferred over Bazett/Fridericia)
  - [ ] Independence of QTc from RR demonstrated (QTc-RR plots)
  - [ ] Justification provided if test drug affects heart rate
- [ ] **PK sampling** in same animals (or justified satellite/separate day)
- [ ] **Statistical sensitivity** demonstrated:
  - [ ] Study powered to detect approximately 10 ms QTc effect
  - [ ] Minimum detectable difference reported
- [ ] **Positive control** data available (historical or concurrent)
- [ ] No QTc prolongation at exposures exceeding high clinical exposure = low risk

#### 3C. Follow-up Studies (if triggered)
Evaluate whether follow-up studies are warranted and, if conducted, adequate:

**Triggers requiring follow-up:**
- hERG IC50 near or below safety margin threshold
- QTc prolongation in in vivo study
- QTc prolongation observed clinically
- Pharmacological class associated with cardiac effects
- Structural similarity to drugs with known proarrhythmic risk

**Follow-up study types to evaluate:**
- [ ] **Additional ion channels** (CaV1.2, NaV1.5, IKs) — temperature 35-37 C, frequency 0.2 Hz
- [ ] **In vitro cardiomyocyte repolarization** (hiPSC-CMs or primary human cardiomyocytes)
  - [ ] Biological preparation and technology platform described
  - [ ] Electrophysiologic sensitivity calibrated with positive controls
  - [ ] Drug exposures characterized and reported
- [ ] **In silico proarrhythmia models** (if used)
  - [ ] Context of use defined
  - [ ] Model validation described
  - [ ] Uncertainty quantified
  - [ ] Predictive performance demonstrated
- [ ] **Additional in vivo studies** (different design, species, or conditions)

#### 3D. Integrated Risk Assessment
Per E14/S7B Q&A 1.1, compile the totality of evidence:

**Low TdP risk conclusion supported if ALL of:**
1. hERG assay (best practice) shows safety margin above threshold
2. In vivo QT assay shows no QTc prolongation at high clinical exposures
3. Clinical QTc assessment: upper bound 2-sided 90% CI of delta-QTc <10 ms
4. No QT outlier imbalances between treatment arms
5. CV safety database does not suggest proarrhythmic adverse events

**If nonclinical data show low risk but clinical data uncertain:**
- Totality of evidence argument may still support low risk if upper bound of 90% CI for delta-QTc <10 ms at highest clinically relevant exposure, even without positive control waiver

**If nonclinical data show elevated risk:**
- Clinical implications must be assessed
- Intensive ECG monitoring in Phase 2/3 may be required
- Concentration-response QTc modeling recommended
- Discuss with regulatory authorities before Phase 3

---

### STEP 4: Evaluate Supplemental Studies

Required before **marketing approval** unless justified as not necessary:

| Organ System | Required Endpoints | Status |
|-------------|-------------------|--------|
| Renal/Urinary | Urine volume, specific gravity, osmolality, pH, electrolytes, proteins, BUN/creatinine | [ ] Complete / [ ] Justified omission / [ ] Gap |
| Autonomic Nervous System | Receptor binding, functional agonist/antagonist responses, baroreflex | [ ] Complete / [ ] Justified omission / [ ] Gap |
| Gastrointestinal | GI transit, gastric secretion, ileal contraction, ulcerogenic potential | [ ] Complete / [ ] Justified omission / [ ] Gap |
| Other (if warranted) | Skeletal muscle, immune, endocrine — based on drug class | [ ] N/A / [ ] Complete / [ ] Gap |

**Acceptable justifications for omission:**
- Endpoints adequately covered in general toxicology studies
- Endpoints covered in clinical studies (e.g., renal function panels, GI adverse event monitoring)
- Drug class has no mechanistic basis for organ system concern
- Locally applied agent with negligible systemic exposure

---

### STEP 5: Timing Alignment with Clinical Development Stage

Cross-reference what studies should be available at each clinical stage:

#### Before FIH / Phase I
| Study | Required? | Status |
|-------|----------|--------|
| Core battery (CNS, CV, Respiratory) | YES | |
| hERG assay | YES | |
| In vivo QT study | YES (or in toxicology) | |
| Follow-up studies (if class concern) | CONDITIONAL | |
| Supplemental studies | NO (unless concern) | |

#### Before Phase II
| Study | Required? | Status |
|-------|----------|--------|
| All Phase I requirements | YES | |
| Complete genotoxicity battery | YES | |

#### Before Phase III
| Study | Required? | Status |
|-------|----------|--------|
| All Phase II requirements | YES | |
| Chronic toxicology (appropriate duration) | YES | |
| Male fertility study | YES | |
| Embryo-fetal development | YES (EU/Japan) or CONDITIONAL (US) | |
| Follow-up SP studies (if signals) | YES | |

#### Before Marketing Authorization
| Study | Required? | Status |
|-------|----------|--------|
| All Phase III requirements | YES | |
| Supplemental SP studies (or justified omission) | YES | |
| Pre-and-postnatal development | YES | |
| Carcinogenicity (if applicable per S1A) | YES | |

---

### STEP 6: Special Situations Assessment

#### 6A. Metabolites
- [ ] Major human metabolites identified
- [ ] If disproportionate metabolite in humans (>10% of drug-related exposure, not adequately represented in animal species):
  - [ ] Metabolite hERG assessment considered
  - [ ] Safety pharmacology of metabolite evaluated or justified as not needed
- Per M3(R2) Q&A 2.9: Nonclinical SP studies of metabolites generally not warranted because clinical SP endpoints assessed in Phase I before full metabolite characterization. Exception: if unpredicted SP signal in humans, then metabolite SP studies warranted.

#### 6B. Combination Products
- [ ] If individual agents tested per current standards, combination SP studies generally NOT required
- [ ] Exception: if combination raises specific mechanistic concern for additive/synergistic effects on vital organ function

#### 6C. Pediatric Development
- [ ] Core SP package from adult program available
- [ ] Juvenile animal studies considered if adult data insufficient
- [ ] One relevant species generally adequate for juvenile studies

#### 6D. Incorporation into Toxicology Studies
- [ ] If SP endpoints assessed in toxicology rather than standalone:
  - [ ] Methods validated to same rigor as standalone studies
  - [ ] For CV: heart rate correction, statistical sensitivity, positive controls, exposure measurement all meet S7B best practices
  - [ ] Justified as equivalent to standalone assessment

---

## Output Template

### Safety Pharmacology Evaluation Report

**Drug:** [Name]
**Modality:** [Small molecule / mAb / ADC / Peptide / Oligonucleotide / Other]
**Clinical Development Stage:** [Pre-FIH / Phase I / Phase II / Phase III / NDA-BLA]
**Date of Evaluation:** [Date]

#### Summary Scorecard

| Domain | Status | Critical Findings |
|--------|--------|-------------------|
| Core Battery - CNS | PASS/FAIL/PARTIAL | |
| Core Battery - CV | PASS/FAIL/PARTIAL | |
| Core Battery - Respiratory | PASS/FAIL/PARTIAL | |
| Cardiac Safety (S7B) - hERG | PASS/FAIL/NOT DONE | |
| Cardiac Safety (S7B) - In Vivo QT | PASS/FAIL/NOT DONE | |
| Cardiac Safety - Follow-up | ADEQUATE/GAPS/N/A | |
| Cardiac Safety - Integrated Risk | LOW/UNCERTAIN/ELEVATED | |
| Supplemental Studies | COMPLETE/GAPS/JUSTIFIED | |
| Timing Alignment | ALIGNED/GAPS | |
| GLP Compliance | COMPLIANT/DEVIATIONS | |

#### Risk Classification

| Risk Level | Definition |
|------------|-----------|
| **LOW** | All core battery complete, hERG margin above threshold, no in vivo QTc signal, supplemental studies complete or justified |
| **MODERATE** | Core battery complete but hERG margin near threshold, or in vivo QTc signal at supratherapeutic only, or supplemental studies incomplete |
| **HIGH** | Core battery gaps, hERG margin below threshold, in vivo QTc prolongation at therapeutic exposures, or critical timing misalignment |
| **CRITICAL** | Missing core battery studies at a stage where they are required, or unaddressed cardiac safety signals |

#### Detailed Findings
[For each domain, list specific findings, deviations, and recommendations]

#### Recommended Actions
1. [Prioritized list of studies or analyses needed]
2. [Regulatory interaction recommendations]
3. [Clinical monitoring implications]

---

## Quick Reference: Decision Trees

### Should a standalone S7B package be conducted?

```
Is this a small molecule?
  YES -> Full S7B package required (hERG + in vivo QT)
  NO -> Is there a known target-related effect on cardiac repolarization?
    YES -> Assess potential for cardiac repolarization delay (may not need full S7B)
    NO -> Is there potential for off-target ion channel interaction?
      YES -> hERG assay recommended; in vivo QT case-by-case
      NO -> Justify reduced/no S7B package based on modality and mechanism
```

### Is a Thorough QT (TQT) Study Required?

```
Is this a large targeted protein or monoclonal antibody?
  YES -> TQT not required unless target-related cardiac repolarization risk (E14 Q6.3)
  NO -> Can supratherapeutic exposure be safely tested in healthy volunteers?
    YES -> Standard TQT or concentration-response QTc analysis (E14 Q&A 5.1)
    NO -> Integrated nonclinical + clinical risk assessment (E14 Q&A 6.1)
           Nonclinical studies must cover high clinical exposure
           Alternative clinical QT assessment in patients
```

### When Are Follow-up Studies Needed?

```
hERG safety margin ABOVE threshold AND no in vivo QTc signal?
  YES -> Low risk; no follow-up needed for S7B
  NO -> At least one concerning finding?
    hERG near/below threshold -> Test additional ion channels + consider hiPSC-CM or in silico
    In vivo QTc prolongation -> Mechanism investigation (multi-channel, action potential studies)
    Clinical QTc signal -> Nonclinical follow-up to characterize mechanism + inform clinical monitoring
```
