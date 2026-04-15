# EU GMP & EMA Module 3 CMC Analysis Skill

## Purpose

Analyze CTD Module 3 (Quality) dossier sections against EU GMP (EudraLex Volume 4) and EMA guideline requirements. Identify compliance gaps, EU-specific requirements not covered by FDA-oriented dossiers, and generate actionable deficiency assessments.

## When to Use

- Reviewing Module 3 CMC sections for EU Marketing Authorisation Applications (MAA)
- Gap analysis between FDA NDA/ANDA/BLA filings and EU CTD requirements
- Pre-submission readiness assessment for EU filings
- Supporting Qualified Person (QP) certification review
- Evaluating manufacturing site compliance with EU GMP
- Assessing biosimilar quality comparability packages for EU

## Input Required

The user should provide one or more of the following:
- Module 3 CTD sections (3.2.S Drug Substance, 3.2.P Drug Product)
- Manufacturing site information
- Batch analysis data / Certificates of Analysis
- Process validation reports
- Stability data
- Specifications and analytical methods
- Product type (small molecule, biological, biosimilar, herbal, radiopharmaceutical, sterile, etc.)

## Analysis Framework

### Phase 1: Product Classification & Applicable Requirements

1. **Classify the product** to determine which EU GMP annexes and EMA guidelines apply:
   - Small molecule oral solid → EU GMP Part I Chapters 1-9, Annex 8, Annex 15
   - Sterile product → Add Annex 1 (critical)
   - Biological/biotech → Add Annex 2
   - Biosimilar → Add EMA Biosimilars Quality Guideline + product-class-specific annex
   - Radiopharmaceutical → Add Annex 3
   - Herbal → Add Annex 7
   - Veterinary → Add Annex 4 or 5
   - Medicinal gas → Add Annex 6
   - Inhalation product → Add Annex 10
   - Modified release → EMA FDF guideline + process validation guideline (non-standard)
   - Investigational medicinal product → Add Annex 13

2. **Identify the regulatory procedure:**
   - Centralised Procedure (CP) → EMA/CHMP assessment
   - Decentralised Procedure (DCP) → Reference Member State + Concerned Member States
   - Mutual Recognition Procedure (MRP) → Existing MA in Reference Member State
   - National Procedure → Single Member State

### Phase 2: Drug Substance (3.2.S) Review

Check each subsection against EU-specific requirements:

#### 3.2.S.1 General Information
- [ ] INN and chemical name per Ph.Eur. nomenclature
- [ ] Pharmacopoeial monograph reference (Ph.Eur. takes precedence over USP)

#### 3.2.S.2 Manufacture
- [ ] EU GMP Part II (ICH Q7) compliance confirmed
- [ ] All manufacturing sites with EU GMP certificate or equivalent (MRA country)
- [ ] Starting material definition justified per ICH Q11 and EU GMP Part II
- [ ] For API from third countries: Written Confirmation from competent authority of manufacturing country that GMP standards equivalent to EU apply (Article 46b Directive 2001/83/EC)
- [ ] CEP (Certificate of Suitability) from EDQM available? If yes, can replace full 3.2.S description
- [ ] ASMF (Active Substance Master File) / EU DMF filed with EDQM if CEP not used

#### 3.2.S.3 Characterisation
- [ ] Impurity profiling per ICH Q3A
- [ ] Elemental impurities per ICH Q3D AND Ph.Eur. 2.4.20
- [ ] Mutagenic impurities per ICH M7 (EU implementation may have additional guidance from CHMP)
- [ ] Residual solvents per ICH Q3C AND Ph.Eur. 5.4

#### 3.2.S.4 Control of Drug Substance
- [ ] Specifications comply with Ph.Eur. monograph (where applicable) — Ph.Eur. is MINIMUM
- [ ] Additional tests beyond Ph.Eur. justified
- [ ] Reference standard: Ph.Eur. Chemical Reference Substance (CRS) used as primary where available
- [ ] Analytical methods validated per ICH Q2(R2)
- [ ] EU-specific: Certificates of Analysis from EDQM reference standards

