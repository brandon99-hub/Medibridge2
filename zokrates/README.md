# ZoKrates Setup for MediBridge

This directory contains the ZoKrates circuits and setup for the MediBridge ZKP system.

## Prerequisites

1. **Install ZoKrates CLI**:
   - Visit: https://zokrates.github.io/gettingstarted.html
   - Follow the installation instructions for your platform

2. **Verify Installation**:
   ```bash
   zokrates --version
   ```

## Setup

### Windows (PowerShell)
```powershell
.\setup.ps1
```

### Linux/Mac (Bash)
```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup
```bash
# Compile the circuit
zokrates compile -i circuits/medical_proof.zok -o artifacts/medical_proof

# Setup proving and verification keys
zokrates setup -i artifacts/medical_proof -p artifacts/medical_proof/proving.key -v artifacts/medical_proof/verification.key

# Export verifier contract (optional)
zokrates export-verifier -i artifacts/medical_proof/verification.key -o artifacts/medical_proof/verifier.sol
```

## Circuit Description

The `medical_proof.zok` circuit implements the same logic as the previous Noir circuit:

- **Inputs**: Medical record data (diagnosis, prescription, treatment)
- **Outputs**: Proof that the record exists and has specific properties
- **Functionality**: Proves medical facts without revealing actual data

## Usage

After setup, the ZKP service will automatically use the compiled circuit for:
- Proof generation
- Proof verification
- Selective disclosure
- Emergency access

## Files

- `circuits/medical_proof.zok` - Main ZoKrates circuit
- `artifacts/medical_proof/` - Compiled circuit and keys
- `setup.ps1` - Windows setup script
- `setup.sh` - Linux/Mac setup script

## Migration from Noir

This replaces the previous Noir implementation with ZoKrates for better Windows compatibility and simpler toolchain management. 