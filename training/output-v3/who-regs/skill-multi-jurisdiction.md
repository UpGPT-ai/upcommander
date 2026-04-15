# SKILL.md - Cross-Jurisdiction Regulatory Gap Analysis

## Skill Identity

| Field | Value |
|-------|-------|
| **Name** | Multi-Jurisdiction Gap Analysis |
| **ID** | `cross-jurisdiction-gap-analysis` |
| **Version** | 3.0 |
| **Category** | Regulatory Intelligence |
| **Complexity** | Expert |

## Purpose

Perform systematic regulatory gap analysis across **FDA (USA)**, **EMA (EU)**, **PMDA (Japan)**, **Health Canada**, and **WHO** for pharmaceutical product registration. Identifies divergences that create regulatory risk, additional work, or timeline impact for multi-market submissions.

## When to Invoke

- Planning a global regulatory submission strategy
- Preparing CTD dossiers for simultaneous or sequential multi-market filing
- Evaluating whether existing data packages support a new market entry
- Assessing regulatory risk for a product in development
- Preparing for pre-submission meetings with multiple agencies
- Evaluating impact of a manufacturing change across markets

## Jurisdiction Profiles

### FDA (United States)
- **Authority**: FDA (CDER/CBER)
- **Law**: FD&C Act, 21 CFR
- **Application**: NDA/BLA/ANDA
- **Dossier**: CTD with US-specific Module 1
- **Pharmacopoeia**: USP-NF
- **Climatic Zone**: II (25C/60% RH)
- **Key Unique Requirements**: FDA-specific clinical holds, REMS, patent certifications (Paragraph IV), Orange Book listing, user fee (PDUFA)
- **Exclusivity**: 5yr NCE, 7yr orphan, 3yr new clinical data, 180-day FTF generic

### EMA (European Union)
- **Authority**: EMA + National Competent Authorities
- **Law**: Directive 2001/83/EC, Regulation 726/2004
- **Application**: MAA (Centralised/Decentralised/Mutual Recognition)
- **Dossier**: CTD with EU-specific Module 1
- **Pharmacopoeia**: Ph.Eur. (European Pharmacopoeia)
- **Climatic Zone**: II (25C/60% RH)
- **Key Unique Requirements**: QPPV, EU-QP batch certification, PSUR/PBRER, Paediatric Investigation Plan (PIP), Qualified Person for Pharmacovigilance, conditional marketing authorization
- **Exclusivity**: 8yr data + 2yr market + 1yr possible extension

### PMDA (Japan)
- **Authority**: PMDA under MHLW
- **Law**: PMD Act (Pharmaceutical and Medical Device Act)
- **Application**: J-NDA (Shonin)
- **Dossier**: CTD with Japan-specific Module 1
- **Pharmacopoeia**: JP (Japanese Pharmacopoeia, currently JP18)
- **Climatic Zone**: II (25C/60% RH)
- **Key Unique Requirements**:
  - Foreign Manufacturer Accreditation (PAL Art. 13-3)
  - ICH E5 Bridging Study requirement
  - Japanese patient enrollment in pivotal trials
  - Re-examination system (8yr NCE, 10yr orphan)
  - JP18 crude drug monographs for Kampo
  - Broader transporter DDI panel (includes OCT1, MRP2, MRP4, BSEP)
  - CYP2C19 PM frequency emphasis
  - Japanese MAH required
- **Exclusivity**: Re-examination period (8-10yr effectively blocks generics)

### Health Canada
- **Authority**: Health Canada / Health Products and Food Branch
- **Law**: Food and Drugs Act, Food and Drug Regulations
- **Application**: NDS (New Drug Submission) / ANDS (Abbreviated)
- **Dossier**: CTD with Canada-specific Module 1
- **Pharmacopoeia**: References USP, EP, and BP; no separate Canadian pharmacopoeia for most drugs
- **Climatic Zone**: II (25C/60% RH)
- **Key Unique Requirements**: Notice of Compliance (NOC), data protection (8yr + possible extensions), C.08.004 Priority Review, SAP (Special Access Programme), bilingual labeling (English/French), PM (Product Monograph) format
- **Exclusivity**: 8yr data protection + possible extensions for pediatric/innovative

### WHO (Prequalification)
- **Authority**: WHO Prequalification Programme
- **Scope**: Primarily multisource (generic) products for UN procurement
- **Dossier**: WHO-specific format referencing CTD
- **Pharmacopoeia**: References multiple (USP, EP, JP, BP, IP)
- **Climatic Zone Coverage**: All zones (I-IVb) - uniquely comprehensive
- **Key Unique Requirements**:
  - Zone IVb stability conditions (30C/75% RH)
  - Semi-permeable container low-RH testing protocol
  - Reduced batch requirements for generics (2 batches acceptable)
  - Zone II to Zone IV extrapolation requirements (Appendix 3)
  - Prohibition of "ambient conditions" / "room temperature" on labels
  - Ongoing stability: 1 batch/year minimum, report to authorities
  - Specific significant change criteria for FPPs

## Gap Analysis Framework

### Step 1: Scope Definition
```
For each product, define:
- Target markets (which jurisdictions)
- Product type (NCE, biologic, generic, biosimilar, herbal/Kampo)
- Development stage (preclinical, Phase I-III, filed, marketed)
- Manufacturing locations (domestic vs foreign per jurisdiction)
- Climatic zones for distribution
```

### Step 2: Systematic Gap Categories

