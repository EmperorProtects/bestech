# Демо портала через ngrok: туннель → портал → (по желанию) пульт показаний.
# Порядок важен: сначала поднимается туннель, потом портал получает публичный хост
# в BESTECH_PUBLIC_HOST — без него Next отклоняет вход и загрузку файлов как межсайтовые.
#
#   .\scripts\demo-ngrok.ps1                      # туннель + портал, опрос 6 с
#   .\scripts\demo-ngrok.ps1 -Console             # ещё и пульт на localhost:4000
#   .\scripts\demo-ngrok.ps1 -Domain my.ngrok-free.app   # постоянный адрес аккаунта
#   .\scripts\demo-ngrok.ps1 -Stop                # остановить всё, что подняли

[CmdletBinding()]
param(
    [int]$Port = 3000,
    [string]$Domain = '',
    [int]$PollMs = 6000,
    [switch]$Console,
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logDir'
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }

function Stop-Demo {
    foreach ($name in 'ngrok', 'node') {
        Get-CimInstance Win32_Process -Filter "Name='$name.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match 'ngrok http|next dev|next start|sensor-console|server\.mjs' } |
            ForEach-Object {
                Write-Output "останавливаю $($_.Name) pid $($_.ProcessId)"
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
    }
}

if ($Stop) { Stop-Demo; Write-Output 'демо остановлено'; exit 0 }

# ── 1. Туннель ───────────────────────────────────────────────────────────
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Output 'ngrok не найден в PATH. Установите: winget install Ngrok.Ngrok'
    exit 1
}

$ngrokArgs = @('http', "$Port", '--log', 'stdout')
if ($Domain) { $ngrokArgs += @('--domain', $Domain) }
Start-Process -FilePath 'ngrok' -ArgumentList $ngrokArgs -WindowStyle Minimized `
    -RedirectStandardOutput (Join-Path $logs 'ngrok.log') -RedirectStandardError (Join-Path $logs 'ngrok.err.log')

$public = $null
for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Seconds 1
    try {
        $api = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
        $https = $api.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1
        if ($https) { $public = $https.public_url; break }
    } catch {}
}
if (-not $public) {
    Write-Output 'не удалось получить адрес туннеля. Логи: logDir\ngrok.log и logDir\ngrok.err.log'
    Write-Output 'частая причина: не задан токен — выполните: ngrok config add-authtoken <ваш токен>'
    exit 1
}
$host_only = ($public -replace '^https?://', '')

# ── 2. Портал ────────────────────────────────────────────────────────────
$env:BESTECH_PUBLIC_HOST = $host_only
$env:NEXT_PUBLIC_BESTECH_LIVE_POLL_MS = "$PollMs"
Start-Process -FilePath 'pnpm.cmd' -ArgumentList @('--filter', '@bestech/portal', 'dev') -WorkingDirectory $root -WindowStyle Minimized `
    -RedirectStandardOutput (Join-Path $logs 'portal.log') -RedirectStandardError (Join-Path $logs 'portal.err.log')

$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        if ((Invoke-WebRequest "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 30).StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}

# ── 3. Пульт показаний (по желанию, остаётся локальным) ──────────────────
if ($Console) {
    Start-Process -FilePath 'pnpm.cmd' -ArgumentList @('--filter', '@bestech/sensor-console', 'start') -WorkingDirectory $root -WindowStyle Minimized `
        -RedirectStandardOutput (Join-Path $logs 'console.log') -RedirectStandardError (Join-Path $logs 'console.err.log')
}

# ── 4. Итог ──────────────────────────────────────────────────────────────
Write-Output ''
Write-Output '─────────────────────────────────────────────'
Write-Output "Ссылка клиенту:   $public/login"
Write-Output "Двойник:          $public/twin/2026-014"
Write-Output "Портал локально:  http://localhost:$Port"
if ($Console) { Write-Output "Пульт (только вам): http://localhost:4000" }
Write-Output "Опрос экранов:    $PollMs мс"
Write-Output "Портал отвечает:  $ready"
Write-Output '─────────────────────────────────────────────'
Write-Output 'Перед показом:'
Write-Output '  1. Откройте ссылку сами и нажмите Visit Site — ngrok показывает заглушку первому посетителю.'
Write-Output '  2. Не закрывайте эту машину и сессию: туннель живёт, пока работают процессы.'
Write-Output '  3. Остановить всё: .\scripts\demo-ngrok.ps1 -Stop'
Write-Output 'Логи: logDir\portal.log, logDir\ngrok.log'
