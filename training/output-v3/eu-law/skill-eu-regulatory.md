# SKILL: EU Regulatory Compliance Analyzer

## Purpose
Analyze pharmaceutical regulatory submissions, development plans, and compliance documentation against the full body of EU pharmaceutical legislation. Identify gaps, non-compliance, and strategic risks — with particular attention to where EU requirements diverge from US FDA requirements.

## Trigger Conditions
Activate this skill when:
- Reviewing a regulatory submission dossier for EU markets
- Comparing EU and FDA regulatory strategies
- Assessing whether a product needs centralised vs national/MRP/DCP procedure
- Evaluating clinical trial applications under Regulation 536/2014
- Reviewing pharmacovigilance system compliance
- Assessing manufacturing/GMP compliance for EU
- Planning a paediatric investigation plan (PIP)
- Evaluating orphan drug designation strategy
- Reviewing ATMP classification and requirements
- Assessing post-authorization variation strategy

## Source Legislation
This skill draws on requirements extracted from 8 EU legislative instruments:

| Legislation | Scope |
|---|---|
| **Directive 2001/83/EC** | Community code for medicinal products — MA, manufacturing, labelling, distribution, pharmacovigilance, advertising |
| **Regulation (EC) 726/2004** | Centralised procedure, EMA structure, pharmacovigilance, financial penalties |
| **Regulation (EU) 536/2014** | Clinical trials — authorisation, conduct, safety reporting, informed consent, transparency |
| **Regulation (EU) 2017/1569** | GMP for investigational medicinal products |
| **Regulation (EC) 1394/2007** | Advanced therapy medicinal products (ATMPs) |
| **Regulation (EC) 141/2000** | Orphan medicinal products |
| **Regulation (EC) 1901/2006** | Paediatric medicinal products |
| **Regulation (EC) 1234/2008** | Variations to marketing authorisations |

## Reference Files
- `eu-legislation-requirements.json` — 412 structured legal requirements organized by 17 topics
- `eu-vs-fda-divergences.json` — 68 mapped EU-FDA divergences across 15 categories

---

## Analysis Framework

### STEP 1: Product Classification & Pathway Determination

Determine:
1. **Is the product an ATMP** (gene therapy, somatic cell therapy, tissue engineered product)?
   - If YES → Mandatory centralised procedure (Reg 1394/2007 + Reg 726/2004)
   - Assess CAT classification opinion requirement
   - Check 30-year traceability obligation
   - Evaluate hospital exemption applicability

2. **Does the product contain a new active substance for a mandatory indication?**
   - Biotech (recombinant DNA, gene expression, hybridoma/mAb) → Mandatory centralised
   - New active substance for: AIDS, cancer, neurodegeneration, diabetes, autoimmune, viral → Mandatory centralised
   - Orphan designated → Mandatory centralised

3. **Is the product eligible for optional centralised procedure?**
   - New active substance not in mandatory scope → Optional centralised (Art. 3(2))
   - Significant therapeutic, scientific, or technical innovation → Optional centralised

4. **If not centralised → Determine national/MRP/DCP strategy**
   - Single Member State: National procedure (210-day timeline)
   - Multiple Member States, existing MA: Mutual Recognition (90-day recognition)
   - Multiple Member States, new application: Decentralised (120-day RMS assessment + 90-day recognition)

### STEP 2: Pre-Submission Requirements Checklist

For each submission, verify:

**Application Dossier (Art. 8(3))**
- [ ] Applicant established in the Community (Art. 8(2))
- [ ] Complete CTD format dossier per Annex I
- [ ] Environmental risk assessment (Art. 8(3)(ca)) — **EU-specific, no FDA equivalent**
- [ ] Pharmacovigilance system summary with QPPV proof (Art. 8(3)(ia))
- [ ] Risk Management Plan (Art. 8(3)(iaa)) — **Mandatory for ALL new MAs**
- [ ] Ethical compliance statement for non-EU clinical trials (Art. 8(3)(ib))
- [ ] GMP audit confirmation for active substance manufacturer (Art. 8(3)(ha))
- [ ] SmPC draft per Article 11 format (12 defined sections)
- [ ] Mock-ups of outer/immediate packaging with Braille
- [ ] Package leaflet with user testing documentation
- [ ] Orphan designation copy if applicable

**Paediatric Requirements (Reg 1901/2006)**
- [ ] Agreed PIP, or waiver, or deferral decision from Paediatric Committee
- [ ] PIP compliance statement with study results
- [ ] If deferral: timeline for paediatric development agreed

**For Biologics/Biosimilars**
- [ ] If biosimilar: comparability exercise with EU reference product (Art. 10(4))
- [ ] If ATMP: CAT classification recommendation obtained

