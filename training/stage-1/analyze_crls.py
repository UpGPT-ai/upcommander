#!/usr/bin/env python3
"""
CRL Deficiency Analyzer — parses 419 FDA Complete Response Letters,
extracts deficiencies, classifies by eCTD module / CMC vs Clinical,
and determines cross-reference preventability.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

INPUT = Path("/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/stage-1/crl-database/crl-data.json")
OUTDIR = Path("/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/output/crl-analyst")
OUTDIR.mkdir(parents=True, exist_ok=True)

# ── eCTD Module mapping ──────────────────────────────────────────────
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

# ── Deficiency keyword taxonomy ──────────────────────────────────────
# Each entry: (pattern, deficiency_type, ectd_module, is_cmc, cross_ref_catchable)
DEFICIENCY_PATTERNS = [
    # ── CMC / Product Quality (Module 3) ──
    (r'specif(?:ication|y|ied).*(?:not adequate|inadequate|not acceptable|missing|lack)',
     'Specification Inadequacy', '3', True, True),
    (r'(?:dissolution|drug release).*(?:not adequate|inadequate|fail|specification)',
     'Dissolution/Drug Release', '3', True, True),
    (r'(?:stability|shelf.?life|expir|degradation).*(?:not adequate|inadequate|insufficient|data|support)',
     'Stability Data Deficiency', '3', True, True),
    (r'(?:impurit|degradant|related substance).*(?:not adequate|inadequate|characteriz|identif|qualif|specify|limit)',
     'Impurity Characterization', '3', True, True),
    (r'(?:manufactur|process|batch|lot).*(?:valid|control|scale.?up|consistency|not adequate)',
     'Manufacturing Process/Validation', '3', True, False),
    (r'(?:container.?closure|packaging|seal|integrity).*(?:not adequate|inadequate|data|support)',
     'Container Closure System', '3', True, True),
    (r'(?:sterili|asepti|endotoxin|bioburden|microbi).*(?:not adequate|inadequate|assurance|valid|data)',
     'Sterility/Microbial Control', '3', True, False),
    (r'(?:analytic|method|assay|test).*(?:valid|not adequate|inadequate|suitable|acceptable)',
     'Analytical Method Validation', '3', True, True),
    (r'(?:excipient|inactive ingredient|component).*(?:not adequate|inadequate|control|characteriz|source|grade)',
     'Excipient/Component Control', '3', True, True),
    (r'(?:drug.?substance|active.*ingredient|API).*(?:not adequate|inadequate|control|characteriz|specification)',
     'Drug Substance Control', '3', True, True),
    (r'(?:drug.?master.?file|DMF).*(?:not adequate|inadequate|deficien|found)',
     'Drug Master File Deficiency', '3', True, True),
    (r'(?:facility|GMP|cGMP|inspection).*(?:deficien|observation|finding|not adequate|violat|Form 483)',
     'Facility/GMP Compliance', '3', True, False),
    (r'(?:in.?vitro|release.*rate|permeation|flux)',
     'In Vitro Performance', '3', True, True),
    (r'(?:polymorp|crystal|particle.?size|form)',
     'Physical Characterization', '3', True, True),
    (r'(?:extract|leach|elemental impurit|nitrosamine|genotox.*impurit)',
     'Extractables/Leachables/Elemental', '3', True, True),
    (r'(?:label.*claim|potency|assay.*result|content.*uniform)',
     'Potency/Content Uniformity', '3', True, True),
    (r'(?:comparab|bioequival|BE study|bioavailab).*(?:not adequate|inadequate|fail|establish)',
     'Bioequivalence/Comparability', '3', True, True),
    (r'(?:device|combination product|applicator|injector|auto.?inject|pen|inhaler|deliver.*system)',
     'Device/Combination Product', '3', True, False),
    (r'(?:residual solvent|organic.*volatile)',
     'Residual Solvents', '3', True, True),
    (r'(?:endotoxin|pyrogen|LAL)',
     'Endotoxin/Pyrogen', '3', True, True),
    (r'(?:cold.?flow|shear|adhes|peel)',
     'Adhesion/Physical Performance', '3', True, True),
    (r'(?:visual inspection|particulate|visible)',
     'Particulate/Visual Inspection', '3', True, True),

    # ── Clinical (Module 5) ──
    (r'(?:efficacy|effective|primary.*endpoint|failed.*demonstrate|Pearl.*Index).*(?:not adequate|inadequate|fail|insufficient|demonstrate)',
     'Efficacy Not Demonstrated', '5', False, False),
    (r'(?:safety|adverse.*event|toxicity|risk).*(?:concern|signal|not adequate|inadequate|characteriz|assess)',
     'Safety Concerns/Signal', '5', False, False),
    (r'(?:clinical.*trial|study|phase).*(?:design|conduct|execution).*(?:deficien|not adequate|inadequate|issue|problem)',
     'Clinical Trial Design/Conduct', '5', False, False),
    (r'(?:statistical|analysis|endpoint).*(?:not adequate|inadequate|issue|concern|flaw)',
     'Statistical/Analysis Issues', '5', False, True),
    (r'(?:dose|dosing|dose.?response|dose.?finding|dose.?select)',
     'Dosing Deficiency', '5', False, False),
    (r'(?:REMS|risk.*evaluation|mitigation.*strategy)',
     'REMS Requirement', '5', False, True),
    (r'(?:pediatric|PREA|Required Pediatric)',
     'Pediatric Assessment', '5', False, True),
    (r'(?:suicid|depression|psychiat|neuropsych)',
     'Psychiatric Safety Signal', '5', False, False),
    (r'(?:cardiovascul|MACE|heart|myocard|stroke|thromb)',
     'Cardiovascular Safety', '5', False, False),
    (r'(?:hepat|liver|ALT|AST|bilirub|Hy.?s.*Law|DILI)',
     'Hepatotoxicity Concern', '5', False, False),
    (r'(?:immunogenic|anti.?drug.*antibod|ADA|neutraliz.*antibod)',
     'Immunogenicity', '5', False, True),
    (r'(?:abuse.*potential|addiction|depend|schedule|DEA)',
     'Abuse Potential Assessment', '5', False, True),
    (r'(?:QT|QTc|arrhythm|torsade|proarrhythm|cardiac.*repolariz)',
     'QT/Cardiac Electrophysiology', '5', False, True),
    (r'(?:carcinogen|long.?term|chronic.*toxicity|2.?year.*study)',
     'Carcinogenicity/Chronic Toxicity', '4', False, False),
    (r'(?:genotox|mutagen|Ames|clastogen)',
     'Genotoxicity', '4', False, True),
    (r'(?:repro.*toxicol|teratogen|embryo|fetal|fertility.*study)',
     'Reproductive Toxicology', '4', False, True),
    (r'(?:pharmacokinet|PK|absorption|distribution|metabolism|elimination|half.?life|AUC|Cmax|clearance)',
     'Pharmacokinetics', '5', False, True),
    (r'(?:drug.*interact|DDI|CYP|P.?gp)',
     'Drug Interaction', '5', False, True),
    (r'(?:special.*population|renal.*impair|hepatic.*impair|geriatric|organ.*impair)',
     'Special Populations', '5', False, True),
    (r'(?:patient.?report|PRO|quality.*of.*life|QoL)',
     'Patient-Reported Outcomes', '5', False, True),
    (r'(?:human.*factor|use.*error|usability|instructions.*for.*use|IFU)',
     'Human Factors/Usability', '5', False, False),
    (r'(?:subgroup|subpopulation|racial|ethnic|sex.*diff|gender.*diff)',
     'Subgroup Analysis', '5', False, True),
    (r'(?:missing.*data|incomplete|lost.?to.?follow)',
     'Missing Data/Follow-up', '5', False, False),

    # ── Nonclinical (Module 4) ──
    (r'(?:nonclinical|animal|preclinical|in.?vivo.*toxicol).*(?:not adequate|inadequate|deficien|additional|concern)',
     'Nonclinical Study Deficiency', '4', False, False),
    (r'(?:pharmacol|mechanism.*action|receptor|binding)',
     'Pharmacology', '4', False, False),

    # ── Labeling / Administrative (Modules 1, 2) ──
    (r'(?:label|prescribing.*information|package.*insert|SPL|Highlights).*(?:not adequate|inadequate|deficien|revis|update|concern|issue)',
     'Labeling/PI Deficiency', '1', False, True),
    (r'(?:proprietary.*name|trade.*name|brand.*name).*(?:not acceptable|confusion|concern|similar|reject)',
     'Proprietary Name Issue', '1', False, True),
    (r'(?:carton|container.*label|primary.*label|immediate.*container)',
     'Carton/Container Labeling', '1', False, True),
    (r'(?:Medication Guide|patient.*information|patient.*labeling)',
     'Medication Guide/Patient Labeling', '1', False, True),
    (r'(?:postmarket|Phase 4|commitment|PMR|PMC|requirement.*after)',
     'Postmarket Requirement', '1', False, True),

    # ── Clinical Pharmacology (Module 2.7 / 5) ──
    (r'(?:clinical.*pharmacol|biopharmaceutic|food.*effect|fed.*fasted)',
     'Clinical Pharmacology', '2.7', False, True),
    (r'(?:biowaiver|BCS|biopharmaceutic.*classification)',
     'Biowaiver/BCS', '2.7', True, True),
]

# ── Section Extractor ─────────────────────────────────────────────────
SECTION_HEADERS = [
    'CLINICAL/STATISTICAL', 'CLINICAL PHARMACOLOGY', 'CLINICAL',
    'PRODUCT QUALITY', 'CHEMISTRY, MANUFACTURING AND CONTROLS',
    'NONCLINICAL', 'FACILITY INSPECTIONS', 'MICROBIOLOGY',
    'HUMAN FACTORS', 'DEVICE', 'LABELING', 'PRESCRIBING INFORMATION',
    'CARTON AND CONTAINER LABELING', 'PROPRIETARY NAME',
    'MEDICATION GUIDE', 'RISK EVALUATION AND MITIGATION STRATEGY',
    'SAFETY UPDATE', 'ADDITIONAL COMMENTS', 'OTHER',
    'REGULATORY', 'BIOPHARMACEUTICS', 'REQUIRED PEDIATRIC',
]

def extract_sections(text):
    """Split CRL text into labeled sections."""
    sections = {}
    # Build regex for section splitting
    pattern = '|'.join(re.escape(h) for h in SECTION_HEADERS)
    splits = re.split(r'\n(' + pattern + r'[A-Z ]*)\n', text)

    current_section = 'PREAMBLE'
    current_text = ''
    for i, part in enumerate(splits):
        is_header = False
        for h in SECTION_HEADERS:
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

def classify_section(section_name):
    """Map a CRL section header to eCTD module and CMC flag."""
    name = section_name.upper()
    if any(k in name for k in ['PRODUCT QUALITY', 'CHEMISTRY', 'CMC']):
        return '3', True
    if 'MICROBIOLOGY' in name:
        return '3', True
    if 'FACILITY' in name:
        return '3', True
    if 'DEVICE' in name:
        return '3', True
    if 'NONCLINICAL' in name:
        return '4', False
    if 'CLINICAL PHARMACOLOGY' in name or 'BIOPHARMACEUTIC' in name:
        return '2.7', False
    if 'CLINICAL/STATISTICAL' in name:
        return '5', False
    if 'CLINICAL' in name:
        return '5', False
    if any(k in name for k in ['LABEL', 'PRESCRIBING', 'CARTON', 'CONTAINER',
                                'PROPRIETARY', 'MEDICATION GUIDE']):
        return '1', False
    if 'RISK EVALUATION' in name or 'REMS' in name:
        return '1', False
    if 'HUMAN FACTOR' in name:
        return '5', False
    return None, None

def count_numbered_deficiencies(text):
    """Count numbered items (1., 2., etc.) in a section."""
    items = re.findall(r'\n\s*(\d+)\.\s+[A-Z]', text)
    if items:
        return max(int(i) for i in items)
    return 1 if len(text.strip()) > 100 else 0

def extract_deficiency_keywords(text):
    """Match text against deficiency patterns, return list of matched types."""
    matched = []
    text_lower = text.lower()
    for pattern, dtype, module, is_cmc, cross_ref in DEFICIENCY_PATTERNS:
        if re.search(pattern, text_lower):
            matched.append({
                'type': dtype,
                'ectd_module': module,
                'is_cmc': is_cmc,
                'cross_ref_catchable': cross_ref
            })
    return matched

# ── Main Analysis ─────────────────────────────────────────────────────
with open(INPUT) as f:
    data = json.load(f)

records = data['results']
print(f"Analyzing {len(records)} CRLs...")

# Aggregation structures
all_deficiencies = []  # flat list of every deficiency found
crl_summaries = []  # per-CRL summary
deficiency_type_counts = Counter()
module_counts = Counter()
cmc_count = 0
clinical_count = 0
cross_ref_catchable_count = 0
total_deficiency_count = 0
section_deficiency_counts = Counter()
cmc_sub_categories = Counter()
clinical_sub_categories = Counter()
year_distribution = Counter()
cmc_per_crl = []
clinical_per_crl = []

for idx, rec in enumerate(records):
    text = rec.get('text', '')
    company = rec.get('company_name', 'Unknown')
    app_nums = rec.get('application_number', [])
    letter_date = rec.get('letter_date', '')
    letter_year = rec.get('letter_year', '')

    sections = extract_sections(text)

    crl_cmc_count = 0
    crl_clinical_count = 0
    crl_deficiencies = []
    crl_has_cmc = False
    crl_has_clinical = False
    crl_sections_with_deficiencies = []

    for sec_name, sec_text in sections.items():
        if sec_name in ('PREAMBLE', 'OTHER', 'SAFETY UPDATE', 'ADDITIONAL COMMENTS'):
            # Skip non-deficiency sections (but scan preamble for embedded deficiencies)
            if sec_name == 'PREAMBLE':
                # Sometimes the deficiency text is in the preamble before labeled sections
                pass
            else:
                continue

        sec_module, sec_is_cmc = classify_section(sec_name)
        if sec_module is None:
            # Try to extract deficiencies from the text itself
            pass

        # Count numbered deficiencies in this section
        num_deficiencies = count_numbered_deficiencies(sec_text)

        # Pattern match for specific deficiency types
        matched_types = extract_deficiency_keywords(sec_text)

        if not matched_types and sec_module and num_deficiencies > 0:
            # Section had numbered items but no specific pattern match —
            # create a generic deficiency based on section type
            if sec_is_cmc:
                matched_types = [{'type': f'CMC General ({sec_name})', 'ectd_module': sec_module, 'is_cmc': True, 'cross_ref_catchable': False}]
            elif sec_module in ('5', '2.7'):
                matched_types = [{'type': f'Clinical General ({sec_name})', 'ectd_module': sec_module, 'is_cmc': False, 'cross_ref_catchable': False}]
            elif sec_module == '4':
                matched_types = [{'type': f'Nonclinical General ({sec_name})', 'ectd_module': sec_module, 'is_cmc': False, 'cross_ref_catchable': False}]
            elif sec_module == '1':
                matched_types = [{'type': f'Administrative/Labeling ({sec_name})', 'ectd_module': sec_module, 'is_cmc': False, 'cross_ref_catchable': True}]

        for mt in matched_types:
            deficiency_type_counts[mt['type']] += 1
            module_counts[mt['ectd_module']] += 1
            total_deficiency_count += 1

            if mt['is_cmc']:
                cmc_count += 1
                crl_cmc_count += 1
                crl_has_cmc = True
                cmc_sub_categories[mt['type']] += 1
            else:
                clinical_count += 1
                crl_clinical_count += 1
                if mt['ectd_module'] in ('5', '4', '2.7'):
                    crl_has_clinical = True
                clinical_sub_categories[mt['type']] += 1

            if mt['cross_ref_catchable']:
                cross_ref_catchable_count += 1

            section_deficiency_counts[sec_name] += 1

            crl_deficiencies.append({
                'section': sec_name,
                'deficiency_type': mt['type'],
                'ectd_module': mt['ectd_module'],
                'ectd_module_name': ECTD_MODULES.get(mt['ectd_module'], f"Module {mt['ectd_module']}"),
                'is_cmc': mt['is_cmc'],
                'cross_ref_catchable': mt['cross_ref_catchable']
            })

    # Also scan full text for patterns not caught by section parsing
    full_text_matches = extract_deficiency_keywords(text)
    existing_types = {d['deficiency_type'] for d in crl_deficiencies}
    for mt in full_text_matches:
        if mt['type'] not in existing_types:
            # Found a deficiency type in the full text not caught by sections
            deficiency_type_counts[mt['type']] += 1
            module_counts[mt['ectd_module']] += 1
            total_deficiency_count += 1
            if mt['is_cmc']:
                cmc_count += 1
                crl_cmc_count += 1
                crl_has_cmc = True
                cmc_sub_categories[mt['type']] += 1
            else:
                clinical_count += 1
                crl_clinical_count += 1
                if mt['ectd_module'] in ('5', '4', '2.7'):
                    crl_has_clinical = True
                clinical_sub_categories[mt['type']] += 1
            if mt['cross_ref_catchable']:
                cross_ref_catchable_count += 1
            crl_deficiencies.append({
                'section': 'FULL_TEXT_SCAN',
                'deficiency_type': mt['type'],
                'ectd_module': mt['ectd_module'],
                'ectd_module_name': ECTD_MODULES.get(mt['ectd_module'], f"Module {mt['ectd_module']}"),
                'is_cmc': mt['is_cmc'],
                'cross_ref_catchable': mt['cross_ref_catchable']
            })

    cmc_per_crl.append(crl_cmc_count)
    clinical_per_crl.append(crl_clinical_count)
    year_distribution[letter_year] += 1

    crl_summaries.append({
        'application_number': app_nums[0] if app_nums else 'Unknown',
        'company': company,
        'letter_date': letter_date,
        'letter_year': letter_year,
        'has_cmc_deficiency': crl_has_cmc,
        'has_clinical_deficiency': crl_has_clinical,
        'cmc_deficiency_count': crl_cmc_count,
        'clinical_deficiency_count': crl_clinical_count,
        'total_deficiencies': len(crl_deficiencies),
        'deficiencies': crl_deficiencies
    })

# ── Compute aggregate stats ──────────────────────────────────────────
crls_with_cmc = sum(1 for s in crl_summaries if s['has_cmc_deficiency'])
crls_with_clinical = sum(1 for s in crl_summaries if s['has_clinical_deficiency'])
crls_with_both = sum(1 for s in crl_summaries if s['has_cmc_deficiency'] and s['has_clinical_deficiency'])
crls_cmc_only = sum(1 for s in crl_summaries if s['has_cmc_deficiency'] and not s['has_clinical_deficiency'])
crls_clinical_only = sum(1 for s in crl_summaries if s['has_clinical_deficiency'] and not s['has_cmc_deficiency'])

print(f"\n=== RESULTS ===")
print(f"Total CRLs analyzed: {len(records)}")
print(f"Total deficiency instances found: {total_deficiency_count}")
print(f"CRLs with CMC deficiencies: {crls_with_cmc} ({crls_with_cmc/len(records)*100:.1f}%)")
print(f"CRLs with Clinical deficiencies: {crls_with_clinical} ({crls_with_clinical/len(records)*100:.1f}%)")
print(f"CRLs with both: {crls_with_both}")
print(f"CRLs CMC-only: {crls_cmc_only}")
print(f"CRLs Clinical-only: {crls_clinical_only}")
print(f"Cross-ref catchable: {cross_ref_catchable_count} ({cross_ref_catchable_count/total_deficiency_count*100:.1f}%)")

# ── Build taxonomy structure ─────────────────────────────────────────
taxonomy = {
    "meta": {
        "total_crls_analyzed": len(records),
        "total_deficiency_instances": total_deficiency_count,
        "analysis_date": "2026-03-22",
        "data_source": "openFDA CRL database (419 Complete Response Letters)"
    },
    "summary_statistics": {
        "crls_with_cmc_deficiency": crls_with_cmc,
        "crls_with_cmc_deficiency_pct": round(crls_with_cmc / len(records) * 100, 1),
        "crls_with_clinical_deficiency": crls_with_clinical,
        "crls_with_clinical_deficiency_pct": round(crls_with_clinical / len(records) * 100, 1),
        "crls_with_both": crls_with_both,
        "crls_cmc_only": crls_cmc_only,
        "crls_clinical_only": crls_clinical_only,
        "total_cmc_deficiency_instances": cmc_count,
        "total_clinical_deficiency_instances": clinical_count,
        "cross_reference_catchable_instances": cross_ref_catchable_count,
        "cross_reference_catchable_pct": round(cross_ref_catchable_count / total_deficiency_count * 100, 1),
    },
    "ectd_module_distribution": {
        mod: {
            "module_name": ECTD_MODULES.get(mod, f"Module {mod}"),
            "deficiency_count": cnt,
            "pct_of_total": round(cnt / total_deficiency_count * 100, 1)
        }
        for mod, cnt in sorted(module_counts.items(), key=lambda x: -x[1])
    },
    "deficiency_taxonomy": {
        "cmc_deficiencies": {
            "total_instances": cmc_count,
            "pct_of_all_deficiencies": round(cmc_count / total_deficiency_count * 100, 1),
            "categories": [
                {
                    "type": dtype,
                    "count": cnt,
                    "pct_of_cmc": round(cnt / cmc_count * 100, 1) if cmc_count > 0 else 0,
                    "ectd_module": "3",
                    "cross_ref_catchable": any(
                        p[4] for p in DEFICIENCY_PATTERNS if p[1] == dtype
                    )
                }
                for dtype, cnt in cmc_sub_categories.most_common()
            ]
        },
        "clinical_deficiencies": {
            "total_instances": clinical_count,
            "pct_of_all_deficiencies": round(clinical_count / total_deficiency_count * 100, 1),
            "categories": [
                {
                    "type": dtype,
                    "count": cnt,
                    "pct_of_clinical": round(cnt / clinical_count * 100, 1) if clinical_count > 0 else 0,
                    "ectd_module": next(
                        (p[2] for p in DEFICIENCY_PATTERNS if p[1] == dtype), "5"
                    ),
                    "cross_ref_catchable": any(
                        p[4] for p in DEFICIENCY_PATTERNS if p[1] == dtype
                    )
                }
                for dtype, cnt in clinical_sub_categories.most_common()
            ]
        }
    },
    "year_distribution": dict(sorted(year_distribution.items())),
    "per_crl_details": crl_summaries
}

# ── Write taxonomy JSON ──────────────────────────────────────────────
with open(OUTDIR / "crl-deficiency-taxonomy.json", 'w') as f:
    json.dump(taxonomy, f, indent=2)
print(f"\nWrote: {OUTDIR / 'crl-deficiency-taxonomy.json'}")

# ── Top deficiency types ─────────────────────────────────────────────
print("\nTop 20 deficiency types:")
for dtype, cnt in deficiency_type_counts.most_common(20):
    print(f"  {cnt:4d}  {dtype}")

print(f"\nYear distribution:")
for y, c in sorted(year_distribution.items()):
    print(f"  {y}: {c}")
