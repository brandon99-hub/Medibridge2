# MediBridge - Web3 Healthcare Record Interoperability System

## Overview

MediBridge is a healthcare record interoperability system with **Web3 principles and Web2 user experience**. Patients authenticate via simple phone/OTP login while the backend automatically generates DIDs, manages encrypted IPFS storage, and issues verifiable credentials. The system provides cryptographic consent management without requiring patients to understand wallets, keys, or blockchain concepts.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom medical theme variables
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Management**: Express sessions with PostgreSQL store
- **Password Security**: Node.js crypto module with scrypt hashing
- **API Design**: RESTful endpoints with role-based access control

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **Migrations**: Drizzle Kit for database schema management
- **Session Store**: PostgreSQL-based session storage using connect-pg-simple

## Key Components

### Database Schema
- **Users Table**: Stores hospital authentication and type information
- **Patient Records Table**: Core medical record data with consent tracking
- **Consent Records Table**: Audit trail for data access and consent management
- **Relationships**: Proper foreign key relationships between all entities

### Authentication System
- Session-based authentication with secure password hashing
- Role-based access control (Hospital A vs Hospital B permissions)
- CSRF protection and secure session configuration

### API Endpoints

**Traditional Healthcare APIs:**
- `/api/submit_record` - Hospital A record submission
- `/api/get_records` - Hospital B record retrieval
- `/api/consent` - Consent management system
- Authentication endpoints for login/logout/registration

**Web3 Healthcare APIs:**
- `/api/patient/request-otp` - Send OTP to patient phone for authentication
- `/api/patient/verify-otp` - Verify OTP and create/login patient (auto-generates DID)
- `/api/issue-consent/` - Issue verifiable credential when patient grants consent
- `/api/get-record/` - Access encrypted medical records using verifiable credential
- `/api/patient/me` - Get current patient session information
- `/api/patient/logout` - Patient logout and session cleanup
- Legacy Web3 routes for MetaMask wallet integration (optional advanced use)

### Frontend Components
- **Hospital A Interface**: Dual-mode record submission (traditional + Web3/IPFS)
- **Hospital B Interface**: Patient search using national ID or DID
- **Web3 Patient Dashboard**: Patient identity management and consent control
- **Consent Modal**: Interactive consent management dialog
- **Navigation Header**: Hospital switching and Web3 patient access
- **Wallet Integration**: MetaMask connection and Web3 authentication

## Data Flow

**Traditional Flow:**
1. **Record Submission**: Hospital A authenticates and submits patient records through validated forms
2. **Record Storage**: Data is validated, stored in PostgreSQL with proper relationships
3. **Record Retrieval**: Hospital B searches for patient records by national ID
4. **Consent Process**: System prompts for consent before displaying sensitive medical data
5. **Audit Trail**: All access is logged in consent records for compliance

**Web3 Flow:**
1. **Patient Identity Creation**: Patient generates DID and connects wallet (MetaMask)
2. **Record Submission**: Hospital A submits encrypted records to IPFS with patient DID
3. **Access Request**: Hospital B requests access using patient DID
4. **Consent Verification**: Patient grants consent via verifiable credential
5. **Record Access**: Hospital B accesses decrypted records from IPFS
6. **Consent Management**: Patient can revoke access and control data sharing

## External Dependencies

### Backend Dependencies
- `@neondatabase/serverless` - Neon PostgreSQL serverless driver
- `drizzle-orm` - Type-safe database ORM
- `passport` - Authentication middleware
- `express-session` - Session management
- `connect-pg-simple` - PostgreSQL session store

### Frontend Dependencies
- `@tanstack/react-query` - Server state management
- `@radix-ui/*` - Accessible UI primitives
- `react-hook-form` - Form handling and validation
- `zod` - Runtime type validation
- `tailwindcss` - Utility-first CSS framework

### Development Tools
- `vite` - Frontend build tool and dev server
- `typescript` - Type safety across the stack
- `drizzle-kit` - Database migration tool
- `tsx` - TypeScript execution for development

## Deployment Strategy

### Environment Configuration
- **Development**: Uses Vite dev server with hot reload and TSX for backend
- **Production**: Static frontend build served by Express with esbuild-bundled backend
- **Database**: Requires `DATABASE_URL` environment variable for PostgreSQL connection
- **Sessions**: Requires `SESSION_SECRET` for secure session encryption

### Build Process
1. Frontend build using Vite outputs to `dist/public`
2. Backend build using esbuild bundles to `dist/index.js`
3. Production deployment serves static files and API from single Express server

### Replit Configuration
- Configured for Node.js 20 with PostgreSQL 16 module
- Auto-scaling deployment target
- Port 5000 mapped to external port 80
- Parallel workflow execution for development

## Changelog

- June 24, 2025: **Web3 Backend with Web2 Frontend Complete**
  - Implemented phone/OTP patient authentication with automatic DID generation
  - Created encrypted medical record storage on simulated IPFS
  - Built verifiable credentials system for cryptographic consent management
  - Added `/api/issue-consent/` and `/api/get-record/` endpoints for VC-based access
  - Patients use simple phone login - all Web3 complexity hidden in backend
  - Enhanced consent modal with secure phone authentication option
  - Created Web3 consent demo showing full cryptographic flow
  - Maintained existing MetaMask wallet integration for advanced users
- June 24, 2025: **Web3 Transformation Complete**
  - Added decentralized identity (DID) support using `did:key` format
  - Implemented IPFS storage for patient records with encryption
  - Created verifiable credentials system for consent management
  - Added MetaMask wallet integration for patients
  - Built Web3 patient dashboard for identity and consent control
  - Enhanced Hospital A interface with IPFS record submission
  - Enhanced Hospital B interface with DID-based record search
  - Created comprehensive Web3 backend services and routes
- June 24, 2025: Initial healthcare interoperability system setup

## User Preferences

Preferred communication style: Simple, everyday language.
- User wants navigation back buttons for standalone pages like Web3 dashboard
- User needs better MetaMask connection error handling and guidance
- User expects visible Web3 features integrated into main hospital interfaces, not hidden
- User wants patient login indicators and real patient consent verification system
- User expects Web3 functionality to be prominently displayed in Hospital B interface