# ICH Q8-Q13 Quality Systems Evaluation Skill

## Purpose

Evaluate pharmaceutical development sections and quality system documentation against ICH Q8(R2), Q9(R1), Q10, Q11, Q12, and Q13 requirements. This skill covers pharmaceutical development (QbD), quality risk management, pharmaceutical quality systems, drug substance development, lifecycle management, and continuous manufacturing.

## Source Authority

| Guideline | Title | Step 4 Date |
|-----------|-------|-------------|
| Q8(R2) | Pharmaceutical Development | August 2009 |
| Q9(R1) | Quality Risk Management | January 2023 |
| Q10 | Pharmaceutical Quality System | June 2008 |
| Q11 | Development and Manufacture of Drug Substances | May 2012 |
| Q12 | Technical and Regulatory Considerations for Lifecycle Management | November 2019 |
| Q13 | Continuous Manufacturing of Drug Substances and Drug Products | November 2022 |
| Q8/Q9/Q10 Q&As | Points to Consider (R4/R5) | October 2024 |

## Rules File

Load `quality-systems-rules.json` from this directory for the complete structured ruleset with all requirements, definitions, and cross-references.

---

## Evaluation Framework

### Section 1: Quality Target Product Profile (QTPP) and Critical Quality Attributes (CQAs)

**Evaluate whether the submission:**

1. **Defines a QTPP** that includes intended clinical use, route of administration, dosage form, delivery systems, dosage strength(s), container closure system, therapeutic moiety release characteristics, and drug product quality criteria (sterility, purity, stability, drug release)
2. **Identifies potential CQAs** with scientific rationale for their designation, including explanation of why other properties were not designated as CQAs
3. **Distinguishes criticality from risk** -- criticality of quality attributes is based on severity of harm and does NOT change with risk management; only risk levels change through control strategy
4. **Links CQAs to QTPP** with clear traceability from product quality requirements through to controls

**Red flags:**
- QTPP is absent or incomplete (missing route, dosage form, or quality criteria)
- CQAs identified without scientific rationale or risk assessment justification
- Criticality classification conflated with risk level (e.g., claiming an attribute is "no longer critical" because controls reduce the risk)
- No linkage between CQAs and drug substance properties that affect drug product quality

---

### Section 2: Pharmaceutical Development Approach

**Evaluate whether the submission:**

1. **Clearly identifies the development approach** (traditional, enhanced/QbD, or combination) and applies it consistently
2. **For traditional approaches:** demonstrates process reproducibility with appropriate set points, operating ranges, and end-product testing
3. **For enhanced approaches:** includes systematic evaluation of formulation and manufacturing process, identifies material attributes and process parameters affecting CQAs through prior knowledge and experimentation, and determines functional relationships linking inputs to CQAs
4. **Uses risk assessment** (per Q9) to identify and rank material attributes and process parameters with potential impact on quality
5. **Provides adequate drug substance characterisation** including physicochemical and biological properties affecting drug product performance and manufacturability
6. **Justifies excipient selection** relative to function, compatibility, and performance throughout shelf life
7. **Justifies the manufacturing process** including critical formulation attributes and process parameters, equipment appropriateness, and sterilisation method (if applicable)
8. **Addresses container closure system** selection with justification for materials, integrity, and compatibility (including sorption, leaching, and light/moisture protection)

**Red flags:**
- Claims of enhanced approach without multivariate studies or mechanistic understanding
- Risk assessments that are purely qualitative with no scientific basis
- Knowledge gained not proportionate to the level of regulatory flexibility requested
- No discussion of process differences between clinical trial batches and proposed commercial process
- Overages used to compensate for degradation without adequate justification

---

### Section 3: Design Space

**Evaluate whether the submission:**

