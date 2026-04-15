# SKILL: CMC Analytical Methods & Impurity Data Analysis

## Purpose

Evaluate pharmaceutical CMC (Chemistry, Manufacturing, and Controls) analytical methods, impurity profiles, and specification data against ICH requirements. This skill covers the full analytical procedure lifecycle — from development through validation to ongoing verification — plus all impurity classification systems, specification-setting logic, pharmacopoeial harmonisation rules, and API GMP requirements.

## Source Authority

All rules derive from ICH guidelines extracted from 87 source PDFs:

| Guideline | Domain |
|-----------|--------|
| Q2(R2) | Analytical Procedure Validation |
| Q14 | Analytical Procedure Development |
| Q3A(R2) | Impurities in New Drug Substances |
| Q3B(R2) | Impurities in New Drug Products |
| Q3C(R9) | Residual Solvents |
| Q3D(R2) | Elemental Impurities |
| Q3E (Draft) | Extractables and Leachables |
| Q4B(R1) + Annexes 1–14 | Pharmacopoeial Harmonisation |
| Q6A | Specifications: Chemical Substances |
| Q6B | Specifications: Biotech/Biological Products |
| Q7 + Q&As | GMP for Active Pharmaceutical Ingredients |

Structured rule data: `analytical-impurity-rules.json` (same directory).

---

## When to Use This Skill

- Reviewing or drafting analytical method validation protocols
- Setting impurity specifications for drug substances or drug products
- Evaluating residual solvent, elemental impurity, or E&L control strategies
- Assessing whether a pharmacopoeial method is interchangeable across regions
- Reviewing biotech product specifications (potency, purity, HCP, DNA)
- Auditing API manufacturing against GMP requirements
- Preparing CTD Module 3 analytical sections (S.4.2/P.5.2, S.4.3/P.5.3)
- Evaluating post-approval analytical procedure changes

---

## Analysis Framework

### Step 1: Classify the Analytical Context

Determine which ICH guidelines apply based on what is being analyzed:

| Context | Primary Guidelines |
|---------|-------------------|
| Drug substance impurities | Q3A, Q6A |
| Drug product degradation products | Q3B, Q6A |
| Residual solvents | Q3C |
| Elemental impurities | Q3D |
| Extractables & leachables | Q3E |
| Analytical method validation | Q2(R2) |
| Analytical procedure development/lifecycle | Q14 |
| Biotech product specifications | Q6B |
| Pharmacopoeial test interchangeability | Q4B + relevant Annex |
| API manufacturing GMP | Q7 |

### Step 2: Apply the Analytical Procedure Lifecycle

The ICH Q14/Q2(R2) lifecycle has three stages:

**Stage 1 — Development (Q14):**
1. Define the Analytical Target Profile (ATP): intended purpose, linked CQA, performance criteria, rationale
2. Conduct risk assessment (Ishikawa diagrams) to identify all procedure parameters
3. Choose approach: minimal (traditional OFAT) or enhanced (DoE, multivariate, PARs)
4. Develop control strategy: system suitability tests, sample suitability, reference controls, data quality checks

**Stage 2 — Validation (Q2(R2)):**
1. Check the applicability matrix — which characteristics apply to which method type:

| Characteristic | ID | Assay | Quant. Impurity | Limit Test | Dissolution |
|---|---|---|---|---|---|
| Specificity | Yes | Yes | Yes | Yes | Yes |
| Repeatability | — | Yes | Yes | — | Yes |
| Intermediate precision | — | Yes | Yes | — | Yes |
| Accuracy | — | Yes | Yes | Maybe | Yes |
| Reportable range | — | Yes | Yes | Maybe | Yes |
| Detection limit | — | — | — | Yes | — |
| Quantitation limit | — | — | Yes | — | — |

2. Apply minimum requirements:
   - Repeatability: ≥6 determinations at 100% OR 3 levels × 3 reps
   - Intermediate precision: ≥6 determinations varying days/analysts/equipment
   - Accuracy: 3 levels × 3 replicates = 9 determinations minimum
   - Reportable range: ≥5 concentration levels
   - DL: S/N 2:1–3:1 or DL = 3.3σ/S
   - QL: S/N 10:1 or QL = 10σ/S (verify with accuracy/precision at QL)

3. Verify reportable ranges:

