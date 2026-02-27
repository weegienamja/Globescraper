# run-daily-scrape.ps1 — Windows Task Scheduler wrapper
#
# Setup:
#   1. Open Task Scheduler → Create Basic Task
#   2. Trigger: Daily at your preferred time (e.g. 06:00)
#   3. Action: Start a program
#      Program: powershell.exe
#      Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\dev\globescraper_nextjs\scripts\run-daily-scrape.ps1"
#      Start in: C:\dev\globescraper_nextjs
#
# Logs are written to scripts/logs/daily-scrape-YYYY-MM-DD.log

Set-Location "C:\dev\globescraper_nextjs"

$logDir  = "scripts\logs"
$logFile = "$logDir\daily-scrape-$(Get-Date -Format 'yyyy-MM-dd').log"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

Write-Output "Starting daily scrape at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Tee-Object -FilePath $logFile -Append

npx tsx scripts/rentals_daily_scrape.ts 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Output "Finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Tee-Object -FilePath $logFile -Append
