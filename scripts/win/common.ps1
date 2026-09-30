# Shared settings and helpers for the Windows scripts (dot-source it). Machine-specific values go in local.ps1
# next to this file (git-ignored), e.g.:
#   $env:MOSAIC_PG_PORT = "5434"; $env:MOSAIC_REDIS_PORT = "6380"
#   $env:MOSAIC_MODELS_CONFIG = "./models/models.7b-only.yaml"
$Repo = (Resolve-Path "$PSScriptRoot\..\..").Path
if (Test-Path "$PSScriptRoot\local.ps1") { . "$PSScriptRoot\local.ps1" }

function Get-Setting([string]$Name, [string]$Default) {
  $v = [Environment]::GetEnvironmentVariable($Name)
  if ($v) { $v } else { $Default }
}

$GatewayPort = Get-Setting "MOSAIC_GATEWAY_PORT" "8089"
$ConsolePort = Get-Setting "MOSAIC_CONSOLE_PORT" "3000"
$PgPort = Get-Setting "MOSAIC_PG_PORT" "5432"
$RedisPort = Get-Setting "MOSAIC_REDIS_PORT" "6379"
$ModelsConfig = Get-Setting "MOSAIC_MODELS_CONFIG" "./models/models.yaml"
$ChatModel = Get-Setting "MOSAIC_DEFAULT_CHAT_MODEL" "qwen2.5:7b-instruct"
$DemoDatabaseUrl = Get-Setting "MOSAIC_DEMO_DATABASE_URL" "postgresql+psycopg://mosaic:mosaic@127.0.0.1:$PgPort/mosaic"
$DemoRedisUrl = Get-Setting "MOSAIC_DEMO_REDIS_URL" "redis://127.0.0.1:$RedisPort/1"
$DemoDataUrl = Get-Setting "MOSAIC_DEMO_DATA_URL" "postgresql+psycopg://mosaic:mosaic@127.0.0.1:$PgPort/mosaic_demo_data"
$Gateway = "http://127.0.0.1:$GatewayPort"
$Logs = Join-Path $Repo ".data\logs"
New-Item -ItemType Directory -Force $Logs | Out-Null

function Test-Port([int]$Port) {
  [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-Http([string]$Url, [int]$Seconds = 90) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    try { Invoke-RestMethod $Url -TimeoutSec 2 | Out-Null; return $true } catch { Start-Sleep 1 }
  }
  $false
}

# The PowerShell window that hosts a process listening on $Port, if it was started by one of these scripts.
function Get-OwnWindow([int]$Port, [string]$Script) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) { return $null }
  $procs = Get-CimInstance Win32_Process
  $cur = $procs | Where-Object ProcessId -eq $listener.OwningProcess
  while ($cur -and $cur.Name -ne 'powershell.exe') { $cur = $procs | Where-Object ProcessId -eq $cur.ParentProcessId }
  if ($cur -and $cur.CommandLine -match [regex]::Escape($Script)) { $cur } else { $null }
}

function Stop-OwnWindow([int]$Port, [string]$Script) {
  $w = Get-OwnWindow $Port $Script
  if ($w) { taskkill /T /F /PID $w.ProcessId | Out-Null; "stopped $Script (window $($w.ProcessId))"; return $true }
  if (Test-Port $Port) { Write-Warning "port $Port is held by something that isn't $Script; not touching it" }
  $false
}

function Start-Window([string]$Script) {
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot $Script)
}