1. **Defines the design space clearly** in terms of ranges of material attributes and process parameters, mathematical relationships, or multivariate models
2. **Provides supporting data** including prior knowledge, QRM conclusions, experimental studies (DOE), and model validation
3. **Demonstrates that proven acceptable ranges based on univariate experimentation alone are NOT presented as a design space** -- a design space requires demonstrated interactions
4. **Justifies scale relevance** if design space was developed at small or pilot scale, including discussion of scale-dependent vs. scale-independent parameters
5. **Addresses edge-of-failure risks** -- while determining edge of failure is NOT required, the control strategy must manage residual risk near design space edges
6. **Documents the relationship** between design space, CQAs, QTPP, and control strategy
7. **Includes verification approach** for scale-up, noting that the entire design space need NOT be re-established at commercial scale
8. **Addresses unit operation interactions** when design spaces are established per unit operation

**Red flags:**
- Univariate ranges presented as a design space without interaction data
- No statistical DOE or mechanistic model supporting the design space boundaries
- No discussion of scale-dependent parameters or verification strategy
- Design space verification confused with process validation
- Missing linkage between design space and overall control strategy

---

### Section 4: Control Strategy

**Evaluate whether the submission:**

1. **Describes a comprehensive control strategy** including controls on input materials, process design, in-process controls, and drug substance/product release testing
2. **Justifies the control approach for each CQA** -- whether controlled via specification testing, upstream controls (including RTRT), or ensured through process design
3. **Demonstrates that upstream controls are based on evaluation and understanding of variability sources** rather than convenience
4. **Addresses variability management** -- identifies sources of variability and how the control strategy compensates for them
5. **Provides a summary** in tabular or diagrammatic format explaining how individual elements work together
6. **For RTRT:** links measured attributes to CQAs and QTPP, follows regional requirements for release specifications, and includes CoA elements
7. **Addresses batch release requirements** including regulatory compliance data, system data, process data, and QC data

**Red flags:**
- Control strategy relies solely on end-product testing with no process understanding
- Upstream controls proposed without demonstrated link to CQAs
- RTRT proposed without validated predictive models or adequate reference method correlation
- No summary showing how individual control elements integrate
- Different control strategies at different sites without justification for equivalent quality assurance

---

### Section 5: Quality Risk Management (QRM)

**Evaluate whether the submission:**

1. **Follows the Q9(R1) QRM process** -- hazard identification, risk analysis, risk evaluation, risk control, risk communication, and risk review
2. **Uses appropriate formality level** commensurate with uncertainty, importance, and complexity (NOT justified by resource constraints)
3. **Manages subjectivity** -- acknowledges bias, uses relevant data, and properly applies QRM tools
4. **Documents risk assessments** with scientific rationale, including factors considered and basis for conclusions
5. **Identifies residual risk** remaining after control strategy implementation
6. **Plans for ongoing risk review** with frequency based on risk level
7. **Addresses product availability risks** from quality/manufacturing issues including process variability, facility/equipment robustness, and supplier oversight

**Red flags:**
- Risk assessments with no scientific basis or where scores appear arbitrary
- Formality level justified by resource constraints rather than risk characteristics
- Risk used to reclassify attribute criticality (criticality is severity-based and does NOT change)
- QRM used to justify practices that would otherwise be unacceptable
- No plan for ongoing risk review or reassessment as knowledge evolves
- Subjectivity not acknowledged or addressed

---

### Section 6: Pharmaceutical Quality System (PQS)

**Evaluate whether the submission demonstrates:**

1. **Management commitment** including quality policy, quality objectives, resource allocation, and communication/escalation processes
2. **Four PQS elements** in place:
   - Process performance and product quality monitoring system
   - CAPA system with root cause investigation commensurate with risk
   - Change management system evaluating changes relative to marketing authorisation and design space
   - Management review providing governance and continual improvement
3. **Knowledge management** as an enabler -- systematic approach to acquiring, storing, and disseminating product/process knowledge
4. **QRM integration** throughout the PQS as an enabler
5. **Outsourced activities and supplier management** -- the company is ultimately responsible for quality regardless of outsourcing
6. **Appropriate application** across all lifecycle stages, proportionate to each stage's goals and available knowledge

