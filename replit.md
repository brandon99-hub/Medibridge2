# MediBridge - Healthcare Record Interoperability System

## Overview

MediBridge is a full-stack healthcare record interoperability system that enables secure sharing of patient records between different hospitals. The system implements a two-hospital model where Hospital A submits patient records and Hospital B can retrieve them with proper consent management.

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
- `/api/submit_record` - Hospital A record submission
- `/api/get_records` - Hospital B record retrieval
- `/api/consent` - Consent management system
- Authentication endpoints for login/logout/registration

### Frontend Components
- **Hospital A Interface**: Record submission form with validation
- **Hospital B Interface**: Patient search and record retrieval
- **Consent Modal**: Interactive consent management dialog
- **Navigation Header**: Hospital switching and user management

## Data Flow

1. **Record Submission**: Hospital A authenticates and submits patient records through validated forms
2. **Record Storage**: Data is validated, stored in PostgreSQL with proper relationships
3. **Record Retrieval**: Hospital B searches for patient records by national ID
4. **Consent Process**: System prompts for consent before displaying sensitive medical data
5. **Audit Trail**: All access is logged in consent records for compliance

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

Changelog:
- June 24, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.