### STEP 3: Clinical Trial Compliance Review (Reg 536/2014)

**Authorisation**
- [ ] Application submitted via EU portal (CTIS)
- [ ] Reporting Member State proposed and confirmed
- [ ] Application validated within 10 days (tacit validation applies)
- [ ] Part I assessment completed within 45 days (3-phase for multi-state)
- [ ] Part II (ethics) assessment completed within 45 days per Member State
- [ ] Tacit authorisation provisions understood if timelines lapse

**Protocol Design**
- [ ] Low-intervention trial criteria assessed (Art. 2(2)(3))
- [ ] Population representativeness justified (Recital 14)
- [ ] Vulnerable populations protections (Arts. 31-35): minors, incapacitated, pregnant/breastfeeding, emergency
- [ ] Germ line modification prohibition respected (Art. 90)

**Informed Consent**
- [ ] Written, dated, signed by interviewer and subject (Art. 29)
- [ ] Information comprehensive, concise, understandable to layperson
- [ ] Prior interview with qualified team member documented
- [ ] Damage compensation system information provided (Art. 76)
- [ ] EU trial number and results availability information provided
- [ ] Impartial witness provision for subjects unable to write
- [ ] Withdrawal rights clearly communicated

**Safety Reporting**
- [ ] SAE reporting: investigator → sponsor within 24 hours (Art. 41)
- [ ] SUSAR reporting: sponsor → Eudravigilance: fatal/life-threatening 7 days, others 15 days (Art. 42)
- [ ] Annual safety report submitted for each IMP (Art. 43)
- [ ] Serious breach reporting within 7 days (Art. 52)
- [ ] Urgent safety measures reporting within 7 days (Art. 54)

**IMP Manufacturing**
- [ ] Manufacturing authorisation per Art. 61(1)
- [ ] QP batch certification per Art. 62
- [ ] GMP compliance per Reg 2017/1569
- [ ] Product specification file maintained
- [ ] 5-year document retention; 2-year sample retention

**Transparency**
- [ ] Results summary submitted within 1 year of trial end (6 months paediatric)
- [ ] Layperson summary prepared — **EU-specific requirement**
- [ ] 25-year archival plan for clinical trial master file

**Insurance/Compensation**
- [ ] Damage compensation system in place per each Member State's requirements
- [ ] Insurance/guarantee appropriate to nature and extent of risk

### STEP 4: Manufacturing & Supply Chain Compliance

**Manufacturing Authorisation**
- [ ] Manufacturing authorisation obtained (Art. 40)
- [ ] QP appointed with qualifying credentials (4-year university + 2-year experience) (Art. 48-52)
- [ ] QP batch release register maintained (5-year retention)
- [ ] GMP compliance verified via regular inspections
- [ ] GMP certificate obtained and entered in EudraGMDP

**Active Substance Controls**
- [ ] API manufacturer registered with competent authority (60-day advance) (Art. 52a)
- [ ] Imported APIs accompanied by written GMP confirmation from exporting country (Art. 46b) — **EU-specific**
- [ ] MAH has conducted GMP audit at API manufacturing and distribution sites (Art. 46(f))
- [ ] Excipient suitability confirmed via formalised risk assessment (Art. 46)

**Anti-Falsification / Safety Features**
- [ ] Unique identifier applied to prescription product packaging (Art. 54(o))
- [ ] Anti-tampering device applied
- [ ] Connected to EU repositories system for verification
- [ ] Safety features compliant with Delegated Regulation (EU) 2016/161

**Labelling**
- [ ] All Art. 54 particulars on outer packaging
- [ ] Braille product name on packaging — **EU-specific**
- [ ] Official language(s) of each target Member State
- [ ] Package leaflet user-tested with target patient groups — **EU-specific**
- [ ] Black triangle statement if on additional monitoring list — **EU-specific**

### STEP 5: Pharmacovigilance System Assessment

- [ ] QPPV appointed, residing and operating in the EU (Art. 104(3))
- [ ] Pharmacovigilance System Master File (PSMF) maintained and accessible within 7 days (Art. 104(3)(e))
- [ ] Risk Management Plan (RMP) submitted with MA and updated through lifecycle
- [ ] Adverse reaction reporting operational:
  - Serious: 15 days to Eudravigilance
  - Non-serious (Union): 90 days to Eudravigilance — **Note: FDA does not require individual non-serious reporting**
- [ ] PSUR schedule established:
  - Pre-marketing: every 6 months
  - First 2 years marketed: every 6 months
  - Next 2 years: annually
  - Thereafter: every 3 years
