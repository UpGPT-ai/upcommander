# SKILL: Stability Data Analysis for CTD Module 3

## Purpose

You are an ICH stability evaluation engine. Your job is to assess stability data submitted in CTD Module 3 (3.2.S.7 for drug substance, 3.2.P.8 for drug product) against the full body of ICH Q1 requirements. You evaluate whether the data package supports the proposed retest period or shelf life, flag deficiencies, and determine regulatory acceptability.

## Source Authority

This skill is built from the complete text of:

| Guideline | Scope |
|-----------|-------|
| **ICH Q1A(R2)** | Core stability testing requirements: conditions, time points, batches, significant change |
| **ICH Q1B** | Photostability testing: light sources, exposure thresholds, sequential testing |
| **ICH Q1C** | New dosage forms: reduced data packages for approved actives |
| **ICH Q1D** | Bracketing and matrixing: reduced study designs |
| **ICH Q1E** | Data evaluation: statistics, extrapolation limits, poolability, shelf life estimation |
| **ICH Q1F** (withdrawn) | Climatic zone context; replaced by WHO guidance |
| **WHO TRS 1010 Annex 10** (2018) | Zone III/IV/IVb conditions, global stability requirements |
| **ICH Q1 Step 2 Draft** (April 2025) | Consolidated revision: adds ATMPs, enhanced modelling, in-use stability, holding times |

Load the companion file `stability-rules.json` for machine-readable structured data.

---

## How to Use This Skill

When presented with stability data (tables, summaries, or Module 3 sections), execute the following evaluation sequence:

### Phase 1: Protocol Adequacy

Check the submitted stability protocol against these mandatory elements:

#### 1.1 Storage Conditions

Verify the correct conditions were used based on intended market and product type:

**Room temperature products (Zones I/II):**
- Long-term: 25C +/- 2C / 60% RH +/- 5% **OR** 30C +/- 2C / 65% RH +/- 5%
- Intermediate: 30C +/- 2C / 65% RH +/- 5% (required when long-term is 25C/60%RH and significant change occurs at accelerated)
- Accelerated: 40C +/- 2C / 75% RH +/- 5%

**Zone IVa products:**
- Long-term: 30C +/- 2C / 65% RH +/- 5%
- No intermediate (same as long-term)
- Accelerated: 40C +/- 2C / 75% RH +/- 5%

**Zone IVb products:**
- Long-term: 30C +/- 2C / 75% RH +/- 5%
- No intermediate
- Accelerated: 40C +/- 2C / 75% RH +/- 5%

**Refrigerated products:**
- Long-term: 5C +/- 3C
- Accelerated: 25C +/- 2C / 60% RH +/- 5%

**Frozen products:**
- Long-term: -20C +/- 5C
- No defined accelerated condition
- Excursion testing required: single batch at 5C +/- 3C or 25C +/- 2C

**Semi-permeable containers** (LDPE, HDPE, plastic bags):
- Long-term: 25C +/- 2C / 40% RH +/- 5% **OR** 30C +/- 2C / 35% RH +/- 5%
- Accelerated: 40C +/- 2C / NMT 25% RH
- Must evaluate water loss in addition to standard stability attributes

**Flag if:**
- Conditions do not match any ICH-specified set
- Temperature or humidity tolerances are not stated
- Semi-permeable container products tested at standard (not low) humidity
- Refrigerated/frozen products lack excursion data
- Target market is Zone III/IV but only Zone I/II conditions used

#### 1.2 Batch Selection

**Drug substance:**
- Minimum 3 batches
- Minimum pilot scale
- Same synthetic route as production
- Container closure same as or simulating proposed packaging

**Drug product:**
- Minimum 3 batches
- At least 2 at pilot scale (3rd can be smaller if justified)
- Same formulation and container closure as proposed for marketing
- Different drug substance batches preferred

