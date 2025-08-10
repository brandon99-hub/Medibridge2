# Patent Drawings Guide for Draw.io

## Overview
This guide provides detailed descriptions and simple diagrams for creating the 8 patent figures in draw.io. Each figure should be created as a black and white line drawing with clear labels and reference numbers.

---

## Fig. 1: System Architecture Diagram

### Description
Overall medical record interoperability system showing all major components and their relationships.

### Draw.io Elements to Use
- **Rectangles** for system components
- **Arrows** for data flow
- **Cloud shapes** for decentralized networks
- **Text boxes** for labels

### Layout Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                    MEDICAL RECORD INTEROPERABILITY SYSTEM       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   HOSPITAL  │    │ DECENTRALIZED│    │   HOSPITAL  │
│      A      │───▶│   STORAGE    │───▶│      B      │
│  INTERFACE  │    │   NETWORK    │    │  INTERFACE  │
│     12      │    │     14       │    │     20      │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ ZERO-KNOWLEDGE│    │ VERIFIABLE   │    │ PATIENT      │
│    PROOF     │    │ CREDENTIAL   │    │ IDENTITY     │
│   SYSTEM     │    │   SYSTEM     │    │ MANAGEMENT   │
│     16       │    │     18       │    │     22       │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   TRIPLE     │    │   EMERGENCY  │    │   AUDIT      │
│ REDUNDANCY   │    │    ACCESS    │    │   SYSTEM     │
│   STORAGE    │    │   SYSTEM     │    │              │
│     24       │    │     26       │    │              │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Reference Numbers to Include
- 10: Medical record interoperability system
- 12: First hospital interface
- 14: Decentralized storage network
- 16: Zero-knowledge proof system
- 18: Verifiable credential system
- 20: Second hospital interface
- 22: Patient identity management system
- 24: Triple redundancy storage system
- 26: Emergency access system

---

## Fig. 2: Medical Record Submission Process Flow

### Description
Flow diagram showing the step-by-step process of submitting medical records from Hospital A to decentralized storage.

### Draw.io Elements to Use
- **Ovals** for start/end points
- **Rectangles** for process steps
- **Diamonds** for decision points
- **Arrows** for flow direction

### Layout Structure
```
                    START
                      │
                      ▼
┌─────────────────────────────────────┐
│         DATA INPUT STEP 32          │
│  Receive medical record from        │
│  Hospital A (patient info,          │
│  diagnosis, prescription, etc.)      │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│       ENCRYPTION STEP 34            │
│  Apply AES-256-GCM encryption       │
│  with patient-specific key          │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│    DECENTRALIZED STORAGE STEP 36    │
│  Store on IPFS + Filecoin + Local   │
│  with triple redundancy             │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│      CONFIRMATION STEP 38           │
│  Provide storage confirmations      │
│  (CIDs, deal IDs, verification      │
│  codes)                             │
└─────────────────────────────────────┘
                      │
                      ▼
                    END
```

### Reference Numbers to Include
- 30: Medical record submission process
- 32: Data input step
- 34: Encryption step
- 36: Decentralized storage step
- 38: Confirmation step

---

## Fig. 3: Zero-Knowledge Proof Generation and Verification

### Description
Flow diagram showing how zero-knowledge proofs are generated and verified for medical data privacy.

### Draw.io Elements to Use
- **Rectangles** for processes
- **Hexagons** for cryptographic operations
- **Arrows** for data flow
- **Cloud shapes** for external systems

### Layout Structure
```
┌─────────────────────────────────────┐
│      MEDICAL DATA INPUT             │
│  (diagnosis, prescription,          │
│   treatment details)                │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│      PROOF GENERATION STEP 42       │
│  Create cryptographic proofs using  │
│  ZoKrates circuits and Poseidon     │
│  hash functions                     │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│   CRYPTOGRAPHIC VERIFICATION STEP 44│
│  Validate proofs using public       │
│  verification keys                  │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│     SELECTIVE DISCLOSURE STEP 46    │
│  Allow patients to control which    │
│  specific information is revealed   │
└─────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────┐
│      VERIFICATION CODES             │
│  Share codes with hospitals for     │
│  proof validation                   │
└─────────────────────────────────────┘
```