| # | Category | Key Questions |
|---|----------|---------------|
| 1 | **Regulatory Pathway** | Which application type in each market? Centralised vs decentralised (EU)? |
| 2 | **Clinical Data** | Bridging study needed (Japan)? Ethnic sensitivity assessment? Japanese/local enrollment sufficient? |
| 3 | **Quality/CMC** | Pharmacopoeia differences (JP vs USP vs EP)? Container/closure test divergences? |
| 4 | **Stability** | Climatic zone coverage? Zone IVb data needed? Semi-permeable container protocols? |
| 5 | **Nonclinical** | Carcinogenicity dose selection alignment? Species selection differences? |
| 6 | **Drug Interactions** | Transporter panel completeness? CYP polymorphism coverage for target populations? |
| 7 | **Manufacturing** | Foreign manufacturer accreditation (Japan)? EU MIA? FDA establishment registration? |
| 8 | **Labeling** | Package insert format differences? Language requirements? DDI information placement? |
| 9 | **Post-Approval** | Re-examination (Japan)? PSUR schedule (EU)? Phase IV commitments (FDA)? |
| 10 | **Exclusivity/IP** | Data exclusivity periods? Patent linkage? Generic entry timelines? |
| 11 | **Pharmacovigilance** | PV system requirements? Safety reporting timelines? QPPV (EU)? |
| 12 | **Pricing/Reimbursement** | NHI price listing (Japan)? HTA assessment (EU)? PMPRB (Canada)? |

### Step 3: Gap Severity Classification

| Severity | Definition | Example |
|----------|-----------|---------|
| **CRITICAL** | Blocks approval; no workaround | Missing Japanese bridging study for ethnically sensitive drug |
| **HIGH** | Major additional work; timeline impact >6 months | Foreign manufacturer not accredited for Japan; Zone IVb stability data missing |
| **MEDIUM** | Moderate additional work; timeline impact 1-6 months | JP-specific dissolution method needed; DDI transporter panel incomplete |
| **LOW** | Minor administrative; <1 month impact | Labeling format adaptation; document translation |

### Step 4: Gap Resolution Strategies

| Strategy | When to Use |
|----------|-------------|
| **Prospective Harmonization** | Design studies/specs to satisfy all target markets simultaneously (most efficient) |
| **Sequential Bridging** | Use approved-market data as basis, add jurisdiction-specific studies |
| **Parallel Submission** | File simultaneously with jurisdiction-specific Module 1 packages |
| **Phased Market Entry** | File in primary market first, use approval as reference for secondary markets |
| **Regulatory Consultation** | Pre-submission meetings with each agency to align expectations |

## Common Multi-Jurisdiction Pitfalls

### 1. Japan Bridging Trap
**Problem**: Development team designs global MRCT without Japanese sites, then discovers PMDA requires bridging study.
**Prevention**: Include Japanese sites in Phase III design from the start. Conduct ICH E5 assessment before Phase III protocol finalization.

### 2. Pharmacopoeia Specification Mismatch
**Problem**: Product meets USP specifications but fails JP dissolution or EP related substance limits.
**Prevention**: During specification-setting, cross-reference JP18, USP, and EP simultaneously. Develop widest acceptable specification window.

### 3. Zone IVb Stability Surprise
**Problem**: Product approved for Zone II markets; sponsor wants to supply WHO prequalified markets in Zone IVb without 30C/75% RH data.
**Prevention**: If tropical market entry is possible, include Zone IVb conditions in initial stability protocol.

### 4. Foreign Manufacturer Accreditation Delay
**Problem**: 5-month accreditation process for Japan not started early enough; product approved but cannot be imported.
**Prevention**: Initiate PMDA foreign manufacturer accreditation at least 12 months before planned J-NDA submission.

### 5. DDI Panel Gaps
**Problem**: DDI package designed for FDA submission missing OCT1 and hepatobiliary transporters required by PMDA.
**Prevention**: Design in vitro DDI panel to satisfy the most comprehensive requirements (PMDA panel) from the start.

## Cross-Reference Files

| File | Content |
|------|---------|
| `who-requirements.json` | WHO-specific requirements diverging from ICH, climatic zone stability conditions |
| `japan-specific-requirements.json` | Comprehensive PMDA/JP18 requirements |
| `japan-vs-fda-ema.json` | 17 mapped divergences with severity ratings and actions |

## Data Sources

| Source | Jurisdiction | Key Content |
|--------|-------------|-------------|
| WHO TRS 1010 Annex 10 (2018) | WHO | Stability testing for APIs and FPPs |
| WHO TRS 986 Annex 2 (2014) | WHO | GMP for pharmaceutical products |
| PMDA Foreign Manufacturer Accreditation Guide | Japan | Accreditation procedures and forms |
| PMDA DDI Guideline (2019) | Japan | Drug interaction evaluation requirements |
| JP18 (2021) | Japan | Pharmacopoeia monographs and general tests |
| ICH E5 / PMDA Implementation | Japan | Ethnic factors and bridging studies |
| ICH E16 / PMDA Implementation | Japan | Biomarker qualification submissions |
| PMDA Stability Testing Guidelines | Japan | ICH Q1 Japanese implementation |
| PMDA Biologics Quality Guidelines | Japan | Biologics characterization requirements |

## Usage Pattern

```
INPUT:  Product profile (API, formulation, indication, target markets)
OUTPUT: Gap matrix with severity, timeline impact, and resolution actions

For each identified gap:
  1. Which jurisdiction requires what
  2. What the other jurisdictions require (or don't)
  3. Severity rating (CRITICAL/HIGH/MEDIUM/LOW)
  4. Specific action to resolve
  5. Timeline impact estimate
  6. Risk if gap is not addressed
```
