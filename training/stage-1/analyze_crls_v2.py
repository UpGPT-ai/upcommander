#!/usr/bin/env python3
"""
CRL Deficiency Analyzer v2 — Refined analysis with tighter pattern matching,
section-based CMC classification, and proper deficiency extraction.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

INPUT = Path("/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/stage-1/crl-database/crl-data.json")
OUTDIR = Path("/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/output/crl-analyst")
OUTDIR.mkdir(parents=True, exist_ok=True)

ECTD_MODULES = {
    "1": "Module 1 — Administrative / Regional",
    "2.3": "Module 2.3 — Quality Overall Summary",
    "2.4": "Module 2.4 — Nonclinical Overview",
    "2.5": "Module 2.5 — Clinical Overview",
    "2.6": "Module 2.6 — Nonclinical Written/Tabulated Summaries",
    "2.7": "Module 2.7 — Clinical Summary",
    "3": "Module 3 — Quality (CMC)",
    "4": "Module 4 — Nonclinical Study Reports",
    "5": "Module 5 — Clinical Study Reports",
}

# ── Section-level classification ──────────────────────────────────────
# These are sections that contain actual approvability deficiencies
CMC_SECTIONS = {
    'PRODUCT QUALITY', 'CHEMISTRY, MANUFACTURING AND CONTROLS',
    'CHEMISTRY', 'CMC', 'MICROBIOLOGY', 'DEVICE',
}
CMC_ADJACENT_SECTIONS = {
    'FACILITY INSPECTIONS',  # Often CMC-blocking
}
CLINICAL_SECTIONS = {
    'CLINICAL', 'CLINICAL/STATISTICAL',
}
CLINICAL_ADJACENT_SECTIONS = {
    'CLINICAL PHARMACOLOGY', 'NONCLINICAL', 'BIOPHARMACEUTICS',
    'HUMAN FACTORS',
}
LABELING_SECTIONS = {
    'LABELING', 'PRESCRIBING INFORMATION', 'CARTON AND CONTAINER LABELING',
    'PROPRIETARY NAME', 'MEDICATION GUIDE',
    'RISK EVALUATION AND MITIGATION STRATEGY REQUIREMENTS',
    'RISK EVALUATION AND MITIGATION STRATEGY',
}
NON_DEFICIENCY_SECTIONS = {
    'OTHER', 'SAFETY UPDATE', 'ADDITIONAL COMMENTS', 'ADDITIONAL COMMENT',
    'PREAMBLE', 'REQUIRED PEDIATRIC ASSESSMENTS',
}

# ── Refined deficiency pattern taxonomy ──────────────────────────────
# Format: (regex, deficiency_type, is_cmc_override, cross_ref_catchable)
# is_cmc_override: True/False/None (None = inherit from section)
CMC_PATTERNS = [
    (r'specif(?:ication|y|ied)\b.{0,80}(?:not adequate|inadequate|not acceptable|missing|lack|deficien)',
     'Specification Inadequacy', True, True),
    (r'(?:dissolution|drug release|release rate).{0,60}(?:not adequate|inadequate|fail|specification|criteria)',
     'Dissolution/Drug Release', True, True),
    (r'(?:stability|shelf.?life|expir|degradation product).{0,60}(?:not adequate|inadequate|insufficient|data|support|protocol)',
     'Stability Data Deficiency', True, True),
    (r'(?:impurit|degradant|related substance).{0,60}(?:not adequate|inadequate|characteriz|identif|qualif|specify|limit|report)',
     'Impurity/Degradant Control', True, True),
    (r'(?:manufactur|process|batch|lot).{0,60}(?:validat|control strategy|scale.?up|consistency|not adequate|inadequate)',
     'Manufacturing Process/Validation', True, False),
    (r'(?:container.?closure|packaging|seal integrity).{0,60}(?:not adequate|inadequate|data|support|system)',
     'Container Closure System', True, True),
    (r'(?:steril(?:ity|ization)|aseptic|endotoxin|bioburden|microbial limit).{0,60}(?:not adequate|inadequate|assurance|valid|data|concern)',
     'Sterility/Microbial Control', True, False),
    (r'(?:analytic(?:al)?|method|assay).{0,60}(?:validat|not adequate|inadequate|suitable|acceptable|transfer)',
     'Analytical Method Validation', True, True),
    (r'(?:excipient|inactive ingredient).{0,60}(?:not adequate|inadequate|control|characteriz|source|grade|specification)',
     'Excipient Control', True, True),
    (r'(?:drug substance|active.*ingredient|API).{0,60}(?:not adequate|inadequate|control|characteriz|specification)',
     'Drug Substance Control', True, True),
    (r'(?:drug master file|DMF).{0,60}(?:not adequate|inadequate|deficien|found|outstanding)',
     'Drug Master File Deficiency', True, True),
    (r'(?:GMP|cGMP|Form 483|inspection).{0,80}(?:deficien|observation|finding|not adequate|violat|outstanding|unresolved|satisf)',
     'GMP/Facility Compliance', True, False),
    (r'(?:in.?vitro|permeation|flux|IVRT).{0,60}(?:not adequate|inadequate|data|test|correlation)',
     'In Vitro Performance', True, True),
    (r'(?:polymorphi|crystal(?:line)?|particle size distribution).{0,60}(?:control|characteriz|not adequate|specify)',
     'Polymorphism/Particle Size', True, True),
    (r'(?:extractable|leachable|elemental impurit|nitrosamine|N-nitroso|genotoxic impurit)',
     'Extractables/Leachables/Nitrosamines', True, True),
    (r'(?:potency|content uniformity|assay result|label claim|dose uniformity)',
     'Potency/Content Uniformity', True, True),
    (r'(?:bioequivalence|BE study|comparative bioavailab).{0,60}(?:not adequate|inadequate|fail|establish|demonstrate)',
     'Bioequivalence Failure', True, True),
    (r'(?:residual solvent|organic volatile|ICH Q3C)',
     'Residual Solvents', True, True),
    (r'(?:endotoxin|pyrogen|LAL|bacterial endotoxin)',
     'Endotoxin/Pyrogen', True, True),
    (r'(?:cold flow|shear|adhesion|peel force|patch adherence|adhesive)',
     'Adhesion/Physical Properties', True, True),
    (r'(?:particulate|visible particle|sub-?visible)',
     'Particulate Matter', True, True),
    (r'(?:reference standard|reference material).{0,60}(?:not adequate|characteriz|qualify)',
     'Reference Standard', True, True),
    (r'(?:environmental monitor|clean ?room|ISO class)',
     'Environmental Controls', True, False),
    (r'(?:batch analysis|certificate of analysis|CoA).{0,60}(?:not adequate|inadequate|missing|provide)',
     'Batch Analysis/CoA', True, True),
    (r'(?:comparability|bridging).{0,60}(?:not adequate|inadequate|demonstrate|establish|data)',
     'Comparability/Bridging', True, True),
    (r'(?:drug product|finished product).{0,60}(?:specification|not adequate|inadequate|control|test)',
     'Drug Product Specification', True, True),
    (r'(?:combination product|device constituent|applicator|injector|auto.?inject|pen|inhaler|delivery system).{0,40}(?:not adequate|inadequate|deficien|concern|issue|design)',
     'Combination Product/Device', True, False),
]

CLINICAL_PATTERNS = [
    (r'(?:efficacy|effective|primary\s+endpoint).{0,80}(?:not\s+(?:adequate|demonstrat)|inadequate|fail|insufficient)',
     'Efficacy Not Demonstrated', False, False),
    (r'(?:safety|adverse event|toxicity).{0,60}(?:concern|signal|not adequate|inadequate|characteriz|unacceptable)',
     'Safety Concern', False, False),
    (r'(?:clinical trial|study design|study conduct).{0,60}(?:deficien|not adequate|inadequate|issue|problem|concern)',
     'Trial Design/Conduct', False, False),
    (r'(?:statistical|analysis plan|primary analysis|endpoint).{0,60}(?:not adequate|inadequate|issue|concern|flaw|inappropriate)',
     'Statistical Analysis', False, True),
    (r'(?:dose.?response|dose.?finding|dose selection|dosing regimen|dosage).{0,60}(?:not adequate|inadequate|justif|support|optimal|concern)',
     'Dosing/Dose Selection', False, False),
    (r'(?:REMS|risk evaluation and mitigation)',
     'REMS Requirement', False, True),
    (r'(?:pediatric|PREA|pediatric assessment)',
     'Pediatric Requirement', False, True),
    (r'(?:suicid|suicidality).{0,60}(?:signal|concern|risk|assess|monitor)',
     'Psychiatric Safety Signal', False, False),
    (r'(?:cardiovascular|MACE|myocardial|stroke|thrombo).{0,60}(?:risk|concern|safety|event|signal)',
     'Cardiovascular Safety', False, False),
    (r'(?:hepatotoxic|liver injury|ALT|AST|bilirubin|Hy.?s Law|DILI).{0,40}(?:concern|signal|elevat|risk)',
     'Hepatotoxicity Signal', False, False),
    (r'(?:immunogenic|anti.?drug antibod|ADA|neutralizing antibod).{0,40}(?:concern|assess|data|characteriz)',
     'Immunogenicity', False, True),
    (r'(?:abuse potential|addiction|dependence|DEA scheduling)',
     'Abuse Potential', False, True),
    (r'(?:QT\s|QTc|torsade|proarrhythm|cardiac repolariz|thorough QT)',
     'QT/Cardiac Electrophysiology', False, True),
    (r'(?:carcinogenic|2.?year study|long.?term toxicity|chronic toxicity)',
     'Carcinogenicity Study', False, False),
    (r'(?:genotoxic|mutagenic|Ames test|clastogen|chromosom)',
     'Genotoxicity', False, True),
    (r'(?:reproductive toxicol|teratogen|embryo.?fetal|fertility study|developmental)',
     'Reproductive Toxicology', False, True),
    (r'(?:pharmacokinetic|PK data|AUC|Cmax|clearance|half.?life|bioavailab)',
     'Pharmacokinetics', False, True),
    (r'(?:drug.?drug interaction|DDI|CYP\d|P-glycoprotein)',
     'Drug-Drug Interaction', False, True),
    (r'(?:renal impair|hepatic impair|geriatric|organ impairment|special population)',
     'Special Populations', False, True),
    (r'(?:patient.?reported outcome|PRO|quality of life|QoL)',
     'Patient-Reported Outcomes', False, True),
    (r'(?:human factor|use error|usability|instructions for use|IFU)',
     'Human Factors/Usability', False, False),
    (r'(?:subgroup|subpopulation|racial|ethnic).{0,40}(?:analysis|difference|efficacy|outcome)',
     'Subgroup Analysis', False, True),
    (r'(?:missing data|lost to follow|incomplete follow|dropout rate)',
     'Missing Data/Follow-up', False, False),
    (r'(?:blood pressure|hypertension|ABPM)',
     'Blood Pressure/Hypertension', False, False),
    (r'(?:renal|kidney|nephrotoxic|creatinine|GFR).{0,40}(?:concern|safety|toxicity|impair|signal)',
     'Renal Safety', False, False),
    (r'(?:infection|sepsis|opportunistic).{0,40}(?:risk|concern|safety|signal)',
     'Infection Risk', False, False),
    (r'(?:malignancy|cancer|tumor|neoplasm|lymphoma).{0,40}(?:risk|concern|safety|signal)',
     'Malignancy Risk', False, False),
    (r'(?:nonclinical|animal|preclinical).{0,60}(?:not adequate|inadequate|deficien|additional|concern)',
     'Nonclinical Deficiency', False, False),
]

LABELING_PATTERNS = [
    (r'(?:prescribing information|package insert|SPL|label).{0,60}(?:not adequate|inadequate|deficien|revis|update|comment)',
     'Prescribing Information', None, True),
    (r'(?:proprietary name|trade name|brand name).{0,60}(?:not acceptable|confusion|concern|similar|reject)',
     'Proprietary Name Rejection', None, True),
    (r'(?:carton|container label|primary label|immediate container|blister)',
     'Container/Carton Labeling', None, True),
    (r'(?:Medication Guide|patient information|patient labeling)',
     'Medication Guide', None, True),
    (r'(?:postmarket|Phase 4|PMR|PMC|post.?approval|commitment)',
     'Postmarket Commitment', None, True),
]


def extract_sections(text):
    """Split CRL text into labeled sections based on ALL-CAPS headers."""
    ALL_HEADERS = sorted([
        'CLINICAL/STATISTICAL', 'CLINICAL PHARMACOLOGY', 'CLINICAL',
        'PRODUCT QUALITY', 'CHEMISTRY, MANUFACTURING AND CONTROLS',
        'NONCLINICAL', 'FACILITY INSPECTIONS', 'MICROBIOLOGY',
        'HUMAN FACTORS', 'DEVICE', 'LABELING', 'PRESCRIBING INFORMATION',
        'CARTON AND CONTAINER LABELING', 'PROPRIETARY NAME',
        'MEDICATION GUIDE', 'RISK EVALUATION AND MITIGATION STRATEGY',
        'SAFETY UPDATE', 'ADDITIONAL COMMENTS', 'ADDITIONAL COMMENT', 'OTHER',
        'REGULATORY', 'BIOPHARMACEUTICS', 'REQUIRED PEDIATRIC',
        'RISK EVALUATION AND MITIGATION STRATEGY REQUIREMENTS',
    ], key=len, reverse=True)

    sections = {}
    pattern = '|'.join(re.escape(h) for h in ALL_HEADERS)
    splits = re.split(r'\n(' + pattern + r'[A-Z ]*)\n', text)

    current_section = 'PREAMBLE'
    current_text = ''
    for part in splits:
        is_header = False
        for h in ALL_HEADERS:
            if part.strip().startswith(h):
                is_header = True
                if current_text.strip():
                    sections[current_section] = current_text
                current_section = part.strip()
                current_text = ''
                break
        if not is_header:
            current_text += part
    if current_text.strip():
        sections[current_section] = current_text
    return sections


def classify_section_type(sec_name):
    """Returns 'cmc', 'clinical', 'labeling', 'cmc_adjacent', 'clinical_adjacent', or 'non_deficiency'."""
    name = sec_name.upper().strip()
    for s in CMC_SECTIONS:
        if name.startswith(s):
            return 'cmc'
    for s in CMC_ADJACENT_SECTIONS:
        if name.startswith(s):
            return 'cmc_adjacent'
    for s in CLINICAL_SECTIONS:
        if name.startswith(s):
            return 'clinical'
    for s in CLINICAL_ADJACENT_SECTIONS:
        if name.startswith(s):
            return 'clinical_adjacent'
    for s in LABELING_SECTIONS:
        if name.startswith(s):
            return 'labeling'
    for s in NON_DEFICIENCY_SECTIONS:
        if name.startswith(s):
            return 'non_deficiency'
    return 'unknown'


def has_deficiency_content(text):
    """Check if section text contains actual deficiency content (not just boilerplate)."""
    # Look for numbered items, "you must", "you need", "not adequate", "deficien", etc.
    indicators = [
        r'\d+\.\s+[A-Z]',  # numbered items
        r'(?:you must|you need|you should|we recommend|is required|are required)',
        r'(?:not adequate|inadequate|deficien|unresolved|outstanding)',
        r'(?:cannot approve|cannot be approved)',
        r'(?:provide|submit|conduct|address|resolve)',
    ]
    text_lower = text.lower()
    score = sum(1 for p in indicators if re.search(p, text_lower))
    return score >= 2 or len(text) > 500


def section_has_facility_deficiency(text):
    """Check if FACILITY INSPECTIONS section describes actual blocking deficiency vs. routine."""
    text_lower = text.lower()
    blocking_indicators = [
        r'(?:form 483|483 observation)',
        r'(?:deficien|violat|deviation|finding)',
        r'(?:not adequate|inadequate|unresolved|outstanding)',
        r'(?:satisfactor|unsatisfactor)',
        r'(?:warning letter)',
        r'(?:re.?inspect|follow.?up inspection)',
        r'(?:CGMP|cGMP).{0,40}(?:deficien|violat|not)',
    ]
    # Routine / non-blocking
    routine_indicators = [
        r'pre.?approval inspection.*(?:will be|may be|is) (?:needed|required|scheduled|necessary)',
        r'inspection.*(?:has not yet|not yet been) (?:completed|conducted|performed)',
        r'(?:we will schedule|inspection requests)',
    ]
    blocking = sum(1 for p in blocking_indicators if re.search(p, text_lower))
    routine = sum(1 for p in routine_indicators if re.search(p, text_lower))
    if blocking >= 2:
        return 'blocking'
    elif routine >= 1 and blocking == 0:
        return 'pending'
    elif blocking >= 1:
        return 'blocking'
    return 'pending'


def match_patterns(text, patterns):
    """Match text against a list of deficiency patterns."""
    matched = []
    text_lower = text.lower()
    seen = set()
    for pattern, dtype, is_cmc_flag, cross_ref in patterns:
        if dtype not in seen and re.search(pattern, text_lower):
            matched.append({
                'type': dtype,
                'is_cmc': is_cmc_flag,
                'cross_ref_catchable': cross_ref,
            })
            seen.add(dtype)
    return matched


# ── Main Analysis ─────────────────────────────────────────────────────
with open(INPUT) as f:
    data = json.load(f)

records = data['results']
print(f"Analyzing {len(records)} CRLs...")

# Tracking structures
crl_summaries = []
deficiency_type_counts = Counter()
cmc_sub_categories = Counter()
clinical_sub_categories = Counter()
labeling_sub_categories = Counter()
nonclinical_sub_categories = Counter()
module_counts = Counter()
year_distribution = Counter()
section_type_counts = Counter()  # how many CRLs have each section type as deficiency

total_def_instances = 0
total_cmc_instances = 0
total_clinical_instances = 0
total_labeling_instances = 0
total_cross_ref = 0

crls_with_cmc = 0
crls_with_clinical = 0
crls_with_labeling = 0
crls_with_nonclinical = 0
crls_with_facility = 0
crls_with_facility_blocking = 0

# Track cross-reference detail
xref_by_type = Counter()

for idx, rec in enumerate(records):
    text = rec.get('text', '')
    company = rec.get('company_name', 'Unknown')
    app_nums = rec.get('application_number', [])
    letter_date = rec.get('letter_date', '')
    letter_year = rec.get('letter_year', '')

    sections = extract_sections(text)

    crl_has_cmc = False
    crl_has_clinical = False
    crl_has_labeling = False
    crl_has_nonclinical = False
    crl_has_facility = False
    crl_facility_blocking = False
    crl_deficiencies = []

    for sec_name, sec_text in sections.items():
        sec_type = classify_section_type(sec_name)

        if sec_type == 'non_deficiency':
            continue

        if sec_type == 'cmc':
            if has_deficiency_content(sec_text):
                crl_has_cmc = True
                matched = match_patterns(sec_text, CMC_PATTERNS)
                if not matched:
                    matched = [{'type': 'CMC General', 'is_cmc': True, 'cross_ref_catchable': False}]
                for m in matched:
                    m['ectd_module'] = '3'
                    m['section'] = sec_name
                    cmc_sub_categories[m['type']] += 1
                    deficiency_type_counts[m['type']] += 1
                    module_counts['3'] += 1
                    total_def_instances += 1
                    total_cmc_instances += 1
                    if m['cross_ref_catchable']:
                        total_cross_ref += 1
                        xref_by_type[m['type']] += 1
                    crl_deficiencies.append(m)

        elif sec_type == 'cmc_adjacent':
            # Facility inspections
            crl_has_facility = True
            status = section_has_facility_deficiency(sec_text)
            if status == 'blocking':
                crl_has_cmc = True
                crl_facility_blocking = True
                m = {'type': 'GMP/Facility Compliance', 'is_cmc': True, 'cross_ref_catchable': False,
                     'ectd_module': '3', 'section': sec_name, 'facility_status': 'blocking'}
                cmc_sub_categories['GMP/Facility Compliance'] += 1
                deficiency_type_counts['GMP/Facility Compliance'] += 1
                module_counts['3'] += 1
                total_def_instances += 1
                total_cmc_instances += 1
                crl_deficiencies.append(m)
            else:
                # Pending inspection — still CMC-related but not a "deficiency" per se
                m = {'type': 'Pending Facility Inspection', 'is_cmc': True, 'cross_ref_catchable': False,
                     'ectd_module': '3', 'section': sec_name, 'facility_status': 'pending'}
                crl_has_cmc = True  # Still CMC-related
                cmc_sub_categories['Pending Facility Inspection'] += 1
                deficiency_type_counts['Pending Facility Inspection'] += 1
                module_counts['3'] += 1
                total_def_instances += 1
                total_cmc_instances += 1
                crl_deficiencies.append(m)

        elif sec_type == 'clinical':
            if has_deficiency_content(sec_text):
                crl_has_clinical = True
                matched = match_patterns(sec_text, CLINICAL_PATTERNS)
                if not matched:
                    matched = [{'type': 'Clinical General', 'is_cmc': False, 'cross_ref_catchable': False}]
                for m in matched:
                    m['ectd_module'] = '5'
                    m['section'] = sec_name
                    clinical_sub_categories[m['type']] += 1
                    deficiency_type_counts[m['type']] += 1
                    module_counts['5'] += 1
                    total_def_instances += 1
                    total_clinical_instances += 1
                    if m['cross_ref_catchable']:
                        total_cross_ref += 1
                        xref_by_type[m['type']] += 1
                    crl_deficiencies.append(m)

        elif sec_type == 'clinical_adjacent':
            if has_deficiency_content(sec_text):
                if 'NONCLINICAL' in sec_name.upper():
                    crl_has_nonclinical = True
                    matched = match_patterns(sec_text, CLINICAL_PATTERNS)
                    if not matched:
                        matched = [{'type': 'Nonclinical General', 'is_cmc': False, 'cross_ref_catchable': False}]
                    for m in matched:
                        m['ectd_module'] = '4'
                        m['section'] = sec_name
                        nonclinical_sub_categories[m['type']] += 1
                        deficiency_type_counts[m['type']] += 1
                        module_counts['4'] += 1
                        total_def_instances += 1
                        total_clinical_instances += 1
                        if m['cross_ref_catchable']:
                            total_cross_ref += 1
                            xref_by_type[m['type']] += 1
                        crl_deficiencies.append(m)
                else:
                    crl_has_clinical = True
                    mod = '2.7' if 'PHARMACOL' in sec_name.upper() or 'BIOPHARM' in sec_name.upper() else '5'
                    matched = match_patterns(sec_text, CLINICAL_PATTERNS)
                    if not matched:
                        matched = [{'type': f'Clinical Pharmacology General', 'is_cmc': False, 'cross_ref_catchable': True}]
                    for m in matched:
                        m['ectd_module'] = mod
                        m['section'] = sec_name
                        clinical_sub_categories[m['type']] += 1
                        deficiency_type_counts[m['type']] += 1
                        module_counts[mod] += 1
                        total_def_instances += 1
                        total_clinical_instances += 1
                        if m['cross_ref_catchable']:
                            total_cross_ref += 1
                            xref_by_type[m['type']] += 1
                        crl_deficiencies.append(m)

        elif sec_type == 'labeling':
            if has_deficiency_content(sec_text):
                crl_has_labeling = True
                matched = match_patterns(sec_text, LABELING_PATTERNS)
                if not matched:
                    label_type = sec_name.replace('CARTON AND ', '').title()
                    matched = [{'type': f'Labeling ({label_type})', 'is_cmc': False, 'cross_ref_catchable': True}]
                for m in matched:
                    m['ectd_module'] = '1'
                    m['section'] = sec_name
                    labeling_sub_categories[m['type']] += 1
                    deficiency_type_counts[m['type']] += 1
                    module_counts['1'] += 1
                    total_def_instances += 1
                    total_labeling_instances += 1
                    if m['cross_ref_catchable']:
                        total_cross_ref += 1
                        xref_by_type[m['type']] += 1
                    crl_deficiencies.append(m)

    year_distribution[letter_year] += 1
    if crl_has_cmc:
        crls_with_cmc += 1
    if crl_has_clinical:
        crls_with_clinical += 1
    if crl_has_labeling:
        crls_with_labeling += 1
    if crl_has_nonclinical:
        crls_with_nonclinical += 1
    if crl_has_facility:
        crls_with_facility += 1
    if crl_facility_blocking:
        crls_with_facility_blocking += 1

    crl_summaries.append({
        'application_number': app_nums[0] if app_nums else 'Unknown',
        'company': company,
        'letter_date': letter_date,
        'letter_year': letter_year,
        'has_cmc_deficiency': crl_has_cmc,
        'has_clinical_deficiency': crl_has_clinical,
        'has_labeling_deficiency': crl_has_labeling,
        'has_nonclinical_deficiency': crl_has_nonclinical,
        'has_facility_issue': crl_has_facility,
        'facility_blocking': crl_facility_blocking,
        'deficiency_count': len(crl_deficiencies),
        'deficiencies': crl_deficiencies
    })

# ── Derived stats ────────────────────────────────────────────────────
total_crls = len(records)
crls_both = sum(1 for s in crl_summaries if s['has_cmc_deficiency'] and s['has_clinical_deficiency'])
crls_cmc_only = sum(1 for s in crl_summaries if s['has_cmc_deficiency'] and not s['has_clinical_deficiency'])
crls_clinical_only = sum(1 for s in crl_summaries if s['has_clinical_deficiency'] and not s['has_cmc_deficiency'])

print(f"\n{'='*60}")
print(f"RESULTS — {total_crls} CRLs analyzed")
print(f"{'='*60}")
print(f"Total deficiency instances: {total_def_instances}")
print(f"")
print(f"CRLs citing CMC deficiencies:     {crls_with_cmc:4d} ({crls_with_cmc/total_crls*100:.1f}%)")
print(f"CRLs citing Clinical deficiencies: {crls_with_clinical:4d} ({crls_with_clinical/total_crls*100:.1f}%)")
print(f"CRLs citing Labeling deficiencies: {crls_with_labeling:4d} ({crls_with_labeling/total_crls*100:.1f}%)")
print(f"CRLs citing Nonclinical defic.:    {crls_with_nonclinical:4d} ({crls_with_nonclinical/total_crls*100:.1f}%)")
print(f"CRLs with Facility issues:         {crls_with_facility:4d} ({crls_with_facility/total_crls*100:.1f}%)")
print(f"  - Blocking GMP findings:         {crls_with_facility_blocking:4d}")
print(f"")
print(f"CRLs with CMC + Clinical:          {crls_both:4d}")
print(f"CRLs CMC-only:                     {crls_cmc_only:4d}")
print(f"CRLs Clinical-only:                {crls_clinical_only:4d}")
print(f"")
print(f"CMC deficiency instances:          {total_cmc_instances:4d} ({total_cmc_instances/total_def_instances*100:.1f}%)")
print(f"Clinical deficiency instances:     {total_clinical_instances:4d} ({total_clinical_instances/total_def_instances*100:.1f}%)")
print(f"Labeling instances:                {total_labeling_instances:4d} ({total_labeling_instances/total_def_instances*100:.1f}%)")
print(f"")
print(f"Cross-ref catchable instances:     {total_cross_ref:4d} ({total_cross_ref/total_def_instances*100:.1f}%)")

print(f"\nTop 25 deficiency types:")
for dtype, cnt in deficiency_type_counts.most_common(25):
    print(f"  {cnt:4d}  {dtype}")

print(f"\neCTD Module distribution:")
for mod, cnt in sorted(module_counts.items(), key=lambda x: -x[1]):
    name = ECTD_MODULES.get(mod, f'Module {mod}')
    print(f"  {cnt:4d} ({cnt/total_def_instances*100:.1f}%)  {name}")

# ── Build taxonomy JSON ──────────────────────────────────────────────
taxonomy = {
    "meta": {
        "total_crls_analyzed": total_crls,
        "total_deficiency_instances": total_def_instances,
        "analysis_date": "2026-03-22",
        "data_source": "openFDA CRL database — 419 FDA Complete Response Letters with full text",
        "methodology": "Section-based extraction with NLP pattern matching against 50+ deficiency archetypes"
    },
    "summary_statistics": {
        "crls_citing_cmc": {"count": crls_with_cmc, "pct": round(crls_with_cmc / total_crls * 100, 1)},
        "crls_citing_clinical": {"count": crls_with_clinical, "pct": round(crls_with_clinical / total_crls * 100, 1)},
        "crls_citing_labeling": {"count": crls_with_labeling, "pct": round(crls_with_labeling / total_crls * 100, 1)},
        "crls_citing_nonclinical": {"count": crls_with_nonclinical, "pct": round(crls_with_nonclinical / total_crls * 100, 1)},
        "crls_with_facility_issues": {"count": crls_with_facility, "pct": round(crls_with_facility / total_crls * 100, 1)},
        "crls_facility_blocking_gmp": crls_with_facility_blocking,
        "crls_cmc_and_clinical": crls_both,
        "crls_cmc_only": crls_cmc_only,
        "crls_clinical_only": crls_clinical_only,
        "deficiency_instances": {
            "cmc": {"count": total_cmc_instances, "pct": round(total_cmc_instances / total_def_instances * 100, 1)},
            "clinical": {"count": total_clinical_instances, "pct": round(total_clinical_instances / total_def_instances * 100, 1)},
            "labeling": {"count": total_labeling_instances, "pct": round(total_labeling_instances / total_def_instances * 100, 1)},
        },
        "cross_reference_catchable": {
            "count": total_cross_ref,
            "pct": round(total_cross_ref / total_def_instances * 100, 1),
            "by_type": dict(xref_by_type.most_common())
        }
    },
    "ectd_module_distribution": {
        mod: {
            "module_name": ECTD_MODULES.get(mod, f"Module {mod}"),
            "deficiency_count": cnt,
            "pct_of_total": round(cnt / total_def_instances * 100, 1)
        }
        for mod, cnt in sorted(module_counts.items(), key=lambda x: -x[1])
    },
    "deficiency_taxonomy": {
        "cmc": {
            "total_instances": total_cmc_instances,
            "ectd_module": "Module 3 — Quality (CMC)",
            "categories": [
                {
                    "type": dtype,
                    "count": cnt,
                    "pct_of_cmc": round(cnt / total_cmc_instances * 100, 1),
                    "cross_ref_catchable": any(p[3] for p in CMC_PATTERNS if p[1] == dtype),
                    "ectd_subsection": "3.2.P" if "Drug Product" in dtype or "Dissolution" in dtype or "Stability" in dtype or "Content" in dtype
                        else "3.2.S" if "Drug Substance" in dtype
                        else "3.2.A" if "Facility" in dtype or "GMP" in dtype
                        else "3.2.P/3.2.S"
                }
                for dtype, cnt in cmc_sub_categories.most_common()
            ]
        },
        "clinical": {
            "total_instances": total_clinical_instances,
            "ectd_modules": "Module 4 (Nonclinical) + Module 5 (Clinical)",
            "categories": [
                {
                    "type": dtype,
                    "count": cnt,
                    "pct_of_clinical": round(cnt / total_clinical_instances * 100, 1),
                    "cross_ref_catchable": any(p[3] for p in CLINICAL_PATTERNS if p[1] == dtype),
                }
                for dtype, cnt in clinical_sub_categories.most_common()
            ]
        },
        "labeling_administrative": {
            "total_instances": total_labeling_instances,
            "ectd_module": "Module 1 — Administrative",
            "categories": [
                {
                    "type": dtype,
                    "count": cnt,
                    "pct_of_labeling": round(cnt / total_labeling_instances * 100, 1) if total_labeling_instances > 0 else 0,
                    "cross_ref_catchable": True,
                }
                for dtype, cnt in labeling_sub_categories.most_common()
            ]
        }
    },
    "year_distribution": dict(sorted(year_distribution.items())),
    "per_crl_details": crl_summaries
}

with open(OUTDIR / "crl-deficiency-taxonomy.json", 'w') as f:
    json.dump(taxonomy, f, indent=2, default=str)
print(f"\nWrote: {OUTDIR / 'crl-deficiency-taxonomy.json'}")
