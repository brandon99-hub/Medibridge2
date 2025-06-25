MediBridge: Decentralized Healthcare Record Interoperability Platform
 Overview
MediBridge is a Web3-enhanced healthcare data interoperability system designed for secure, consent-based sharing of patient medical records between hospitals. Built with "Invisible Web3 Design," MediBridge fuses the cryptographic integrity of decentralized identity and storage with a Web2-friendly user experience optimized for emerging healthcare systems, including Kenya's mobile-first infrastructure.
This project was developed from scratch as part of the Fresh Code Challenge (May 15 – July 6, 2025).
________________________________________
 Problem Statement
In most healthcare systems, especially in developing nations, medical records are siloed within individual hospitals. This leads to:
•	Repeated tests
•	Incomplete histories
•	Delayed emergency care
•	Privacy violations due to poor data governance
Patients lack visibility and control over their own data. There is no standardized, secure mechanism for inter-hospital record access with patient consent.
________________________________________
 Our Solution
MediBridge offers a dual-mode system:
•	Traditional Flow: Hospital-to-hospital record sharing using national ID and encrypted PostgreSQL storage
•	Web3 Flow: Cryptographic consent, decentralized identity (DID), encrypted record storage via IPFS, and verifiable credentials (VCs)
Patients authenticate using simple phone/email OTP, but behind the scenes, a decentralized identity is created, private keys are securely stored, and encrypted records are linked to the patient's DID. Hospitals access only what the patient consents to via VC-based cryptographic authorization.
________________________________________
 Tech Stack
•	Frontend: React 18 + TypeScript + Tailwind + shadcn/ui + TanStack Query
•	Backend: Node.js + Express.js
•	Database: PostgreSQL (hosted on Neon), managed with Drizzle ORM
•	Web3 Layer:
o	Decentralized Identity (did:key)
o	Verifiable Credentials (JWT + ECDSA)
o	IPFS for encrypted medical records
o	Web3.storage (with failover support)
•	Security:
o	AES-256-GCM for record encryption
o	PBKDF2 key derivation (100,000 iterations)
o	Encrypted key vault for private key storage
o	Full audit logs with integrity checks
________________________________________
 Key Features
 Patient Experience
•	No wallets or blockchain jargon
•	Simple login via phone/email OTP
•	Automatic DID + key creation
•	Private data encrypted and stored on IPFS
•	Full consent dashboard to manage record access
 Hospital Workflow
•	Hospital A: Creates patient records
o	Dual-mode submission (traditional or Web3/IPFS)
o	AES-encrypted records stored securely
•	Hospital B: Searches patient using ID or DID
o	Consent modal with 3-tab wizard: Overview, Records, Authorization
o	Receives access only after patient VC approval
 Consent System
•	VCs are issued by the patient per record (or category)
•	VCs are signed using patient’s private key
•	Hospitals submit VC to backend to gain access
•	Revocable, time-limited, auditable
 Emergency Protocol
•	Dual-doctor override with audit logging
•	Next-of-kin contact system
•	Auto-revoking credentials post-emergency
________________________________________
 Security Highlights
•	End-to-end AES-256-GCM encryption for all records
•	Tamper-proof audit logs with IP + timestamp
•	Rate limiting, CSRF, session security, and brute force protection
•	Decentralized storage with redundancy (Web3.storage + Pinata + Infura + local node)
________________________________________
 Build Process
•	All code was written during the hackathon window (May 15 – July 6, 2025)
•	System was first prototyped on Replit
•	Pulled to local dev environment, connected to Neon PostgreSQL
•	Deployed to Render (fullstack deployment)
•	Encrypted IPFS files hosted via Web3.storage
________________________________________
 Walkthrough Video
[Link to video walkthrough coming soon]
________________________________________
 GitHub Repo
[Insert GitHub repository link here]
________________________________________
 Future Plans
•	DID communication via Ceramic network
•	Integration with national health registries
•	FHIR support for record interoperability
•	AI analytics layer for population-level health trends
________________________________________
 Team
Brandon Mwenja  - Fullstack Engineer | Kenya
•	Led system architecture, encryption flows, backend logic, and frontend UI/UX
________________________________________