**Red flags:**
- No independent quality unit with appropriate authority
- CAPA system that lacks root cause investigation or is not risk-proportionate
- Change management that does not evaluate changes relative to the marketing authorisation
- No knowledge management practices, especially critical for contract manufacturing
- Outsourced activities without quality agreements or bidirectional knowledge transfer

---

### Section 7: Drug Substance Development (Q11-Specific)

**Evaluate whether the submission:**

1. **Justifies starting material selection** against all six general principles (not applying each in isolation)
2. **Demonstrates understanding of impurity formation, fate, and purge** throughout the manufacturing process
3. **For mutagenic impurities:** uses 30% of ICH M7 TTC threshold to assess impact on impurity profile
4. **Provides adequate control strategy** for drug substance including controls on raw materials, in-process controls, and release testing
5. **Justifies specifications** with linkage to QTPP, including tests for identity, purity, and assay
6. **For biotech/biological products:** addresses cell bank characterisation, adventitious agent safety, process-related and product-related impurities, and comparability per Q5E
7. **Documents process development history** with chronological milestones and batch information

**Red flags:**
- Starting material selection that applies only one principle in isolation
- Custom-synthesised chemicals proposed as starting materials without justification against general principles
- No impurity fate and purge analysis for chemical entities
- Platform manufacturing claims without product-specific validation
- Inadequate starting material specification (missing impurity controls)

---

### Section 8: Lifecycle Management (Q12-Specific)

**Evaluate whether the submission:**

1. **Identifies Established Conditions (ECs)** with clear distinction from supportive information
2. **Justifies reporting categories** for changes to ECs based on risk assessment per Q9
3. **Uses appropriate EC identification approach** (minimal/enhanced/performance-based) consistent with level of product and process knowledge
4. **Includes PACMP** where applicable, with proper two-step structure (protocol approval, then execution)
5. **Includes or references a PLCM document** capturing ECs, reporting categories, PACMPs, and post-approval commitments
6. **For stability data:** uses science- and risk-based approaches to CONFIRM (not re-establish) approved shelf-life
7. **Addresses supply chain change management** with communication mechanisms between MAH and manufacturing organisations

**Red flags:**
- ECs not clearly distinguished from supportive information in the dossier
- Reporting categories not justified by risk assessment
- PACMP proposed for changes requiring clinical/non-clinical data
- EC identification approach inconsistent with stated level of knowledge
- Manufacturing process description is less detailed because ECs were identified (this should NOT happen)
- No mechanism for supply chain communication of changes

---

### Section 9: Continuous Manufacturing (Q13-Specific)

**Evaluate whether the submission:**

1. **Defines the CM mode** (hybrid, fully continuous, or integrated DS/DP) with clear description
2. **Defines batch size** appropriately (quantity, run time, or range) with justification
3. **Characterises process dynamics and RTD** over planned operating ranges using scientifically justified approaches
4. **Describes material traceability and diversion strategy** with criteria for triggering diversion and resuming collection, incorporating safety margins based on RTD uncertainty
5. **Addresses state of control** including mechanisms to detect drift/trends and identify root causes
6. **Describes process monitoring** with appropriate PAT, sampling strategy, and automated controls (feedforward/feedback)
7. **Addresses startup, shutdown, pause, and restart procedures** with disposition justification for material impacted by transient events
8. **Includes disturbance management strategy** covering scenarios of varying amplitude, duration, and frequency
9. **For process models:** provides detail commensurate with impact category, including maintenance and contingency plans
10. **For integrated DS/DP:** defines drug substance specification even when DS is not isolated, with periodic conformance verification

**Red flags:**
- No RTD characterisation or reliance on RTD studies that are not representative of commercial process
- Diversion strategy without justified safety margins
- Data averaging across entire run time rather than appropriate time intervals
- No contingency plan for PAT equipment failure or data gaps
- Batch size defined as a range without justification
- For integrated processes: no drug substance specification defined

---

### Section 10: Process Models and PAT

**Evaluate whether the submission:**

