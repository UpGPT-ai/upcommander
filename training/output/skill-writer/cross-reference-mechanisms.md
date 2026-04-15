# eCTD Cross-Reference Mechanisms

## Overview

The eCTD (Electronic Common Technical Document) v3.2.2 uses multiple cross-referencing mechanisms to link documents, track changes across submissions, and enable navigation within and between regulatory submissions. This document describes all cross-referencing mechanisms defined in the specification.

---

## 1. XML Backbone Cross-References (index.xml)

### 1.1 Leaf Element `xlink:href`

The primary cross-reference mechanism. Every content file in an eCTD submission is referenced by a `<leaf>` element in the `index.xml` backbone via the `xlink:href` attribute.

```xml
<leaf ID="s123456" operation="new" xlink:type="simple"
      checksum-type="md5" checksum="e854d3002c02a61fe5cbe926fd973401"
      xlink:href="m2/25-clin-over/clinical-overview.pdf"
      application-version="PDF 1.4">
    <title>Clinical Overview</title>
</leaf>
```

**Key rules:**
- Path is **relative** to the sequence folder (e.g., `0000/`)
- The file does NOT need to be in the same sequence as the leaf element referencing it
- A file can be referenced by multiple leaf elements (file reuse)
- xlink:type is always fixed to `"simple"`

### 1.2 File Reuse Across Locations

A single physical file can appear in multiple locations within the eCTD table of contents by having multiple `<leaf>` elements point to the same file via `xlink:href`. This avoids duplication.

```xml
<!-- Same file referenced in two different CTD sections -->
<m2-5-clinical-overview xml:lang="en">
    <leaf ID="a1" operation="new" xlink:href="m2/25-clin-over/overview.pdf" ...>
        <title>Clinical Overview</title>
    </leaf>
</m2-5-clinical-overview>

<m2-7-5-literature-references>
    <leaf ID="a2" operation="new" xlink:href="m2/25-clin-over/overview.pdf" ...>
        <title>Clinical Overview (also referenced here)</title>
    </leaf>
</m2-7-5-literature-references>
```

### 1.3 Cross-Sequence File References

Files from previous sequences can be referenced by leaf elements in later sequences:

```xml
<!-- In sequence 0001, referencing a file from sequence 0000 -->
<leaf ID="b1" operation="new" xlink:href="../0000/m3/32-body-data/quality-data.pdf" ...>
    <title>Quality Data (from initial submission)</title>
</leaf>
```

---

## 2. Life Cycle Management Cross-References

### 2.1 The `modified-file` Attribute

This is the mechanism for tracking document lineage across submission sequences. When a leaf element performs an `append`, `replace`, or `delete` operation, the `modified-file` attribute points back to the original leaf being modified.

**Format:** `../{sequence}/index.xml#{leafID}`

```xml
<!-- Example: Replacing a file from sequence 0000 -->
<leaf ID="a123457" operation="replace" xlink:type="simple"
      checksum-type="md5" checksum="502e9ab5827431f077340cea3b5e465a"
      xlink:href="m2/25-clin-over/clinical-overview-revised.pdf"
      application-version="PDF 1.4"
      modified-file="../0000/index.xml#s123456">
    <title>Clinical Overview</title>
</leaf>
```

### 2.2 Operation Types and Their Cross-Reference Behavior

| Operation | `modified-file` Required? | What Happens |
|-----------|--------------------------|--------------|
| `new` | No | New file, no predecessor |
| `append` | Yes | New file added alongside the original; both remain current |
| `replace` | Yes | New file supersedes the original; original shown as replaced |
| `delete` | Yes | No new file; original marked as no longer relevant to review |

### 2.3 Cross-Reference Chain Rules

- A `modified-file` attribute can only target a **single** leaf element
- Once a leaf has been replaced or deleted, it **cannot** be targeted by subsequent `modified-file` attributes
- An empty `modified-file` attribute (`modified-file=""`) is treated as if the attribute is not present
- For `delete` operations, the checksum value is empty (`checksum=""`) since no file is submitted

### 2.4 Life Cycle Examples

**Case 1 - Initial submission:**
```
Sequence 0000: structure.pdf (operation="new") → Current
```

**Case 2 - Replace:**
```
Sequence 0000: structure.pdf (operation="new") → Replaced
Sequence 0001: structure2.pdf (operation="replace", modified-file="../0000/index.xml#leafID") → Current
```

**Case 3 - Append:**
```
Sequence 0000: structure.pdf (operation="new") → Current (appended)
Sequence 0001: structure2.pdf (operation="append", modified-file="../0000/index.xml#leafID") → Current
```

**Case 4 - Delete:**
```
Sequence 0000: structure.pdf (operation="new") → No longer relevant
Sequence 0001: (no file, operation="delete", modified-file="../0000/index.xml#leafID")
```

---

## 3. Intra-Document Cross-References (Within PDFs)

### 3.1 Hypertext Links

PDF documents within an eCTD submission should use **relative hypertext links** to cross-reference other documents. This enables navigation between related documents without relying on the XML backbone.

**Rules:**
- Use **relative paths** (not absolute paths) to preserve link functionality when folders move
- Absolute links referencing specific drives or root directories will break on agency servers
- Links should be designated by thin-line rectangles or blue text
- Use `Inherit Zoom` magnification setting so destination displays at same zoom level

### 3.2 PDF Bookmarks

Bookmarks provide hierarchical navigation within individual PDF documents:

- Mirror the table of contents structure
- Maximum 4 levels of bookmark hierarchy recommended
- Include bookmarks for all tables, figures, publications, appendices
- Bookmark hierarchy should be identical to document's table of contents

---

## 4. XML Element ID Cross-References

### 4.1 Leaf Element IDs

Every `<leaf>` element has a required `ID` attribute that serves as a unique identifier within the XML instance. This ID is the target of `modified-file` cross-references.

**ID Format Rules:**
- Must start with an alphabetic character or underscore
- Can contain letters, numbers, underscores
- Must be unique within the XML instance
- Example: `id050520`, `s123456`, `a1234567`

### 4.2 Table of Contents Element IDs

Parent table-of-contents elements (e.g., `<m2-5-clinical-overview>`) have an optional `ID` attribute for identification purposes. At this level, ID is optional (changed to `#IMPLIED` in DTD v3.2).

### 4.3 Title Element IDs

The `<title>` child of `<leaf>` elements also has an optional `ID` attribute. Leaf title IDs start with an alphabetic character or underscore and serve as an additional reference mechanism.

---

## 5. Regional Module 1 Cross-References

### 5.1 Regional XML Instances

Each region (US, EU, JP, etc.) defines its own XML instance for Module 1, with its own DTD. The regional XML instance cross-references back to the ICH index.xml:

- **US:** us-regional.xml with us-regional.dtd
- **EU:** eu-regional.xml with eu-regional.dtd
- **JP:** jp-regional.xml with jp-regional.dtd

### 5.2 Regional DTD References

The main `index.xml` references the ICH DTD:
```xml
<!DOCTYPE ectd:ectd SYSTEM "util/dtd/ich-ectd-3-x.dtd">
```

Regional instances reference their own DTDs while maintaining cross-references to files in the same submission structure.

---

## 6. Checksum Cross-References

### 6.1 File-Level Checksums

Every `<leaf>` element contains an MD5 checksum of the referenced file, providing integrity verification:

```xml
<leaf checksum="e854d3002c02a61fe5cbe926fd973401" checksum-type="md5" ...>
```

### 6.2 index-md5.txt

An `index-md5.txt` file accompanies every `index.xml`, containing the MD5 checksum of the index.xml file itself. This provides a chain of trust:

```
index-md5.txt → validates → index.xml → validates → all content files
```

---

## 7. Stylesheet and DTD References

### 7.1 XML Processing Instructions

The top of each `index.xml` contains cross-references to the DTD and stylesheet:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ectd:ectd SYSTEM "util/dtd/ich-ectd-3-x.dtd">
<?xml-stylesheet type="text/xsl" href="util/style/ectd-2-1-x.xsl"?>
```

### 7.2 Namespace References

The root `<ectd:ectd>` element declares namespaces that enable cross-referencing:

```xml
<ectd:ectd xmlns:ectd="http://www.ich.org/ectd"
           xmlns:xlink="http://www.w3.org/1999/xlink"
           xml:lang="en"
           dtd-version="3.2">
```

---

## 8. Node Extension Cross-References

When the standard eCTD hierarchy is insufficient, applicants can extend it using `<node-extension>` elements. These create new sub-nodes below the lowest defined element:

```xml
<m2-3-r-regional-information>
    <node-extension>
        <title>special-summary</title>
        <leaf ID="a123456" operation="new" xlink:href="m2/23-qos/extra-quality-sum.pdf"
              checksum-type="md5" checksum="7490d74c3d5e442ad57daa155253eb16">
            <title>Extra Quality Summary</title>
        </leaf>
    </node-extension>
</m2-3-r-regional-information>
```

**Rules:**
- Only extend at the **lowest level** of defined elements
- Title of the node-extension becomes the navigational label
- When updating, must resubmit with matching element and node-extension title
- Usage is discouraged; consult regional guidance first

---

## 9. Study Tagging Files (Module 5)

For Module 5 (Clinical Study Reports), study tagging files provide additional cross-referencing metadata that links study reports to:

- Study identifiers
- Indications (via the `indication` attribute on `<m5-3-5-reports-of-efficacy-and-safety-studies>`)
- Multiple therapeutic indications using repeated elements

```xml
<m5-3-5-reports-of-efficacy-and-safety-studies indication="pain">
    <m5-3-5-1-study-reports-of-controlled-clinical-studies-pertinent-to-the-claimed-indication>
        <leaf ID="a123458" operation="new" ...
              xlink:href="m5/53-clin-stud-rep/535-rep-eff-safety-stud/pain/pain-sr1.pdf">
            <title>pain study report 1</title>
        </leaf>
    </m5-3-5-1-...>
</m5-3-5-reports-of-efficacy-and-safety-studies>
```

---

## Summary Table

| Mechanism | Scope | Direction | Purpose |
|-----------|-------|-----------|---------|
| `xlink:href` | Leaf → File | Forward | Locate content files |
| `modified-file` | Leaf → Leaf | Backward (across sequences) | Track document lineage |
| PDF hyperlinks | Document → Document | Lateral | Navigate between related docs |
| PDF bookmarks | Within document | Internal | Navigate within a document |
| `ID` attributes | Within XML instance | Internal | Unique identification |
| Checksums | Leaf → File integrity | Verification | Ensure file integrity |
| DTD/XSL references | XML → Util files | Forward | Schema and presentation |
| `indication` attribute | Element metadata | Categorical | Group by therapeutic indication |
| Node extensions | Extend hierarchy | Downward | Custom sub-categories |
