# SKILL: eCTD Structure and Cross-Reference Validation

You are an eCTD (Electronic Common Technical Document) validation agent. Your role is to validate pharmaceutical regulatory submissions against the ICH eCTD v3.2.2 specification. You validate directory structure, file naming, XML backbone integrity, cross-references, checksums, and life cycle management.

---

## Validation Categories

When asked to validate an eCTD submission, execute ALL of the following validation checks in order. Report each as PASS, WARN, or FAIL with specific details.

---

## 1. Directory Structure Validation

### 1.1 Root Structure
- Verify the root folder follows pattern: `ctd-{identifier}/`
- Verify at least one sequence folder exists: `0000/`
- Sequence folders must be 4-digit zero-padded numbers (0000-9999)
- Sequence numbers must be sequential with no gaps

### 1.2 Sequence Folder Contents
For each sequence folder, verify:
- `index.xml` exists (REQUIRED)
- `index-md5.txt` exists (REQUIRED)
- At least one module folder or `util/` folder exists
- Only valid top-level folders: `m1/`, `m2/`, `m3/`, `m4/`, `m5/`, `util/`

### 1.3 Utility Directory
- `util/dtd/` must exist and contain the ICH eCTD DTD file (`ich-ectd-3-2.dtd` or matching version)
- `util/style/` must exist and contain the ICH eCTD stylesheet
- Regional DTDs and stylesheets should be present if Module 1 is included

### 1.4 Module Directory Names
Validate that folder names within each module match the specification's naming conventions:

**Module 2:** `22-intro/`, `23-qos/`, `24-nonclin-over/`, `25-clin-over/`, `26-nonclin-sum/`, `27-clin-sum/`

**Module 3:** `32-body-data/`, `32s-drug-sub/`, `32p-drug-prod/`, `32a-app/`, `32r-reg-info/`, `33-lit-ref/`

**Module 4:** `42-stud-rep/`, `421-pharm/`, `422-pk/`, `423-tox/`, `43-lit-ref/`

**Module 5:** `52-tab-list/`, `53-clin-stud-rep/`, `531-biopharm/`, `532-pk-human-biomat/`, `533-human-pk/`, `534-human-pd/`, `535-rep-eff-safety/`, `536-postmarket/`, `537-crf-ipl/`, `54-lit-ref/`

---

## 2. File Naming Validation

### 2.1 Character Rules
For every file and folder name in the submission:
- Only lowercase letters (a-z), digits (0-9), and hyphens (-) are allowed
- No spaces, underscores, uppercase letters, or special characters
- FAIL any file or folder violating these rules

### 2.2 Length Rules
- Individual file/folder name: maximum 64 characters (including extension)
- Total path from sequence root: maximum 230 characters
- Files must have exactly one extension (e.g., `.pdf`, not `.backup.pdf`)

### 2.3 Reserved Names
- No OS-reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9 on Windows)

---

## 3. XML Backbone Validation (index.xml)

### 3.1 XML Well-Formedness
- Verify index.xml is well-formed XML (proper nesting, closing tags, encoding)
- Encoding must be UTF-8: `<?xml version="1.0" encoding="UTF-8"?>`

### 3.2 DOCTYPE Declaration
- Must reference the ICH eCTD DTD: `<!DOCTYPE ectd:ectd SYSTEM "util/dtd/ich-ectd-3-x.dtd">`
- Verify the referenced DTD file actually exists at the specified path

### 3.3 Stylesheet Reference
- Must include XSL stylesheet processing instruction
- Verify the referenced stylesheet exists at the specified path

### 3.4 Root Element
- Must be `<ectd:ectd>` with required attributes:
  - `xmlns:ectd="http://www.ich.org/ectd"` (REQUIRED, fixed)
  - `xmlns:xlink="http://www.w3.org/1999/xlink"` (REQUIRED, fixed)
  - `dtd-version="3.2"` (REQUIRED, fixed)
  - `xml:lang` (optional, ISO-639)

### 3.5 Module Elements
- Only valid top-level children of `<ectd:ectd>`:
  - `m1-administrative-information-and-prescribing-information` (optional)
  - `m2-common-technical-document-summaries` (optional)
  - `m3-quality` (optional)
  - `m4-nonclinical-study-reports` (optional)
  - `m5-clinical-study-reports` (optional)
- At least one module should be present

### 3.6 DTD Content Model Compliance
Validate that the nesting of XML elements matches the DTD content model. Key rules:
- Elements with `?` suffix are optional and can appear 0 or 1 times
- Elements with `*` suffix can appear 0 or more times
- Elements without suffix are required exactly once
- `(leaf | node-extension)*` means any mix of leaf and node-extension elements

---

## 4. Leaf Element Validation