#### 3.2.S.5 Reference Standards
- [ ] Ph.Eur. CRS used as primary standard
- [ ] Secondary (working) standards: traceability to Ph.Eur. CRS documented
- [ ] Qualification and certification clearly stated per EU GMP Chapter 6.20

#### 3.2.S.6 Container Closure System
- [ ] Compliance with Ph.Eur. container material monographs (3.1 series)
- [ ] Extractables/leachables per EMA guideline on plastic primary packaging

#### 3.2.S.7 Stability
- [ ] ICH Q1A(R2)/Q1B conditions AND Ph.Eur. requirements
- [ ] Photostability per ICH Q1B
- [ ] Retest period/shelf life supported by real-time data

### Phase 3: Drug Product (3.2.P) Review

#### 3.2.P.1 Description and Composition
- [ ] Formula with Ph.Eur. names for all excipients
- [ ] Overage justified per EMA FDF guideline
- [ ] Function of each excipient stated
- [ ] For biologics: formulation strategy vs. reference product documented

#### 3.2.P.2 Pharmaceutical Development
- [ ] Excipient selection justified; novel excipients: FULL drug substance-level dossier required (EMA excipients guideline)
- [ ] Excipients of animal/human origin: TSE/BSE risk assessment per EMA Note for Guidance
- [ ] Container closure: Ph.Eur. 3.1/3.2 series compliance; extractable/leachable studies per EMA guideline
- [ ] For generics: dissolution in 3 media (pH 1.2, 4.5, 6.8) per EMA BE guideline
- [ ] For biosimilars: side-by-side quality comparison with EU-authorised reference product at key milestones
- [ ] Design Space: clearly described if claimed; subject to CHMP approval
- [ ] Criticality assessment: CPPs and CQAs identified per ICH Q8/Q9/Q11

#### 3.2.P.3 Manufacture
- [ ] **EU batch release site** identified (EMA FDF guideline requirement)
- [ ] Batch formula for intended commercial scale (minimum 100,000 units for solid oral unless orphan)
- [ ] Process description with **target values or ranges** for all parameters (not "typical" or "suitable")
- [ ] CPPs and non-CPPs both described in detail
- [ ] In-process controls with acceptance criteria
- [ ] Hold times justified: >30 days (solid oral) or >24 hours (sterile) need stability data on >=2 pilot batches
- [ ] For sterile products: Annex 1 compliance including CCS, grade assignments for each operation
- [ ] EU GMP Annex 15 qualification/validation requirements addressed
- [ ] Scale-up factor <=10x from pilot to production (EMA PV guideline)

#### 3.2.P.3.5 Process Validation
- [ ] **Standard process:** validation scheme submitted; full data may be deferred post-approval
- [ ] **Non-standard process** (biologics, sterile, MDIs, mod-rel, novel tech): FULL production-scale validation data required at submission
- [ ] Minimum 3 production-scale batches (or justified fewer)
- [ ] Pilot batch minimum 10% of production scale or 100,000 units
- [ ] Traditional, continuous process verification, or hybrid approach documented
- [ ] Validation report signed by QP (EU GMP Annex 15)
- [ ] For cleaning validation: HBEL-based acceptance criteria for shared facilities

#### 3.2.P.4 Control of Excipients
- [ ] Ph.Eur. monograph compliance for all excipients with monographs
- [ ] CEP acceptable for excipients as alternative to full description
- [ ] Novel excipients: full dossier per EMA excipients guideline
- [ ] Functional excipients: FRC testing per Ph.Eur. Chapter 5.15
- [ ] TSE/BSE certification for animal-origin excipients

#### 3.2.P.5 Control of Drug Product
- [ ] Specifications comply with Ph.Eur. monograph (if applicable) as MINIMUM
- [ ] Release AND shelf-life specifications both provided
- [ ] Test methods validated per ICH Q2(R2)
- [ ] Batch analysis data: minimum 3 production batches or justified pilot batches
- [ ] For biosimilars: specification limits justified by comparability exercise

