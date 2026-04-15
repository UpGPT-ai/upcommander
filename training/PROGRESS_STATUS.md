# Regulatory Training Pipeline — Progress Status

**Last Updated:** 2026-03-25
**Status:** CORPUS EXTRACTION COMPLETE — all in-corpus documents processed

---

## Overall Numbers

| Metric | Value |
|--------|-------|
| **Total rules extracted** | ~11,139 (+425 from Swarm 7 Europe) |
| **Output files** | v2: 13 dirs, v3: 8 dirs, v4: 36 files, v5: 216 files |
| **Source documents in corpus** | ~838 files (+56 from Europe+HC) |
| **Documents processed** | ~409 (+18 new from Swarm 7) |
| **Documents unprocessed in corpus** | **0** — all downloaded documents now processed |
| **Safety Pharmacology (D1)** | 132/132 = 100% verified |

## Extraction Runs Completed

| Run | Workers | Model | Duration | Output |
|-----|---------|-------|----------|--------|
| Swarm 1 (output-v2) | 12 Opus | opus | 60 min | ICH + FDA regs + CRLs → 1,360 rules |
| Swarm 2 (output-v3) | 6 Sonnet | sonnet | 20 min | EU + PMDA + Canada + WHO → 483 rules |
| Swarm 3 (output-v4) | 12 Sonnet | sonnet | ~45 min | Deep ICH + EMA GVP + FDA + PIC/S → 3,089 rules |
| Swarm 4 (output-v5) | 8+4+3+2+1 Sonnet | sonnet | ~3 hours | FDA v2 + EMA v2 + biosimilar + CBER + ICH gaps + gene therapy + vaccines + WHO → 4,627 rules |
| Verification | 11 Sonnet | sonnet | ~30 min | 10 verification types |
| Corrections | 7 Sonnet | sonnet | 23 min | 91 issues fixed, 67 corrections |
| Final Fixes | 4 Sonnet | sonnet | ~20 min | Factual accuracy, severity, source fidelity → 100 |
| D1 Closure | 4 Sonnet | sonnet | ~40 min | 132/132 safety pharmacology verified |
| Swarm 5 (cleanup) | 7 Opus | opus | ~10 min | Final sweep: 4 new extractions (168 rules), confirmed all corpus docs processed |
| Swarm 6 (Europe2) | 8 Opus | opus | ~19 min | 45 EMA therapeutic area PDFs → 36 extracted (987 rules), 9 skipped (concept papers, comments, dupes) |
| Swarm 7 (Europe) | 7 Opus | opus | ~19 min | 56 Europe+HC PDFs → 18 extracted (425 rules), 38 skipped (dupes/superseded/comments/drafts) |

## What Is DONE

### Fully Verified (100% confidence)
- Safety Pharmacology: S7A, S7B, E14, E14/S7B Q&As, M3(R2) — 132 rules, verbatim quotes, adversarial tested

### Extracted with Good Confidence (80-90%)
- **ICH**: All major guidelines extracted including E1-E19, E22(draft), M3-M15, Q1-Q14, S1-S11
- **FDA**: 92 guidances processed (19 batch 1 + 73 batch 2), 3 CBER biologics, data integrity, PIC/S
- **EMA**: 89 scientific guidelines (+36 from Europe2: CV, thrombosis, infectious disease, dermatology, nephrology, urology, endocrinology, paediatric addenda, reflection papers), 15 GVP modules, 32 EU GMP chapters/annexes, 8 EU regulations, 5 biosimilar guidelines, 6 gene therapy/ATMP
- **PMDA**: 16 guidelines (7 original + 5 v2 prior + 4 v2 new: BMV, ligand binding assay, drug interactions, foreign manufacturer accreditation)
- **Health Canada**: Act, regulations, CTD guidance, drug submission guidance
- **WHO**: 7 vaccine/biological guidelines
- **Gene Therapy**: 12 FDA + 3 EMA = 15 gene therapy docs
- **Vaccines**: 6 FDA + 6 WHO = 12 vaccine docs
- **CRL Database**: Deficiency taxonomy, jurisdiction divergences

## What REMAINS — Downloads Needed

All documents currently in the corpus have been processed. The only remaining work requires **manual browser downloads** of documents not yet in the corpus.

### User Browser Downloads Needed (can't automate)

**EMA Scientific Guidelines (biggest gap ~100 docs):**
- Quality: stability, nitrosamines, extractables/leachables, process validation, specifications (~30-40)
- Safety/Non-clinical: EMA-specific beyond ICH (~10-15)
- Efficacy/Clinical therapeutic areas: cardiovascular, CNS, respiratory, pain, infectious disease, haematology, endocrinology, dermatology, ophthalmology, musculoskeletal, renal (~40-50)
- Annex I to Directive 2001/83/EC (EU dossier structure — CRITICAL)
- QRD templates (SmPC, PIL, labelling) — 3 docs
- EMA GVP Modules XI, XII, XIII, XIV — 4 docs
- CMDh procedural guidance — ~10-15 docs

**Japan (PMDA):**
- MHLW GMP Ordinance (MO 179)
- MHLW GCP Ordinance (MO 28)
- MHLW GVP Ordinance (MO 135)
- Module 1.12 Japan-specific CTD requirements

**Canada (Health Canada):**
- Product Monograph guidance + template
- Post-NOC changes guidance
- NOC/c guidance
- Drug submission requirements (C.08)

