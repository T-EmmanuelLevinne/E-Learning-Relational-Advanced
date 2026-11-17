import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../db/supabaseClient.js';
import { fetchClinicSnapshot } from '../services/clinicDataService.js';
import { addSqlLog } from '../services/sqlLogger.js';

export const simulatorRouter = Router();

const SEED_DOCTORS = [
  { doctor: 'Dr. Heart', specialty: 'Cardiology' },
  { doctor: 'Dr. Skin', specialty: 'Dermatology' },
  { doctor: 'Dr. Rash', specialty: 'Dermatology' },
];

const SEED_APPOINTMENTS = [
  { patient: 'Alice', doctor: 'Dr. Heart' },
  { patient: 'Bob', doctor: 'Dr. Skin' },
  { patient: 'Alice', doctor: 'Dr. Rash' },
  { patient: 'Charlie', doctor: 'Dr. Heart' },
];

const SEED_FLAWED = [
  { patient: 'Alice', specialty: 'Cardiology', doctor: 'Dr. Heart' },
  { patient: 'Bob', specialty: 'Dermatology', doctor: 'Dr. Skin' },
  { patient: 'Alice', specialty: 'Dermatology', doctor: 'Dr. Rash' },
  { patient: 'Charlie', specialty: 'Cardiology', doctor: 'Dr. Heart' },
];

/**
 * Resets both BCNF tables and the flawed 3NF table back to Slide 15's dataset.
 */
simulatorRouter.post('/reset', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();

    await supabase.from('patient_doctor').delete().neq('patient', '');
    await supabase.from('doctor_specialty').delete().neq('doctor', '');
    await supabase.from('flawed_patient_appointments').delete().neq('patient', '');

    const { error: docErr } = await supabase.from('doctor_specialty').insert(SEED_DOCTORS);
    if (docErr) throw docErr;

    const { error: apptErr } = await supabase.from('patient_doctor').insert(SEED_APPOINTMENTS);
    if (apptErr) throw apptErr;

    const { error: flawedErr } = await supabase
      .from('flawed_patient_appointments')
      .insert(SEED_FLAWED);
    if (flawedErr) throw flawedErr;

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'RESET',
      targetTable: 'doctor_specialty, patient_doctor, flawed_patient_appointments',
      sqlPreview: '-- Truncated & re-seeded Slide 15 dataset (Alice, Bob, Charlie | Dr. Heart, Dr. Skin, Dr. Rash)',
      bcnfRule: 'Baseline restored to Slide 15 activity dataset.',
      status: 'SUCCESS',
      detail: 'Reset both BCNF tables and the 3NF comparison table to the Slide 15 dataset.',
    });

    res.json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Update Anomaly Demo:
 * Updates Dr. Heart's specialty on Alice's row ONLY in the flawed 3NF table,
 * while updating Dr. Heart once cleanly in doctor_specialty.
 */
