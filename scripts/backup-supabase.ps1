# Creates a timestamped local backup of the remote Supabase Postgres database.
#
# Prerequisites (pick one):
#   A) Set SUPABASE_DB_URL in .env.local (recommended)
#      Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)
#      Use the "Direct connection" string and replace [YOUR-PASSWORD] with the DB password.
#   B) Link the project and pass -Linked:
#      npx supabase login
#      npx supabase link --project-ref <your-project-ref>
#
# Usage:
#   .\scripts\backup-supabase.ps1
#   .\scripts\backup-supabase.ps1 -Linked
#   .\scripts\backup-supabase.ps1 -DbUrl "postgresql://postgres:...@db....supabase.co:5432/postgres"

param(
    [string]$DbUrl = $env:SUPABASE_DB_URL,
    [switch]$Linked,
    [string]$OutputRoot = "backups/supabase"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

function Load-DotEnv {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) {
            return
        }

        $eq = $line.IndexOf("=")
        if ($eq -lt 1) {
            return
        }

        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if (-not (Get-Item -Path "env:$name" -ErrorAction SilentlyContinue)) {
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

Load-DotEnv ".env.local"

function Encode-DbUrlPassword {
    param([string]$Url)

    if ($Url -notmatch '^(?<scheme>[a-z]+://)(?<user>[^:/@]+):(?<pass>[^@]*)@(?<rest>.+)$') {
        return $Url
    }

    $encodedPass = [uri]::EscapeDataString($matches['pass'])
    return "$($matches['scheme'])$($matches['user']):$encodedPass@$($matches['rest'])"
}

if (-not $DbUrl -and $env:SUPABASE_DB_URL) {
    $DbUrl = $env:SUPABASE_DB_URL
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "Backup directory: $backupDir"

# Snapshot migration history from the repo (schema-as-code baseline).
$migrationsSource = Join-Path $ProjectRoot "supabase/migrations"
if (Test-Path $migrationsSource) {
    $migrationsDest = Join-Path $backupDir "migrations"
    Copy-Item -Path $migrationsSource -Destination $migrationsDest -Recurse -Force
    Write-Host "Copied repo migrations -> $migrationsDest"
}

$dumpArgs = @("db", "dump", "--yes")

if ($Linked) {
    $dumpArgs += "--linked"
} elseif ($DbUrl) {
    $DbUrl = Encode-DbUrlPassword $DbUrl
    $dumpArgs += @("--db-url", $DbUrl)
} else {
    Write-Host ""
    Write-Host "Missing database connection." -ForegroundColor Red
    Write-Host "Add SUPABASE_DB_URL to .env.local, pass -DbUrl, or use -Linked after 'npx supabase link'."
    Write-Host ""
    Write-Host "Get the URI from: Supabase Dashboard -> Project Settings -> Database -> Connection string"
    exit 1
}

function Invoke-SupabaseDump {
    param(
        [string[]]$ExtraArgs,
        [string]$OutFile
    )

    $cliArgs = $dumpArgs + $ExtraArgs + @("--file", $OutFile)
    Write-Host "Dumping -> $OutFile"
    & npm.cmd exec --yes -- supabase @cliArgs
    if ($LASTEXITCODE -ne 0) {
        throw "supabase db dump failed for $OutFile (exit $LASTEXITCODE)"
    }
}

Invoke-SupabaseDump -ExtraArgs @() -OutFile (Join-Path $backupDir "schema.sql")
Invoke-SupabaseDump -ExtraArgs @("--data-only") -OutFile (Join-Path $backupDir "data.sql")
Invoke-SupabaseDump -ExtraArgs @("--data-only", "--schema", "auth") -OutFile (Join-Path $backupDir "auth-data.sql")

@(
    "Supabase local backup"
    "Created: $(Get-Date -Format o)"
    "Mode: $(if ($Linked) { 'linked project' } else { 'SUPABASE_DB_URL / -DbUrl' })"
    ""
    "Files:"
    "  schema.sql     - live remote schema (roles, extensions, tables, RLS, functions)"
    "  data.sql       - public + app schema data"
    "  auth-data.sql  - auth schema data (users, identities, sessions metadata)"
    "  migrations/    - copy of supabase/migrations from this repo at backup time"
    ""
    "Restore (manual, into a fresh Postgres/Supabase project):"
    "  1. psql ... -f schema.sql"
    "  2. psql ... -f data.sql"
    "  3. psql ... -f auth-data.sql"
    ""
    "Notes:"
    "  - Member photos live in Cloudflare R2, not Supabase Storage."
    "  - Auth password hashes restore into auth.users; test login after restore."
    "  - Re-apply Supabase dashboard settings (SMTP, auth providers, cron) manually."
) | Set-Content -Path (Join-Path $backupDir "README.txt") -Encoding UTF8

Write-Host ""
Write-Host "Backup complete." -ForegroundColor Green
Write-Host "Location: $backupDir"
