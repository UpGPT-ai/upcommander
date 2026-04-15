#!/usr/bin/env bash
# Monitor final-fixes workers and generate reports when all 3 complete
# Workers: accuracy, ectd-mapping, safety-pharm

BASE="/Users/gregorybibas/.gemini/antigravity/scratch/Claude Commander/training/final-fixes"
METRICS_DIR="$BASE/metrics"
LOG="$METRICS_DIR/monitor.log"
POLL_INTERVAL=120  # 2 minutes

mkdir -p "$METRICS_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

worker_done() {
  local dir="$BASE/$1"
  # Worker is done if it has at least one file (any output file)
  [[ -n "$(ls -A "$dir" 2>/dev/null)" ]]
}

collect_worker_data() {
  local worker="$1"
  local dir="$BASE/$worker"
  local data=""

  # Try to find JSON result files first
  local json_file
  json_file=$(find "$dir" -name "*.json" | head -1)
  if [[ -n "$json_file" ]]; then
    data=$(cat "$json_file")
  fi

  # Try markdown/text summary files
  local md_file
  md_file=$(find "$dir" -name "*.md" | head -1)
  if [[ -z "$data" && -n "$md_file" ]]; then
    data=$(cat "$md_file")
  fi

  # Fallback: list all files and their content
  if [[ -z "$data" ]]; then
    data=$(find "$dir" -type f -exec echo "=== {} ===" \; -exec cat {} \; 2>/dev/null)
  fi

  echo "$data"
}