simulatorRouter.post('/update-anomaly', async (req: Request, res: Response) => {
  const newSpecialty = String(req.body?.specialty ?? 'Neurology').trim() || 'Neurology';

  try {
    const supabase = getSupabaseClient();

    // 1. Flawed 3NF table: updates only Alice's row -> leaves Charlie's row saying Cardiology!
    const { data: aliceRow } = await supabase
      .from('flawed_patient_appointments')
      .select('*')
      .eq('patient', 'Alice')
      .eq('doctor', 'Dr. Heart')
      .maybeSingle();

    let flawedOutcome = '';
    if (aliceRow) {
      const { error: flawedUpdErr } = await supabase
        .from('flawed_patient_appointments')
        .update({ specialty: newSpecialty })
        .eq('patient', 'Alice')
        .eq('doctor', 'Dr. Heart');

      flawedOutcome = flawedUpdErr
        ? `3NF update errored: ${flawedUpdErr.message}`
        : `Corrupted data! Alice's row now says Dr. Heart = ${newSpecialty}, while Charlie's row still says Dr. Heart = ${aliceRow.specialty}.`;
    } else {
      flawedOutcome =
        'Alice + Dr. Heart row was not present in the 3NF table (reset to Slide 15 data to re-run cleanly).';
    }

    // 2. BCNF table: single-row update on doctor_specialty
    const { error: bcnfErr } = await supabase
      .from('doctor_specialty')
      .update({ specialty: newSpecialty })
      .eq('doctor', 'Dr. Heart');

    const bcnfOutcome = bcnfErr
      ? `BCNF blocked conflicting update: ${bcnfErr.message}`
      : `Clean single-row update! Updated Dr. Heart -> ${newSpecialty} in doctor_specialty. Both Alice and Charlie automatically reflect ${newSpecialty} via JOIN.`;

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'UPDATE',
      targetTable: 'flawed_patient_appointments vs doctor_specialty',
      sqlPreview: `UPDATE doctor_specialty SET specialty = '${newSpecialty}' WHERE doctor = 'Dr. Heart';`,
      bcnfRule: 'Update Anomaly Test (Slide 13): Doctor -> Specialty stored once in BCNF.',
      status: bcnfErr ? 'BLOCKED' : 'SUCCESS',
      detail: `${flawedOutcome} | BCNF: ${bcnfOutcome}`,
    });

    res.json({
      ...snapshot,
      experiment: {
        type: 'UPDATE_ANOMALY',
        flawedOutcome,
        bcnfOutcome,
      },
      latestLog: log,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Insert Anomaly Demo:
 * Tries to register Dr. Ortho (Orthopedics) with no patients yet.
 * Fails in the single 3NF table because patient is part of PRIMARY KEY (NOT NULL),
 * succeeds cleanly in BCNF doctor_specialty.
 */
simulatorRouter.post('/insert-anomaly', async (req: Request, res: Response) => {
  const doctor = String(req.body?.doctor ?? 'Dr. Ortho').trim() || 'Dr. Ortho';
  const specialty = String(req.body?.specialty ?? 'Orthopedics').trim() || 'Orthopedics';

  try {
    const supabase = getSupabaseClient();

    // 1. Try inserting into flawed_patient_appointments without a patient (violates NOT NULL / PK)
    const { error: flawedErr } = await supabase
      .from('flawed_patient_appointments')
      .insert({ patient: null as unknown as string, specialty, doctor });

    const flawedOutcome = flawedErr
      ? `INSERT FAILED (${flawedErr.code ?? 'Constraint'}): Cannot record "${doctor} -> ${specialty}" without inventing a fake patient because (patient, specialty) is the Primary Key.`
      : 'Unexpectedly inserted.';

    // 2. Insert into BCNF doctor_specialty (upsert-like check)
    const { data: existingDoc } = await supabase
      .from('doctor_specialty')
      .select('doctor')
      .eq('doctor', doctor)
      .maybeSingle();

    let bcnfOutcome = '';
    if (existingDoc) {
      bcnfOutcome = `${doctor} is already registered in doctor_specialty (PK) with no patient required!`;
    } else {
      const { error: bcnfErr } = await supabase
        .from('doctor_specialty')
        .insert({ doctor, specialty });
      bcnfOutcome = bcnfErr
        ? `BCNF insert failed: ${bcnfErr.message}`
        : `INSERT SUCCEEDED! Registered ${doctor} (${specialty}) in doctor_specialty without needing any patient appointment.`;
    }

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'INSERT',
      targetTable: 'flawed_patient_appointments vs doctor_specialty',
      sqlPreview: `INSERT INTO doctor_specialty (doctor, specialty) VALUES ('${doctor}', '${specialty}');`,
      bcnfRule: 'Insert Anomaly Test (Slide 13): Doctors can exist independently of patient appointments.',
      status: 'SUCCESS',
      detail: `${flawedOutcome} | BCNF: ${bcnfOutcome}`,
    });

    res.json({
      ...snapshot,
      experiment: {
        type: 'INSERT_ANOMALY',
        flawedOutcome,
        bcnfOutcome,
      },
      latestLog: log,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Delete Anomaly Demo:
 * Deletes Bob's appointment with Dr. Skin.
 * In the 3NF table, deleting Bob erases the fact that Dr. Skin practices Dermatology.
 * In BCNF, deleting (Bob, Dr. Skin) from patient_doctor preserves Dr. Skin in doctor_specialty.
 */
simulatorRouter.post('/delete-anomaly', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();

    await supabase
      .from('flawed_patient_appointments')
      .delete()
      .eq('patient', 'Bob')
      .eq('doctor', 'Dr. Skin');

    await supabase
      .from('patient_doctor')
      .delete()
      .eq('patient', 'Bob')
      .eq('doctor', 'Dr. Skin');

    const snapshot = await fetchClinicSnapshot();
    const drSkinInFlawed = snapshot.flawedAppointments.some((r) => r.doctor === 'Dr. Skin');
    const drSkinInBcnf = snapshot.doctors.find((d) => d.doctor === 'Dr. Skin');

    const flawedOutcome = drSkinInFlawed
      ? 'Dr. Skin still appears in another row.'
      : 'DATA LOST! Deleting Bob erased Dr. Skin and their Dermatology specialty completely from the 3NF table.';
    const bcnfOutcome = drSkinInBcnf
      ? `DATA PRESERVED! Bob's row was removed from patient_doctor, while "${drSkinInBcnf.doctor} -> ${drSkinInBcnf.specialty}" remains safely in doctor_specialty.`
      : 'Dr. Skin was not in doctor_specialty.';

    const log = addSqlLog({
      operation: 'DELETE',
      targetTable: 'flawed_patient_appointments vs patient_doctor',
      sqlPreview: `DELETE FROM patient_doctor WHERE patient = 'Bob' AND doctor = 'Dr. Skin';`,
      bcnfRule: 'Delete Anomaly Test (Slide 13): Deleting an appointment never deletes doctor metadata.',
      status: 'SUCCESS',
      detail: `${flawedOutcome} | BCNF: ${bcnfOutcome}`,
    });

    res.json({
      ...snapshot,
      experiment: {
        type: 'DELETE_ANOMALY',
        flawedOutcome,
        bcnfOutcome,
      },
      latestLog: log,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