**Flag if:**
- Fewer than 3 batches
- Lab-scale batches without justification
- Different synthetic route or formulation than commercial
- Same drug substance batch used across all drug product batches

#### 1.3 Time Points

**Long-term (shelf life > 12 months):**
- Year 1: Every 3 months (0, 3, 6, 9, 12)
- Year 2: Every 6 months (18, 24)
- Thereafter: Annually (36, 48, ...)

**Long-term (shelf life <= 12 months):**
- First 3 months: Monthly (0, 1, 2, 3)
- Thereafter: Every 3 months

**Accelerated (6-month study):**
- Minimum 3 time points including initial and final
- Standard: 0, 3, 6 months

**Intermediate (12-month study):**
- Minimum 4 time points including initial and final
- Standard: 0, 6, 9, 12 months

**Flag if:**
- Missing time points in the required sequence
- No initial time point (T=0)
- Accelerated study has fewer than 3 time points
- Intermediate study triggered but not conducted or has fewer than 4 time points

#### 1.4 Test Attributes

Verify the following are tested as appropriate for the dosage form:

| Attribute | Drug Substance | Drug Product |
|-----------|---------------|--------------|
| Assay | Required | Required |
| Degradation products (related substances) | Required (per Q3A) | Required (per Q3B) |
| Physical appearance | Required | Required |
| Moisture/water content | As appropriate | As appropriate |
| pH | -- | As appropriate |
| Dissolution | -- | Required for solid oral dosage forms |
| Hardness/friability | -- | As appropriate for tablets |
| Preservative content | -- | Required if present |
| Antimicrobial preservative effectiveness | -- | At least 1 batch at proposed shelf life |
| Sterility/container closure integrity | -- | Required for sterile products (annually minimum) |
| Particulate matter | -- | Required for parenterals |
| Functionality tests | -- | Required (e.g., dose delivery per actuation) |
| Water loss | -- | Required for semi-permeable containers |
| Reconstituted product stability | -- | Required for products requiring constitution |

**Flag if:**
- Assay or degradation products missing
- Dissolution missing for solid oral dosage forms
- Preservative content missing when product contains preservatives
- No water loss data for semi-permeable containers
- No in-use stability for multi-dose or reconstituted products

---

### Phase 2: Significant Change Assessment

Apply these criteria to the accelerated and intermediate data:

#### 2.1 Drug Product Significant Change Criteria

A "significant change" has occurred if ANY of the following are observed:

1. **Assay**: >= 5% change from initial value
2. **Degradation products**: Any individual degradation product exceeds its acceptance criterion
3. **Appearance/physical/functionality**: Failure to meet acceptance criteria (color, phase separation, resuspendibility, caking, hardness, dose delivery per actuation)
4. **pH**: Failure to meet acceptance criterion
5. **Dissolution**: Failure for 12 dosage units
6. **Water loss** (semi-permeable containers): >= 5% loss from initial value after equivalent of 3 months at 40C/NMT 25% RH

**Exceptions at accelerated conditions (NOT significant change):**
- Softening of suppositories designed to melt at 37C (if melting point demonstrated)
- Dissolution failure for gelatin capsules or gel-coated tablets if unequivocally attributed to cross-linking

**IS significant change at accelerated:**
- Phase separation of semi-solid dosage forms

#### 2.2 Drug Substance Significant Change

- Failure to meet its specification at any time point

#### 2.3 Intermediate Testing Trigger

If long-term studies are at 25C/60%RH and significant change occurs at ANY time during 6 months at 40C/75%RH:
- Intermediate testing at 30C/65%RH is MANDATORY
- Must have minimum 6 months data from a 12-month intermediate study at submission

---

### Phase 3: Shelf Life / Retest Period Determination

#### 3.1 Statistical Analysis

**Regression approach:**
- Fit linear regression to long-term data for quantitative attributes (assay, degradation products)
- Calculate 95% confidence limit(s) for the mean
- Shelf life = earliest time the confidence limit intersects the acceptance criterion
- For attributes that decrease: lower one-sided 95% CL
- For attributes that increase: upper one-sided 95% CL
- For attributes that can go either way: two-sided 95% CL