#### 3.2.P.7 Container Closure System
- [ ] Ph.Eur. 3.1/3.2 series compliance
- [ ] EMA guideline on plastic primary packaging materials addressed
- [ ] For sterile products: CCIT methodology described; 100% CCIT for fusion-sealed <=100mL (Annex 1)

#### 3.2.P.8 Stability
- [ ] ICH Q1A(R2) long-term, accelerated, stress conditions
- [ ] Ph.Eur. requirements met
- [ ] Ongoing stability commitment: 1 batch/year/strength/packaging (EU GMP Ch 6.32)
- [ ] Shelf life supported by real-time data at proposed storage conditions
- [ ] For biosimilars: stability profile comparable to reference; shelf life determined independently

### Phase 4: EU-Specific Gap Analysis (vs. FDA-Oriented Dossier)

If the dossier was originally prepared for FDA, check for these common gaps:

| # | Common Gap | EU Requirement | Action |
|---|-----------|---------------|--------|
| 1 | No QP identified | QP must be named for batch release site | Add QP details |
| 2 | USP references only | Ph.Eur. monograph compliance required | Cross-reference or add Ph.Eur. testing |
| 3 | No CEP/ASMF for API | CEP or ASMF expected for established APIs | File ASMF or obtain CEP from EDQM |
| 4 | No Written Confirmation for third-country API | Article 46b requires WC from API country authority | Obtain WC |
| 5 | Site Master File missing | EU GMP Chapter 4 requires SMF | Prepare SMF |
| 6 | No CCS for sterile | Annex 1 mandates formal CCS | Develop CCS document |
| 7 | PUPSIT not performed | Annex 1 requires PUPSIT | Implement PUPSIT programme |
| 8 | No HBEL for shared facility | EU requires toxicological HBEL evaluation | Commission HBEL assessment |
| 9 | 1/1000th dose cleaning limits | EU requires HBEL-based limits | Recalculate using PDE/ADE |
| 10 | Cleaning validation uses 10ppm | EU requires health-based limits | Recalculate |
| 11 | No PQR/APR with 12 elements | EU GMP Ch 1.10 mandatory 12-element PQR | Establish full PQR process |
| 12 | Novel excipient without full dossier | EMA requires drug substance-level data | Generate toxicology package |
| 13 | BCS Class III biowaiver attempted | EMA does not accept Class III biowaivers | Conduct BE study |
| 14 | No RMP | Mandatory for all new EU MAAs | Prepare Risk Management Plan |
| 15 | TSE/BSE not addressed | Mandatory for animal-origin materials | Complete TSE risk assessment |
| 16 | Batch records retained only 1 year post-expiry | EU requires 1yr post-expiry OR 5yr post-QP cert | Extend retention |
| 17 | No falsification screening in complaints | FMD requires falsification assessment | Update complaint SOP |
| 18 | APS frequency <semi-annual | EU requires every 6 months per line/shift | Increase APS frequency |
| 19 | No 100% CCIT for small SVPs | Annex 1 requires 100% for fusion-sealed <=100mL | Install automated CCIT |
| 20 | UV sterilisation used | Not acceptable per Annex 1 | Change sterilisation method |

### Phase 5: Biosimilar-Specific Analysis (if applicable)

For biosimilar MAAs, additionally check:

- [ ] Reference product is EU/EEA-authorised (not US RLD)
- [ ] Scientific bridge to EU reference if non-EU data used (PK/PD + analytical comparison)
- [ ] Comprehensive analytical characterisation:
  - Primary structure (amino acid sequence identity)
  - Higher-order structure (CD, FTIR, fluorescence, NMR)
  - Post-translational modifications (glycan mapping, sialylation, fucosylation)
  - Charge variants (IEF, IEX, CE)
  - Size variants (SE-HPLC, AUC)
  - Purity (aggregates, fragments, HCP by orthogonal methods, DNA, Protein A)
  - Biological activity (bioassays reflecting MOA: binding, ADCC, CDC, apoptosis)
  - Receptor binding (SPR)
  - Potency (validated discriminating assay)
  - Forced degradation comparison
