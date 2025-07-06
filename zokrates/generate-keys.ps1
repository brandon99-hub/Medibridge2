Write-Host "Generating ZoKrates proving and verification keys..." -ForegroundColor Green
Write-Host ""

$currentDir = Get-Location
$dockerCommand = "docker run --rm -v `"${currentDir}:/home/zokrates/code`" -w /home/zokrates/code zokrates/zokrates:latest zokrates setup -i circuits/medical_proof.zok"

Write-Host "Running: $dockerCommand" -ForegroundColor Yellow
Write-Host ""

Invoke-Expression $dockerCommand

Write-Host ""
Write-Host "Setup complete! Check the artifacts/medical_proof/ directory for the generated keys." -ForegroundColor Green
Read-Host "Press Enter to continue" 