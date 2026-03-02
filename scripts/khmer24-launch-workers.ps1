# Khmer24 Multi-Terminal Scrape Launcher
#
# Opens multiple PowerShell terminals, each running a separate worker
# with its own proxy (if proxies.txt exists).
#
# Usage:
#   .\scripts\khmer24-launch-workers.ps1                        # discover + 3 workers
#   .\scripts\khmer24-launch-workers.ps1 -Workers 5             # discover + 5 workers
#   .\scripts\khmer24-launch-workers.ps1 -Workers 3 -Fast       # fast mode
#   .\scripts\khmer24-launch-workers.ps1 -SkipDiscover          # workers only (queue pre-filled)
#   .\scripts\khmer24-launch-workers.ps1 -MaxPages 100          # discover more pages
#
# Each worker pulls PENDING items from the shared DB queue — no duplication.
# Press Ctrl+C in any window to gracefully stop that worker.

param(
    [int]$Workers = 3,
    [int]$BatchSize = 20,
    [int]$MaxProcess = 99999,
    [int]$Cooldown = 5000,
    [switch]$Fast,
    [switch]$SkipDiscover,
    [int]$MaxPages = 50,
    [int]$MaxUrls = 5000
)

Set-Location "C:\dev\globescraper_nextjs"

# Load proxies if file exists
$proxies = @()
$proxyFile = "scripts\proxies.txt"
if (Test-Path $proxyFile) {
    $proxies = Get-Content $proxyFile | Where-Object { $_ -and $_ -notmatch "^#" } | ForEach-Object { $_.Trim() }
    Write-Host "Loaded $($proxies.Count) proxies from proxies.txt" -ForegroundColor Cyan
}

# Phase 1: Run discover to populate the queue (unless skipped)
if (-not $SkipDiscover) {
    Write-Host "`n=== Phase 1: Discovering listings ===" -ForegroundColor Yellow
    $discoverArgs = "npx tsx scripts/khmer24-scrape.ts --discover-only --max-pages $MaxPages --max-urls $MaxUrls"
    if ($proxies.Count -gt 0) {
        $discoverArgs += " --proxy $($proxies[0])"
    }
    if ($Fast) { $discoverArgs += " --fast" }
    Invoke-Expression $discoverArgs
    Write-Host "`n=== Discovery complete. Launching workers... ===" -ForegroundColor Yellow
} else {
    Write-Host "`nSkipping discovery (--SkipDiscover). Assuming queue already has items." -ForegroundColor DarkYellow
}

# Phase 2: Launch worker terminals
Write-Host "`nLaunching $Workers worker terminals..." -ForegroundColor Green

$logDir = "scripts\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

for ($i = 0; $i -lt $Workers; $i++) {
    $workerArgs = "npx tsx scripts/khmer24-scrape.ts --process-only --_worker --_worker-id $i --batch-size $BatchSize --max-process $([math]::Ceiling($MaxProcess / $Workers)) --batch-cooldown $Cooldown"

    if ($proxies.Count -gt 0) {
        $proxy = $proxies[$i % $proxies.Count]
        $workerArgs += " --proxy $proxy"
        $proxyLabel = $proxy -replace "//[^:]+:[^@]+@", "//***@"
        Write-Host "  Worker $i → proxy: $proxyLabel" -ForegroundColor DarkCyan
    } else {
        Write-Host "  Worker $i → no proxy (direct IP)" -ForegroundColor DarkYellow
    }

    if ($Fast) { $workerArgs += " --fast" }

    $logFile = "$logDir\khmer24-worker-$i-$(Get-Date -Format 'yyyy-MM-dd').log"

    # Launch in a new PowerShell window
    $title = "Khmer24 Worker $i"
    Start-Process powershell -ArgumentList @(
        "-NoProfile",
        "-Command",
        "Set-Location 'C:\dev\globescraper_nextjs'; `$Host.UI.RawUI.WindowTitle = '$title'; Write-Host 'Worker $i starting...' -ForegroundColor Green; $workerArgs 2>&1 | Tee-Object -FilePath '$logFile' -Append; Write-Host 'Worker $i finished.' -ForegroundColor Yellow; Read-Host 'Press Enter to close'"
    )

    # Stagger launches to avoid thundering herd
    Start-Sleep -Seconds 3
}

Write-Host "`n✅ All $Workers workers launched. Check the new terminal windows." -ForegroundColor Green
Write-Host "   Logs: scripts\logs\khmer24-worker-*-$(Get-Date -Format 'yyyy-MM-dd').log" -ForegroundColor DarkGray
Write-Host "`n   Press Ctrl+C in any worker window to stop it gracefully." -ForegroundColor DarkGray
