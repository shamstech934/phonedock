$ErrorActionPreference = "Stop"
$paths = @(
  "src/app/api/[[...path]]/handlers/ai-research.ts",
  "src/lib/ai-research-worker.ts",
  "src/lib/ai-research-policy.ts",
  "src/lib/ai-enrichment.ts",
  "src/app/admin/ai-research"
)
foreach ($p in $paths) {
  if (Test-Path -LiteralPath $p) {
    Remove-Item -LiteralPath $p -Recurse -Force
    Write-Host "Removed $p"
  }
}
Write-Host "Stale AI Research cleanup complete. Now review changes, commit, and push."
