# 🔐 ZKP (Zero-Knowledge Proofs) Setup Guide

## Overview

The MediBridgeSystem now supports dual-mode ZKP operations:
- **Development Mode**: Uses Docker Zokrates CLI (local development)
- **Production Mode**: Uses pre-compiled artifacts (Render deployment)

## 🚀 Quick Start

### 1. Pre-compile Zokrates Circuits (One-time setup)

Run these commands locally to generate the required artifacts:

```bash
# Navigate to your project root
cd MediBridgeSystem

# Pre-compile all Zokrates circuits
npm run zk:precompile
```

This will create:
- `zokrates/artifacts/medical_proof` (compiled circuit)
- `zokrates/artifacts/medical_proof/proving.key` (proving key)
- `zokrates/artifacts/medical_proof/verification.key` (verification key)
- `zokrates/artifacts/medical_proof/verifier.sol` (smart contract verifier)

### 2. Commit Generated Artifacts

```bash
# Add the generated artifacts to your repository
git add zokrates/artifacts/
git commit -m "Add pre-compiled Zokrates artifacts for production deployment"
```

## 🔄 Development Workflow

### Local Development (Docker Mode)
```bash
# Start development server with Docker Zokrates
npm run dev
```

### Test Production Mode Locally
```bash
# Start development server with pre-compiled artifacts
npm run dev:precompiled
```

### Production Deployment (Render)
```bash
# Build and deploy (automatically uses pre-compiled mode)
npm run build
npm start
```

## 🏗️ Architecture

### Environment Detection
The system automatically detects the environment:

```typescript
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
const usePrecompiled = isProduction || process.env.USE_PRECOMPILED === 'true';
```

### Mode Selection
- **Development**: `NODE_ENV=development` + no `RENDER` env var → Docker mode
- **Production**: `NODE_ENV=production` OR `RENDER` env var → Pre-compiled mode
- **Override**: `USE_PRECOMPILED=true` → Force pre-compiled mode

## 📁 File Structure

```
zokrates/
├── circuits/
│   └── medical_proof.zok          # Zokrates circuit source
├── artifacts/
│   ├── medical_proof              # Compiled circuit
│   ├── medical_proof/
│   │   ├── proving.key           # Proving key
│   │   ├── verification.key      # Verification key
│   │   └── verifier.sol          # Smart contract verifier
│   └── medical_proof_compiled    # Compiled circuit binary
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run zk:compile` | Compile Zokrates circuit |
| `npm run zk:setup` | Generate proving/verification keys |
| `npm run zk:export-verifier` | Export smart contract verifier |
| `npm run zk:precompile` | Run all pre-compilation steps |
| `npm run dev:precompiled` | Test production mode locally |

## 🚨 Important Notes

### For Development
- Keep Docker installed locally
- Use `npm run dev` for normal development
- Docker commands will work as before

### For Production (Render)
- No Docker required
- Uses pre-compiled artifacts
- Automatically detected on Render
- Faster execution (no Docker overhead)

### For Testing
- Use `npm run dev:precompiled` to test production mode locally
- Verify both modes work correctly
- Test ZKP generation and verification

## 🔍 Troubleshooting

### "Pre-compiled artifact not found"
```bash
# Re-run pre-compilation
npm run zk:precompile
```

### "Docker Zokrates not available in pre-compiled mode"
- This is expected in production mode
- Use `npm run dev` for Docker mode
- Use `npm run dev:precompiled` for pre-compiled mode

### "Zokrates CLI not found"
```bash
# Install Zokrates locally (for development)
# Follow official Zokrates installation guide
```

## 📊 Monitoring

### Log Messages
The system logs which mode is being used:
```
[ZKP Service] Environment: development
[ZKP Service] Mode: docker
[ZKP] Using Docker mode for proof generation
```

### Production Logs
```
[ZKP Service] Environment: production
[ZKP Service] Mode: pre-compiled
[ZKP] Using pre-compiled mode for proof generation
```

## 🔄 Updating Circuits

When you modify `zokrates/circuits/medical_proof.zok`:

1. **Re-compile locally**:
   ```bash
   npm run zk:precompile
   ```

2. **Test both modes**:
   ```bash
   npm run dev              # Test Docker mode
   npm run dev:precompiled  # Test pre-compiled mode
   ```

3. **Commit changes**:
   ```bash
   git add zokrates/artifacts/
   git commit -m "Update Zokrates artifacts"
   ```

4. **Deploy to production**:
   - Render will automatically use the new pre-compiled artifacts

## ✅ Verification Checklist

Before deploying to production:

- [ ] Pre-compiled artifacts generated (`npm run zk:precompile`)
- [ ] Artifacts committed to repository
- [ ] Docker mode tested locally (`npm run dev`)
- [ ] Pre-compiled mode tested locally (`npm run dev:precompiled`)
- [ ] ZKP generation works in both modes
- [ ] ZKP verification works in both modes
- [ ] No Docker dependencies in production code

## 🎯 Benefits

### Development
- ✅ Full Zokrates functionality
- ✅ Real-time circuit compilation
- ✅ Easy debugging and testing

### Production
- ✅ No Docker dependency
- ✅ Faster execution
- ✅ Render-compatible
- ✅ Reliable deployment

### Maintenance
- ✅ Single codebase
- ✅ Environment-aware
- ✅ Easy testing
- ✅ Clear separation of concerns 