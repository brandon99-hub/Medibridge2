# ZoKrates Setup Script for MediBridge (Windows PowerShell)
Write-Host "Setting up ZoKrates for MediBridge..." -ForegroundColor Green

# Check if ZoKrates is installed
try {
    $null = Get-Command zokrates -ErrorAction Stop
    Write-Host "ZoKrates found!" -ForegroundColor Green
} catch {
    Write-Host "ZoKrates is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Visit: https://zokrates.github.io/gettingstarted.html" -ForegroundColor Yellow
    exit 1
}

# Create artifacts directory
if (!(Test-Path "artifacts/medical_proof")) {
    New-Item -ItemType Directory -Path "artifacts/medical_proof" -Force
    Write-Host "Created artifacts directory" -ForegroundColor Green
}

# Compile the circuit
Write-Host "Compiling medical proof circuit..." -ForegroundColor Yellow
zokrates compile -i circuits/medical_proof.zok -o artifacts/medical_proof

# Setup proving and verification keys
Write-Host "Setting up proving and verification keys..." -ForegroundColor Yellow
zokrates setup -i artifacts/medical_proof -p artifacts/medical_proof/proving.key -v artifacts/medical_proof/verification.key

# Export verifier contract (optional)
Write-Host "Exporting verifier contract..." -ForegroundColor Yellow
zokrates export-verifier -i artifacts/medical_proof/verification.key -o artifacts/medical_proof/verifier.sol

Write-Host "ZoKrates setup complete!" -ForegroundColor Green
Write-Host "Circuit compiled and keys generated in artifacts/medical_proof/" -ForegroundColor Cyan 