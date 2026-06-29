$EnvFile = ".env"

$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$token = [System.Convert]::ToBase64String($bytes) -replace '[=+/]', ''
$token = $token.Substring(0, [Math]::Min(43, $token.Length))

$exists = $false
if (Test-Path $EnvFile) {
    $lines = Get-Content $EnvFile
    $exists = ($lines | Where-Object { $_ -match '^INGEST_TOKEN=' }).Count -gt 0
}

if ($exists) {
    $ans = Read-Host "INGEST_TOKEN già presente in .env. Sovrascrivere? [y/N]"
    if ($ans -notmatch '^[yY]$') {
        Write-Host "Annullato."
        exit 0
    }
    $updated = $lines -replace '^INGEST_TOKEN=.*', "INGEST_TOKEN=$token"
    $updated | Set-Content $EnvFile -Encoding utf8
} else {
    Add-Content $EnvFile "`nINGEST_TOKEN=$token" -Encoding utf8
}

Write-Host "✔ INGEST_TOKEN generato e salvato in .env"
Write-Host "Chiave: $token"
Write-Host "Conservala — non verrà mostrata di nuovo."