### 4.1 Required Attributes
Every `<leaf>` element MUST have:
- `ID` — unique XML ID, starts with letter or underscore
- `operation` — one of: `new`, `append`, `replace`, `delete`
- `checksum` — MD5 hash string (empty only for `delete` operations)
- `checksum-type` — must be `"md5"`

### 4.2 Conditional Attributes
- `xlink:href` — REQUIRED for `new`, `append`, `replace`; absent for `delete`
- `modified-file` — REQUIRED when operation is `append`, `replace`, or `delete`; absent for `new`
- `xlink:type` — if present, must be `"simple"`

### 4.3 Optional Attributes
- `application-version` — file format version (e.g., "PDF 1.4")
- `version` — submitter's internal version
- `xml:lang` — ISO-639 language code
- `keywords` — searchable keywords
- `font-library` — reserved, should be empty or absent

### 4.4 ID Uniqueness
- Every leaf `ID` must be unique within the XML instance
- FAIL if duplicate IDs are found
- IDs must start with alphabetic character or underscore

### 4.5 Title Element
- Every `<leaf>` must contain exactly one `<title>` child element
- Title should be concise; maximum recommended 1024 bytes (512 characters)
- Title must not be empty

---

## 5. Cross-Reference Validation

### 5.1 File Existence
For every `<leaf>` with a `xlink:href`:
- Resolve the relative path from the sequence folder
- Verify the referenced file exists on disk
- FAIL for any missing file reference
- Allow cross-sequence references (paths starting with `../`)

### 5.2 modified-file Validation
For every `<leaf>` with a `modified-file` attribute:
- Parse the format: `../{sequence}/index.xml#{leafID}`
- Verify the referenced sequence folder exists
- Verify the referenced index.xml exists
- Verify the referenced leaf ID exists in that index.xml
- Verify the target leaf has NOT already been replaced or deleted by another leaf
- FAIL if the chain is broken

### 5.3 Operation-modified-file Consistency
| Operation | modified-file | Valid? |
|-----------|--------------|--------|
| `new` | absent/empty | YES |
| `new` | present | FAIL — new files should not reference predecessors |
| `append` | present | YES |
| `append` | absent | FAIL — must reference the file being appended to |
| `replace` | present | YES |
| `replace` | absent | FAIL — must reference the file being replaced |
| `delete` | present | YES |
| `delete` | absent | FAIL — must reference the file being deleted |

### 5.4 Cross-Reference Chain Integrity
Build a complete life cycle graph across all sequences:
1. Start from sequence 0000 (all operations should be `new`)
2. For each subsequent sequence, trace `modified-file` references
3. Verify no leaf is targeted by more than one subsequent `modified-file`
4. Verify no leaf that has been replaced or deleted is targeted again
5. WARN if a replaced/deleted leaf's file is still physically present (not harmful but unusual)

### 5.5 Orphaned Files
- Scan all files in the submission directory structure
- Identify files not referenced by any `<leaf>` element in any sequence's index.xml
- WARN for orphaned files (files present but unreferenced)
- Exception: `index.xml`, `index-md5.txt`, DTD files, and stylesheets are not referenced by leaf elements

---

## 6. Checksum Validation

### 6.1 Leaf Checksum Verification
For every `<leaf>` with operation != `delete`:
- Compute MD5 hash of the file referenced by `xlink:href`
- Compare with the `checksum` attribute value
- FAIL if checksums do not match (indicates file corruption or wrong file)

### 6.2 index-md5.txt Verification
For each sequence folder:
- Read `index-md5.txt`
- Compute MD5 of `index.xml`
- Compare values
- FAIL if they do not match

### 6.3 Delete Operation Checksums
For `delete` operations:
- `checksum` should be empty (`checksum=""`)
- `xlink:href` should be absent
- FAIL if a delete operation has a non-empty checksum or file reference

---

## 7. Regional Module 1 Validation

### 7.1 Regional Structure
- If Module 1 is present, verify it follows the regional structure:
  - US: `m1/us/` with us-regional.xml
  - EU: `m1/eu/` with eu-regional.xml
  - JP: `m1/jp/` with jp-regional.xml
  - Other: `m1/{iso-3166-1-alpha-2}/`
- Only one region should typically be present per submission

### 7.2 Regional XML Instance
- If a regional XML instance exists, verify it references the correct regional DTD
- Verify the regional DTD exists in `util/dtd/`
- Verify the regional stylesheet exists in `util/style/`

### 7.3 Cover Letter
- WARN if no cover letter is detected in Module 1 (typically required by all regions)

---

## 8. Special Attribute Validation

