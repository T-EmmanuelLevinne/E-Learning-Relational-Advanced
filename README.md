# Clinic BCNF DBMS (TypeScript + React + Node.js + Supabase)

A full-stack Database Management System applying **Boyce-Codd Normal Form (BCNF)** from *Topic 1: Advanced Relational Database Design - BCNF* (specifically *The Clinic Database Dilemma*, Slides 14–16).

## Architecture

- **Frontend (`client/`):** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend (`server/`):** Node.js + Express + TypeScript (`@supabase/supabase-js`)
- **Database (Supabase / PostgreSQL):**
  - `doctor_specialty(doctor PK, specialty)` — resolves `Doctor -> Specialty`
  - `patient_doctor(patient PK, doctor PK/FK)` — links patients and doctors, with PostgreSQL triggers enforcing `(Patient, Specialty) -> Doctor`
  - `flawed_patient_appointments(patient, specialty, doctor)` — 3NF comparison table used in the **Anomaly Lab** tab

## Quick Start

1. **Configure Supabase:**
   - Create a Supabase project.
   - Copy `server/.env.example` to `server/.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Open the Supabase **SQL Editor** and run `server/sql/schema.sql`.

2. **Install dependencies:**
   ```bash
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

3. **Run development servers (React + Node.js):**
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:4000`
