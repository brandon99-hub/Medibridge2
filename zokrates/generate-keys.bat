@echo off
echo Generating ZoKrates proving and verification keys...
echo.

docker run --rm -v "%~dp0:/home/zokrates/code" -w /home/zokrates/code zokrates/zokrates:latest zokrates setup -i circuits/medical_proof.zok

echo.
echo Setup complete! Check the artifacts/medical_proof/ directory for the generated keys.
pause 