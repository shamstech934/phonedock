#!/bin/bash
# Stage 1: Console.log/warn cleanup script
# Removes debug console.log/warn from admin pages, API handlers, client components
# PRESERVES console.error everywhere (important for production error tracking)

set -e
cd /home/z/my-project

echo "=== Stage 1: Console Cleanup ==="

# ── Admin Pages: Remove ALL console.log/warn (client-side debug) ──
ADMIN_FILES=(
  "src/app/admin/activity/page.tsx"
  "src/app/admin/brands/page.tsx"
  "src/app/admin/data-quality/page.tsx"
  "src/app/admin/news/page.tsx"
  "src/app/admin/phones/page.tsx"
  "src/app/admin/reviews/page.tsx"
  "src/app/admin/sponsors/page.tsx"
  "src/app/admin/sync/page.tsx"
  "src/app/admin/users/page.tsx"
  "src/app/admin/videos/page.tsx"
)

for f in "${ADMIN_FILES[@]}"; do
  if [ -f "$f" ]; then
    count_before=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    if [ "$count_before" -gt 0 ]; then
      # Remove entire lines containing console.log or console.warn
      sed -i '/console\.log(/d; /console\.warn(/d' "$f"
      count_after=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
      echo "  $f: removed $((count_before - count_after)) console statements"
    fi
  fi
done

# ── Client Component: phones/[slug]/page.tsx ──
f="src/app/phones/[slug]/page.tsx"
if [ -f "$f" ]; then
  count_before=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
  if [ "$count_before" -gt 0 ]; then
    sed -i '/console\.log(/d; /console\.warn(/d' "$f"
    count_after=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    echo "  $f: removed $((count_before - count_after)) console statements"
  fi
fi

# ── API Handlers: Remove console.log, keep console.error ──
API_FILES=(
  "src/app/api/[[...path]]/handlers/admin-auth.ts"
  "src/app/api/[[...path]]/handlers/admin-crud.ts"
  "src/app/api/[[...path]]/handlers/collector.ts"
  "src/app/api/[[...path]]/handlers/first-setup.ts"
  "src/app/api/[[...path]]/handlers/helpers.ts"
  "src/app/api/[[...path]]/handlers/import-v2.ts"
  "src/app/api/[[...path]]/handlers/import.ts"
  "src/app/api/[[...path]]/handlers/price-tracker.ts"
  "src/app/api/[[...path]]/route.ts"
  "src/app/api/[[...path]]/handlers/data-quality.ts"
)

for f in "${API_FILES[@]}"; do
  if [ -f "$f" ]; then
    count_before=$(rg "console\.log" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    if [ "$count_before" -gt 0 ]; then
      sed -i '/console\.log(/d' "$f"
      count_after=$(rg "console\.log" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
      echo "  $f: removed $((count_before - count_after)) console.log"
    fi
  fi
done

# ── Special: public.ts — remove success logs but keep error context ──
f="src/app/api/[[...path]]/handlers/public.ts"
if [ -f "$f" ]; then
  count_before=$(rg "console\.log" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
  if [ "$count_before" -gt 0 ]; then
    # Remove specific non-essential log lines
    sed -i "/console\.log('\[Contact\]/d" "$f"
    count_after=$(rg "console\.log" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    echo "  $f: removed $((count_before - count_after)) console.log"
  fi
fi

# ── cron-update-prices.ts — remove success log, keep SSRF warning ──
f="src/app/api/[[...path]]/handlers/cron-update-prices.ts"
if [ -f "$f" ]; then
  count_before=$(rg "console\.log" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
  if [ "$count_before" -gt 0 ]; then
    sed -i '/console\.log/d' "$f"
    count_after=$(rg "console\.log" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    echo "  $f: removed $((count_before - count_after)) console.log"
  fi
fi

# ── Lib files: Remove debug logs, keep connection/error logs ──

# mongodb.ts: Remove connection success log (fires on every cold start)
f="src/lib/mongodb.ts"
if [ -f "$f" ]; then
  sed -i "/console\.log('MongoDB connected successfully')/d" "$f"
  echo "  $f: removed MongoDB success log"
fi

# seed-data.ts: Keep warn (important), remove success log
f="src/lib/seed-data.ts"
if [ -f "$f" ]; then
  sed -i "/console\.log('\[seedPhones\]/d" "$f"
  echo "  $f: removed seed success log"
fi

# scanner.ts: Remove all console.log/warn
f="src/lib/data-quality/scanner.ts"
if [ -f "$f" ]; then
  count_before=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
  if [ "$count_before" -gt 0 ]; then
    sed -i '/console\.log(/d; /console\.warn(/d' "$f"
    count_after=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    echo "  $f: removed $((count_before - count_after)) console statements"
  fi
fi

# youtube.ts, mongodb-env.ts: remove console
for f in "src/lib/youtube.ts" "src/lib/mongodb-env.ts"; do
  if [ -f "$f" ]; then
    count_before=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
    if [ "$count_before" -gt 0 ]; then
      sed -i '/console\.log(/d; /console\.warn(/d' "$f"
      count_after=$(rg "console\.(log|warn)" "$f" --count-matches 2>/dev/null | awk -F: '{print $2}' || echo 0)
      echo "  $f: removed $((count_before - count_after)) console statements"
    fi
  fi
done

echo ""
echo "=== Remaining console.error (preserved) ==="
rg "console\.error" src/ --count-matches 2>/dev/null | sort -t: -k2 -rn | head -10

echo ""
echo "=== Remaining console.warn (preserved) ==="
rg "console\.warn" src/ --count-matches 2>/dev/null

echo ""
echo "=== Remaining console.log ==="
rg "console\.log" src/ --count-matches 2>/dev/null

TOTAL_REMAINING=$(rg "console\.(log|warn)" src/ --count-matches 2>/dev/null | awk -F: '{sum+=$2} END{print sum}')
echo ""
echo "Total console.log/warn remaining: $TOTAL_REMAINING"