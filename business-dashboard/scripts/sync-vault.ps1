# sync-vault.ps1 — refresh the vault snapshot and (only if it changed) commit + push.
#
# Vercel can't read the local Obsidian vault, so this keeps the committed
# src/data/vault.json current. A push to `main` auto-deploys via the repo's
# Vercel Git integration (no `vercel --prod` needed while that stays connected).
#
# ── Install as an hourly scheduled task (run ONCE, from an elevated PowerShell): ──
#
#   schtasks /create /tn "SyncVault" /sc hourly `
#     /tr "powershell -NoProfile -ExecutionPolicy Bypass -File `"C:\Users\taylo\my-personal-dashboard\business-dashboard\scripts\sync-vault.ps1`""
#
#   # Force-run it once to confirm it produces a commit + redeploy:
#   schtasks /run /tn "SyncVault"
#   # Remove later with:  schtasks /delete /tn "SyncVault" /f
#
# Manual run:  powershell -ExecutionPolicy Bypass -File scripts\sync-vault.ps1

$ErrorActionPreference = "Stop"

# Resolve repo layout relative to this script: <repo root>/business-dashboard/scripts/
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir    = Split-Path -Parent $ScriptDir          # business-dashboard/
$RepoRoot  = Split-Path -Parent $AppDir             # my-personal-dashboard/ (git root)
$JsonRel   = "business-dashboard/src/data/vault.json"

Write-Host "[sync-vault] app dir : $AppDir"
Write-Host "[sync-vault] repo root: $RepoRoot"

# 1. Regenerate the snapshot. Stamp with the current local time so the JSON is stable
#    for this run. Node is invoked from the app dir so relative paths in the .mjs hold.
$Stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Push-Location $AppDir
try {
  $env:SYNC_STAMP = $Stamp
  node scripts/sync-vault.mjs
  if ($LASTEXITCODE -ne 0) { throw "sync-vault.mjs exited with code $LASTEXITCODE" }
}
finally {
  Remove-Item Env:SYNC_STAMP -ErrorAction SilentlyContinue
  Pop-Location
}

# 2. Commit + push only if vault.json actually changed. `git status --porcelain` is
#    empty when nothing changed, so we skip an empty commit and a needless redeploy.
Push-Location $RepoRoot
try {
  $changed = git status --porcelain -- $JsonRel
  if ([string]::IsNullOrWhiteSpace($changed)) {
    Write-Host "[sync-vault] no vault changes — nothing to commit."
    return
  }

  Write-Host "[sync-vault] vault.json changed — committing + pushing."
  git add -- $JsonRel
  git commit -m "chore: sync vault snapshot"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed ($LASTEXITCODE)" }
  git push
  if ($LASTEXITCODE -ne 0) { throw "git push failed ($LASTEXITCODE)" }
  Write-Host "[sync-vault] pushed — Vercel will redeploy from main."
}
finally {
  Pop-Location
}
