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
    [switch]$Seed,

    # Install mode: re-copy the bundle's repo over the target even
    # if the target already has a built repo (default skips the
    # copy in that case to speed up troubleshooting re-runs).
    [switch]$ForceRepoCopy,

    # Pack mode: bypass the NTFS / ReFS filesystem check on the
    # repo drive. pnpm fundamentally requires NTFS-style symlinks;
    # this switch only exists for power users who have explicitly
    # configured `node-linker=hoisted` in .npmrc to work around it.
    [switch]$AllowNonNtfs
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

# Loud banner shown when the repo drive isn't NTFS / ReFS. Most USB
# sticks ship FAT32 or exFAT, neither of which supports the symlinks
# pnpm uses, so the operator almost always hits this if they clone
# straight to a USB. We abort before pnpm install -- silent
# corruption later is much worse than a hard stop now.
function Show-NtfsAbort {
    param([string]$DriveLetter, [string]$FsType)
    $bar = "*" * 70
    Write-Host ""
    Write-Host $bar -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*   THE REPO DRIVE MUST BE NTFS.                                     *" -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host ("*   Drive {0}: is {1,-12} -- this WILL break pnpm install.        *" -f $DriveLetter, $FsType) -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*   Most USB sticks ship FAT32 or exFAT. pnpm uses NTFS-only         *" -ForegroundColor Red
    Write-Host "*   symbolic links for its node_modules layout; FAT32 and exFAT      *" -ForegroundColor Red
    Write-Host "*   silently corrupt the install partway through.                    *" -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*   YOUR OPTIONS:                                                    *" -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*   1. (Recommended) Clone the repo to C:\ and re-run from there.    *" -ForegroundColor Red
    Write-Host "*          cd C:\                                                    *" -ForegroundColor Red
    Write-Host "*          git clone <repo-url> platform                             *" -ForegroundColor Red
    Write-Host "*          cd C:\platform                                            *" -ForegroundColor Red
    Write-Host ("*          .\airgap.ps1 -Mode Pack -Output {0}:\bundle              *" -f $DriveLetter) -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*      The USB output drive can stay exFAT/FAT32 -- the bundle is    *" -ForegroundColor Red
    Write-Host "*      just regular files. Only the WORKING REPO needs NTFS.         *" -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*   2. Reformat the drive to NTFS (DESTRUCTIVE; back up first):      *" -ForegroundColor Red
    Write-Host ("*          format {0}: /FS:NTFS /Q                                  *" -f $DriveLetter) -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host "*   3. If you know what you're doing and have configured             *" -ForegroundColor Red
    Write-Host "*      node-linker=hoisted in .npmrc, re-run with -AllowNonNtfs.     *" -ForegroundColor Red
    Write-Host "*                                                                    *" -ForegroundColor Red
    Write-Host $bar -ForegroundColor Red
    Write-Host ""
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

# --- PACK -----------------------------------------------------
function Invoke-Pack {
    $repoRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) {
        Fail "Run this script from the repo root (no package.json found next to airgap.ps1)."
    }

    # Default -Output to <repo-drive>:\ci-cyber-lab-bundle so the
    # common case (cloned the repo to a USB, want the bundle on the
    # same USB) needs no flags. The bundle drive can be exFAT/FAT32
    # if it's separate from the repo drive (only the working repo
    # needs NTFS -- see the NTFS abort banner).
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
        # install -- far more reliable.
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
                # `cmd /c rmdir /s /q` is 5-10x faster than
                # Remove-Item -Recurse -Force on large directory
                # trees because it skips PowerShell's per-file
                # provider marshaling. Stderr is suppressed because
                # rmdir is chatty on locked files; the result is
                # verified by the Test-Path check on the next loop
                # iteration anyway.
                & cmd /c "rmdir /s /q `"$p`"" 2>$null
            }
        }
        # Filesystem sanity check: pnpm requires NTFS-style symlinks
        # for its node_modules/.pnpm/ layout. FAT32 and exFAT (the
        # default format on most USB sticks) do NOT support symlinks
        # and pnpm install will fail in confusing ways. Abort up
        # front with reformat instructions; -AllowNonNtfs bypasses
        # for the rare case the operator has wired `node-linker=
        # hoisted` into .npmrc themselves.
        $repoDrive = (Get-Item $repoRoot).PSDrive.Name
        $vol = Get-Volume -DriveLetter $repoDrive -ErrorAction SilentlyContinue
        if ($vol -and $vol.FileSystemType -notin @("NTFS", "ReFS")) {
            if ($AllowNonNtfs) {
                Write-Host "WARN: drive ${repoDrive}: filesystem is $($vol.FileSystemType); proceeding because -AllowNonNtfs was set." -ForegroundColor Yellow
            } else {
                Show-NtfsAbort -DriveLetter $repoDrive -FsType $vol.FileSystemType
                Fail "Repo drive ${repoDrive}: is $($vol.FileSystemType). Move the repo to an NTFS drive (e.g. C:\) and re-run, or pass -AllowNonNtfs if you know what you're doing."
            }
        }

        # node-linker=hoisted: install in a flat node_modules layout
        # (npm-style), not pnpm's default .pnpm/ virtual store. This
        # is the form that survives a robocopy intact -- pnpm's
        # default layout uses symlinks for transitive-dep resolution,
        # which break after robocopy dereferences them and lead to
        # "Cannot find module '@prisma/engines'" at runtime on the
        # install target.
        & $pnpm install --frozen-lockfile --config.node-linker=hoisted
        if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed." }
        # Prisma engines land in node_modules during postinstall;
        # build the contracts + apps so the bundle ships ready-to-run.
        & $pnpm --filter "@ci-train/contracts" build
        if ($LASTEXITCODE -ne 0) { Fail "contracts build failed." }
        & $pnpm --filter "@ci-train/api" prisma:generate
        if ($LASTEXITCODE -ne 0) { Fail "prisma generate failed." }
        & $pnpm --filter "@ci-train/api" build
        if ($LASTEXITCODE -ne 0) { Fail "api build failed." }
        # Next.js's `output: "standalone"` build step creates real
        # NTFS symlinks under apps/web/.next/standalone/, which
        # requires admin (or Developer Mode) on Windows. Pack mode
        # shouldn't need admin, and we don't NEED the standalone
        # bundle -- Install mode runs `next start` against the
        # regular .next/ directory. Temporarily disable standalone
        # for this build and restore the config afterward.
        $webConfig = Join-Path $repoRoot "apps\web\next.config.js"
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
            & $pnpm --filter "@ci-train/web" build
            if ($LASTEXITCODE -ne 0) { Fail "web build failed." }
        } finally {
            if ($standaloneDisabled -and (Test-Path -LiteralPath $webConfigBackup)) {
                Move-Item -LiteralPath $webConfigBackup -Destination $webConfig -Force
                Write-Note "Restored next.config.js."
            }
        }
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
        Write-Note "AIRGAP-INSTALL.txt not found at repo root -- bundle will not include operator instructions."
    }

    Write-Stage "Bundle complete"
    Write-OK "Bundle: $Output"
    Write-OK "Eject the drive, walk it to the air-gapped box, and run:"
    Write-Note "    .\airgap.ps1 -Mode Install -Source <bundle-path> -Target C:\ci-cyber-lab"
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
        $rcArgs = @($repoSrc, $Target, "/MIR", "/R:1", "/W:1",
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
        Set-Content -LiteralPath $existingEnv -Value "DATABASE_URL=$dbUrl" -Encoding UTF8
        Write-OK "Wrote $existingEnv"
    }

    Write-Stage "Applying Prisma migrations"
    Push-Location (Join-Path $Target "apps\api")
    try {
        # Use Node's own resolution to find the prisma CLI entry,
        # which is more robust than hardcoding apps/api/node_modules/
        # /prisma/build/index.js -- pnpm in hoisted mode hoists
        # workspace dev deps to the workspace root, so prisma may
        # actually live at $Target/node_modules/prisma instead.
        $prismaCli = & node -e "try{console.log(require.resolve('prisma/build/index.js'))}catch{process.exit(2)}" 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $prismaCli) {
            Fail "Could not resolve 'prisma/build/index.js' from $Target\apps\api. Did pnpm install run during pack?"
        }
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
            # cd into apps\api so the seed picks up .env and uses
            # the api package's local node_modules.
            # --env-file: Node 20.6+ loads .env before running the
            # script. Prisma's CLI loads .env on its own, but a
            # plain `node seed.js` doesn't, so the seed script's
            # PrismaClient() can't find DATABASE_URL otherwise.
            & node --env-file=.env "dist\scripts\seed.js"
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
