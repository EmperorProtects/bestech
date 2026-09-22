$projectDir = "C:\Users\Hikariyuki\Documents\github\BesTechPortal"
$port = 3000
$consolePort = 4000
echo $projectDir

$logDir = Join-Path $projectDir "logDir"
echo $logDir

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Stop old tunnels of this project (matched by their --url argument)
Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" |
    Where-Object { $_.CommandLine -match "--url http://localhost:($port|$consolePort)\b" } |
    ForEach-Object {
        Write-Host "Stopping old tunnel (PID $($_.ProcessId)): $($_.CommandLine)"
        Stop-Process -Id $_.ProcessId -Force
    }

# Stop old dev server / console holding the ports (otherwise EADDRINUSE)
foreach ($p in $port, $consolePort) {
    $listeners = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($procId in ($listeners.OwningProcess | Select-Object -Unique)) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
        # the console runs as a bare "node server.mjs" (no project path in its command line)
        $isOurs = $owner.CommandLine -like "*$projectDir*" -or
            ($p -eq $consolePort -and $owner.CommandLine -match '\bserver\.mjs\b')
        if ($owner -and $isOurs) {
            Write-Host "Port $p is held by an old process (PID $procId), stopping it"
            taskkill /PID $procId /T /F | Out-Null
        }
        elseif ($owner) {
            Write-Host "Port $p is used by another app: $($owner.Name) (PID $procId). Aborting."
            exit 1
        }
    }
    if ($listeners) { Start-Sleep -Seconds 1 }
}

$mainOutLog= Join-Path $logDir "dev.stdout.log"
$mainErrLog = Join-Path $logDir "dev.stderr.log"

$consoleOutLog = Join-Path $logDir "console.stdout.log"
$consoleErrLog= Join-Path $logDir "console.stderr.log"


$mainProcess = Start-Process `
    -FilePath "pnpm.cmd" `
    -ArgumentList "dev" `
    -WorkingDirectory $projectDir `
    -RedirectStandardOutput $mainOutLog `
    -RedirectStandardError $mainErrLog `
    -PassThru

$consoleProcess = Start-Process `
    -FilePath "pnpm.cmd" `
    -ArgumentList "console" `
    -WorkingDirectory $projectDir `
    -RedirectStandardOutput $consoleOutLog `
    -RedirectStandardError $consoleErrLog `
    -PassThru
    

Write-Host "pnpm dev started. PID $($mainProcess.Id), http://localhost:$port"
Write-Host "Logs: $logDir"


$startedAt = Get-Date 
$ready = $false


while (((Get-Date) - $startedAt).TotalSeconds -lt 60) {
  Start-Sleep -Seconds 1
  $connection = Test-NetConnection `
      -ComputerName localhost `
      -port $port `
      -WarningAction SilentlyContinue `

  if ($connection.TcpTestSucceeded) {
    $ready = $true
    break
  }
}

if($ready){
  Write-Host "Done! http://localhost:$port"

  $cloudflareMainOutLog= Join-Path $logDir "cloudflareMain.stdout.log"
  $cloudflareMainErrLog = Join-Path $logDir "cloudflareMain.stderr.log"

  $cloudflareConsoleOutLog = Join-Path $logDir "cloudflareConsole.stdout.log"
  $cloudflareConsoleErrLog = Join-Path $logDir "cloudflareConsole.stderr.log"
  $cloudFlareMain = Start-Process `
      -FilePath "cloudflared.exe" `
      -ArgumentList @("tunnel", "--url", "http://localhost:$port") `
      -WorkingDirectory $projectDir `
      -RedirectStandardOutput $cloudflareMainOutLog `
      -RedirectStandardError $cloudflareMainErrLog `
      -PassThru


  $cloudFlareConsole = Start-Process `
      -FilePath "cloudflared.exe" `
      -ArgumentList @("tunnel", "--url", "http://localhost:$consolePort") `
      -WorkingDirectory $projectDir `
      -RedirectStandardOutput $cloudflareConsoleOutLog `
      -RedirectStandardError $cloudflareConsoleErrLog `
      -PassThru

    function Get-CloudflareUrl {
      param (
          [string]$LogFile,
          [int]$TimeoutSeconds = 30
          )
      $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

      while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        if (Test-Path $LogFile) {
          $content = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue

            $match = [regex]::Match(
                $content,
                'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
                )

            if ($match.Success) {
              return $match.Value
            }
        }

        Start-Sleep -Milliseconds 500
      }

      return $null
    }

  $mainUrl = Get-CloudflareUrl $cloudflareMainErrLog
  $consoleUrl = Get-CloudflareUrl $cloudflareConsoleErrLog

  if ($mainUrl) {
      Write-Host "Main tunnel:    $mainUrl"
  }
  else {
      Write-Warning "Не удалось получить URL для порта $port"
  }

  if ($consoleUrl) {
      Write-Host "Console tunnel: $consoleUrl"
  }
  else {
      Write-Warning "Не удалось получить URL для порта $consolePort"
  }
}
else {
  Write-Error "Error occuried"
  Write-Host "`nSTDOUT:"
  Get-Content $mainOutLog -Tail 30
  Write-Host "`nSTDERR"
  Get-Content $mainErrLog -Tail 30
  taskkill /PID $mainProcess.Id /T /F 2>$null | Out-Null
  taskkill /PID $consoleProcess.Id /T /F 2>$null | Out-Null
  exit 1
}
