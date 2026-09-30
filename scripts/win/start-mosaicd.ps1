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
$Host.UI.RawUI.WindowTitle = "mosaicd :$GatewayPort"
$log = Join-Path $Logs "mosaicd.log"
"=== start $(Get-Date -Format s)" | Out-File -Encoding utf8 -Append $log
uv run mosaicd 2>&1 | ForEach-Object { "$_"; "$_" | Out-File -Encoding utf8 -Append $log }
