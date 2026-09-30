# Runs mosaicd with the demo settings (HANDOFF-KAMAL.md section 2.7) in this window; output is also written to
# .data/logs/mosaicd.log. The demo database is set here only, so tests (via .env) keep using mosaic_test.
. "$PSScriptRoot\common.ps1"
Set-Location $Repo
$env:MOSAIC_DEFAULT_MODE = "real"
$env:MOSAIC_OKF_DIR = "./data/okf"
$env:MOSAIC_DATA_DIR = "./.data/demo"
$env:MOSAIC_KNOWLEDGE_WATCH = "true"
$env:MOSAIC_SANDBOX_ENDPOINT = "port"
$env:MOSAIC_JIRA_URL = "inprocess"
$env:MOSAIC_DATABASE_URL = $DemoDatabaseUrl
$env:MOSAIC_REDIS_URL = $DemoRedisUrl
$env:MOSAIC_MODELS_CONFIG = $ModelsConfig
$env:MOSAIC_GATEWAY_PORT = $GatewayPort
$env:MOSAIC_URL = "http://localhost:$GatewayPort"
$env:PYTHONIOENCODING = "utf-8"
# Connector tokens are encrypted at rest with a key made on this machine on first start; it lives in .data (git-ignored)
# and never in the repo. Set MOSAIC_VAULT_KEY yourself to use another.
if (-not $env:MOSAIC_VAULT_KEY) {
    $keyFile = Join-Path $Repo ".data\vault.key"
    if (-not (Test-Path $keyFile)) {
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_") | Out-File -Encoding ascii -NoNewline $keyFile
    }
    $env:MOSAIC_VAULT_KEY = (Get-Content $keyFile -Raw).Trim()
}
$Host.UI.RawUI.WindowTitle = "mosaicd :$GatewayPort"
$log = Join-Path $Logs "mosaicd.log"
"=== start $(Get-Date -Format s)" | Out-File -Encoding utf8 -Append $log
uv run mosaicd 2>&1 | ForEach-Object { "$_"; "$_" | Out-File -Encoding utf8 -Append $log }
