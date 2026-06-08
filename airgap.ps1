# Air-gap pack / install helper for the CI Cyber Lab platform.
#
# Two modes -- same script:
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
# are operator decisions -- see AIRGAP-INSTALL.txt for the steps
# the script intentionally leaves to you.

[CmdletBinding()]
param(
    # Pack or Install. If omitted, the script prints usage and
    # exits -- no interactive prompt (PowerShell's default prompt
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
    # LTS line where `require(esm)` is on by default (>=22.12 --
    # the platform's contracts package is ESM, and the seed step
    # requires it from CommonJS, so older Node aborts with
    # ERR_REQUIRE_ESM).
    [string]$NodeMsiUrl = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi",

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
    [switch]$Seed,

    # Install mode: email + password to seed the first admin with
    # so operators don't have to scrollback for a random password.
    # MUST be changed on first login. Override either to bake a
    # different default into your deploy.
    [string]$AdminEmail = "admin@example.local",
    [string]$AdminPassword = "CICyberLab-Admin-1",

    # Install mode: re-copy the bundle's repo over the target even
    # if the target already has a built repo (default skips the
    # copy in that case to speed up troubleshooting re-runs).
    [switch]$ForceRepoCopy,

    # Install mode: ports the printed start commands tell the
    # operator to bind to, AND the defaults baked into the
    # generated start.ps1 helper.
    [int]$ApiPort = 4000,
    [int]$WebPort = 3000,

    # Install mode: spawn the API + web in their own PowerShell
    # windows immediately after the Done banner, so the operator
    # doesn't have to start them manually. Without this, the
    # install just writes start.ps1 into -Target and prints the
    # commands.
    [switch]$AutoStart
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

# Resolve a module's bin entry via Node's own resolution from a
# specific cwd. Returns the absolute path or $null. Used so the
# install side finds `prisma` / `next` wherever pnpm's hoisted
# install put them (workspace root vs per-workspace node_modules).
function Resolve-ModuleBin {
    param(
        [Parameter(Mandatory)][string]$Cwd,
        [Parameter(Mandatory)][string]$RelativePath
    )
    Push-Location $Cwd
    try {
        $resolved = & node -e "try{console.log(require.resolve('$RelativePath'))}catch{process.exit(2)}" 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $resolved) { return $null }
        return $resolved
    } finally {
        Pop-Location
    }
}

# Locate pnpm. Installed via `npm install -g pnpm@<v>` (see
# Invoke-Pack) which writes a shim to %APPDATA%\npm. That dir is
# already on PATH after a standard Node install, but the running
# PowerShell session was started before npm ran, so plain `pnpm`
# can still miss until PATH refreshes. Try, in order: PATH as-is,
# PATH refreshed from the registry, then known shim locations.
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

# Pack: downloads the Node MSI + Postgres EXE into the bundle.
function Save-PackInstallers {
    param([string]$InstallersDir)
    Write-Stage "Downloading Node.js installer"
    $nodePath = Join-Path $InstallersDir "node.msi"
    Write-Note "$NodeMsiUrl"
    Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $nodePath -UseBasicParsing
    Write-OK "Saved $nodePath ($([math]::Round((Get-Item $nodePath).Length / 1MB, 1)) MB)"

    Write-Stage "Downloading PostgreSQL installer"
    $pgPath = Join-Path $InstallersDir "postgresql.exe"
    Write-Note "$PostgresInstallerUrl"
    Invoke-WebRequest -Uri $PostgresInstallerUrl -OutFile $pgPath -UseBasicParsing
    Write-OK "Saved $pgPath ($([math]::Round((Get-Item $pgPath).Length / 1MB, 1)) MB)"
}