| Method Type | Required Range |
|---|---|
| Assay (drug substance) | 80%–120% |
| Assay (drug product, CU) | 70%–130% |
| Dissolution | ±20% over specified range |
| Impurities (quantitative) | QL to 120% of spec |
| Potency bioassay | 80%–120% of spec range |
| qPCR | ≥5 log₁₀ |

**Stage 3 — Verification (Q14):**
1. Trend control samples, SST data, reference material results over time
2. Use statistical process control (control charts)
3. Periodic verification against reference procedure
4. Revalidate when: procedure changes, new degradation products found, matrix changes, adverse trends

### Step 3: Evaluate Impurity Controls

#### 3a. Organic Impurities — Drug Substances (Q3A)

Look up thresholds by maximum daily dose:

**Reporting:**
- ≤2 g/day → 0.05%
- >2 g/day → 0.03%

**Identification:**
- ≤1 mg/day → 1.0% or 5 µg TDI (whichever lower)
- >1–10 mg/day → 0.5% or 20 µg TDI
- >10 mg–2 g/day → 0.2% or 2 mg TDI
- >2 g/day → 0.10%

**Qualification:**
- ≤10 mg/day → 1.0% or 50 µg TDI
- >10–100 mg/day → 0.5% or 200 µg TDI
- >100 mg–2 g/day → 0.2% or 3 mg TDI
- >2 g/day → 0.15%

#### 3b. Degradation Products — Drug Products (Q3B)

**Reporting:**
- ≤1 g/day → 0.1%
- >1 g/day → 0.05%

**Identification:**
- <1 mg → 1.0% or 5 µg TDI
- 1–10 mg → 0.5% or 20 µg TDI
- >10–100 mg → 0.2% or 2 mg TDI
- >100 mg–2 g → 0.2%
- >2 g → 0.10%

**Qualification:**
- <1 mg → 1.0% or 50 µg TDI
- 1–10 mg → 0.5% or 200 µg TDI
- >10–100 mg → 0.5% or 200 µg TDI
- >100 mg–2 g → 0.2% or 3 mg TDI
- >2 g → 0.15%

#### 3c. Residual Solvents (Q3C)

Classify by class and apply:
- **Class 1 (avoid):** Benzene 2 ppm, CCl₄ 4 ppm, 1,2-dichloroethane 5 ppm, 1,1-dichloroethene 8 ppm, 1,1,1-trichloroethane 1500 ppm
- **Class 2 (limit):** Apply PDE-based limits (50–4500 ppm depending on solvent)
- **Class 3 (low toxicity):** 5000 ppm acceptable without justification

Option 1: Use ppm limits (assumes ≤10 g/day dose)
Option 2: Calculate from PDE: concentration (ppm) = (1000 × PDE) / actual daily dose

#### 3d. Elemental Impurities (Q3D)

Classify elements and check PDEs by route:

| Class | Elements | Evaluate When |
|---|---|---|
| 1 | Cd, Pb, As, Hg | Always, all routes |
| 2A | Co, V, Ni | Always, all routes |
| 2B | Tl, Au, Pd, Ir, Os, Rh, Ru, Se, Ag, Pt | Only if intentionally added or identified risk |
| 3 | Li, Sb, Ba, Mo, Cu, Sn, Cr | Only if intentionally added |

Critical parenteral PDEs (µg/day): Cd=2, Pb=5, As=15, Hg=3, Co=5, V=10, Ni=20

Option 1: Permitted concentrations (µg/g) assuming ≤10 g/day
Option 2a/2b: PDE-based assessment across components

#### 3e. Extractables & Leachables (Q3E Draft)

Apply safety concern thresholds:
- **TTC (mutagenicity):** 1.5 µg/day (>10 yr exposure), 10 (1–10 yr), 20 (1 mo–1 yr), 120 (≤1 mo)
- **QT (non-mutagenic):** Oral 48 µg/day (>1–10 yr), 136 (≤1 mo); Parenteral 12 (>1–10 yr), 26 (≤1 mo)
- **Local toxicity:** 20 ppm (ophthalmic), 50 ppm (subcutaneous), 500 ppm (dermal), 5 µg/day (inhalation)

Calculate AET = SCT × UF × dosing factors (SCT = lower of TTC and QT)

Classify leachables: Class 1 (avoid), Class 2 (limit to TTC/QT), Class 3 (qualified to 1.0 mg/day)

