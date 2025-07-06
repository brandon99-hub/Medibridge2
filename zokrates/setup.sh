#!/bin/bash

# ZoKrates Setup Script for MediBridge
echo "Setting up ZoKrates for MediBridge..."

# Check if ZoKrates is installed
if ! command -v zokrates &> /dev/null; then
    echo "ZoKrates is not installed. Please install it first."
    echo "Visit: https://zokrates.github.io/gettingstarted.html"
    exit 1
fi

# Create artifacts directory
mkdir -p artifacts/medical_proof

# Compile the circuit
echo "Compiling medical proof circuit..."
zokrates compile -i circuits/medical_proof.zok -o artifacts/medical_proof

# Setup proving and verification keys
echo "Setting up proving and verification keys..."
zokrates setup -i artifacts/medical_proof -p artifacts/medical_proof/proving.key -v artifacts/medical_proof/verification.key

# Export verifier contract (optional)
echo "Exporting verifier contract..."
zokrates export-verifier -i artifacts/medical_proof/verification.key -o artifacts/medical_proof/verifier.sol

echo "ZoKrates setup complete!"
echo "Circuit compiled and keys generated in artifacts/medical_proof/" 