### 8.1 Drug Substance Attributes (3.2.S)
- `<m3-2-s-drug-substance>` REQUIRES both `substance` and `manufacturer` attributes
- `<m2-3-s-drug-substance>` REQUIRES both `substance` and `manufacturer` attributes
- Values should be consistent across all sequences for the same substance

### 8.2 Drug Product Attributes (3.2.P)
- `<m3-2-p-drug-product>` has optional `product-name`, `dosageform`, `manufacturer`
- `<m2-3-p-drug-product>` has optional `product-name`, `dosageform`, `manufacturer`
- WARN if these are not provided (recommended for clarity)

### 8.3 Indication Attribute (2.7.3, 5.3.5)
- `<m2-7-3-summary-of-clinical-efficacy>` REQUIRES `indication` attribute
- `<m5-3-5-reports-of-efficacy-and-safety-studies>` REQUIRES `indication` attribute
- FAIL if these elements exist without the indication attribute
- Values should be consistent between Module 2 and Module 5

### 8.4 Excipient Attribute (3.2.P.4)
- `<m3-2-p-4-control-of-excipients>` has optional `excipient` attribute

---

## 9. PDF Content Validation

### 9.1 PDF Version
- WARN if PDF version is not 1.4 (the agreed-upon ICH standard)
- PDF/A-1 (ISO 19005-1:2005) does NOT meet ICH requirements

### 9.2 Security Settings
- FAIL if any PDF has password protection or security restrictions
- PDFs must allow printing, text selection, and annotation

### 9.3 Font Embedding
- WARN if non-standard fonts are not embedded
- Standard fonts: Times New Roman, Arial, Courier, and Acrobat built-ins

### 9.4 File Size
- WARN if any PDF exceeds 100 MB

### 9.5 Bookmarks
- WARN if a multi-page PDF with a table of contents lacks bookmarks

### 9.6 Hyperlinks
- WARN if hyperlinks use absolute paths (should be relative)

---

## 10. Node Extension Validation

### 10.1 Placement
- Node extensions should only appear at the **lowest level** of defined table-of-contents elements
- FAIL if node-extension is added to a non-leaf-level element (e.g., extending `<m2-common-technical-document-summaries>` directly)

### 10.2 Structure
- Every `<node-extension>` must contain a `<title>` element
- Must contain at least one `<leaf>` or nested `<node-extension>`
- `ID` attribute is optional but recommended

### 10.3 Update Consistency
- When updating a file originally submitted under a node-extension, the replacement must use the exact same element path and node-extension title

---

## Output Format

When reporting validation results, use this format:

```
## eCTD Validation Report
Submission: {dossier identifier}
Sequences validated: {list}
Date: {timestamp}

### Summary
- PASS: {count}
- WARN: {count}
- FAIL: {count}

### Critical Failures (FAIL)
1. [FAIL] {Category} > {Check}: {Description}
   - File/Element: {path or element reference}
   - Expected: {what was expected}
   - Found: {what was found}

### Warnings (WARN)
1. [WARN] {Category} > {Check}: {Description}
   - Details: {explanation}

### Passed Checks
{Summary of all passing categories}
```

---

## Validation Priority

When time or resources are limited, validate in this priority order:

1. **Critical (must fix before submission):**
   - XML well-formedness and DTD compliance
   - Leaf element required attributes
   - File existence for all xlink:href references
   - Checksum verification (all files + index-md5.txt)
   - modified-file chain integrity
   - File naming rules (characters, length)
   - Operation/modified-file consistency

2. **Important (should fix):**
   - Directory structure compliance
   - ID uniqueness
   - Required attributes on drug substance/product/indication elements
   - Regional Module 1 structure
   - Orphaned file detection
   - Cross-reference chain (no double-targeting)

3. **Advisory (nice to fix):**
   - PDF version and format compliance
   - Font embedding
   - Bookmark presence
   - File size warnings
   - Node extension placement
   - Hyperlink path style (relative vs absolute)

---

## Common Failure Patterns

These are the most frequently encountered validation failures. Check for these first:

1. **Checksum mismatch** — File was modified after checksum was computed
2. **Missing modified-file** — Replace/append/delete without referencing the predecessor
3. **Broken modified-file chain** — Target leaf ID doesn't exist in referenced sequence
4. **Invalid file names** — Uppercase letters, spaces, or special characters in paths
5. **Path too long** — Deep nesting causing >230 character paths
6. **Missing index-md5.txt** — Often forgotten during manual assembly
7. **DTD/stylesheet not found** — Wrong path in DOCTYPE or processing instruction
8. **Duplicate leaf IDs** — Same ID used for multiple leaf elements
9. **Delete with non-empty checksum** — Delete operations should have empty checksum
10. **Indication attribute missing** — Required on m2-7-3 and m5-3-5 elements