### Step 4: Set Specifications (Q6A / Q6B)

#### Chemical Drug Substances — Universal Tests:
1. **Description** — qualitative (state, color)
2. **Identification** — minimum 2 tests; one IR recommended
3. **Assay** — specific, stability-indicating
4. **Impurities** — organic (Q3A), inorganic (ROI, heavy metals), residual solvents (Q3C)

#### Chemical Drug Products — Universal Tests:
1. **Description** — shape, size, color, markings
2. **Identification** — minimum 2 tests, one highly specific
3. **Assay** — specific, stability-indicating, % label claim
4. **Impurities** — degradation products per Q3B

#### Apply Decision Trees:
- **DT#1/2** (acceptance criteria): Mean batch level + 3×SD + stability increase; compare to qualified level
- **DT#3** (particle size): Required if critical to dissolution, bioavailability, processability, stability, CU, or appearance
- **DT#4** (polymorphism): Screen → characterize → assess safety/performance impact
- **DT#5** (chirality): Single enantiomer → chiral ID + assay + enantiomeric impurity
- **DT#6** (microbial quality): Growth-supporting → establish limits; consistent → skip-lot
- **DT#7** (dissolution): Modified release → multi-point; rapid dissolution + disintegration correlation → disintegration acceptable
- **DT#8** (microbial DP): Preservative → chemical + effectiveness; dry dosage → may omit if growth-inhibitory

#### Biotech Products (Q6B):
- **Potency:** Validated biological assay required; replacement by physicochemical only with demonstrated correlation AND established manufacturing history
- **Purity:** Multiple orthogonal methods; product-related substances (active variants) are NOT impurities
- **Process-related impurities:** HCP, host cell DNA, cell culture components, downstream reagents, column leachables
- **Product-related impurities:** Truncated forms, deamidated, oxidized, aggregates, altered glycosylation
- **Contaminants:** Must be strictly avoided; viral contamination per Q5A

### Step 5: Check Pharmacopoeial Interchangeability (Q4B)

Before citing an EP/JP/USP test interchangeably:

1. Identify the relevant Q4B Annex
2. Check if the test is **fully** or **conditionally** interchangeable
3. Apply conditions — key restrictions:
   - Particulate contamination: NOT interchangeable at 100 mL volume (JP stricter)
   - Disintegration: NOT for >18 mm tablets or delayed-release
   - Uniformity of dosage units: Mass variation NOT interchangeable unless 25 mg/25% threshold; FDA rejects 2% RSD exception
   - Dissolution: NOT with enzymes, delayed-release, JP Interpretation 2, or >1L vessels
   - Sterility: Specific sampling rule for batches >500 containers
4. Note regional requirements:
   - EU: Ph. Eur. is mandatory; interchangeability means other texts fulfill Ph. Eur. requirements
   - FDA: May still request suitability demonstration for specific product

### Step 6: Audit API GMP (Q7)

Key audit checkpoints:

**Quality System:**
- [ ] Independent quality unit (no production responsibilities for release decision-maker)
- [ ] Annual product quality review covering all required elements
- [ ] Formal change control system with quality impact evaluation
- [ ] OOS investigation procedure documented and followed

**Documentation:**
- [ ] Records retained: 1 year after expiry OR 3 years after distribution (retest date)
- [ ] Master production instructions approved by quality unit
- [ ] Batch records include all required elements (parameters, yields, deviations, signatures)

**Production:**
- [ ] Critical operations witnessed or equivalent control
- [ ] Time limits met; deviations documented
- [ ] IPC acceptance criteria based on development/historical data
- [ ] OOS batches never blended

**Laboratory:**
- [ ] Impurity profile established per API (identity, range, classification)
- [ ] Stability program: first 3 commercial batches + ≥1/year ongoing
- [ ] Reserve samples: quantity for ≥2 full analyses; proper retention periods
- [ ] CoAs contain all required data elements

**Validation:**
- [ ] Process: 3 consecutive successful batches (prospective)
- [ ] Cleaning: residue limits justified, analytical methods validated
- [ ] Analytical methods: validated per Q2 or verified for compendial methods

**Facilities:**
- [ ] Dedicated areas for penicillins/cephalosporins (mandatory)
- [ ] Water quality appropriate for intended use
- [ ] Equipment calibration traceable to certified standards