### Reference Numbers to Include
- 40: Zero-knowledge proof system
- 42: Proof generation step
- 44: Cryptographic verification step
- 46: Selective disclosure step

---

## Fig. 4: Verifiable Credential-Based Consent Management

### Description
Flow diagram showing the consent request, approval, and credential issuance process.

### Draw.io Elements to Use
- **Rectangles** for processes
- **Ovals** for actors (Hospital B, Patient)
- **Arrows** for interactions
- **Hexagons** for cryptographic operations

### Layout Structure
```
┌─────────────┐    ┌─────────────────────────────────────┐
│   HOSPITAL  │───▶│      CONSENT REQUEST STEP 52        │
│      B      │    │  Submit request with hospital DID,  │
│             │    │  record identifiers, and purpose    │
└─────────────┘    └─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              PATIENT APPROVAL STEP 54                   │
│  Present consent request showing:                       │
│  - What data will be shared                            │
│  - With which hospital                                  │
│  - For how long                                         │
│  - For what purpose                                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│           CREDENTIAL ISSUANCE STEP 56                   │
│  Create cryptographically signed JWT credential         │
│  with patient DID as issuer, hospital DID as subject,  │
│  record CIDs, and time-limited permissions              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│          CREDENTIAL VERIFICATION STEP 58                │
│  Validate credential signature, expiration,             │
│  and revocation status before granting access           │
└─────────────────────────────────────────────────────────┘
```

### Reference Numbers to Include
- 50: Verifiable credential system
- 52: Consent request step
- 54: Patient approval step
- 56: Credential issuance step
- 58: Credential verification step

---

## Fig. 5: Medical Record Access Process at Hospital B

### Description
Flow diagram showing how Hospital B accesses medical records using cryptographic verification.

### Draw.io Elements to Use
- **Rectangles** for processes
- **Cloud shapes** for storage systems
- **Arrows** for data flow
- **Hexagons** for verification steps

### Layout Structure
```
┌─────────────┐    ┌─────────────────────────────────────┐
│   HOSPITAL  │───▶│    CREDENTIAL SUBMISSION STEP 62    │
│      B      │    │  Submit verifiable credential to    │
│             │    │  system backend                     │
└─────────────┘    └─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              VERIFICATION STEP 64                       │
│  Validate credential signature, check expiration        │
│  and revocation status, verify hospital authorization   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              DECRYPTION STEP 66                         │
│  Retrieve encrypted records from IPFS using CIDs,       │
│  decrypt using patient's encryption key                 │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│            RECORD DISPLAY STEP 68                       │
│  Present decrypted medical records in secure            │
│  interface, log all access attempts                     │
└─────────────────────────────────────────────────────────┘
```

### Reference Numbers to Include
- 60: Medical record access process
- 62: Credential submission step
- 64: Verification step
- 66: Decryption step
- 68: Record display step

---

## Fig. 6: Triple Redundancy Storage Architecture

### Description
System diagram showing the three-layer storage architecture (IPFS + Filecoin + Local).

### Draw.io Elements to Use
- **Rectangles** for storage layers
- **Cloud shapes** for networks
- **Arrows** for data flow
- **Text boxes** for descriptions

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│              MEDICAL RECORD DATA                        │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              ENCRYPTION LAYER                           │
│         AES-256-GCM with patient-specific key          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              TRIPLE REDUNDANCY STORAGE                  │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   IPFS      │    │  FILECOIN   │    │   LOCAL     │
│  STORAGE    │    │  ARCHIVAL   │    │   BACKUP    │
│   LAYER     │    │   LAYER     │    │   LAYER     │
│     72      │    │     74      │    │     76      │
│             │    │             │    │             │
│ - Immediate │    │ - Long-term │    │ - Emergency │
│   access    │    │   storage   │    │   access    │
│ - Multiple  │    │ - Crypto    │    │ - Secure    │
│   nodes     │    │   proofs    │    │   servers   │
└─────────────┘    └─────────────┘    └─────────────┘
         │                    │                    │
         └──────────┬─────────┴─────────┬──────────┘
                    ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              FAILOVER MECHANISM                         │
