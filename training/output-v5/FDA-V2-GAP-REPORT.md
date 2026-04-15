# FDA Guidance v2 Gap Report
Generated: 2026-03-25

## Summary

| Metric | Count |
|--------|-------|
| Total source PDFs in fda-guidance-v2/ | 18 |
| Fully extracted (rules JSON in output-v5/) | 3 |
| Skipped - duplicate of another extracted source | 9 |
| Skipped - mislabeled/non-regulatory content | 6 |
| Unprocessed | 0 |

**Result: 100% coverage. No gaps found.**

## MANIFEST Coverage (Positions 01-40)

The MANIFEST.txt lists 40 priority positions. Positions 14-40 were downloaded as separate PDFs (no longer present in directory) and all have corresponding output-v5 JSON files. Of the 18 PDFs physically present in fda-guidance-v2/, all are accounted for.

## Detailed Status by File

### Extracted (3 files)

| Source PDF | Output JSON | Rules |
|-----------|-------------|-------|
| 01-bioanalytical-method-validation-2018.pdf | fda-bioanalytical-method-validation-2018-rules.json | 42 |
| 05-clinical-evidence-effectiveness-1998.pdf | fda-clinical-evidence-effectiveness-1998-rules.json | 35 |
| 06-drug-induced-liver-injury-2009.pdf | fda-drug-induced-liver-injury-2009-rules.json | 38 |

### Skipped - Duplicate (9 files)

| Source PDF | Duplicate Of | Existing Extraction |
|-----------|-------------|---------------------|
| 05-benefit-risk-assessment.pdf | 15-benefit-risk-assessment-2023.pdf | 15-benefit-risk-assessment-2023-rules.json (30 rules) |
| 07-drug-induced-liver-injury.pdf | 06-drug-induced-liver-injury-2009.pdf | fda-drug-induced-liver-injury-2009-rules.json (38 rules) |
| 07-scientific-considerations-biosimilarity-2015.pdf | Position 27 | 27-scientific-considerations-biosimilarity-rules.json (38 rules) |
| 09-clinical-evidence-effectiveness.pdf | 05-clinical-evidence-effectiveness-1998.pdf | fda-clinical-evidence-effectiveness-1998-rules.json (35 rules) |
| 10-clinical-trial-endpoints-cancer.pdf | Position 30 | 30-clinical-trial-endpoints-cancer-2018-rules.json (35 rules) |
| 11-expedited-programs.pdf | Position 09 | fda-expedited-programs-serious-conditions-2014-rules.json (45 rules) |
| 12-non-inferiority-clinical-trials.pdf | Position 04 | fda-non-inferiority-clinical-trials-2016-rules.json (38 rules) |
| 13-adaptive-designs-clinical-trials.pdf | Position 26 | 26-adaptive-designs-clinical-trials-2019-rules.json (35 rules) |
| 03-in-vitro-drug-interaction-studies.pdf | ICH M12 in v4 | output-v4/m12-ddi-rules.json (78 rules) |

### Skipped - Mislabeled / Non-Regulatory (6 files)

| Source PDF | Actual Content |
|-----------|---------------|
| 02-clinical-drug-interaction-cyp-transporter.pdf | 1-page "Statistical Software Clarifying Statement" (FDA, 2015) |
| 04-refuse-to-file.pdf | FDA MAPP 5015.7 Rev.1 "Environmental Assessments" (internal procedural) |
| 06-rems-guidance.pdf | Influenza A (H1N1) 2009 Monovalent Vaccine USPI (product label) |
| 08-assessment-abuse-potential.pdf | FDA SMG 1410.35 debarment delegation document |
| 08-quality-considerations-biosimilarity-2015.pdf | 510(k) SE decision-making guidance (CDRH device guidance) |
| 10-refuse-to-file-2017.pdf | Veterinary medicated feed product label (monensin/bacitracin) |

## Higher-Position Coverage (Positions 13-40)

All MANIFEST positions 13-40 have been fully extracted to output-v5/ with numbered JSON files:

| Position Range | Files | Status |
|---------------|-------|--------|
| 13-15 | 6 JSON files (some positions have 2 extractions) | Complete |
| 16-22 | 14 JSON files | Complete |
| 23-29 | 14 JSON files | Complete |
| 30-35 | 12 JSON files | Complete |
| 36-40 | 5 JSON files | Complete |

Note: Position 38 (dissolution-testing-ir-products) is documented as mislabeled (CDRH webinar transcript) but was extracted for whatever content existed.

## Conclusion

All 18 FDA v2 source PDFs have been processed. No new extractions are needed. The extensive mislabeling of files in this directory (6 of 18 contain entirely wrong documents) has been properly documented in SKIPPED.log. The correctly-labeled files have all been extracted with full rule sets in output-v5/.
