#!/usr/bin/env python3
"""
CRL Deficiency Analyzer v3 — Final analysis with section-based + full-text
CMC detection, producing taxonomy JSON, patterns MD, and skill MD.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

INPUT = Path("/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/stage-1/crl-database/crl-data.json")
OUTDIR = Path("/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/output/crl-analyst")
OUTDIR.mkdir(parents=True, exist_ok=True)

ECTD_MODULES = {
    "1": "Module 1 — Administrative / Regional",
    "2.3": "Module 2.3 — Quality Overall Summary",
    "2.7": "Module 2.7 — Clinical Summary",
    "3": "Module 3 — Quality (CMC)",
    "4": "Module 4 — Nonclinical Study Reports",
    "5": "Module 5 — Clinical Study Reports",
}

# ── Section classification ────────────────────────────────────────────
CMC_SECTIONS = {'PRODUCT QUALITY', 'CHEMISTRY, MANUFACTURING AND CONTROLS',
                'CHEMISTRY', 'CMC', 'MICROBIOLOGY', 'DEVICE'}
CMC_ADJACENT = {'FACILITY INSPECTIONS'}
CLINICAL_SECTIONS = {'CLINICAL', 'CLINICAL/STATISTICAL'}
CLINICAL_ADJACENT = {'CLINICAL PHARMACOLOGY', 'NONCLINICAL', 'BIOPHARMACEUTICS', 'HUMAN FACTORS'}
LABELING_SECTIONS = {'LABELING', 'PRESCRIBING INFORMATION', 'CARTON AND CONTAINER LABELING',
                     'PROPRIETARY NAME', 'MEDICATION GUIDE',
                     'RISK EVALUATION AND MITIGATION STRATEGY REQUIREMENTS',
                     'RISK EVALUATION AND MITIGATION STRATEGY'}
SKIP_SECTIONS = {'OTHER', 'SAFETY UPDATE', 'ADDITIONAL COMMENTS', 'ADDITIONAL COMMENT',
                 'PREAMBLE', 'REQUIRED PEDIATRIC ASSESSMENTS'}

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

# ── Deficiency patterns ──────────────────────────────────────────────
CMC_PATTERNS = [
    (r'specif(?:ication|y|ied)\b.{0,80}(?:not adequate|inadequate|not acceptable|missing|deficien|revise|update)',
     'Specification Inadequacy', True),
    (r'(?:dissolution|drug release|release rate).{0,60}(?:not adequate|inadequate|fail|specification|criteria)',
     'Dissolution/Drug Release', True),
    (r'(?:stability|shelf.?life|degradation product).{0,60}(?:not adequate|inadequate|insufficient|data|support|protocol|provide|conduct)',
     'Stability Data Deficiency', True),
    (r'(?:impurit|degradant|related substance).{0,60}(?:not adequate|inadequate|characteriz|identif|qualif|specify|limit|report|revise)',
     'Impurity/Degradant Control', True),
    (r'(?:manufactur|process|batch|lot).{0,60}(?:validat|control strategy|scale.?up|consistency|not adequate|inadequate)',
     'Manufacturing Process/Validation', False),
    (r'(?:container.?closure|packaging|seal integrity).{0,60}(?:not adequate|inadequate|data|support)',
     'Container Closure System', True),
    (r'(?:steril(?:ity|ization)|aseptic|bioburden|microbial limit).{0,60}(?:not adequate|inadequate|assurance|valid|data|concern)',
     'Sterility/Microbial Control', False),
    (r'(?:analytic(?:al)?|method|assay).{0,60}(?:validat|not adequate|inadequate|suitable|acceptable|transfer)',
     'Analytical Method Validation', True),
    (r'(?:excipient|inactive ingredient).{0,60}(?:not adequate|inadequate|control|characteriz|source|specification)',
     'Excipient Control', True),
    (r'(?:drug substance|active.*ingredient|API).{0,60}(?:not adequate|inadequate|control|characteriz|specification)',
     'Drug Substance Control', True),
    (r'(?:drug master file|DMF).{0,60}(?:not adequate|inadequate|deficien|found|outstanding)',
     'Drug Master File Deficiency', True),
    (r'(?:GMP|cGMP|Form 483|inspection).{0,80}(?:deficien|observation|finding|not adequate|violat|outstanding|unresolved)',
     'GMP/Facility Compliance', False),
    (r'(?:in.?vitro|permeation|IVRT).{0,60}(?:not adequate|inadequate|data|test|correlation)',
     'In Vitro Performance', True),
    (r'(?:polymorphi|crystal(?:line)?|particle size).{0,60}(?:control|characteriz|not adequate|specify)',
     'Polymorphism/Particle Size', True),
    (r'(?:extractable|leachable|elemental impurit|nitrosamine|N-nitroso|genotoxic impurit)',
     'Extractables/Leachables/Nitrosamines', True),
    (r'(?:potency|content uniformity|dose uniformity|assay result|label claim)',
     'Potency/Content Uniformity', True),
    (r'(?:bioequivalence|BE study|comparative bioavailab).{0,60}(?:not adequate|inadequate|fail|establish|demonstrate)',
     'Bioequivalence Failure', True),
    (r'(?:residual solvent|organic volatile|ICH Q3C)',
     'Residual Solvents', True),
    (r'(?:endotoxin|pyrogen|LAL|bacterial endotoxin)',
     'Endotoxin/Pyrogen Testing', True),
    (r'(?:cold flow|shear adhesion|peel force|patch adherence|adhesive).{0,40}(?:not adequate|inadequate|test|data|concern)',
     'Adhesion Properties', True),
    (r'(?:particulate|visible particle|sub.?visible)',
     'Particulate Matter', True),
    (r'(?:reference standard|reference material).{0,60}(?:not adequate|characteriz|qualify)',
     'Reference Standard', True),
    (r'(?:batch analysis|certificate of analysis).{0,60}(?:not adequate|inadequate|missing|provide)',
     'Batch Analysis/CoA', True),
    (r'(?:comparability|bridging).{0,60}(?:not adequate|inadequate|demonstrate|establish|data)',
     'Comparability/Bridging', True),
    (r'(?:drug product|finished product).{0,60}(?:specification|not adequate|inadequate|control|test)',
     'Drug Product Specification', True),
    (r'(?:combination product|device constituent|applicator|injector|auto.?inject|pen|inhaler|delivery system).{0,40}(?:not adequate|inadequate|deficien|concern|design)',
     'Combination Product/Device', False),
    (r'pre.?approval inspection.{0,60}(?:will be|may be|needed|required|scheduled|necessary|has not)',
     'Pending Pre-Approval Inspection', False),
    (r'(?:environmental monitor|clean ?room|ISO class)',
     'Environmental Controls', False),
    (r'(?:water system|purified water|WFI).{0,40}(?:not adequate|qualify|valid)',
     'Water System Qualification', False),
    (r'(?:cleaning valid|equipment clean|residue)',
     'Cleaning Validation', False),
]

CLINICAL_PATTERNS = [
    (r'(?:efficacy|effective|primary\s+endpoint).{0,80}(?:not\s+(?:adequate|demonstrat)|inadequate|fail|insufficient)',
     'Efficacy Not Demonstrated', False),
    (r'(?:safety|adverse event|toxicity).{0,60}(?:concern|signal|not adequate|inadequate|characteriz|unacceptable)',
     'Safety Concern', False),
    (r'(?:clinical trial|study design|study conduct).{0,60}(?:deficien|not adequate|inadequate|issue|problem)',
     'Trial Design/Conduct', False),
    (r'(?:statistical|analysis plan|primary analysis).{0,60}(?:not adequate|inadequate|issue|concern|flaw)',
     'Statistical Analysis', True),
    (r'(?:dose.?response|dose.?finding|dose selection|dosing regimen).{0,60}(?:not adequate|inadequate|justif|support|optimal)',
     'Dosing/Dose Selection', False),
    (r'(?:REMS|risk evaluation and mitigation)',
     'REMS Requirement', True),
    (r'(?:suicid|suicidality).{0,60}(?:signal|concern|risk|assess)',
     'Psychiatric Safety Signal', False),
    (r'(?:cardiovascular|MACE|myocardial|stroke|thrombo).{0,60}(?:risk|concern|safety|event)',
     'Cardiovascular Risk', False),
    (r'(?:hepatotoxic|liver injury|DILI|Hy.?s Law).{0,40}(?:concern|signal|risk)',
     'Hepatotoxicity Signal', False),
    (r'(?:immunogenic|anti.?drug antibod|ADA|neutralizing antibod)',
     'Immunogenicity', True),
    (r'(?:abuse potential|addiction|dependence|DEA schedul)',
     'Abuse Potential', True),
    (r'(?:QT\b|QTc|torsade|proarrhythm|thorough QT)',
     'QT/Cardiac Safety', True),
    (r'(?:carcinogenic|2.?year study|long.?term toxicity)',
     'Carcinogenicity Study', False),
    (r'(?:genotoxic|mutagenic|Ames test|clastogen)',
     'Genotoxicity', True),
    (r'(?:reproductive toxicol|teratogen|embryo.?fetal|fertility study)',
     'Reproductive Toxicology', True),
    (r'(?:pharmacokinetic|PK data|AUC|Cmax|clearance|bioavailab)',
     'Pharmacokinetics', True),
    (r'(?:drug.?drug interaction|DDI|CYP\d)',
     'Drug-Drug Interaction', True),
    (r'(?:renal impair|hepatic impair|geriatric|special population)',
     'Special Populations', True),
    (r'(?:human factor|use error|usability|instructions for use)',
     'Human Factors/Usability', False),
    (r'(?:subgroup|subpopulation).{0,40}(?:analysis|difference)',
     'Subgroup Analysis', True),
    (r'(?:missing data|lost to follow|dropout)',
     'Missing Data/Follow-up', False),
    (r'(?:blood pressure|hypertension|ABPM)',
     'Blood Pressure Concern', False),
    (r'(?:infection|sepsis|opportunistic).{0,40}(?:risk|concern|safety)',
     'Infection Risk', False),
    (r'(?:malignancy|cancer|neoplasm|lymphoma).{0,40}(?:risk|concern)',
     'Malignancy Risk', False),
    (r'(?:nonclinical|animal|preclinical).{0,60}(?:not adequate|inadequate|deficien|additional)',
     'Nonclinical Study Deficiency', False),
    (r'(?:pediatric|PREA|pediatric assessment)',
     'Pediatric Requirement', True),
    (r'(?:clinical pharmacol|biopharmaceutic|food effect)',
     'Clinical Pharmacology', True),
    (r'(?:patient.?reported outcome|PRO|quality of life)',
     'Patient-Reported Outcomes', True),
    (r'(?:pregnancy|lactation|nursing|contraind.*pregnan)',
     'Pregnancy/Lactation Safety', False),
    (r'(?:withdrawal|rebound|discontinuation).{0,40}(?:effect|symptom|syndrome)',
     'Withdrawal/Rebound', False),
]

LABELING_PATTERNS = [
    (r'(?:prescribing information|package insert|SPL).{0,60}(?:not adequate|inadequate|deficien|revis|update|comment)',
     'Prescribing Information', True),
    (r'(?:proprietary name|trade name|brand name).{0,60}(?:not acceptable|confusion|concern|similar|reject)',
     'Proprietary Name Rejection', True),
    (r'(?:carton|container label|primary label|immediate container|blister)',
     'Container/Carton Labeling', True),
    (r'(?:Medication Guide|patient information|patient labeling)',
     'Medication Guide', True),
    (r'(?:postmarket|Phase 4|PMR|PMC|commitment)',
     'Postmarket Commitment', True),
]

# Full-text CMC detection for CRLs without CMC sections
FULLTEXT_CMC_PATTERNS = [
    r'(?:chemistry|manufacturing|CMC|product quality).{0,40}(?:deficien|issue|concern)',
    r'(?:specification|spec\b).{0,60}(?:not adequate|inadequate|revise your)',
    r'(?:stability data|stability stud).{0,60}(?:not adequate|inadequate|insufficien|provide|conduct)',
    r'(?:impurit|degradant).{0,60}(?:not adequate|inadequate|characteriz|identif|qualif|revise)',
    r'(?:manufactur|process valid).{0,60}(?:not adequate|inadequate|deficien)',
    r'(?:dissolution|drug release).{0,60}(?:not adequate|inadequate|fail|criteria)',
    r'(?:analyti|method valid|assay valid).{0,60}(?:not adequate|inadequate)',
    r'(?:container|closure).{0,40}(?:not adequate|inadequate|deficien)',
    r'(?:steril|aseptic|endotoxin).{0,40}(?:not adequate|inadequate|deficien)',
    r'(?:GMP|cGMP|Form 483).{0,40}(?:deficien|violat|finding)',
    r'pre.?approval inspection',
    r'(?:DMF|drug master file)',
    r'(?:extractable|leachable|nitrosamine|elemental impurit)',
    r'(?:batch record|batch analysis|lot).{0,40}(?:fail|reject|deviation)',
]


def extract_sections(text):
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


def classify_section(sec_name):
    name = sec_name.upper().strip()
    for s in CMC_SECTIONS:
        if name.startswith(s): return 'cmc'
    for s in CMC_ADJACENT:
        if name.startswith(s): return 'cmc_adjacent'
    for s in CLINICAL_SECTIONS:
        if name.startswith(s): return 'clinical'
    for s in CLINICAL_ADJACENT:
        if name.startswith(s): return 'clinical_adjacent'
    for s in LABELING_SECTIONS:
        if name.startswith(s): return 'labeling'
    for s in SKIP_SECTIONS:
        if name.startswith(s): return 'skip'
    return 'unknown'


def has_real_deficiency(text):
    """Filter out boilerplate labeling/prescribing sections."""
    low = text.lower()
    boilerplate_phrases = [
        'we reserve comment on the proposed labeling',
        'we reserve comment on the proposed prescribing',
        'submit draft carton and container labeling',
        'name was found acceptable',
        'please resubmit the proposed proprietary name',
    ]
    if any(bp in low for bp in boilerplate_phrases):
        # Check if there's also real deficiency content beyond boilerplate
        real_indicators = [
            r'\d+\.\s+[A-Z]',
            r'(?:not adequate|inadequate|deficien|unresolved|reject)',
        ]
        has_real = any(re.search(p, text) for p in real_indicators)
        if not has_real:
            return False
    return len(text.strip()) > 50


def match_patterns(text, patterns):
    matched = []
    text_lower = text.lower()
    seen = set()
    for pattern, dtype, cross_ref in patterns:
        if dtype not in seen and re.search(pattern, text_lower):
            matched.append({'type': dtype, 'cross_ref_catchable': cross_ref})
            seen.add(dtype)
    return matched


def check_fulltext_cmc(text):
    """Check if full CRL text contains CMC deficiency indicators."""
    text_lower = text.lower()
    matches = [p for p in FULLTEXT_CMC_PATTERNS if re.search(p, text_lower)]
    return len(matches) >= 2  # Require at least 2 CMC indicators


# ── Main Analysis ─────────────────────────────────────────────────────
with open(INPUT) as f:
    data = json.load(f)

records = data['results']
print(f"Analyzing {len(records)} CRLs...\n")

crl_summaries = []
type_counts = Counter()
cmc_cats = Counter()
clinical_cats = Counter()
labeling_cats = Counter()
module_counts = Counter()
year_dist = Counter()
xref_by_type = Counter()

totals = {'def': 0, 'cmc': 0, 'clinical': 0, 'labeling': 0, 'xref': 0}
crl_flags = {'cmc': 0, 'clinical': 0, 'labeling': 0, 'nonclinical': 0,
             'facility': 0, 'facility_blocking': 0}

# Track specific pattern prevalences across CRLs (not instances)
crl_level_patterns = Counter()

for idx, rec in enumerate(records):
    text = rec.get('text', '')
    company = rec.get('company_name', 'Unknown')
    app_nums = rec.get('application_number', [])
    letter_date = rec.get('letter_date', '')
    letter_year = rec.get('letter_year', '')

    sections = extract_sections(text)

    flags = {'cmc': False, 'clinical': False, 'labeling': False,
             'nonclinical': False, 'facility': False, 'facility_blocking': False}
    defs = []
    seen_types = set()

    for sec_name, sec_text in sections.items():
        sec_type = classify_section(sec_name)

        if sec_type == 'skip' or sec_type == 'unknown':
            continue

        if sec_type == 'cmc':
            flags['cmc'] = True
            matched = match_patterns(sec_text, CMC_PATTERNS)
            if not matched:
                matched = [{'type': 'CMC General', 'cross_ref_catchable': False}]
            for m in matched:
                if m['type'] not in seen_types:
                    m['ectd_module'] = '3'
                    m['is_cmc'] = True
                    m['section'] = sec_name
                    cmc_cats[m['type']] += 1
                    type_counts[m['type']] += 1
                    module_counts['3'] += 1
                    totals['def'] += 1
                    totals['cmc'] += 1
                    if m['cross_ref_catchable']:
                        totals['xref'] += 1
                        xref_by_type[m['type']] += 1
                    defs.append(m)
                    seen_types.add(m['type'])
                    crl_level_patterns[m['type']] += 1

        elif sec_type == 'cmc_adjacent':
            flags['facility'] = True
            flags['cmc'] = True
            # Check if blocking or pending
            low = sec_text.lower()
            blocking_words = ['form 483', 'deficien', 'violat', 'not adequate', 'inadequate',
                              'unsatisfact', 'warning letter', 'unresolved']
            is_blocking = sum(1 for w in blocking_words if w in low) >= 1
            if is_blocking:
                flags['facility_blocking'] = True
                dtype = 'GMP/Facility Compliance'
            else:
                dtype = 'Pending Pre-Approval Inspection'
            if dtype not in seen_types:
                m = {'type': dtype, 'is_cmc': True, 'cross_ref_catchable': False,
                     'ectd_module': '3', 'section': sec_name}
                cmc_cats[dtype] += 1
                type_counts[dtype] += 1
                module_counts['3'] += 1
                totals['def'] += 1
                totals['cmc'] += 1
                defs.append(m)
                seen_types.add(dtype)
                crl_level_patterns[dtype] += 1

        elif sec_type == 'clinical':
            if has_real_deficiency(sec_text):
                flags['clinical'] = True
                matched = match_patterns(sec_text, CLINICAL_PATTERNS)
                if not matched:
                    matched = [{'type': 'Clinical General', 'cross_ref_catchable': False}]
                for m in matched:
                    if m['type'] not in seen_types:
                        m['ectd_module'] = '5'
                        m['is_cmc'] = False
                        m['section'] = sec_name
                        clinical_cats[m['type']] += 1
                        type_counts[m['type']] += 1
                        module_counts['5'] += 1
                        totals['def'] += 1
                        totals['clinical'] += 1
                        if m['cross_ref_catchable']:
                            totals['xref'] += 1
                            xref_by_type[m['type']] += 1
                        defs.append(m)
                        seen_types.add(m['type'])
                        crl_level_patterns[m['type']] += 1

        elif sec_type == 'clinical_adjacent':
            if has_real_deficiency(sec_text):
                is_nonc = 'NONCLINICAL' in sec_name.upper()
                if is_nonc:
                    flags['nonclinical'] = True
                else:
                    flags['clinical'] = True
                mod = '4' if is_nonc else ('2.7' if 'PHARMACOL' in sec_name.upper() else '5')
                matched = match_patterns(sec_text, CLINICAL_PATTERNS)
                if not matched:
                    label = 'Nonclinical General' if is_nonc else 'Clinical Pharmacology General'
                    matched = [{'type': label, 'cross_ref_catchable': not is_nonc}]
                for m in matched:
                    if m['type'] not in seen_types:
                        m['ectd_module'] = mod
                        m['is_cmc'] = False
                        m['section'] = sec_name
                        clinical_cats[m['type']] += 1
                        type_counts[m['type']] += 1
                        module_counts[mod] += 1
                        totals['def'] += 1
                        totals['clinical'] += 1
                        if m['cross_ref_catchable']:
                            totals['xref'] += 1
                            xref_by_type[m['type']] += 1
                        defs.append(m)
                        seen_types.add(m['type'])
                        crl_level_patterns[m['type']] += 1

        elif sec_type == 'labeling':
            if has_real_deficiency(sec_text):
                flags['labeling'] = True
                matched = match_patterns(sec_text, LABELING_PATTERNS)
                if not matched:
                    label = sec_name.replace('CARTON AND ', '').title()
                    matched = [{'type': f'Labeling ({label})', 'cross_ref_catchable': True}]
                for m in matched:
                    if m['type'] not in seen_types:
                        m['ectd_module'] = '1'
                        m['is_cmc'] = False
                        m['section'] = sec_name
                        labeling_cats[m['type']] += 1
                        type_counts[m['type']] += 1
                        module_counts['1'] += 1
                        totals['def'] += 1
                        totals['labeling'] += 1
                        if m['cross_ref_catchable']:
                            totals['xref'] += 1
                            xref_by_type[m['type']] += 1
                        defs.append(m)
                        seen_types.add(m['type'])
                        crl_level_patterns[m['type']] += 1

    # Full-text CMC scan for CRLs without CMC sections
    if not flags['cmc'] and check_fulltext_cmc(text):
        flags['cmc'] = True
        fulltext_matched = match_patterns(text, CMC_PATTERNS)
        if not fulltext_matched:
            fulltext_matched = [{'type': 'CMC General (Body Text)', 'cross_ref_catchable': False}]
        for m in fulltext_matched:
            if m['type'] not in seen_types:
                m['ectd_module'] = '3'
                m['is_cmc'] = True
                m['section'] = 'FULL_TEXT'
                cmc_cats[m['type']] += 1
                type_counts[m['type']] += 1
                module_counts['3'] += 1
                totals['def'] += 1
                totals['cmc'] += 1
                if m.get('cross_ref_catchable'):
                    totals['xref'] += 1
                    xref_by_type[m['type']] += 1
                defs.append(m)
                seen_types.add(m['type'])
                crl_level_patterns[m['type']] += 1

    year_dist[letter_year] += 1
    for k in flags:
        if flags[k]:
            crl_flags[k] += 1

    crl_summaries.append({
        'application_number': app_nums[0] if app_nums else 'Unknown',
        'company': company,
        'letter_date': letter_date,
        'letter_year': letter_year,
        'flags': flags,
        'deficiency_count': len(defs),
        'deficiencies': defs
    })

# ── Derived stats ────────────────────────────────────────────────────
N = len(records)
crls_both = sum(1 for s in crl_summaries if s['flags']['cmc'] and s['flags']['clinical'])
crls_cmc_only = sum(1 for s in crl_summaries if s['flags']['cmc'] and not s['flags']['clinical'])
crls_clinical_only = sum(1 for s in crl_summaries if s['flags']['clinical'] and not s['flags']['cmc'])

print(f"{'='*60}")
print(f"FINAL RESULTS — {N} CRLs")
print(f"{'='*60}")
print(f"Total deficiency instances: {totals['def']}")
print()
print(f"CRLs citing CMC:        {crl_flags['cmc']:4d} ({crl_flags['cmc']/N*100:.1f}%)")
print(f"CRLs citing Clinical:   {crl_flags['clinical']:4d} ({crl_flags['clinical']/N*100:.1f}%)")
print(f"CRLs citing Labeling:   {crl_flags['labeling']:4d} ({crl_flags['labeling']/N*100:.1f}%)")
print(f"CRLs citing Nonclinical:{crl_flags['nonclinical']:4d} ({crl_flags['nonclinical']/N*100:.1f}%)")
print(f"CRLs w/ Facility:       {crl_flags['facility']:4d} ({crl_flags['facility']/N*100:.1f}%)")
print(f"  Blocking GMP:         {crl_flags['facility_blocking']:4d}")
print()
print(f"CMC + Clinical:         {crls_both:4d}")
print(f"CMC only:               {crls_cmc_only:4d}")
print(f"Clinical only:          {crls_clinical_only:4d}")
print()
print(f"Instance totals:")
print(f"  CMC:       {totals['cmc']:4d} ({totals['cmc']/totals['def']*100:.1f}%)")
print(f"  Clinical:  {totals['clinical']:4d} ({totals['clinical']/totals['def']*100:.1f}%)")
print(f"  Labeling:  {totals['labeling']:4d} ({totals['labeling']/totals['def']*100:.1f}%)")
print(f"  Cross-ref: {totals['xref']:4d} ({totals['xref']/totals['def']*100:.1f}%)")
print()
print("Top 25 deficiency types (by CRL count):")
for dtype, cnt in crl_level_patterns.most_common(25):
    print(f"  {cnt:4d} CRLs  {dtype}")

# ── OUTPUT 1: Taxonomy JSON ──────────────────────────────────────────
taxonomy = {
    "meta": {
        "total_crls_analyzed": N,
        "total_deficiency_instances": totals['def'],
        "analysis_date": "2026-03-22",
        "data_source": "openFDA CRL database — 419 FDA Complete Response Letters with full OCR text",
        "methodology": "Section-based extraction + full-text CMC scanning with 80+ regex deficiency archetypes mapped to eCTD modules"
    },
    "summary_statistics": {
        "crl_level": {
            "crls_citing_cmc": {"count": crl_flags['cmc'], "pct": round(crl_flags['cmc'] / N * 100, 1)},
            "crls_citing_clinical": {"count": crl_flags['clinical'], "pct": round(crl_flags['clinical'] / N * 100, 1)},
            "crls_citing_labeling": {"count": crl_flags['labeling'], "pct": round(crl_flags['labeling'] / N * 100, 1)},
            "crls_citing_nonclinical": {"count": crl_flags['nonclinical'], "pct": round(crl_flags['nonclinical'] / N * 100, 1)},
            "crls_with_facility_issues": {"count": crl_flags['facility'], "pct": round(crl_flags['facility'] / N * 100, 1)},
            "crls_with_blocking_gmp": crl_flags['facility_blocking'],
            "crls_cmc_and_clinical": crls_both,
            "crls_cmc_only": crls_cmc_only,
            "crls_clinical_only": crls_clinical_only,
        },
        "instance_level": {
            "cmc": {"count": totals['cmc'], "pct": round(totals['cmc'] / totals['def'] * 100, 1)},
            "clinical": {"count": totals['clinical'], "pct": round(totals['clinical'] / totals['def'] * 100, 1)},
            "labeling": {"count": totals['labeling'], "pct": round(totals['labeling'] / totals['def'] * 100, 1)},
        },
        "cross_reference_catchable": {
            "count": totals['xref'],
            "pct_of_all": round(totals['xref'] / totals['def'] * 100, 1),
            "by_type": dict(xref_by_type.most_common()),
        }
    },
    "ectd_module_distribution": {
        mod: {
            "module_name": ECTD_MODULES.get(mod, f"Module {mod}"),
            "deficiency_count": cnt,
            "pct_of_total": round(cnt / totals['def'] * 100, 1)
        }
        for mod, cnt in sorted(module_counts.items(), key=lambda x: -x[1])
    },
    "deficiency_taxonomy": {
        "cmc": {
            "description": "Chemistry, Manufacturing, and Controls deficiencies (eCTD Module 3)",
            "total_instances": totals['cmc'],
            "crls_affected": crl_flags['cmc'],
            "crls_affected_pct": round(crl_flags['cmc'] / N * 100, 1),
            "categories": [
                {
                    "type": dtype,
                    "instance_count": cnt,
                    "pct_of_cmc": round(cnt / totals['cmc'] * 100, 1) if totals['cmc'] > 0 else 0,
                    "cross_ref_catchable": any(p[2] for p in CMC_PATTERNS if p[1] == dtype),
                }
                for dtype, cnt in cmc_cats.most_common()
            ]
        },
        "clinical": {
            "description": "Clinical and Nonclinical deficiencies (eCTD Modules 4-5, 2.7)",
            "total_instances": totals['clinical'],
            "crls_affected": crl_flags['clinical'],
            "crls_affected_pct": round(crl_flags['clinical'] / N * 100, 1),
            "categories": [
                {
                    "type": dtype,
                    "instance_count": cnt,
                    "pct_of_clinical": round(cnt / totals['clinical'] * 100, 1) if totals['clinical'] > 0 else 0,
                    "cross_ref_catchable": any(p[2] for p in CLINICAL_PATTERNS if p[1] == dtype),
                }
                for dtype, cnt in clinical_cats.most_common()
            ]
        },
        "labeling_administrative": {
            "description": "Labeling and administrative deficiencies (eCTD Module 1)",
            "total_instances": totals['labeling'],
            "crls_affected": crl_flags['labeling'],
            "crls_affected_pct": round(crl_flags['labeling'] / N * 100, 1),
            "categories": [
                {
                    "type": dtype,
                    "instance_count": cnt,
                    "pct_of_labeling": round(cnt / totals['labeling'] * 100, 1) if totals['labeling'] > 0 else 0,
                    "cross_ref_catchable": True,
                }
                for dtype, cnt in labeling_cats.most_common()
            ]
        }
    },
    "year_distribution": dict(sorted(year_dist.items())),
    "crl_level_pattern_prevalence": {
        dtype: {"crls_citing": cnt, "pct_of_crls": round(cnt / N * 100, 1)}
        for dtype, cnt in crl_level_patterns.most_common()
    },
    "per_crl_details": crl_summaries
}

with open(OUTDIR / "crl-deficiency-taxonomy.json", 'w') as f:
    json.dump(taxonomy, f, indent=2, default=str)
print(f"\nWrote taxonomy: {OUTDIR / 'crl-deficiency-taxonomy.json'}")

# Store stats for markdown generation
stats = {
    'N': N, 'totals': totals, 'crl_flags': crl_flags,
    'crls_both': crls_both, 'crls_cmc_only': crls_cmc_only,
    'crls_clinical_only': crls_clinical_only,
    'cmc_cats': cmc_cats, 'clinical_cats': clinical_cats,
    'labeling_cats': labeling_cats, 'module_counts': module_counts,
    'year_dist': year_dist, 'xref_by_type': xref_by_type,
    'crl_level_patterns': crl_level_patterns,
    'type_counts': type_counts,
}
with open(OUTDIR / '_stats.json', 'w') as f:
    json.dump({k: dict(v) if isinstance(v, (Counter, defaultdict)) else v for k, v in stats.items()}, f, indent=2)
print(f"Wrote stats cache: {OUTDIR / '_stats.json'}")