1. **Categorises models by impact level** (low/medium/high) with appropriate oversight
2. **Validates models** against predetermined acceptance criteria using statistically sound approaches including external data sets
3. **Includes lifecycle verification plans** with risk-based frequency and triggers for model updates
4. **For high-impact models (e.g., RTRT):** provides full documentation including sample size justification, variable selection rationale, validation (internal and external), and lifecycle verification approach
5. **Addresses model uncertainty** and its impact on product quality decisions
6. **Documents PAT implementation** with measurement method, calibration approach, and handling of OOS model predictions

**Red flags:**
- High-impact models treated with low-impact documentation
- No external validation data set for medium/high-impact models
- No lifecycle verification plan or triggers for model update
- Model uncertainty not addressed or not linked to control strategy
- Validation data not representative of anticipated production variability

---

## Scoring Rubric

For each of the 10 sections, assign a rating:

| Rating | Label | Criteria |
|--------|-------|----------|
| 3 | **Compliant** | All applicable requirements addressed with adequate scientific justification |
| 2 | **Partially Compliant** | Most requirements addressed but gaps exist in justification or completeness |
| 1 | **Deficient** | Significant gaps; requirements missing or scientifically unjustified |
| 0 | **Not Addressed** | Section entirely missing or inapplicable content provided |
| N/A | **Not Applicable** | Section does not apply to this submission type |

**Overall Assessment:**
- Calculate the weighted average across applicable sections
- Flag any section rated 0 or 1 as requiring remediation
- Note all red flags identified during evaluation

---

## Output Template

```markdown
# Quality Systems Evaluation Report

## Submission: [Product/Application Name]
## Date: [Evaluation Date]
## Evaluator: [Name/ID]

### Summary Score Card

| Section | Rating | Key Findings |
|---------|--------|-------------|
| 1. QTPP & CQAs | [0-3] | |
| 2. Development Approach | [0-3] | |
| 3. Design Space | [0-3/N/A] | |
| 4. Control Strategy | [0-3] | |
| 5. Quality Risk Management | [0-3] | |
| 6. Pharmaceutical Quality System | [0-3] | |
| 7. Drug Substance Development | [0-3/N/A] | |
| 8. Lifecycle Management | [0-3/N/A] | |
| 9. Continuous Manufacturing | [0-3/N/A] | |
| 10. Process Models & PAT | [0-3/N/A] | |

**Overall Score:** [X.X / 3.0]
**Red Flags Identified:** [Count]

### Detailed Findings

[Per-section analysis with specific rule references from quality-systems-rules.json]

### Red Flags

[List all red flags with section reference and severity assessment]

### Recommendations

[Prioritised list of actions to achieve compliance]

### Cross-Reference Verification

| ICH Guideline | Sections Evaluated | Compliance Level |
|---------------|-------------------|-----------------|
| Q8(R2) | | |
| Q9(R1) | | |
| Q10 | | |
| Q11 | | |
| Q12 | | |
| Q13 | | |
```

---

## Quick Reference: Critical Distinctions

| Concept | Rule | Source |
|---------|------|--------|
| Criticality vs. Risk | Criticality (severity-based) does NOT change with risk management; risk CAN change | Q&As S2 |
| Design Space vs. Proven Ranges | Univariate proven acceptable ranges do NOT constitute a design space | Q8 S2.4.5 |
| Within Design Space | NOT a change from regulatory perspective; IS evaluated by company change management | Q8/Q10 |
| Outside Design Space | IS a change; initiates regulatory post-approval change process | Q8 Glossary |
| EC vs. Supportive Info | ECs are legally binding; supportive info is NOT an EC | Q12 S3 |
| RTRT vs. Release | RTRT replaces end-product testing but NOT GMP review/QC steps for batch release | Q8 S2.5 |
| Formality | Continuum, NOT binary; resource constraints must NOT justify lower formality | Q9(R1) S5.1 |
| CM Batch Definition | Q7 definition applies; can use quantity, run time, or range | Q13 S3.2 |
| Model Oversight | Must be commensurate with risk/impact of the model | Q&As S5 |
| Knowledge Transfer | Must be bidirectional in contract manufacturing | Q&As S3.1 |
