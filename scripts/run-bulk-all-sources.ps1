# run-bulk-all-sources.ps1 — Scrape ALL enabled sources at maximum depth
#
# Runs rentals_bulk_scrape.ts once per source with no caps (max pages/URLs/process).
# Each source gets its own log file. The script runs sequentially so you don't
# hammer multiple sites at once.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-bulk-all-sources.ps1
#
# Or just right-click → Run with PowerShell

Set-Location "C:\dev\globescraper_nextjs"

$logDir  = "scripts\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$date    = Get-Date -Format 'yyyy-MM-dd'
$startTs = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

# All sources to scrape (in order). HomeToGo is excluded — it's a disabled stub.
$sources = @(
    "REALESTATE_KH",
    "KHMER24",
    "IPS_CAMBODIA",
    "CAMREALTY",
    "LONGTERMLETTINGS",
    "FAZWAZ"
)

$summaryLog = "$logDir\bulk-all-$date.log"

Write-Output "=== Bulk scrape ALL sources ===" | Tee-Object -FilePath $summaryLog
Write-Output "Started: $startTs" | Tee-Object -FilePath $summaryLog -Append
Write-Output "Sources: $($sources -join ', ')" | Tee-Object -FilePath $summaryLog -Append
Write-Output "" | Tee-Object -FilePath $summaryLog -Append

$totalSources = $sources.Count
$completed    = 0
$failed       = @()

foreach ($source in $sources) {
    $completed++
    $sourceLog = "$logDir\bulk-$source-$date.log"
    $sourceStart = Get-Date -Format 'HH:mm:ss'

    Write-Output "[$completed/$totalSources] Starting $source at $sourceStart ..." | Tee-Object -FilePath $summaryLog -Append

    try {
        npx tsx scripts/rentals_bulk_scrape.ts $source 2>&1 | Tee-Object -FilePath $sourceLog -Append

        if ($LASTEXITCODE -ne 0) {
            Write-Output "  WARNING: $source exited with code $LASTEXITCODE" | Tee-Object -FilePath $summaryLog -Append
            $failed += $source
        } else {
            Write-Output "  OK: $source finished at $(Get-Date -Format 'HH:mm:ss')" | Tee-Object -FilePath $summaryLog -Append
        }
    }
    catch {
        Write-Output "  ERROR: $source threw exception: $_" | Tee-Object -FilePath $summaryLog -Append
        $failed += $source
    }

    Write-Output "" | Tee-Object -FilePath $summaryLog -Append
}

# Summary
$endTs = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Write-Output "=== DONE ===" | Tee-Object -FilePath $summaryLog -Append
Write-Output "Finished: $endTs" | Tee-Object -FilePath $summaryLog -Append
Write-Output "Completed: $($totalSources - $failed.Count)/$totalSources sources" | Tee-Object -FilePath $summaryLog -Append

if ($failed.Count -gt 0) {
    Write-Output "Failed: $($failed -join ', ')" | Tee-Object -FilePath $summaryLog -Append
} else {
    Write-Output "All sources scraped successfully!" | Tee-Object -FilePath $summaryLog -Append
}

Write-Output ""
Write-Output "Logs saved to $logDir\"
Write-Output "  Summary: bulk-all-$date.log"
Write-Output "  Per-source: bulk-<SOURCE>-$date.log"