│  Automatic routing to most available storage layer      │
└─────────────────────────────────────────────────────────┘
```

### Reference Numbers to Include
- 70: Triple redundancy storage system
- 72: IPFS storage layer
- 74: Filecoin archival layer
- 76: Local backup layer

---

## Fig. 7: Patient Identity Management and DID Generation

### Description
Flow diagram showing the patient identity management process including DID generation and key management.

### Draw.io Elements to Use
- **Ovals** for start/end points
- **Rectangles** for processes
- **Hexagons** for cryptographic operations
- **Arrows** for flow direction

### Layout Structure
```
                    START
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           DID GENERATION STEP 82                        │
│  Create unique decentralized identifier using           │
│  did:key format, cryptographically verifiable           │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           KEY MANAGEMENT STEP 84                        │
│  Securely store patient private keys using              │
│  AES-256-GCM encryption with patient-specific salt     │
│  and PBKDF2 key derivation                              │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         IDENTITY VERIFICATION STEP 86                   │
│  Verify patient identity through:                       │
│  - Phone number verification                            │
│  - Email verification                                   │
│  - Wallet signature verification (advanced users)      │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              KEY EXPORT OPTIONS                         │
│  - QR code export                                       │
│  - Recovery phrase (12 words)                           │
│  - Secure backup mechanisms                             │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
                    END
```

### Reference Numbers to Include
- 80: Patient identity management system
- 82: DID generation step
- 84: Key management step
- 86: Identity verification step

---

## Fig. 8: Emergency Access Protocols

### Description
System diagram showing emergency access protocols with time-limited credentials.

### Draw.io Elements to Use
- **Rectangles** for processes
- **Ovals** for actors
- **Arrows** for flow
- **Hexagons** for time-based operations

### Layout Structure
```
┌─────────────┐    ┌─────────────────────────────────────┐
│ EMERGENCY   │───▶│      EMERGENCY REQUEST STEP 92      │
│ PROVIDER    │    │  Request emergency access when      │
│             │    │  immediate care is required          │
└─────────────┘    └─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│           RAPID VERIFICATION STEP 94                    │
│  Expedited verification using pre-approved              │
│  emergency protocols and physician credentials          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│         TIME-LIMITED ACCESS STEP 96                     │
│  Grant temporary access for limited duration            │
│  (typically 24-72 hours) with automatic expiration      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│        AUTOMATIC REVOCATION STEP 98                     │
│  Immediately revoke access permissions when             │
│  emergency period expires                               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              NOTIFICATION SYSTEM                        │
│  - Immediate patient notification                       │
│  - Detailed audit trails                                │
│  - Compliance reporting                                 │
└─────────────────────────────────────────────────────────┘
```

### Reference Numbers to Include
- 90: Emergency access system
- 92: Emergency request step
- 94: Rapid verification step
- 96: Time-limited access step
- 98: Automatic revocation step

---

## Draw.io Tips

### General Guidelines
1. **Use black and white only** - No colors for patent drawings
2. **Keep it simple** - Clean lines, clear labels
3. **Use consistent fonts** - Arial or similar sans-serif
4. **Add reference numbers** - Match the numbers in the patent specification
5. **Include titles** - Each figure should have a clear title

### Recommended Settings
- **Page size**: A4 or Letter
- **Grid**: Enable for alignment
- **Snap to grid**: Enable for clean lines
- **Line thickness**: 1-2px for most elements
- **Font size**: 10-12pt for labels, 14-16pt for titles

### Export Settings
- **Format**: PNG or SVG
- **Resolution**: 300 DPI minimum
- **Background**: White
- **Transparency**: Disabled

### File Naming
Save each figure as:
- `Fig1-System-Architecture.png`
- `Fig2-Submission-Process.png`
- `Fig3-ZKP-Generation.png`
- `Fig4-Consent-Management.png`
- `Fig5-Record-Access.png`
- `Fig6-Storage-Architecture.png`
- `Fig7-Identity-Management.png`
- `Fig8-Emergency-Access.png`

---

## Quick Start in Draw.io

1. **Open draw.io** (diagrams.net)
2. **Create new diagram**
3. **Choose template**: Basic → Flowchart
4. **Use the layout structures** provided above
5. **Add reference numbers** as shown
6. **Export as PNG** at 300 DPI
7. **Save each figure separately**

This guide provides everything you need to create professional patent drawings that accurately represent your MediBridge system's architecture and processes. 