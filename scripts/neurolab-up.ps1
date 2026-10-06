<#
 Start (or repair) the NeuroLab stack and publish it on the tailnet.
   .\scripts\neurolab-up.ps1                 # up + tailscale serve on :10000
   .\scripts\neurolab-up.ps1 -TailscalePort 8444
   .\scripts\neurolab-up.ps1 -NoTailscale
#>
param(
  [int]$TailscalePort = 10000,
  [switch]$NoTailscale,
  [switch]$NoBuild
)
$ErrorActionPreference = "Stop"
function Test-Docker { cmd /c "docker info >nul 2>&1"; return ($LASTEXITCODE -eq 0) }
Set-Location (Split-Path $PSScriptRoot -Parent)

# Start Docker Desktop if the engine is not answering.
if (-not (Test-Docker)) {
  $exe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $exe)) { throw "Docker Desktop not found" }
  Start-Process $exe
  Write-Host "Waiting for Docker engine..."
  for ($i = 0; $i -lt 60 -and -not (Test-Docker); $i++) { Start-Sleep 5 }
  if (-not (Test-Docker)) { throw "Docker engine did not come up" }
}

# A dangling credential helper in ~/.docker/config.json breaks image pulls; use a clean temp config for this run only.
$cfg = Get-Content "$HOME\.docker\config.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($cfg.credsStore -and -not (Get-Command "docker-credential-$($cfg.credsStore)" -ErrorAction SilentlyContinue)) {
  $tmp = Join-Path $env:TEMP "neurolab-docker-config"
  New-Item -ItemType Directory -Force $tmp | Out-Null
  '{"auths":{}}' | Set-Content "$tmp\config.json" -Encoding ascii
  foreach ($d in "contexts", "cli-plugins") { if (Test-Path "$HOME\.docker\$d") { Copy-Item "$HOME\.docker\$d" "$tmp\$d" -Recurse -Force } }
  $env:DOCKER_CONFIG = $tmp
  Write-Host "credsStore '$($cfg.credsStore)' missing; using temporary Docker config."
}

$ErrorActionPreference = "Continue"
if ($NoBuild) { docker compose up -d 2>&1 | Out-Host } else { docker compose up -d --build 2>&1 | Out-Host }
if ($LASTEXITCODE -ne 0) { throw "docker compose failed" }
$ErrorActionPreference = "Stop"

if (-not $NoTailscale) {
  tailscale serve --bg --https=$TailscalePort http://127.0.0.1:3005 | Out-Null
  $dns = (tailscale status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.')
  Write-Host "NeuroLab: https://${dns}:$TailscalePort/"
}
Write-Host "Local:    http://localhost:3005/"
