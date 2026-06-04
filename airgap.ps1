# Air-gap pack / install helper for the CI Cyber Lab platform.
#
# Two modes — same script:
#
#   Online (internet-connected) Windows box:
#       .\airgap.ps1 -Mode Pack -Output E:\ci-cyber-lab-bundle
#     Downloads Node + PostgreSQL installers, copies the repo,
#     populates node_modules (so Prisma engines + every npm dep
#     come along), pre-builds the apps, writes a manifest, and
#     drops INSTALL.txt into the bundle. Eject and walk over.
#
#   Air-gapped Windows box (run as Administrator):
#       .\airgap.ps1 -Mode Install -Source E:\ci-cyber-lab-bundle -Target C:\ci-cyber-lab
#     Installs Node silently, runs the Postgres installer
#     (interactive so you pick the postgres password), copies
#     the repo into -Target, runs `prisma migrate deploy`, and
#     prints the start commands.
#
# Honest scope: this script is a starting point. Postgres
# password selection, firewall rules, choosing where to bind
# the API, TLS termination, and how to keep the service running
# are operator decisions — see AIRGAP-INSTALL.txt for the steps
# the script intentionally leaves to you.

[CmdletBinding()]
param(
    # Pack or Install. If omitted, the script prints usage and
    # exits — no interactive prompt (PowerShell's default prompt
    # confuses operators who haven't read AIRGAP-INSTALL.txt).
    [ValidateSet("Pack", "Install", "Help")]
    [string]$Mode,

    # Pack mode: where to write the bundle. Install mode: ignored.
    [string]$Output,

    # Install mode: where the bundle lives (USB root).
    # Pack mode: ignored.
    [string]$Source,

    # Install mode: where the platform should live on the
    # air-gapped box. Pack mode: ignored.
    [string]$Target,

    # Pack mode: Node.js Windows-x64 MSI URL. Defaults to the
    # LTS line the repo's engines field requires (>=20.11).
    # Override if you want a newer LTS.
    [string]$NodeMsiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi",

    # Pack mode: PostgreSQL Windows-x64 installer URL.
    # Override if you want a different major version.
    [string]$PostgresInstallerUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe",

    # Install mode: skip the silent Node install (useful if Node
    # is already installed and you only want repo + migrations).
    [switch]$SkipNode,

    # Install mode: skip the Postgres installer (useful if a DB
    # already exists; you'll be prompted for DATABASE_URL).
    [switch]$SkipPostgres,

    # Install mode: run the seed script after migrations.
    [switch]$Seed
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Stage([string]$m) {
    Write-Host ""
    Write-Host "==> $m" -ForegroundColor Cyan
}

function Write-Note([string]$m)  { Write-Host "    $m" -ForegroundColor DarkGray }
function Write-OK([string]$m)    { Write-Host "    $m" -ForegroundColor Green }
function Fail([string]$m)        { Write-Host "ERR: $m" -ForegroundColor Red; throw $m }

function Require-Tool([string]$exe, [string]$hint) {
    $found = Get-Command $exe -ErrorAction SilentlyContinue
    if (-not $found) { Fail "Required tool '$exe' not found. $hint" }
}

function Test-IsAdmin {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object System.Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

# `corepack enable` + `corepack prepare pnpm@... --activate` creates
# a pnpm shim, but the directory it lands in may not be on this
# PowerShell session's PATH (env changes don't propagate to a
# running session). Try, in order: PATH as-is, PATH refreshed from
# the registry, then known shim locations.
function Find-PnpmShim {
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $env:Path = `
        [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + `
        [Environment]::GetEnvironmentVariable("Path", "User")
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @()
    $corepack = Get-Command corepack -ErrorAction SilentlyContinue
    if ($corepack) {
        $candidates += (Join-Path (Split-Path $corepack.Source) "pnpm.cmd")
    }
    $candidates += (Join-Path $env:LOCALAPPDATA "node\corepack\shims\pnpm.cmd")
    $candidates += (Join-Path "$env:ProgramFiles\nodejs" "pnpm.cmd")
    $candidates += (Join-Path $env:APPDATA "npm\pnpm.cmd")
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

# ─── PACK ─────────────────────────────────────────────────────
function Invoke-Pack {
    if (-not $Output) { Fail "Pack mode needs -Output <path-to-bundle-dir>." }

    $repoRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) {
        Fail "Run this script from the repo root (no package.json found next to airgap.ps1)."
    }

    Require-Tool "node" "Install Node.js (>=20.11) and re-run."
    Require-Tool "npm"  "npm ships with Node. If missing, reinstall Node."

    # Bundle layout we're about to produce:
    #   $Output\manifest.json
    #   $Output\INSTALL.txt
    #   $Output\installers\node.msi
    #   $Output\installers\postgresql.exe
    #   $Output\repo\        (source + node_modules + prebuilt dist/.next)
    Write-Stage "Preparing bundle root at $Output"
    if (-not (Test-Path -LiteralPath $Output)) {
        New-Item -ItemType Directory -Path $Output | Out-Null
    }
    $installersDir = Join-Path $Output "installers"
    $repoDest      = Join-Path $Output "repo"
    New-Item -ItemType Directory -Force -Path $installersDir | Out-Null

    Write-Stage "Downloading Node.js installer"
    $nodePath = Join-Path $installersDir "node.msi"
    Write-Note "$NodeMsiUrl"
    Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $nodePath -UseBasicParsing
    Write-OK "Saved $nodePath ($([math]::Round((Get-Item $nodePath).Length / 1MB, 1)) MB)"

    Write-Stage "Downloading PostgreSQL installer"
    $pgPath = Join-Path $installersDir "postgresql.exe"
    Write-Note "$PostgresInstallerUrl"
    Invoke-WebRequest -Uri $PostgresInstallerUrl -OutFile $pgPath -UseBasicParsing
    Write-OK "Saved $pgPath ($([math]::Round((Get-Item $pgPath).Length / 1MB, 1)) MB)"

    Write-Stage "Refreshing repo dependencies (pnpm install + Prisma generate)"
    Push-Location $repoRoot
    try {
        # Originally this used `corepack enable` + `corepack prepare
        # pnpm@<v> --activate`, but on Windows `corepack enable`
        # writes shims to `C:\Program Files\nodejs\` which requires
        # admin; without admin it silently fails and leaves no pnpm
        # on PATH. `npm install -g` writes to %APPDATA%\npm which is
        # user-writable AND already on PATH after a standard Node
        # install — far more reliable.
        $pnpm = Find-PnpmShim
        if (-not $pnpm) {
            Write-Note "pnpm not found — installing via 'npm install -g pnpm@9.12.0'"
            & npm install -g "pnpm@9.12.0"
            if ($LASTEXITCODE -ne 0) { Fail "npm install -g pnpm failed." }
            $pnpm = Find-PnpmShim
        }
        if (-not $pnpm) {
            Fail @"
pnpm not found after 'npm install -g pnpm@9.12.0'.
%APPDATA%\npm should be on PATH after a standard Node install.
Check that 'npm config get prefix' returns a writable directory
on PATH, then re-run.
"@
        }
        Write-Note "pnpm at $pnpm"
        # Clear any half-finished state from a prior failed run.
        # pnpm's "rename to .ignored_<dep>" step fails noisily if a
        # previous install was interrupted; starting clean avoids it.
        # The pnpm content-addressable store is elsewhere so we're
        # not throwing away any download work.
        $repoNm  = Join-Path $repoRoot "node_modules"
        $apiNm   = Join-Path $repoRoot "apps\api\node_modules"
        $webNm   = Join-Path $repoRoot "apps\web\node_modules"
        $cntrNm  = Join-Path $repoRoot "packages\contracts\node_modules"
        foreach ($p in @($repoNm, $apiNm, $webNm, $cntrNm)) {
            if (Test-Path -LiteralPath $p) {
                Write-Note "Removing $p (clean slate for pnpm install)"
                Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        # Quick filesystem sanity check: pnpm requires NTFS-style
        # symlinks for its node_modules layout. FAT32 / exFAT
        # silently corrupt the install.
        $repoDrive = (Get-Item $repoRoot).PSDrive.Name
        $vol = Get-Volume -DriveLetter $repoDrive -ErrorAction SilentlyContinue
        if ($vol -and $vol.FileSystemType -notin @("NTFS", "ReFS")) {
            Write-Host "WARN: drive ${repoDrive}: filesystem is $($vol.FileSystemType); pnpm needs NTFS." -ForegroundColor Yellow
            Write-Host "      If install fails, move the repo to an NTFS volume and re-run." -ForegroundColor Yellow
        }

        & $pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed." }
        # Prisma engines land in node_modules during postinstall;
        # build the contracts + apps so the bundle ships ready-to-run.
        & $pnpm --filter "@ci-train/contracts" build
        if ($LASTEXITCODE -ne 0) { Fail "contracts build failed." }
        & $pnpm --filter "@ci-train/api" prisma:generate
        if ($LASTEXITCODE -ne 0) { Fail "prisma generate failed." }
        & $pnpm --filter "@ci-train/api" build
        if ($LASTEXITCODE -ne 0) { Fail "api build failed." }
        & $pnpm --filter "@ci-train/web" build
        if ($LASTEXITCODE -ne 0) { Fail "web build failed." }
    } finally {
        Pop-Location
    }
    Write-OK "Dependencies + builds ready."

    Write-Stage "Copying repo into bundle (this is the slow part)"
    # robocopy with default symlink-follow behaviour: pnpm uses NTFS
    # symlinks for node_modules/<pkg> → node_modules/.pnpm/... and we
    # WANT robocopy to dereference those so the bundle is self-
    # contained on the air-gapped box. /MIR mirrors; /R:1 /W:1 keeps
    # it from stalling on a locked file; /NFL /NDL /NP /NJH /NJS
    # keeps stdout quiet.
    $excluded = @(
        "/XD", ".git", ".next\cache", "deploy", "out", ".turbo",
        "/XF", ".env", ".env.local", ".env.production"
    )
    $rcArgs = @($repoRoot, $repoDest, "/MIR", "/R:1", "/W:1",
                "/NFL", "/NDL", "/NP", "/NJH", "/NJS") + $excluded
    & robocopy @rcArgs | Out-Null
    # robocopy exit codes 0-7 are success; >=8 is failure.
    if ($LASTEXITCODE -ge 8) { Fail "robocopy failed with code $LASTEXITCODE" }
    Write-OK "Repo copied to $repoDest"

    Write-Stage "Writing manifest + INSTALL.txt"
    $manifest = [pscustomobject]@{
        bundle_version   = "1"
        packed_at_utc    = (Get-Date).ToUniversalTime().ToString("o")
        node_msi_url     = $NodeMsiUrl
        postgres_url     = $PostgresInstallerUrl
        repo_remote      = (git -C $repoRoot config --get remote.origin.url 2>$null)
        repo_branch      = (git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null)
        repo_commit      = (git -C $repoRoot rev-parse HEAD 2>$null)
    }
    $manifest | ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath (Join-Path $Output "manifest.json") -Encoding UTF8

    $instructionsSrc = Join-Path $repoRoot "AIRGAP-INSTALL.txt"
    if (Test-Path -LiteralPath $instructionsSrc) {
        Copy-Item -LiteralPath $instructionsSrc -Destination (Join-Path $Output "INSTALL.txt") -Force
    } else {
        Write-Note "AIRGAP-INSTALL.txt not found at repo root — bundle will not include operator instructions."
    }

    Write-Stage "Bundle complete"
    Write-OK "Bundle: $Output"
    Write-OK "Eject the drive, walk it to the air-gapped box, and run:"
    Write-Note "    .\airgap.ps1 -Mode Install -Source <bundle-path> -Target C:\ci-cyber-lab"
}

# ─── INSTALL ──────────────────────────────────────────────────
function Invoke-Install {
    if (-not $Source) { Fail "Install mode needs -Source <bundle-path>." }
    if (-not $Target) { Fail "Install mode needs -Target <install-path>." }
    if (-not (Test-IsAdmin)) {
        Fail "Install mode needs an elevated PowerShell (Run as Administrator)."
    }

    $manifestPath = Join-Path $Source "manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        Fail "manifest.json not found under $Source — is this the right path?"
    }

    if (-not $SkipNode) {
        Write-Stage "Installing Node.js (silent)"
        $nodeMsi = Join-Path $Source "installers\node.msi"
        if (-not (Test-Path -LiteralPath $nodeMsi)) { Fail "node.msi missing in bundle." }
        # ADDLOCAL=ALL pulls in npm + corepack; /qn = quiet.
        $p = Start-Process -FilePath msiexec.exe `
            -ArgumentList @("/i", "`"$nodeMsi`"", "/qn", "/norestart", "ADDLOCAL=ALL") `
            -Wait -PassThru
        if ($p.ExitCode -ne 0) { Fail "Node MSI returned $($p.ExitCode)." }
        Write-OK "Node installed."
        # PATH won't have refreshed for this session; reach into the
        # standard install path so subsequent commands resolve.
        $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
    } else {
        Write-Note "Skipping Node install per -SkipNode."
    }

    if (-not $SkipPostgres) {
        Write-Stage "Running PostgreSQL installer (interactive — choose the postgres password)"
        $pgExe = Join-Path $Source "installers\postgresql.exe"
        if (-not (Test-Path -LiteralPath $pgExe)) { Fail "postgresql.exe missing in bundle." }
        Write-Note "When the installer asks: remember the postgres-user password —"
        Write-Note "you'll paste it into DATABASE_URL in a moment."
        $p = Start-Process -FilePath $pgExe -Wait -PassThru
        if ($p.ExitCode -ne 0) { Fail "Postgres installer returned $($p.ExitCode)." }
        Write-OK "PostgreSQL installed."
    } else {
        Write-Note "Skipping Postgres install per -SkipPostgres."
    }

    Write-Stage "Copying repo into $Target"
    if (-not (Test-Path -LiteralPath $Target)) {
        New-Item -ItemType Directory -Path $Target | Out-Null
    }
    $repoSrc = Join-Path $Source "repo"
    if (-not (Test-Path -LiteralPath $repoSrc)) { Fail "$repoSrc not found in bundle." }
    $rcArgs = @($repoSrc, $Target, "/MIR", "/R:1", "/W:1",
                "/NFL", "/NDL", "/NP", "/NJH", "/NJS")
    & robocopy @rcArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "robocopy failed with code $LASTEXITCODE" }
    Write-OK "Repo at $Target"

    Write-Stage "DATABASE_URL configuration"
    $existingEnv = Join-Path $Target "apps\api\.env"
    if (Test-Path -LiteralPath $existingEnv) {
        Write-Note "apps\api\.env already exists. Skipping prompt; edit it by hand if needed."
    } else {
        $dbUrl = Read-Host "Paste the DATABASE_URL (e.g. postgresql://postgres:PASSWORD@localhost:5432/ci_cyber_lab)"
        if (-not $dbUrl) { Fail "DATABASE_URL is required to run migrations." }
        Set-Content -LiteralPath $existingEnv -Value "DATABASE_URL=$dbUrl" -Encoding UTF8
        Write-OK "Wrote $existingEnv"
    }

    Write-Stage "Applying Prisma migrations"
    Push-Location (Join-Path $Target "apps\api")
    try {
        # node_modules was bundled, so prisma's CLI + engines are
        # already on disk; no online resolution needed.
        & node "node_modules\prisma\build\index.js" migrate deploy
        if ($LASTEXITCODE -ne 0) { Fail "prisma migrate deploy failed." }
    } finally {
        Pop-Location
    }
    Write-OK "Migrations applied."

    if ($Seed) {
        Write-Stage "Seeding content"
        Push-Location (Join-Path $Target "apps\api")
        try {
            # cd into apps\api so the seed picks up .env and uses
            # the api package's local node_modules.
            & node "dist\scripts\seed.js"
            if ($LASTEXITCODE -ne 0) { Fail "seed failed." }
        } finally {
            Pop-Location
        }
        Write-OK "Seed complete."
    } else {
        Write-Note "Skipping seed. Re-run with -Seed if you want to populate the catalog."
    }

    Write-Stage "Done"
    Write-Host @"
The platform is installed at $Target.

To start the API (port 4000):
    cd $Target\apps\api
    node dist\main.js

To start the web app (port 3000):
    cd $Target\apps\web
    node node_modules\next\dist\bin\next start -p 3000

See AIRGAP-INSTALL.txt (also copied into the bundle root) for
how to run these as services, set the admin password, and
verify the install.
"@ -ForegroundColor Green
}

function Show-Usage {
    Write-Host @"

CI Cyber Lab — air-gap pack / install helper
============================================

You must supply -Mode. Two modes:

  Pack   — on the internet-connected Windows box, build a USB bundle.
  Install— on the air-gapped Windows box (elevated), consume the bundle.

Quick start:

  Online box:
      .\airgap.ps1 -Mode Pack -Output E:\ci-cyber-lab-bundle

      Defaults are fine. Adds ~330 MB to the USB; takes 10-30 min.

  Air-gapped box (Run PowerShell as Administrator):
      .\airgap.ps1 -Mode Install -Source E:\ci-cyber-lab-bundle -Target C:\ci-cyber-lab -Seed

      Use -SkipNode if Node is already installed.
      Use -SkipPostgres if a Postgres server already exists.

Full walkthrough + troubleshooting:
  AIRGAP-INSTALL.txt (next to this script, also copied into the
  bundle root after a Pack run).

For the full parameter list:
  Get-Help .\airgap.ps1 -Detailed

"@ -ForegroundColor Yellow
}

# ─── dispatch ─────────────────────────────────────────────────
if (-not $Mode -or $Mode -eq "Help") {
    Show-Usage
    return
}
switch ($Mode) {
    "Pack"    { Invoke-Pack }
    "Install" { Invoke-Install }
}
