$projectDir = "C:\Users\Hikariyuki\Documents\github\BesTechPortal"

$log = Join-Path $projectDir "dev.stdout.log"
$process = Start-Process `
  -FilePath="cloudflared.exe" `
  -ArgumentList="tunnel --url http://localhost:3000" `
  -RedirectStandardOutput $log `