- [ ] Multiple reference product batches used to establish quality attribute ranges
- [ ] Manufacturing process optimised to minimise differences with reference
- [ ] Product-class-specific EMA guideline followed (mAbs, EPO, G-CSF, insulin, etc.)
- [ ] Stability profile comparable; shelf life determined independently

### Phase 6: Sterile Product-Specific Analysis (if applicable)

For sterile products, additionally verify against Annex 1 (2022):

- [ ] CCS document exists covering all 16 mandatory elements
- [ ] Cleanroom grades (A/B/C/D) correctly assigned for each operation
- [ ] At-rest AND in-operation particle limits met per Tables 1 & 5
- [ ] Microbial limits met per Tables 2 & 6
- [ ] Pressure differentials >=10 Pa between different grades
- [ ] No sinks/drains in Grade A/B
- [ ] PUPSIT programme implemented
- [ ] APS semi-annual per line/shift with zero-growth target
- [ ] Personnel gowning qualification with annual microbial reassessment
- [ ] Disinfectants sterile in Grade A/B
- [ ] Airflow visualisation studies with video recordings
- [ ] Requalification schedule: A/B every 6 months, C/D every 12 months
- [ ] WFI system: continuous TOC and conductivity monitoring
- [ ] Daily water sampling from representative point
- [ ] 100% CCIT for fusion-sealed SVPs
- [ ] Depyrogenation achieving >=3 log endotoxin reduction (if applicable)
- [ ] Terminal sterilisation preferred over aseptic (justification required if aseptic)

## Output Format

Generate a structured assessment report with:

1. **Compliance Summary:** Overall compliance status (Compliant / Minor Gaps / Major Gaps / Critical Deficiencies)
2. **EU-Specific Findings Table:** Each finding with:
   - Finding ID
   - EU GMP/EMA reference (chapter/section)
   - Requirement description
   - Current dossier status
   - Gap classification (Critical / Major / Minor / Observation)
   - Recommended action
3. **FDA-to-EU Gap Analysis:** (if applicable) Table of additional EU requirements not covered by existing FDA filing
4. **QP Certification Readiness:** Assessment of whether a QP would have sufficient information to certify batches
5. **Recommendations:** Prioritised list of actions to achieve EU compliance

## Key References

| Document | Identifier |
|----------|-----------|
| EU GMP Part I | EudraLex Volume 4, Chapters 1-9 |
| EU GMP Part II | EudraLex Volume 4 (ICH Q7A) |
| EU GMP Annex 1 | Sterile Manufacturing (2022, C(2022)5938) |
| EU GMP Annex 2 | Biological Products |
| EU GMP Annex 8 | Starting Materials Sampling |
| EU GMP Annex 11 | Computerised Systems |
| EU GMP Annex 13 | Investigational Medicinal Products |
| EU GMP Annex 15 | Qualification and Validation |
| EU GMP Annex 16 | QP Certification |
| EU GMP Annex 17 | Parametric Release |
| EU GMP Annex 19 | Reference/Retention Samples |
| EMA Bioequivalence | CPMP/EWP/QWP/1401/98 Rev.1 |
| EMA Biosimilars Quality | EMA/CHMP/BWP/247713/2012 |
| EMA Process Validation | EMA/CHMP/CVMP/QWP/BWP/70278/2012-Rev1 |
| EMA Excipients | EMEA/CHMP/QWP/396951/2006 |
| EMA Finished Dosage Form | EMA/362427/2017 |
| EMA Immunogenicity | EMEA/CHMP/BMWP/14327/2006 Rev1 |
| EMA mAb Immunogenicity | EMA/CHMP/BMWP/86289/2010 |
| EMA Similar Biologicals | CHMP/437/04 |
| Directive 2001/83/EC | Community Code for Medicinal Products |
| Directive 2003/94/EC | GMP Principles for Medicinal Products |
| Regulation EC 1234/2008 | Variations Regulation |
| Directive 2011/62/EU | Falsified Medicines Directive |
| European Pharmacopoeia | Ph.Eur. (current edition) |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2026-03-22 | Initial extraction from 43 source PDFs (32 EU GMP + 11 EMA guidelines) |