**Paywalled (require subscription):**
- USP General Chapters (1, 61, 71, 621, 1058, 1225, 1226)
- European Pharmacopoeia (Ph.Eur.)

### Pipeline Steps Remaining
1. **Verification swarm** on output-v5 new extractions (same 10-type protocol used on v2/v3)
2. **Corrections swarm** on any issues found
3. **Adversarial testing** on ALL ~9,700+ rules (not just safety pharmacology)
4. **Knowledge compiler** re-run — index all rules by module/topic/jurisdiction
5. **Fine-tuning dataset** re-export — incorporate new 168 rules into training JSONL
6. **File organization** — move processed originals to centralized archive

## Key Findings from Processing

### Mislabeled Files
~15 FDA guidance v2 PDFs (positions 23-72) had wrong content. Workers extracted from actual content and documented each mismatch. Three files had zero extractable content (conference slides, Chinese-language page). Details in output-v5/SKIPPED.log.

All 10 PMDA v2 PDFs were mislabeled — none contained the content their filenames suggested. Workers extracted from actual content and documented mismatches. FDA v2 gap report at output-v5/FDA-V2-GAP-REPORT.md.

### PMDA Superseded
5 of 12 PMDA v2 files were superseded by ICH M10 (2022) or were mislabeled. Correctly skipped per dedup protocol.

### Swarm 6 New Extractions — Europe2 (2026-03-25)
| Category | Files | Rules |
|----------|-------|-------|
| **Cardiovascular** (hypertension, lipids, antiarrhythmics, PAH, HF, angina, ACS, CV prevention, stents) | 11 | 322 |
| **Thrombosis/Vascular** (stroke/NVAF, VTE x3, PAD) | 5 | 165 |
| **Infectious Disease** (bacterial, TB, HIV, antifungal, HCV, HBV, sepsis, bacterial paediatric) | 8 | 211 |
| **Specialty** (psoriasis, corticosteroids x2, renal, urinary incontinence, contraceptives, HRT) | 7 | 172 |
| **Paediatric Addenda** (AHF, lipid disorders, hypertension) | 3 | 70 |
| **Reflection Papers** (CV safety anticancer, AKI) | 2 | 47 |
| **Total** | **36** | **987** |

Skipped: 3 concept papers (no rules), 2 comment overviews (no rules), 1 draft (superseded by final), 1 addendum (superseded by rev3), 2 ICH (already extracted) = 9 skipped.

### Swarm 5 New Extractions (2026-03-25)
| File | Source | Rules |
|------|--------|-------|
| `ema-immunogenicity-therapeutic-proteins-rules.json` | EMA CHMP/BMWP/14327/2006 Rev 1 | 42 |
| `pmda-bioanalytical-method-validation-rules.json` | PMDA BMV Guideline 2013 | 42 |
| `pmda-drug-interaction-guideline-rules.json` | MHLW DDI Guideline 2019 | 35 |
| `pmda-bmv-ligand-binding-assay-rules.json` | PMDA LBA BMV 2014 | 35 |
| `pmda-foreign-manufacturer-accreditation-rules.json` | PMDA PAL Art 13-3 Guide 2021 | 14 |
| **Total** | | **168** |

### Severity Standard
4-level only: CRITICAL / HIGH / MEDIUM / LOW. No variations. All issues fixed regardless of severity.

### Quality Standard
- 100% verbatim quotes for all rules
- 100% source section citations
- Unbroken audit trail: Finding → Rule → Source Document → Section → Page

## How to Resume

```bash
# 1. Start the server
cd "/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander"
npm run build && node dist/server/index.js &

# 2. Launch extraction for remaining PMDA docs
tmux new-session -d -s extract-resume
unset CLAUDECODE
claude --model claude-sonnet-4-6 -p 'Extract rules from 5 PMDA PDFs in training/stage-1/pmda-guidelines-v2/: pmda-anticancer-clinical-evaluation.pdf, pmda-clinical-pharmacokinetics.pdf, pmda-conditional-early-approval.pdf, pmda-drug-interaction-studies.pdf, pmda-ectd-v4-implementation-guide.pdf. Read training/SWARM_INSTRUCTIONS.md for protocol. Write to training/output-v5/. Use /compact after each document.'

# 3. After user downloads EMA/HC/PMDA browser docs, drop them in
#    training/stage-1/ema-guidelines-v3/ (or similar) and run another swarm

# 4. After all extraction: run verification swarm, corrections, adversarial testing
```

## File Locations

| Path | Contents |
|------|----------|
| `training/stage-1/` | All source documents (PDFs) organized by agency |
| `training/output-v2/` | Swarm 1 extractions (ICH/FDA/CRL) |
| `training/output-v3/` | Swarm 2 extractions (EU/PMDA/Canada/WHO) |
| `training/output-v4/` | Swarm 3 deep extractions |
| `training/output-v5/` | Swarm 4+5+6 extractions (198 files, ~5,782 rules) |
| `training/stage-1/ema-guidelines-v3/` | Europe2 source PDFs (45 files) |
| `training/verification/` | Verification results |
| `training/corrections/` | Correction results |
| `training/final-scorecard/` | D1 100% scorecard |
| `training/SWARM_INSTRUCTIONS.md` | Worker protocol for future swarms |
| `training/CORPUS_INVENTORY.md` | Full document inventory with coverage map |
| `docs/KNOWLEDGE_SYSTEM.md` | Training pipeline spec |
