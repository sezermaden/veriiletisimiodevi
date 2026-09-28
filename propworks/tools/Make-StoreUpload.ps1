<#
.SYNOPSIS
  Propworks icin Partner Center'a yuklenebilir .msixupload uretir ve
  YUKLEMEDEN ONCE dogrular.

.DESCRIPTION
  "You cannot submit pre-compiled .NET Native packages" hatasinin sebebi,
  paketin icindeki AppxManifest.xml dosyasinda su satirin bulunmasidir:

      <build:Item Name="OptimizingToolset" Value="ilc.exe"/>

  ilc.exe = .NET Native derleyicisi. Partner Center bu metadata'yi okuyup
  paketi reddediyor. _Test klasorundeki bundle her zaman boyledir, o yuzden
  onu elle zip'leyip .msixupload yapmak ISE YARAMAZ - icerik ayni kalir.

  Bu script paketi Store yolundan uretir, sonra uretilen paketi acip
  OptimizingToolset degerini yazdirir. "ilc.exe" gorursen yukleme; scripti
  -NoNativeToolchain ile tekrar calistir.

.EXAMPLE
  .\tools\Make-StoreUpload.ps1
  .\tools\Make-StoreUpload.ps1 -NoNativeToolchain
  .\tools\Make-StoreUpload.ps1 -Platforms "x86|x64"      # ARM64 patliyorsa
#>
[CmdletBinding()]
param(
    [string] $Project        = "Propworks\Propworks.csproj",
    [string] $Platforms      = "x86|x64|arm64",
    [switch] $NoNativeToolchain,
    [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path $Project)) { throw "Proje bulunamadi: $Project (calisma dizini: $root)" }

# ---------------------------------------------------------------- msbuild
$msbuild = $null
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $msbuild = & $vswhere -latest -requires Microsoft.Component.MSBuild `
                          -find "MSBuild\**\Bin\MSBuild.exe" | Select-Object -First 1
}
if (-not $msbuild) { $msbuild = (Get-Command msbuild.exe -ErrorAction SilentlyContinue).Source }
if (-not $msbuild) { throw "MSBuild bulunamadi. 'Developer Command Prompt for VS' icinden calistir." }
Say "MSBuild : $msbuild"

$appPkgDir = Join-Path $root "Propworks\AppPackages"

# ---------------------------------------------------------------- build
if (-not $SkipBuild) {
    Say "`nEski ciktilar temizleniyor..." Cyan
    foreach ($d in @("Propworks\bin", "Propworks\obj", $appPkgDir)) {
        if (Test-Path $d) { Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue }
    }

    $args = @(
        $Project,
        "/p:Configuration=Release",
        "/p:AppxBundle=Always",
        "/p:AppxBundlePlatforms=$Platforms",
        "/p:UapAppxPackageBuildMode=StoreUpload",
        "/p:AppxPackageSigningEnabled=true",
        "/p:AppxPackageDir=$appPkgDir\",
        "/v:minimal", "/nologo"
    )
    # Store, yerel olarak .NET Native ile derlenmis paketi reddediyorsa
    # MSIL birakip derlemeyi Store'a yaptirmak gerekiyor.
    if ($NoNativeToolchain) {
        $args += "/p:UseDotNetNativeToolchain=false"
        Say "  (.NET Native KAPALI - paket MSIL kalacak)" Yellow
    }

    Say "`nNuGet geri yukleniyor..." Cyan
    & $msbuild $Project /t:Restore /v:minimal /nologo
    if ($LASTEXITCODE -ne 0) { throw "Restore basarisiz." }

    Say "`nPaket uretiliyor (birkac dakika surebilir)..." Cyan
    & $msbuild @args
    if ($LASTEXITCODE -ne 0) { throw "Derleme basarisiz." }
}

# ---------------------------------------------------------------- locate
$upload = Get-ChildItem $appPkgDir -Recurse -File -ErrorAction SilentlyContinue |
          Where-Object { $_.Extension -in '.msixupload', '.appxupload' } |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $upload) {
    Say "`n.msixupload URETILMEDI." Red
    Say "AppPackages altinda bulunanlar:" Red
    Get-ChildItem $appPkgDir -Recurse -File -Include *.msixbundle,*.appxbundle -EA SilentlyContinue |
        ForEach-Object { Say "   $($_.FullName.Replace($root,'.'))" }
    Say "`n_Test klasorundeki bundle'i YUKLEME - reddedilir." Yellow
    throw "Upload dosyasi olusmadi."
}
Say "`nUretildi: $($upload.FullName.Replace($root,'.'))  ($([math]::Round($upload.Length/1MB,1)) MB)" Green

# ---------------------------------------------------------------- verify
Say "`n--- YUKLEMEDEN ONCE DOGRULAMA ---" Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$tmp = Join-Path $env:TEMP ("mbverify_" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$verdict = @()
try {
    [IO.Compression.ZipFile]::ExtractToDirectory($upload.FullName, $tmp)

    $bundle = Get-ChildItem $tmp -Recurse -File |
              Where-Object { $_.Extension -in '.msixbundle', '.appxbundle' } |
              Select-Object -First 1
    if ($bundle) {
        $bdir = Join-Path $tmp "bundle"
        [IO.Compression.ZipFile]::ExtractToDirectory($bundle.FullName, $bdir)
        $inner = Get-ChildItem $bdir -File | Where-Object { $_.Extension -in '.msix', '.appx' }
    } else {
        $inner = Get-ChildItem $tmp -File | Where-Object { $_.Extension -in '.msix', '.appx' }
    }

    foreach ($pkg in $inner) {
        $pdir = Join-Path $tmp ("p_" + $pkg.BaseName)
        try { [IO.Compression.ZipFile]::ExtractToDirectory($pkg.FullName, $pdir) } catch { continue }
        $mf = Join-Path $pdir "AppxManifest.xml"
        if (-not (Test-Path $mf)) { continue }
        $txt = Get-Content $mf -Raw
        $m   = [regex]::Match($txt, 'Name="OptimizingToolset"\s+Value="([^"]*)"')
        $val = if ($m.Success) { $m.Groups[1].Value } else { "(yok)" }
        $bad = ($val -match 'ilc')
        $verdict += [pscustomobject]@{ Paket = $pkg.Name; OptimizingToolset = $val; Sorun = $bad }
        Say ("  {0,-42} OptimizingToolset = {1}" -f $pkg.Name, $val) $(if ($bad) { 'Red' } else { 'Green' })
    }
} finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

if ($verdict.Where({ $_.Sorun }).Count -gt 0) {
    Say "`nRET EDILIR. Paketler .NET Native (ilc.exe) ile derlenmis." Red
    if (-not $NoNativeToolchain) {
        Say "Sunu calistir:" Yellow
        Say "    .\tools\Make-StoreUpload.ps1 -NoNativeToolchain" Yellow
    } else {
        Say "-NoNativeToolchain'e ragmen ilc.exe kalmis - csproj'daki" Yellow
        Say "<UseDotNetNativeToolchain>true</UseDotNetNativeToolchain> satirlarini" Yellow
        Say "Release bloklarindan sil ve tekrar dene." Yellow
    }
    exit 1
}

Say "`nTEMIZ. Partner Center'a yuklenecek dosya:" Green
Say "    $($upload.FullName)" Green
Say "`nDependencies\ klasorundeki hicbir seyi YUKLEME - onlar Microsoft'un" Yellow
Say "framework paketleri, Store'da zaten var." Yellow