# Pack: ensures pnpm is available, returns the absolute shim path.
function Initialize-PackPnpm {
    $pnpm = Find-PnpmShim
    if (-not $pnpm) {
        Write-Note "pnpm not found -- installing via 'npm install -g pnpm@9.12.0'"
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
    return $pnpm
}

# Pack: clean install + production builds. Includes the temporary
# next.config.js standalone-disable so the web build doesn't need
# admin / Developer Mode for NTFS symlinks. Restores on the way out.
function Invoke-PackBuilds {
    param([string]$RepoRoot, [string]$Pnpm)

    # Clear any half-finished state from a prior failed run.
    # pnpm's "rename to .ignored_<dep>" step fails noisily if a
    # previous install was interrupted; starting clean avoids it.
    # The pnpm content-addressable store is elsewhere so we're
    # not throwing away any download work.
    $nodeModuleDirs = @(
        (Join-Path $RepoRoot "node_modules"),
        (Join-Path $RepoRoot "apps\api\node_modules"),
        (Join-Path $RepoRoot "apps\web\node_modules"),
        (Join-Path $RepoRoot "packages\contracts\node_modules")
    )
    foreach ($p in $nodeModuleDirs) {
        if (Test-Path -LiteralPath $p) {
            Write-Note "Removing $p (clean slate for pnpm install)"
            # `cmd /c rmdir /s /q` is 5-10x faster than
            # Remove-Item -Recurse -Force on large directory trees
            # because it skips PowerShell's per-file provider
            # marshaling. Stderr suppressed because rmdir is chatty
            # on locked files; result implicitly verified by the
            # Test-Path on the next iteration.
            & cmd /c "rmdir /s /q `"$p`"" 2>$null
        }
    }

    # node-linker=hoisted: install in a flat node_modules layout
    # (npm-style), not pnpm's default .pnpm/ virtual store. This
    # is the form that survives a robocopy intact -- pnpm's
    # default layout uses symlinks for transitive-dep resolution,
    # which break after robocopy dereferences them and lead to
    # "Cannot find module '@prisma/engines'" at runtime on the
    # install target.
    & $Pnpm install --frozen-lockfile --config.node-linker=hoisted
    if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed." }
    & $Pnpm --filter "@ci-train/contracts" build
    if ($LASTEXITCODE -ne 0) { Fail "contracts build failed." }
    & $Pnpm --filter "@ci-train/api" prisma:generate
    if ($LASTEXITCODE -ne 0) { Fail "prisma generate failed." }
    & $Pnpm --filter "@ci-train/api" build
    if ($LASTEXITCODE -ne 0) { Fail "api build failed." }

    # Next.js's `output: "standalone"` build step creates real
    # NTFS symlinks under apps/web/.next/standalone/, which
    # requires admin (or Developer Mode) on Windows. Pack mode
    # shouldn't need admin, and we don't NEED the standalone
    # bundle -- Install mode runs `next start` against the
    # regular .next/ directory. Temporarily disable standalone
    # for this build and restore the config afterward.
    $webConfig = Join-Path $RepoRoot "apps\web\next.config.js"
    $webConfigBackup = "$webConfig.airgap-backup"
    $standaloneDisabled = $false
    if (Test-Path -LiteralPath $webConfig) {
        $original = Get-Content -LiteralPath $webConfig -Raw
        $patched = $original -replace 'output:\s*["'']standalone["''],?', '// airgap: standalone disabled (Windows symlinks need admin)'
        if ($patched -ne $original) {
            Copy-Item -LiteralPath $webConfig -Destination $webConfigBackup -Force
            Set-Content -LiteralPath $webConfig -Value $patched -Encoding UTF8 -NoNewline
            $standaloneDisabled = $true
            Write-Note "Temporarily disabled 'output: standalone' in next.config.js for build."
        }
    }
    try {
        & $Pnpm --filter "@ci-train/web" build
        if ($LASTEXITCODE -ne 0) { Fail "web build failed." }
    } finally {
        if ($standaloneDisabled -and (Test-Path -LiteralPath $webConfigBackup)) {
            Move-Item -LiteralPath $webConfigBackup -Destination $webConfig -Force
            Write-Note "Restored next.config.js."
        }
    }
}

# --- PACK -----------------------------------------------------
function Invoke-Pack {
    $repoRoot = $PSScriptRoot
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) {
        Fail "Run this script from the repo root (no package.json found next to airgap.ps1)."
    }

    # Default -Output to <repo-drive>:\ci-cyber-lab-bundle so the
    # common case (cloned the repo to a USB, want the bundle on
    # the same USB) needs no flags. The bundle drive can be
    # exFAT/FAT32 if separate from the repo drive.
    if (-not $Output) {
        $repoDrive = (Get-Item $repoRoot).PSDrive.Name
        $Output = "${repoDrive}:\ci-cyber-lab-bundle"
        Write-Note "No -Output supplied; defaulting to $Output"
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

    Save-PackInstallers -InstallersDir $installersDir

    Write-Stage "Refreshing repo dependencies (pnpm install + Prisma generate)"
    Push-Location $repoRoot
    try {
        $pnpm = Initialize-PackPnpm
        # Filesystem note: we pass --config.node-linker=hoisted to
        # pnpm install, so the bundle doesn't depend on NTFS-only
        # symlinks the way pnpm's default layout did. FAT32/exFAT
        # bundles work fine. Surface the FS type for awareness only.
        $repoDrive = (Get-Item $repoRoot).PSDrive.Name
        $vol = Get-Volume -DriveLetter $repoDrive -ErrorAction SilentlyContinue
        if ($vol -and $vol.FileSystemType -notin @("NTFS", "ReFS")) {
            Write-Note "Drive ${repoDrive}: is $($vol.FileSystemType). Hoisted node_modules works fine here, but the pnpm content-addressable store still needs NTFS-style hardlinks; if you hit weirdness, move the repo to C:\ and re-run."
        }
        Invoke-PackBuilds -RepoRoot $repoRoot -Pnpm $pnpm
    } finally {
        Pop-Location
    }
    Write-OK "Dependencies + builds ready."

    Write-Stage "Copying repo into bundle (this is the slow part)"
    # robocopy with default symlink-follow behaviour: pnpm uses NTFS
    # symlinks for node_modules/<pkg> -> node_modules/.pnpm/... and we
    # WANT robocopy to dereference those so the bundle is self-
    # contained on the air-gapped box. /MIR mirrors; /R:1 /W:1 keeps
    # it from stalling on a locked file; /NFL /NDL /NP /NJH /NJS
    # keeps stdout quiet.
    $excluded = @(
        "/XD", ".git", ".next\cache", "deploy", "out", ".turbo",
        "/XF", ".env", ".env.local", ".env.production"
    )
    # /MT:8 = 8 parallel copy threads; 5-10x faster on the small-file
    # trees that dominate node_modules.
    $rcArgs = @($repoRoot, $repoDest, "/MIR", "/MT:8", "/R:1", "/W:1",
                "/NFL", "/NDL", "/NP", "/NJH", "/NJS") + $excluded
    & robocopy @rcArgs | Out-Null
    # robocopy exit codes 0-7 are success; >=8 is failure.
    if ($LASTEXITCODE -ge 8) { Fail "robocopy failed with code $LASTEXITCODE" }
    Write-OK "Repo copied to $repoDest"

    # Strip `output: "standalone"` from the bundle's copy of
    # next.config.js. The source repo's config has it restored
    # (so the operator's dev environment isn't disturbed), but
    # the bundle's BUILD was made without standalone, and shipping
    # a config-vs-build mismatch causes Next to print
    #     "next start does not work with output: standalone"
    # at runtime on the air-gapped box. Patch the bundle's copy
    # to match what was actually built.
    $bundleWebConfig = Join-Path $repoDest "apps\web\next.config.js"
    if (Test-Path -LiteralPath $bundleWebConfig) {
        $cfg = Get-Content -LiteralPath $bundleWebConfig -Raw
        $patchedCfg = $cfg -replace 'output:\s*["'']standalone["''],?', '// airgap: standalone disabled (build does not emit .next/standalone/)'
        if ($patchedCfg -ne $cfg) {
            Set-Content -LiteralPath $bundleWebConfig -Value $patchedCfg -Encoding UTF8 -NoNewline
            Write-Note "Stripped 'output: standalone' from bundle next.config.js (matches the built artifacts)."
        }
    }

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
        Write-Note "AIRGAP-INSTALL.txt not found at repo root -- bundle will not include operator instructions."
    }

    Write-Stage "Bundle complete"
    Write-OK "Bundle: $Output"
    Write-OK "Eject the drive, walk it to the air-gapped box, and run:"
    Write-Note "    .\airgap.ps1 -Mode Install -Source $Output -Target C:\ci-cyber-lab -Seed"
}

# --- INSTALL --------------------------------------------------
function Invoke-Install {
    if (-not $Source) { Fail "Install mode needs -Source <bundle-path>." }
    if (-not $Target) { Fail "Install mode needs -Target <install-path>." }
    if (-not (Test-IsAdmin)) {
        Fail "Install mode needs an elevated PowerShell (Run as Administrator)."
    }

    $manifestPath = Join-Path $Source "manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        Fail "manifest.json not found under $Source -- is this the right path?"
    }

    if (-not $SkipNode) {
        Write-Stage "Installing Node.js (silent)"
        # If Node is already installed (likely from a prior install
        # attempt on this same machine), skip the MSI -- reinstalling
        # the same version is the classic MSI 1603 cause.
        $existingNode = Get-Command node -ErrorAction SilentlyContinue
        if (-not $existingNode) {
            # Refresh PATH from registry in case Node was installed
            # before this PowerShell session started.
            $env:Path = `
                [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + `
                [Environment]::GetEnvironmentVariable("Path", "User")
            $existingNode = Get-Command node -ErrorAction SilentlyContinue
        }
        if ($existingNode) {
            $ver = (& node --version 2>$null)
            # `require(esm)` was made on-by-default in Node 22.12.
            # @ci-train/contracts is ESM; the seed step requires it
            # from CommonJS, so anything older aborts seed.js with
            # ERR_REQUIRE_ESM. Catch it here rather than after the
            # (irreversible) DB migrations run.
            $verNum = $null
            if ($ver -match '^v(\d+\.\d+\.\d+)') { $verNum = [version]$Matches[1] }
            $minVer = [version]"22.12.0"
            if ($verNum -and ($verNum -lt $minVer)) {
                $bundledMsi = Join-Path $Source "installers\node.msi"
                Fail @"
Node $ver is too old. ci-cyber-lab requires >= 22.12.0
(@ci-train/contracts is ESM and the seed step uses require(),
which is only enabled by default on Node 22.12+).

To recover on this box:

  1. Install Node from the bundle (overwrites C:\Program Files\nodejs\):
       Start-Process msiexec.exe -ArgumentList @(
         '/i', '$bundledMsi',
         '/qn', '/norestart', 'ADDLOCAL=ALL') -Wait

  2. Open a FRESH PowerShell so PATH picks up the new node,
     confirm with:  node --version

  3. Re-run the install with -SkipNode (migrations are idempotent;
     seed will retry):
       .\airgap.ps1 -Mode Install -Source $Source -Target $Target -Seed -SkipNode

Or uninstall the old Node via "Add/Remove Programs" first and
re-run without -SkipNode.
"@
            }
            Write-OK "Node already installed at $($existingNode.Source) ($ver) -- skipping MSI."
        } else {
            $nodeMsi = Join-Path $Source "installers\node.msi"
            if (-not (Test-Path -LiteralPath $nodeMsi)) { Fail "node.msi missing in bundle." }
            # /L*V <log> records the MSI's internal error so future
            # 1603s have a paper trail. /qn = quiet. ADDLOCAL=ALL
            # pulls in npm + corepack explicitly (matches what the
            # script used before the 1603 fix; only the
            # already-installed-skip is new behaviour).
            $msiLog = Join-Path $env:TEMP "ci-cyber-lab-node-msi.log"
            $p = Start-Process -FilePath msiexec.exe `
                -ArgumentList @("/i", "`"$nodeMsi`"", "/qn", "/norestart", "/L*V", "`"$msiLog`"", "ADDLOCAL=ALL") `
                -Wait -PassThru
            if ($p.ExitCode -ne 0) {
                Fail @"
Node MSI returned $($p.ExitCode). Full install log at:
    $msiLog

Common causes:
  - Node is already installed (re-run with -SkipNode).
  - A pending Windows reboot. Reboot, then re-run.
  - 1603 specifically: MSI hit a fatal error; the .log above
    will name the failed action (search for 'Return value 3').
"@
            }
            Write-OK "Node installed."
            $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
        }
    } else {
        Write-Note "Skipping Node install per -SkipNode."
    }

    if (-not $SkipPostgres) {
        Write-Stage "Installing PostgreSQL"
        # Auto-detect an existing Postgres install before launching
        # the interactive installer. Saves operator time on repeated
        # install runs against the same box (e.g. troubleshooting).
        $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        $pgInstallDir = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pgService -or $pgInstallDir) {
            $detected = if ($pgInstallDir) { $pgInstallDir.FullName } else { $pgService[0].Name }
            Write-OK "PostgreSQL already installed ($detected) -- skipping installer."
        } else {
            $pgExe = Join-Path $Source "installers\postgresql.exe"
            if (-not (Test-Path -LiteralPath $pgExe)) { Fail "postgresql.exe missing in bundle." }
            Write-Note "Running interactive installer -- remember the postgres-user password,"
            Write-Note "you'll paste it into DATABASE_URL in a moment."
            $p = Start-Process -FilePath $pgExe -Wait -PassThru
            if ($p.ExitCode -ne 0) { Fail "Postgres installer returned $($p.ExitCode)." }
            Write-OK "PostgreSQL installed."
        }
    } else {
        Write-Note "Skipping Postgres install per -SkipPostgres."
    }

    Write-Stage "Copying repo into $Target"
    $repoSrc = Join-Path $Source "repo"
    if (-not (Test-Path -LiteralPath $repoSrc)) { Fail "$repoSrc not found in bundle." }
    # Skip the slow robocopy if the same bundle has already been
    # applied to this target. We stamp the bundle's manifest hash
    # into the target as .airgap-installed-from on success; the
    # next install re-reads it and re-copies only when the bundle
    # is different (e.g. fresh re-pack). Operator can also force
    # with -ForceRepoCopy.
    $apiBuiltMarker = Join-Path $Target "apps\api\dist\main.js"
    $webBuiltMarker = Join-Path $Target "apps\web\.next"
    $bundleManifest = Join-Path $Source "manifest.json"
    $bundleStamp = if (Test-Path -LiteralPath $bundleManifest) {
        (Get-FileHash -LiteralPath $bundleManifest -Algorithm SHA256).Hash
    } else { "" }
    $installedStampFile = Join-Path $Target ".airgap-installed-from"
    $installedStamp = if (Test-Path -LiteralPath $installedStampFile) {
        (Get-Content -LiteralPath $installedStampFile -Raw -ErrorAction SilentlyContinue).Trim()
    } else { "" }
    $bundleMatches = $bundleStamp -and ($bundleStamp -eq $installedStamp)
    if ((-not $ForceRepoCopy) -and $bundleMatches -and (Test-Path -LiteralPath $apiBuiltMarker) -and (Test-Path -LiteralPath $webBuiltMarker)) {
        Write-OK "Same bundle already installed at $Target (skipping copy; -ForceRepoCopy to override)."
    } else {
        if ((-not $ForceRepoCopy) -and (Test-Path -LiteralPath $apiBuiltMarker) -and -not $bundleMatches) {
            Write-Note "Target has a different bundle installed -- re-copying."
        }
        if (-not (Test-Path -LiteralPath $Target)) {
            New-Item -ItemType Directory -Path $Target | Out-Null
        }
        $rcArgs = @($repoSrc, $Target, "/MIR", "/MT:8", "/R:1", "/W:1",
                    "/NFL", "/NDL", "/NP", "/NJH", "/NJS")
        & robocopy @rcArgs | Out-Null
        if ($LASTEXITCODE -ge 8) { Fail "robocopy failed with code $LASTEXITCODE" }
        if ($bundleStamp) {
            Set-Content -LiteralPath $installedStampFile -Value $bundleStamp -Encoding ASCII
        }
        Write-OK "Repo at $Target"
    }

    Write-Stage "DATABASE_URL configuration"
    $existingEnv = Join-Path $Target "apps\api\.env"
    if (Test-Path -LiteralPath $existingEnv) {
        Write-Note "apps\api\.env already exists. Skipping prompt; edit it by hand if needed."
    } else {
        $dbUrl = Read-Host "Paste the DATABASE_URL (e.g. postgresql://postgres:PASSWORD@localhost:5432/ci_cyber_lab)"
        if (-not $dbUrl) { Fail "DATABASE_URL is required to run migrations." }
        # ASCII encoding (no BOM). Set-Content -Encoding UTF8 in
        # Windows PowerShell 5.1 writes a BOM, which Node's
        # --env-file parser treats as part of the first variable
        # name, breaking DATABASE_URL lookup in the seed script.
        Set-Content -LiteralPath $existingEnv -Value "DATABASE_URL=$dbUrl" -Encoding ASCII
        # Tighten ACLs: the file holds a Postgres password. Strip
        # inherited permissions and grant only the local
        # Administrators group + the current user. The API runs as
        # whoever launches `node dist\main.js`, so they need read.
        & icacls "$existingEnv" /inheritance:r /grant:r "BUILTIN\Administrators:F" "$env:USERNAME:F" 2>$null | Out-Null
        Write-OK "Wrote $existingEnv (admin + current user only)"
    }

    # Pre-flight: verify Node on PATH is >= 22.12 before touching
    # the DB. Catches the -SkipNode-with-old-Node case (Node 16/18
    # already installed, operator passes -SkipNode) BEFORE migrations
    # apply -- otherwise migrate succeeds, seed bombs on
    # ERR_REQUIRE_ESM, and the operator is left in a half-installed
    # state with a populated schema and no content.
    $effectiveVer = (& node --version 2>$null)
    $effectiveVerNum = $null
    if ($effectiveVer -match '^v(\d+\.\d+\.\d+)') { $effectiveVerNum = [version]$Matches[1] }
    $minVer = [version]"22.12.0"
    if ($effectiveVerNum -and ($effectiveVerNum -lt $minVer)) {
        Fail @"
Node on PATH is $effectiveVer; ci-cyber-lab requires >= 22.12.0
for the seed step (@ci-train/contracts is ESM, the seed uses
require()). Stopping before migrations apply so you don't end
up in a half-installed state.

Install Node from the bundle:
    Start-Process msiexec.exe -ArgumentList @(
      '/i', '$(Join-Path $Source "installers\node.msi")',
      '/qn', '/norestart', 'ADDLOCAL=ALL') -Wait

Then open a fresh PowerShell, confirm with `node --version`,
and re-run this install command.
"@
    }

    Write-Stage "Applying Prisma migrations"
    $apiDir = Join-Path $Target "apps\api"
    $prismaCli = Resolve-ModuleBin -Cwd $apiDir -RelativePath "prisma/build/index.js"
    if (-not $prismaCli) {
        Fail "Could not resolve 'prisma/build/index.js' from $apiDir. Did pnpm install run during pack?"
    }
    Push-Location $apiDir
    try {
        & node "$prismaCli" migrate deploy
        if ($LASTEXITCODE -ne 0) { Fail "prisma migrate deploy failed." }
    } finally {
        Pop-Location
    }
    Write-OK "Migrations applied."

    if ($Seed) {
        Write-Stage "Seeding content"
        Push-Location (Join-Path $Target "apps\api")
        try {
            # Read .env manually and inject vars into the child
            # process env. Avoids the Node --env-file BOM-parsing
            # bug entirely -- the file's encoding doesn't matter
            # because PowerShell's Get-Content strips the BOM.
            # cd is already apps\api, so .env resolves here.
            $envLines = Get-Content -LiteralPath ".env" -ErrorAction SilentlyContinue
            foreach ($line in $envLines) {
                $trimmed = $line.Trim()
                if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
                $eq = $trimmed.IndexOf("=")
                if ($eq -le 0) { continue }
                $key = $trimmed.Substring(0, $eq).Trim()
                $val = $trimmed.Substring($eq + 1).Trim()
                # Strip surrounding quotes if the operator quoted it.
                if (($val.StartsWith('"') -and $val.EndsWith('"')) -or
                    ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                    $val = $val.Substring(1, $val.Length - 2)
                }
                Set-Item -Path "env:$key" -Value $val
            }
            # Set deterministic admin creds so operators don't have
            # to dig through scrollback for a random password. They
            # MUST change it on first login (the Done banner warns).
            $env:SEED_ADMIN_EMAIL = $AdminEmail
            $env:SEED_ADMIN_PASSWORD = $AdminPassword
            & node "dist\scripts\seed.js"
            if ($LASTEXITCODE -ne 0) { Fail "seed failed." }
        } finally {
            Pop-Location
        }
        Write-OK "Seed complete."
    } else {
        Write-Note "Skipping seed. Re-run with -Seed if you want to populate the catalog."
    }

    $nextBin = Resolve-ModuleBin `
        -Cwd (Join-Path $Target "apps\web") `
        -RelativePath "next/dist/bin/next"
    if (-not $nextBin) {
        $nextBin = "<could not resolve 'next' bin -- check $Target\node_modules\next>"
    }

    # Write a start.ps1 helper into -Target so the operator can
    # re-launch both services any time without typing the two
    # cd + node commands by hand. Defaults to the install-time
    # ports; override at runtime with -ApiPort / -WebPort.
    $startScript = Join-Path $Target "start.ps1"
    $startScriptBody = @"
# CI Cyber Lab -- launch the API + web in their own PowerShell windows.
# Written by airgap.ps1 at install time. Re-run any time to bring the
# services back up after a reboot or after the operator closed the
# windows.
#
# For production-style deployment (running as a service, surviving
# logoff, auto-restart on crash), see AIRGAP-INSTALL.txt Phase 3.
#
# Defaults bake in the install-time ports (-ApiPort / -WebPort on
# airgap.ps1 -Mode Install). Override at runtime:
#   .\start.ps1 -ApiPort 4000 -WebPort 9300

[CmdletBinding()]
param(
    [int]`$ApiPort = $ApiPort,
    [int]`$WebPort = $WebPort
)

`$ErrorActionPreference = "Stop"

`$repo = `$PSScriptRoot
`$apiDir = Join-Path `$repo "apps\api"
`$webDir = Join-Path `$repo "apps\web"
`$nextBin = Join-Path `$repo "node_modules\next\dist\bin\next"
if (-not (Test-Path -LiteralPath `$nextBin)) {
    `$nextBin = Join-Path `$webDir "node_modules\next\dist\bin\next"
}

if (-not (Test-Path -LiteralPath (Join-Path `$apiDir "dist\main.js"))) {
    Write-Host "ERR: `$apiDir\dist\main.js not found. Was the bundle built?" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath `$nextBin)) {
    Write-Host "ERR: next binary not found at `$nextBin." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting API on port `$ApiPort (in its own PowerShell window)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location -LiteralPath '`$apiDir'; ```$env:PORT = '`$ApiPort'; node dist\main.js"
)

Start-Sleep -Seconds 2

Write-Host "Starting web on port `$WebPort (in its own PowerShell window)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location -LiteralPath '`$webDir'; node '`$nextBin' start -p `$WebPort"
)

Write-Host ""
Write-Host "Started." -ForegroundColor Green
Write-Host "  API: http://localhost:`$ApiPort/v1/healthz"
Write-Host "  Web: http://localhost:`$WebPort"
Write-Host ""
Write-Host "To stop, close both new PowerShell windows."
"@
    Set-Content -LiteralPath $startScript -Value $startScriptBody -Encoding UTF8
    Write-Note "Wrote start.ps1 helper to $startScript"

    Write-Stage "Done"
    Write-Host @"
The platform is installed at $Target.

EASIEST WAY TO RUN IT (now and after reboot):

    cd $Target
    .\start.ps1

That launches the API + web in their own PowerShell windows, each
on the install-time port ($ApiPort and $WebPort). Override either
at the moment of launch:
    .\start.ps1 -ApiPort 4000 -WebPort 9300

If you'd rather start each manually:

    # API (port $ApiPort)
    cd $Target\apps\api
    `$env:PORT = $ApiPort
    node dist\main.js

    # Web (port $WebPort)
    cd $Target\apps\web
    node "$nextBin" start -p $WebPort

See AIRGAP-INSTALL.txt (also copied into the bundle root) for
how to run these as services, configure HTTPS, and verify the
install.
"@ -ForegroundColor Green

    if ($Seed) {
        $bar = "*" * 70
        Write-Host ""
        Write-Host $bar -ForegroundColor Yellow
        Write-Host "*                                                                    *" -ForegroundColor Yellow
        Write-Host "*   SIGN IN WITH (change password immediately on first login):       *" -ForegroundColor Yellow
        Write-Host "*                                                                    *" -ForegroundColor Yellow
        Write-Host ("*       Email:    {0,-49} *" -f $AdminEmail)    -ForegroundColor Yellow
        Write-Host ("*       Password: {0,-49} *" -f $AdminPassword) -ForegroundColor Yellow
        Write-Host "*                                                                    *" -ForegroundColor Yellow
        Write-Host "*   This is a known default for the air-gap installer. After your    *" -ForegroundColor Yellow
        Write-Host "*   first sign-in, rotate the password via the admin profile menu    *" -ForegroundColor Yellow
        Write-Host "*   or:                                                              *" -ForegroundColor Yellow
        Write-Host "*       node dist\scripts\reset-password.js \\                        *" -ForegroundColor Yellow
        Write-Host "*           --email <email> --password '<new-password>'              *" -ForegroundColor Yellow
        Write-Host "*                                                                    *" -ForegroundColor Yellow
        Write-Host $bar -ForegroundColor Yellow
        Write-Host ""
    }

    if ($AutoStart) {
        Write-Stage "Auto-starting services (-AutoStart)"
        Write-Note "Invoking $startScript -- two PowerShell windows will open."
        & $startScript -ApiPort $ApiPort -WebPort $WebPort
    }
}

function Show-Usage {
    Write-Host @"

CI Cyber Lab -- air-gap pack / install helper
============================================

You must supply -Mode. Two modes:

  Pack   -- on the internet-connected Windows box, build a USB bundle.
  Install-- on the air-gapped Windows box (elevated), consume the bundle.

Quick start:

  Online box:
      .\airgap.ps1 -Mode Pack

      Bundle defaults to <repo-drive>:\ci-cyber-lab-bundle. Pass
      -Output <path> if you want it somewhere else. Adds ~330 MB
      to the drive; takes 10-30 min.

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

# --- dispatch -------------------------------------------------
if (-not $Mode -or $Mode -eq "Help") {
    Show-Usage
    return
}
switch ($Mode) {
    "Pack"    { Invoke-Pack }
    "Install" { Invoke-Install }
}