extract_score() {
  local data="$1"
  local dimension="$2"
  # Try to extract score from JSON-like or key:value patterns
  local score
  score=$(echo "$data" | grep -iE "\"?${dimension}\"?\s*[:=]\s*([0-9]+\.?[0-9]*)" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
  echo "${score:-null}"
}

generate_reports() {
  log "All 3 workers complete — generating reports..."

  local accuracy_data ectd_data safety_data
  accuracy_data=$(collect_worker_data "accuracy")
  ectd_data=$(collect_worker_data "ectd-mapping")
  safety_data=$(collect_worker_data "safety-pharm")

  # --- Extract scores ---
  # Factual accuracy from accuracy worker
  local factual_accuracy
  factual_accuracy=$(extract_score "$accuracy_data" "factual_accuracy")
  [[ "$factual_accuracy" == "null" ]] && factual_accuracy=$(extract_score "$accuracy_data" "score")
  [[ "$factual_accuracy" == "null" ]] && factual_accuracy=$(echo "$accuracy_data" | grep -oE '[0-9]{2,3}(\.[0-9]+)?' | head -1)

  # Severity consistency from accuracy worker
  local severity_consistency
  severity_consistency=$(extract_score "$accuracy_data" "severity_consistency")
  [[ "$severity_consistency" == "null" ]] && severity_consistency=$(extract_score "$accuracy_data" "severity")

  # eCTD module consistency from ectd-mapping worker
  local ectd_consistency
  ectd_consistency=$(extract_score "$ectd_data" "ectd_module_consistency")
  [[ "$ectd_consistency" == "null" ]] && ectd_consistency=$(extract_score "$ectd_data" "ectd")
  [[ "$ectd_consistency" == "null" ]] && ectd_consistency=$(extract_score "$ectd_data" "score")
  [[ "$ectd_consistency" == "null" ]] && ectd_consistency=$(echo "$ectd_data" | grep -oE '[0-9]{2,3}(\.[0-9]+)?' | head -1)

  # Source fidelity — likely in accuracy or ectd
  local source_fidelity
  source_fidelity=$(extract_score "$accuracy_data" "source_fidelity")
  [[ "$source_fidelity" == "null" ]] && source_fidelity=$(extract_score "$ectd_data" "source_fidelity")
  [[ "$source_fidelity" == "null" ]] && source_fidelity=$(extract_score "$accuracy_data" "fidelity")

  # Safety pharmacology from safety-pharm worker
  local safety_pharm
  safety_pharm=$(extract_score "$safety_data" "safety_pharmacology")
  [[ "$safety_pharm" == "null" ]] && safety_pharm=$(extract_score "$safety_data" "safety")
  [[ "$safety_pharm" == "null" ]] && safety_pharm=$(extract_score "$safety_data" "score")
  [[ "$safety_pharm" == "null" ]] && safety_pharm=$(echo "$safety_data" | grep -oE '[0-9]{2,3}(\.[0-9]+)?' | head -1)

  # Default to "PARSE_FAILED" if null
  [[ "$factual_accuracy" == "null" || -z "$factual_accuracy" ]] && factual_accuracy="PARSE_FAILED"
  [[ "$severity_consistency" == "null" || -z "$severity_consistency" ]] && severity_consistency="PARSE_FAILED"
  [[ "$ectd_consistency" == "null" || -z "$ectd_consistency" ]] && ectd_consistency="PARSE_FAILED"
  [[ "$source_fidelity" == "null" || -z "$source_fidelity" ]] && source_fidelity="PARSE_FAILED"
  [[ "$safety_pharm" == "null" || -z "$safety_pharm" ]] && safety_pharm="PARSE_FAILED"

  # Check thresholds
  flags=""
  check_threshold() {
    local dim="$1" val="$2" target=98
    if [[ "$val" == "PARSE_FAILED" ]]; then
      flags+="  ⚠ $dim: PARSE_FAILED — could not extract score from worker output\n"
    elif (( $(echo "$val < $target" | bc -l 2>/dev/null || echo 1) )); then
      flags+="  ⚠ $dim: $val < $target (BELOW THRESHOLD — FLAG FOR REVIEW)\n"
    fi
  }
  check_threshold "factual_accuracy" "$factual_accuracy"
  check_threshold "severity_consistency" "$severity_consistency"
  check_threshold "ectd_module_consistency" "$ectd_consistency"
  check_threshold "source_fidelity" "$source_fidelity"
  check_threshold "safety_pharmacology" "$safety_pharm"

  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  # --- FINAL_FIX_REPORT.md ---
  cat > "$METRICS_DIR/FINAL_FIX_REPORT.md" << EOF
# Final Fix Report
**Generated:** $timestamp
**Status:** All 3 workers completed

---

## Worker Summary

### Worker 1 — Accuracy (factual_accuracy, severity_consistency, source_fidelity)
\`\`\`
$(echo "$accuracy_data" | head -60)
\`\`\`

### Worker 2 — eCTD Mapping (ectd_module_consistency)
\`\`\`
$(echo "$ectd_data" | head -60)
\`\`\`

### Worker 3 — Safety Pharmacology (safety_pharmacology)
\`\`\`
$(echo "$safety_data" | head -60)
\`\`\`

---

## Before/After Scores by Dimension

| Dimension | Before | After | Target | Status |
|-----------|--------|-------|--------|--------|
| factual_accuracy | (see worker output) | $factual_accuracy | 100 | $([ "$factual_accuracy" = "PARSE_FAILED" ] && echo "⚠ PARSE_FAILED" || ( (( $(echo "$factual_accuracy >= 98" | bc -l 2>/dev/null || echo 0) )) && echo "✓" || echo "⚠ BELOW THRESHOLD" )) |
| severity_consistency | (see worker output) | $severity_consistency | 100 | $([ "$severity_consistency" = "PARSE_FAILED" ] && echo "⚠ PARSE_FAILED" || ( (( $(echo "$severity_consistency >= 98" | bc -l 2>/dev/null || echo 0) )) && echo "✓" || echo "⚠ BELOW THRESHOLD" )) |
| ectd_module_consistency | (see worker output) | $ectd_consistency | 100 | $([ "$ectd_consistency" = "PARSE_FAILED" ] && echo "⚠ PARSE_FAILED" || ( (( $(echo "$ectd_consistency >= 98" | bc -l 2>/dev/null || echo 0) )) && echo "✓" || echo "⚠ BELOW THRESHOLD" )) |
| source_fidelity | (see worker output) | $source_fidelity | 100 | $([ "$source_fidelity" = "PARSE_FAILED" ] && echo "⚠ PARSE_FAILED" || ( (( $(echo "$source_fidelity >= 98" | bc -l 2>/dev/null || echo 0) )) && echo "✓" || echo "⚠ BELOW THRESHOLD" )) |
| safety_pharmacology | (see worker output) | $safety_pharm | 100 | $([ "$safety_pharm" = "PARSE_FAILED" ] && echo "⚠ PARSE_FAILED" || ( (( $(echo "$safety_pharm >= 98" | bc -l 2>/dev/null || echo 0) )) && echo "✓" || echo "⚠ BELOW THRESHOLD" )) |

---

## Flags

$([ -z "$flags" ] && echo "None — all dimensions at or above threshold (98)." || echo -e "$flags")

---

## Adversarial Testing Readiness

$([ -z "$flags" ] && echo "✅ **GO** — all dimensions ≥ 98. Safe to proceed to adversarial testing." || echo "🚫 **HOLD** — one or more dimensions below threshold or failed to parse. Review flags above before proceeding.")
EOF

  log "FINAL_FIX_REPORT.md written."

  # --- PRE_ADVERSARIAL_SCORECARD.json ---
  # Determine overall readiness
  local ready="true"
  [[ -n "$flags" ]] && ready="false"

  cat > "$METRICS_DIR/PRE_ADVERSARIAL_SCORECARD.json" << EOF
{
  "generated_at": "$timestamp",
  "status": "pre_adversarial_checkpoint",
  "target_scores": {
    "factual_accuracy": 100,
    "severity_consistency": 100,
    "ectd_module_consistency": 100,
    "source_fidelity": 100,
    "safety_pharmacology": 100
  },
  "minimum_threshold": 98,
  "scores": {
    "factual_accuracy": "$factual_accuracy",
    "severity_consistency": "$severity_consistency",
    "ectd_module_consistency": "$ectd_consistency",
    "source_fidelity": "$source_fidelity",
    "safety_pharmacology": "$safety_pharm"
  },
  "flags": [
$(if [[ -n "$flags" ]]; then
  echo "$flags" | grep -oP '(?<=  ⚠ ).*(?= —)' | while read -r dim; do
    echo "    \"$dim below threshold or parse failed\","
  done | sed '$ s/,$//'
else
  echo "    "
fi)
  ],
  "adversarial_ready": $ready,
  "workers_completed": ["accuracy", "ectd-mapping", "safety-pharm"]
}
EOF

  log "PRE_ADVERSARIAL_SCORECARD.json written."
  log "Done. Flags: $([ -z "$flags" ] && echo 'none' || echo 'SEE REPORT')"
}

log "Monitor started. Polling every ${POLL_INTERVAL}s for workers: accuracy, ectd-mapping, safety-pharm"

while true; do
  a_done=false; e_done=false; s_done=false

  worker_done "accuracy"   && a_done=true
  worker_done "ectd-mapping" && e_done=true
  worker_done "safety-pharm" && s_done=true

  log "Status — accuracy:$a_done  ectd-mapping:$e_done  safety-pharm:$s_done"

  if $a_done && $e_done && $s_done; then
    generate_reports
    log "Monitor exiting — all reports written to $METRICS_DIR"
    exit 0
  fi

  sleep "$POLL_INTERVAL"
done