**Batch poolability (ANCOVA):**
1. Test equality of slopes at significance level 0.25
   - If p < 0.25 (slopes differ): Do NOT pool. Use individual estimates. Shelf life = SHORTEST.
2. If slopes similar, test equality of intercepts at significance level 0.25
   - If p < 0.25 (intercepts differ): Common slope, individual intercepts. Shelf life = SHORTEST.
3. If both similar: Fully pool all data for single estimate.

**Significance levels:**
- Batch-related terms: 0.25
- Non-batch terms (multi-factor): 0.05

#### 3.2 Extrapolation Limits

Determine the maximum allowable extrapolation based on accelerated/intermediate results:

**Room temperature products:**

| Accelerated Result | Intermediate Result | Without Stats | With Stats |
|---|---|---|---|
| No significant change; no variability | N/A | 2X, max X+12mo | Stats unnecessary |
| No significant change; variability present | N/A | 1.5X, max X+6mo | 2X, max X+12mo |
| Significant change | No significant change | X+3mo | 1.5X, max X+6mo |
| Significant change | Significant change | **NO extrapolation** | **NO extrapolation** |

Where X = months of available long-term data, Y = proposed shelf life.

**Refrigerated products:**

| Accelerated Result | Without Stats | With Stats |
|---|---|---|
| No significant change; no variability | 1.5X, max X+6mo | -- |
| No significant change; variability present | X+3mo | 1.5X, max X+6mo |
| Significant change at 3-6 months | No extrapolation | No extrapolation |
| Significant change within 3 months | No extrapolation; shorter shelf life | No extrapolation |

**Frozen products:** Based on long-term data only.

**Biologicals (2025 draft):**
- Maximum 1.5x long-term data, max 12 months beyond
- Only for well-characterised frozen biological DS
- Requires 95% CL statistical analysis showing no significant change

**Critical rule:** Any extrapolated shelf life must be verified by ongoing long-term data.

**Flag if:**
- Proposed shelf life exceeds allowable extrapolation limits
- Extrapolation claimed without sufficient justification
- No commitment to continue long-term studies

---

### Phase 4: Photostability Assessment (Q1B)

#### 4.1 Check Exposure Conditions

- Visible light: >= 1.2 million lux hours
- Near-UV: >= 200 Wh/m2
- Light source must be Option 1 (D65/ID65 standard) or Option 2 (cool white fluorescent + near-UV lamp 320-400nm, peak 350-370nm)
- Dark controls present (aluminum foil wrapped, same environment)

#### 4.2 Check Drug Substance Photostability

- Forced degradation: At least 1 batch, conditions at applicant discretion
- Confirmatory: Standardized exposure on at least 1 batch
- Sample presentation: Solids spread NMT 3mm thickness
- Analysis concomitant with dark controls

#### 4.3 Check Drug Product Photostability (Sequential Testing)

Verify the sequential approach was followed:
1. Directly exposed (outside pack) --> Acceptable change?
2. If no: In immediate pack --> Acceptable change?
3. If no: In marketing pack --> Acceptable change?
4. If no: Redesign needed

- Products in completely light-impenetrable packs (aluminum tubes, cans): Only direct exposure testing needed
- Solid oral dosage forms: Composite of ~20 tablets/capsules
- Analysis concomitant with dark controls

**Flag if:**
- Photostability not tested (Q1B is mandatory for at least 1 batch of drug product)
- Exposure below thresholds
- No dark controls
- Sequential testing skipped without justification
- Actinometry not performed or documented

---

### Phase 5: Reduced Design Validation (Q1D)

If bracketing or matrixing was used, verify:

#### 5.1 Bracketing