**Biotech/Fermentation Specific:**
- [ ] Cell bank access restricted; periodic monitoring
- [ ] Critical culture parameters monitored (temp, pH, agitation, gases)
- [ ] Viral removal/inactivation within validated parameters
- [ ] Separate areas and air handling for pre-viral vs post-viral steps

### Step 7: Evaluate Post-Approval Changes (Q14/Q12)

Classify changes by risk:

| Risk Level | Examples | Requirements |
|---|---|---|
| High (PA) | Change of analytical principle, ATP criteria change | Full validation + comparative analysis + accept/reject demonstration |
| Medium (NM) | Change within same principle, SST modification | Partial/full revalidation + comparative analysis |
| Low (NL) | Site transfer, cell preparation change | Partial revalidation OR comparative analysis OR justification |

Bridging acceptance criteria (illustrative):
- Impurity ≤1.0%: max difference ±10%; precision RSD ≤10% each procedure
- Impurity ≤0.10%: max difference ±25%; precision RSD ≤10% each procedure

---

## Output Format

When analyzing CMC data, structure findings as:

```
## CMC Analytical Assessment

### 1. Method Classification
- Method type: [ID / Assay / Quant. Impurity / Limit Test / Dissolution / Other]
- Product type: [Chemical DS / Chemical DP / Biotech DS / Biotech DP]
- Applicable guidelines: [list]

### 2. Validation Status
- Characteristics evaluated: [list with pass/fail/gap]
- Reportable range: [stated vs required]
- Key numerical criteria: [specifics]

### 3. Impurity Control Assessment
- Classification: [organic / inorganic / solvent / elemental / E&L]
- Thresholds applied: [reporting / identification / qualification]
- Compliance: [meets / gaps identified]
- Specification-setting logic: [DT reference if applicable]

### 4. Pharmacopoeial Considerations
- Test interchangeability: [fully / conditionally / not interchangeable]
- Regional restrictions: [if any]

### 5. GMP Compliance (if API)
- Key findings: [compliant / non-compliant areas]

### 6. Gaps & Recommendations
- [Prioritized list of findings with ICH section references]
```

---

## Quick Reference: Critical Numerical Thresholds

| Parameter | Value | Source |
|---|---|---|
| DL signal-to-noise | 2:1 or 3:1 | Q2(R2) |
| DL formula | 3.3σ/S | Q2(R2) |
| QL signal-to-noise | 10:1 | Q2(R2) |
| QL formula | 10σ/S | Q2(R2) |
| Assay range (DS) | 80%–120% | Q2(R2) |
| Assay range (DP, CU) | 70%–130% | Q2(R2) |
| Impurity range | QL–120% spec | Q2(R2) |
| Linearity levels | ≥5 | Q2(R2) |
| Accuracy minimum | 3 levels × 3 reps | Q2(R2) |
| Repeatability minimum | 6 determinations | Q2(R2) |
| DS reporting threshold | 0.05% (≤2 g) / 0.03% (>2 g) | Q3A |
| DP reporting threshold | 0.1% (≤1 g) / 0.05% (>1 g) | Q3B |
| Class 1 solvent (benzene) | 2 ppm | Q3C |
| Class 3 solvent default | 5000 ppm | Q3C |
| Cd oral PDE | 5 µg/day | Q3D |
| Pb oral PDE | 5 µg/day | Q3D |
| Mutagenic TTC (>10 yr) | 1.5 µg/day | Q3E |
| Tablet friability | NMT 1.0% | Q4B Annex 9 |
| Particulate ≥10µm (≥100 mL) | NMT 25/mL | Q4B Annex 3 |
| Particulate ≥25µm (≥100 mL) | NMT 3/mL | Q4B Annex 3 |
| Chromatographic SST RSD | ≤2.0% | Q2(R2)/Q14 |
| Bioassay R² standard curve | ≥0.97 | Q2(R2) |
| Process validation batches | 3 consecutive | Q7 |
| Retrospective validation batches | 10–30 | Q7 |
| Stability: first commercial batches | 3 | Q7 |
| Stability: ongoing per year | ≥1 batch | Q7 |
| Record retention (expiry) | ≥1 year after expiry | Q7 |
| Record retention (retest) | ≥3 years after distribution | Q7 |
| Reserve sample quantity | ≥2 full analyses | Q7 |