- [ ] EU reference date and PSUR submission frequency aligned with EURD list
- [ ] Signal detection procedures for Eudravigilance monitoring
- [ ] Post-authorisation safety study (PASS) procedures if required
- [ ] 24-hour pre-notification for non-urgent public pharmacovigilance announcements

### STEP 6: Post-Authorisation Maintenance

**Renewal**
- [ ] 5-year MA validity tracked
- [ ] Consolidated renewal file prepared at least 9 months before expiry
- [ ] After first renewal: unlimited validity unless pharmacovigilance exception

**Sunset Clause**
- [ ] Product marketed within 3 years of MA grant
- [ ] No 3-consecutive-year market absence
- [ ] Market cessation: 2-month advance notification

**Variations**
- [ ] Changes classified per Reg 1234/2008 (Type IA/IB/II/extension)
- [ ] Urgent safety restrictions: 24-hour authority response + 15-day variation follow-up
- [ ] Work-sharing utilised for MRP/DCP products where applicable

**Ongoing Obligations**
- [ ] Manufacturing/control methods updated with scientific progress (Art. 23)
- [ ] New safety/efficacy information reported forthwith (Art. 16/23)
- [ ] Product information kept current with scientific knowledge
- [ ] Annual pharmacovigilance fees paid
- [ ] Supply continuity obligation maintained — **EU-specific**

### STEP 7: Critical EU-FDA Divergence Flags

When analyzing a dual-jurisdiction submission strategy, flag these critical divergences:

| Area | EU Requirement | FDA Requirement | Risk Level |
|---|---|---|---|
| DTC Advertising | **PROHIBITED** for Rx products | Permitted with restrictions | CRITICAL |
| QP Batch Release | Mandatory named individual with specific qualifications | Organizational QC unit | CRITICAL |
| RMP | Mandatory for ALL new MAs | REMS only when FDA determines necessary | HIGH |
| Data Exclusivity | 8+2(+1) years | NCE: 5 years; Biologics: 12 years | HIGH |
| PIP Timing | Triggered at PK study completion (before MA filing) | Triggered at NDA/BLA filing | HIGH |
| Trial Archival | 25 years | 2 years post-approval | HIGH |
| Trial Insurance | Mandatory in each Member State | No federal mandate | HIGH |
| Non-Serious ADR Reporting | Individual case reports within 90 days | Not required individually | HIGH |
| PSUR System | Structured PRAC assessment with EU reference dates | PADERs (less structured) | HIGH |
| Braille on Packaging | Mandatory | Not required | MEDIUM |
| Safety Features | EU repositories verification system | DSCSA serialization (different specs) | MEDIUM |
| Online Pharmacy Logo | EU common logo with cryptographic verification | No federal system | MEDIUM |
| Supply Continuity | Legal obligation | Notification-based only | MEDIUM |
| Environmental Risk Assessment | Substantively evaluated for all MAs | Mostly categorical exclusion | MEDIUM |
| Package Leaflet Testing | Mandatory user testing | Encouraged, not mandated | MEDIUM |

---

## Output Format

When analyzing a submission or strategy, produce:

### 1. Compliance Score
Rate compliance across each major area (0-100%):
- Product Classification & Pathway: ___%
- Pre-Submission Documentation: ___%
- Clinical Trial Compliance: ___%
- Manufacturing & GMP: ___%
- Labelling & Packaging: ___%
- Pharmacovigilance: ___%
- Post-Authorisation: ___%
- **Overall EU Compliance Score: ___%**

### 2. Gap Analysis
For each identified gap:
```
GAP-XXX: [Short description]
  Legal basis: [Article reference]
  Requirement: [What EU law requires]
  Current status: [What exists or is missing]
  Risk level: CRITICAL | HIGH | MEDIUM | LOW
  Remediation: [Specific action required]
  Timeline: [Deadline or recommended completion]
  FDA comparison: [Whether same gap exists for FDA submission]
```

### 3. EU-FDA Strategy Alignment
Where a dual-jurisdiction strategy is being assessed:
```
DIVERGENCE-XXX: [Topic]
  EU approach: [What EU requires]
  FDA approach: [What FDA requires]
  Conflict: [Where they conflict or differ]
  Recommended strategy: [How to handle both]
  Cost/complexity: LOW | MEDIUM | HIGH
```

### 4. Risk Register
Prioritized list of regulatory risks with:
- Likelihood (1-5)
- Impact (1-5)
- Risk score (L × I)
- Mitigation strategy
- Owner

---

## Version History
- v3.0 (2026-03-22): Initial build from 8 EU legislative PDFs. 412 requirements extracted. 68 EU-FDA divergences mapped.
