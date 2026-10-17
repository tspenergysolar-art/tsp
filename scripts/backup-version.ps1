$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
$backupRoot = Join-Path $projectRoot 'backups'
$versionFolder = Join-Path $backupRoot ("versao-{0}" -f $version)

if (Test-Path -LiteralPath $versionFolder) {
  throw "O backup da versao $version ja existe em $versionFolder."
}

$distFolder = Join-Path $projectRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $distFolder 'index.html'))) {
  throw 'Execute npm run build antes de criar o backup.'
}

New-Item -ItemType Directory -Path $versionFolder -Force | Out-Null
$siteArchive = Join-Path $versionFolder ("tsp-energy-solar-v{0}-site.zip" -f $version)
$sourceArchive = Join-Path $versionFolder ("tsp-energy-solar-v{0}-codigo.zip" -f $version)

Compress-Archive -Path (Join-Path $distFolder '*') -DestinationPath $siteArchive -CompressionLevel Optimal
& git -C $projectRoot archive --format=zip --output=$sourceArchive HEAD
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel criar o pacote do codigo-fonte.' }

$commit = (& git -C $projectRoot rev-parse HEAD).Trim()
$created = Get-Date -Format 'dd/MM/yyyy HH:mm:ss zzz'
@"
TSP ENERGY SOLAR
Versao: $version
Criado em: $created
Commit: $commit

site.zip: arquivos prontos para publicacao.
codigo.zip: codigo-fonte versionado no Git.
Dados de clientes e Firebase nao estao incluidos neste backup do site.
"@ | Set-Content -LiteralPath (Join-Path $versionFolder 'LEIA-ME.txt') -Encoding UTF8

Write-Output "Backup criado em: $versionFolder"
