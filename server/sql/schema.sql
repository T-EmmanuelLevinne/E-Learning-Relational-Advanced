-- =============================================================================
-- Clinic BCNF Database Management System - Supabase PostgreSQL Schema
-- Based on Topic 1: Advanced Relational Database Design (BCNF) - Slides 14-16
-- =============================================================================

-- Clean reset (safe on a fresh database or when re-running in Supabase SQL Editor)
DROP VIEW IF EXISTS public.clinic_schedule_view CASCADE;
DROP TABLE IF EXISTS public.patient_doctor CASCADE;
DROP TABLE IF EXISTS public.doctor_specialty CASCADE;
DROP TABLE IF EXISTS public.flawed_patient_appointments CASCADE;
DROP FUNCTION IF EXISTS public.enforce_one_doctor_per_specialty() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_specialty_change_rule() CASCADE;

-- -----------------------------------------------------------------------------
-- 1. BCNF Table 1: doctor_specialty
--    Resolves the rule-breaking dependency: Doctor -> Specialty
--    Primary Key: doctor (now every determinant is a superkey!)
-- -----------------------------------------------------------------------------
CREATE TABLE public.doctor_specialty (
  doctor TEXT PRIMARY KEY,
  specialty TEXT NOT NULL CHECK (char_length(trim(specialty)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. BCNF Table 2: patient_doctor
--    Connects patients to doctors without storing redundant specialty text.
--    Composite Primary Key: (patient, doctor)
--    Foreign Key: doctor -> doctor_specialty(doctor)
-- -----------------------------------------------------------------------------
CREATE TABLE public.patient_doctor (
  patient TEXT NOT NULL CHECK (char_length(trim(patient)) > 0),
  doctor TEXT NOT NULL REFERENCES public.doctor_specialty(doctor)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (patient, doctor)
);

-- -----------------------------------------------------------------------------
-- 3. Business Rule Trigger: (Patient, Specialty) -> Doctor
--    A patient can see multiple doctors, but only ONE doctor per specialty.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_one_doctor_per_specialty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_specialty TEXT;
  conflicting_doctor TEXT;
BEGIN
  SELECT specialty INTO new_specialty
  FROM public.doctor_specialty
  WHERE doctor = NEW.doctor;

  IF new_specialty IS NULL THEN
    RAISE EXCEPTION 'Doctor "%" does not exist in doctor_specialty.', NEW.doctor;
  END IF;

  SELECT pd.doctor INTO conflicting_doctor
  FROM public.patient_doctor pd
  JOIN public.doctor_specialty ds ON ds.doctor = pd.doctor
  WHERE pd.patient = NEW.patient
    AND ds.specialty = new_specialty
    AND pd.doctor <> NEW.doctor
  LIMIT 1;

  IF conflicting_doctor IS NOT NULL THEN
    RAISE EXCEPTION
      'BCNF Business Rule Violation: Patient "%" already sees "%" for "%". Only one doctor per specialty is allowed.',
      NEW.patient, conflicting_doctor, new_specialty
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_doctor_specialty_rule
BEFORE INSERT OR UPDATE ON public.patient_doctor
FOR EACH ROW
EXECUTE FUNCTION public.enforce_one_doctor_per_specialty();

-- Also guard against changing a doctor's specialty if a patient of theirs
-- already sees another doctor in the target specialty.
CREATE OR REPLACE FUNCTION public.enforce_specialty_change_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_patient TEXT;
  conflict_other_doctor TEXT;
BEGIN
  IF NEW.specialty IS DISTINCT FROM OLD.specialty THEN
    SELECT pd1.patient, pd2.doctor
    INTO conflict_patient, conflict_other_doctor
    FROM public.patient_doctor pd1
    JOIN public.patient_doctor pd2
      ON pd1.patient = pd2.patient AND pd2.doctor <> NEW.doctor
    JOIN public.doctor_specialty ds2
      ON ds2.doctor = pd2.doctor
    WHERE pd1.doctor = NEW.doctor
      AND ds2.specialty = NEW.specialty
    LIMIT 1;

    IF conflict_patient IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot change "%" to "%" because patient "%" already sees "%" for "%".',
        NEW.doctor, NEW.specialty, conflict_patient, conflict_other_doctor, NEW.specialty
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_doctor_specialty_update_rule
BEFORE UPDATE OF specialty ON public.doctor_specialty
FOR EACH ROW
EXECUTE FUNCTION public.enforce_specialty_change_rule();

-- -----------------------------------------------------------------------------
-- 4. Joined View (Virtual reconstruction of Patient_Appointments without redundancy)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.clinic_schedule_view AS
SELECT
  pd.patient,
  ds.specialty,
  pd.doctor,
  pd.created_at
FROM public.patient_doctor pd
JOIN public.doctor_specialty ds ON ds.doctor = pd.doctor
ORDER BY pd.patient, ds.specialty;

-- -----------------------------------------------------------------------------
-- 5. Flawed 3NF Table (ONLY for the Anomaly Lab comparison tab - Slide 15)
--    In 3NF (PK = patient, specialty), but violates BCNF because Doctor -> Specialty
--    and Doctor is NOT a superkey.
-- -----------------------------------------------------------------------------
CREATE TABLE public.flawed_patient_appointments (
  patient TEXT NOT NULL CHECK (char_length(trim(patient)) > 0),
  specialty TEXT NOT NULL CHECK (char_length(trim(specialty)) > 0),
  doctor TEXT NOT NULL CHECK (char_length(trim(doctor)) > 0),
  PRIMARY KEY (patient, specialty)
);

-- -----------------------------------------------------------------------------
-- 6. Seed Exact Slide 15 Dataset
-- -----------------------------------------------------------------------------
INSERT INTO public.doctor_specialty (doctor, specialty) VALUES
  ('Dr. Heart', 'Cardiology'),
  ('Dr. Skin', 'Dermatology'),
  ('Dr. Rash', 'Dermatology');

INSERT INTO public.patient_doctor (patient, doctor) VALUES
  ('Alice', 'Dr. Heart'),
  ('Bob', 'Dr. Skin'),
  ('Alice', 'Dr. Rash'),
  ('Charlie', 'Dr. Heart');

INSERT INTO public.flawed_patient_appointments (patient, specialty, doctor) VALUES
  ('Alice', 'Cardiology', 'Dr. Heart'),
  ('Bob', 'Dermatology', 'Dr. Skin'),
  ('Alice', 'Dermatology', 'Dr. Rash'),
  ('Charlie', 'Cardiology', 'Dr. Heart');