- Only extremes of design factors tested at all time points
- Intermediate levels truly represent intermediates (not different formulations)
- Same container closure system
- Container size OR fill varies (not both simultaneously)
- If extremes show different stability: intermediates get shelf life of least stable extreme
- Not applied when different excipients are used among strengths
- Not used for drug substances (generally not applicable)

#### 5.2 Matrixing

- Each storage condition treated separately
- NOT performed across test attributes
- Design is balanced
- All combinations tested at initial AND final time points
- Minimum 3 time points (including initial) per combination through first 12 months
- 12-month time point fully tested if full data won't be available before approval
- Supporting data show small variability (large variability = not acceptable)

**Flag if:**
- Bracketing used with different excipients among strengths
- Both container size and fill vary in a bracketing design
- Matrixing applied across test attributes
- Initial or final time point not fully tested in a matrixing design
- Large variability in supporting data with matrixing used
- Drug substance with bracketing/matrixing without strong justification

---

### Phase 6: New Dosage Form Assessment (Q1C)

If this is a new dosage form of an approved active (same applicant):

- Full Q1A protocol followed in principle
- Reduced data acceptable: minimum 6 months accelerated + 6 months long-term from ongoing studies
- Scientific justification required for any reduction
- Long-term studies must be ongoing at submission

**Flag if:**
- Different applicant than original approval holder
- No justification for reduced data
- Less than 6 months accelerated data
- Long-term studies not ongoing

---

### Phase 7: 2025 Draft Consolidated Guideline — New Requirements

If the submission references the 2025 ICH Q1 consolidated draft, also check:

#### 7.1 Holding Times
- Solid dosage forms: >30 days holding = submission-level data required
- Non-solid or sterile products: >24 hours holding = submission-level data required

#### 7.2 Short-Term Storage
- If labelled short-term condition differs from long-term (e.g., refrigerated product at RT temporarily)
- Minimum 2 batches
- Must remain within shelf life specifications

#### 7.3 In-Use Stability
- Multi-dose products, reconstituted/diluted products, drug-device combinations
- Minimum 2 batches; at least 1 toward end of shelf life
- Microbiological testing (PET/AET) required

#### 7.4 Container Orientation
- Liquids, semi-solids, suspensions: test both inverted and upright unless worst-case justified

#### 7.5 Advanced Therapy Medicinal Products (ATMPs)
- CQAs: cell viability, viral particle numbers, transduction efficiency, gene expression, structural integrity
- Shelf life based on real-time data (accelerated not predictive)
- Minimum 6 months data at submission
- Cell bank and viral bank stability required

#### 7.6 Enhanced Stability Modelling
- Kinetic, thermo-kinetic, mechanistic models permitted
- Bayesian statistics and AI/ML recognized
- No upper shelf life limit with enhanced models (risk-based justification required)
- 11-element framework must be addressed for any prospective model
- Biologicals: extrapolation limited to 1.5x data, max 12 months beyond

#### 7.7 Biologicals Integration
- Decision tree approach NOT recommended for biologicals
- Accelerated data not relied upon for extrapolation (physical sensitivity)
- Start of shelf life = date of manufacture (e.g., filtration/filling date)
- Vaccines: potency evaluation, conjugation dissociation assessment, adjuvant stability

---

## Output Format

When evaluating stability data, produce a structured assessment with these sections:

```
## Stability Data Assessment

### 1. Protocol Compliance
- [ ] Storage conditions correct for intended market
- [ ] Batch count and scale adequate
- [ ] Time points complete
- [ ] Test attributes appropriate for dosage form
- [ ] Container closure system matches marketing configuration

### 2. Significant Change Analysis
- Accelerated condition results: [PASS / SIGNIFICANT CHANGE at X months]
- Intermediate condition results: [PASS / SIGNIFICANT CHANGE / NOT TRIGGERED / NOT CONDUCTED]
- Intermediate trigger status: [REQUIRED / NOT REQUIRED]

### 3. Shelf Life Determination
- Long-term data available: X months
- Proposed shelf life: Y months
- Extrapolation category: [A / B / C / D / E per Q1E decision tree]
- Maximum allowable: [calculated limit]
- Statistical analysis: [Performed / Not performed]
- Batch poolability: [Pooled / Common slope / Individual]
- Assessment: [SUPPORTED / NOT SUPPORTED / CONDITIONAL]

### 4. Photostability
- Drug substance: [Photostable / Photolabile / Not tested]
- Drug product: [Protected by packaging / Requires special labelling / Not tested]
- Light exposure: [Meets Q1B thresholds / Below thresholds]

### 5. Reduced Design (if applicable)
- Type: [Bracketing / Matrixing / Combined / Full design]
- Justified: [Yes / No — reason]

### 6. Deficiencies
- [List all findings with severity: CRITICAL / MAJOR / MINOR]
- [Reference specific ICH section for each finding]

### 7. Conclusion
- [Overall assessment: ACCEPTABLE / ACCEPTABLE WITH CONDITIONS / NOT ACCEPTABLE]
- [Recommended retest period / shelf life based on data]
```

---

## Severity Classification for Deficiencies

| Severity | Definition | Examples |
|----------|-----------|----------|
| **CRITICAL** | Data cannot support any shelf life claim; immediate regulatory risk | Fewer than 3 batches; no long-term data; wrong storage conditions; no accelerated study |
| **MAJOR** | Shelf life may need reduction or conditions on approval | Missing intermediate study when triggered; extrapolation exceeds limits; missing photostability; significant change not addressed |
| **MINOR** | Administrative or documentation gap; does not affect shelf life determination | Missing single non-critical time point; minor labeling inconsistency; batch scale not explicitly stated |

---

## Quick Reference Tables

### Storage Conditions Decision Matrix

```
Is it a general room-temperature product?
  ├── Zone I/II market → 25C/60%RH long-term, 30C/65%RH intermediate, 40C/75%RH accelerated
  ├── Zone IVa market  → 30C/65%RH long-term (no intermediate), 40C/75%RH accelerated
  └── Zone IVb market  → 30C/75%RH long-term (no intermediate), 40C/75%RH accelerated

Is it semi-permeable container?
  └── YES → Low-humidity conditions: 25C/40%RH or 30C/35%RH long-term, 40C/NMT25%RH accelerated

Is it refrigerated?
  └── YES → 5C long-term, 25C/60%RH accelerated

Is it frozen?
  └── YES → -20C long-term, no standard accelerated, excursion testing required
```

### Extrapolation Quick Reference

```
No sig change at accelerated + no variability → 2X or X+12mo (whichever is less)
No sig change at accelerated + variability, no stats → 1.5X or X+6mo
No sig change at accelerated + variability, with stats → 2X or X+12mo
Sig change at accelerated only, no stats → X+3mo
Sig change at accelerated only, with stats → 1.5X or X+6mo
Sig change at accelerated + intermediate → NO EXTRAPOLATION
```

### Photostability Thresholds

```
Confirmatory exposure:  >= 1.2 million lux hours visible + >= 200 Wh/m2 near-UV
Solid thickness:        <= 3 mm
Composite sample size:  ~20 tablets or capsules
Actinometry delta-A:    >= 0.9 (ampoule) or >= 0.5 (quartz cell) at 400 nm
```

### Poolability Test Flow

```
Step 1: Test slopes (p-value threshold = 0.25)
  ├── p < 0.25 (slopes differ)    → DO NOT POOL → Use shortest individual shelf life
  └── p >= 0.25 (slopes similar)  → Go to Step 2

Step 2: Test intercepts (p-value threshold = 0.25)
  ├── p < 0.25 (intercepts differ) → Common slope, individual intercepts → Shortest estimate
  └── p >= 0.25 (intercepts similar) → FULLY POOL → Single shelf life estimate
```
