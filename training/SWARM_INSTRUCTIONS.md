# Extraction Swarm v5 — Worker Instructions

## CRITICAL: Deduplication Protocol

Before extracting rules from ANY document:

1. **Check if rules already exist** — Look in output-v2/, output-v3/, output-v4/ for rules that cover the same ICH code, guideline, or topic.

2. **If rules exist, compare versions:**
   - Check the source document date/version in the existing rules JSON metadata
   - Check the source document date/version of the PDF you are about to process
   - If your PDF is NEWER: extract fresh rules and save to output-v5/ with a note that it REPLACES the older extraction
   - If your PDF is OLDER than existing rules: SKIP IT. Write a one-line entry to output-v5/SKIPPED.log explaining why
   - If SAME version: SKIP unless the existing extraction is flagged as SHALLOW (fewer than 10 rules for a major guideline)

3. **If no rules exist:** Extract fully and save to output-v5/

## Extraction Standard

For each document, produce a JSON file with:
- `metadata`: title, source_file, source_directory, document_date, document_version, extraction_date, total_rules
- `rules[]`: array of rule objects, each with:
  - `rule_id`: unique ID (format: AGENCY-TOPIC-NNN, e.g., FDA-DILI-001, EMA-DM-001)
  - `rule_text`: clear statement of the requirement
  - `source_section`: section/chapter reference
  - `source_page`: page number if available
  - `verbatim_quote`: exact quote from document supporting the rule
  - `severity`: CRITICAL / HIGH / MEDIUM / LOW (4-level only, no variations)
  - `jurisdictions`: array of ["US", "EU", "JP", "CA"] that this applies to
  - `exceptions`: any noted exceptions or special cases
  - `cross_references`: related ICH codes or other guideline references

## Quality Requirements
- 100% of rules must have verbatim quotes
- 100% of rules must have source section citations
- No invented or paraphrased "rules" — every rule must be traceable to specific document text
- Mark severity accurately: CRITICAL = submission will be rejected without this, HIGH = major deficiency, MEDIUM = notable gap, LOW = best practice

## Context Management
- Do NOT hold more than 3 PDFs open simultaneously
- If you hit 50% context usage, checkpoint your work — write partial output and continue in a focused manner
- Process PDFs one at a time, write rules, then move to the next

## Output Location
Write all output to: training/output-v5/
