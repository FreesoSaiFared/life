[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$AccountId = 'd4204bfece1421ae859e5fba54c0a385'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Config = Join-Path $RepoRoot 'r\singularity\worker\wrangler.jsonc'

function Require-Env([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing protected environment variable: $Name"
    }
    return $value
}

$Wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
if (-not $Wrangler) {
    throw 'Authenticated Wrangler executable is not available on PATH.'
}

$whoami = (& $Wrangler.Source whoami 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) {
    throw 'wrangler whoami failed; restore the existing OAuth session before deployment.'
}
if ($whoami -notmatch [regex]::Escape($AccountId)) {
    throw "Wrangler is not authenticated to expected Cloudflare account $AccountId."
}

$GitHubToken = Require-Env 'SINGULARITY_GITHUB_TOKEN'
$ResendKey = Require-Env 'RESEND_API_KEY'
$ModeratorEmail = Require-Env 'MODERATOR_EMAIL'

Push-Location $RepoRoot
try {
    & $Wrangler.Source deploy --config $Config
    if ($LASTEXITCODE -ne 0) { throw 'Wrangler deploy failed.' }

    $GitHubToken | & $Wrangler.Source secret put GITHUB_TOKEN --config $Config
    if ($LASTEXITCODE -ne 0) { throw 'Failed to configure GITHUB_TOKEN.' }

    $ResendKey | & $Wrangler.Source secret put RESEND_API_KEY --config $Config
    if ($LASTEXITCODE -ne 0) { throw 'Failed to configure RESEND_API_KEY.' }

    $ModeratorEmail | & $Wrangler.Source secret put MODERATOR_EMAIL --config $Config
    if ($LASTEXITCODE -ne 0) { throw 'Failed to configure MODERATOR_EMAIL.' }

    $health = Invoke-RestMethod -Uri 'https://transductive.org/r/singularity/api/health' -Method Get -TimeoutSec 30
    if (-not $health.ok) { throw 'Public health returned ok=false.' }
    if (-not $health.contribution_configured) { throw 'Contribution secret is not active in production.' }
    if (-not $health.email_configured) { throw 'Email configuration is not active in production.' }

    $page = Invoke-WebRequest -Uri 'https://transductive.org/r/singularity/' -UseBasicParsing -TimeoutSec 30
    if ($page.StatusCode -ne 200) { throw "Reader HTTP status $($page.StatusCode)." }
    if ($page.Content -notmatch 'r/singularity') { throw 'Reader content marker missing.' }

    [pscustomobject]@{
        status = 'PRODUCTION_HTTP_ACCEPTED'
        account_id = $AccountId
        reader_status = $page.StatusCode
        health_ok = $health.ok
        contribution_configured = $health.contribution_configured
        email_configured = $health.email_configured
        checked_at = (Get-Date).ToString('o')
    } | ConvertTo-Json -Depth 4
}
finally {
    Pop-Location
}
