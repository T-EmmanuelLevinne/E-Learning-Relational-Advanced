import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../db/supabaseClient.js';
import { fetchClinicSnapshot } from '../services/clinicDataService.js';
import { addSqlLog } from '../services/sqlLogger.js';

export const clinicRouter = Router();

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

clinicRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'SELECT',
      targetTable: 'doctor_specialty JOIN patient_doctor',
      sqlPreview:
        'SELECT pd.patient, ds.specialty, pd.doctor FROM patient_doctor pd JOIN doctor_specialty ds ON ds.doctor = pd.doctor ORDER BY pd.patient, ds.specialty;',
      bcnfRule: 'Joined reconstruction from BCNF tables avoids storing redundant specialty values.',
      status: 'SUCCESS',
      detail: `Loaded ${snapshot.doctors.length} doctors and ${snapshot.appointments.length} appointments.`,
    });
    res.json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

clinicRouter.post('/doctors', async (req: Request, res: Response) => {
  const doctor = String(req.body?.doctor ?? '').trim();
  const specialty = String(req.body?.specialty ?? '').trim();

  if (!doctor || !specialty) {
    res.status(400).json({ error: 'Both doctor and specialty are required.' });
    return;
  }

  const sqlPreview = `INSERT INTO doctor_specialty (doctor, specialty) VALUES ('${escapeSql(doctor)}', '${escapeSql(specialty)}');`;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('doctor_specialty')
      .insert({ doctor, specialty });

    if (error) {
      const isDuplicate = error.code === '23505';
      const log = addSqlLog({
        operation: 'INSERT',
        targetTable: 'doctor_specialty',
        sqlPreview,
        bcnfRule: 'Doctor -> Specialty (doctor is PRIMARY KEY; each doctor has exactly one specialty).',
        status: 'BLOCKED',
        detail: isDuplicate
          ? `Doctor "${doctor}" already exists in doctor_specialty.`
          : error.message,
      });
      res.status(isDuplicate ? 409 : 400).json({ error: log.detail, latestLog: log });
      return;
    }

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'INSERT',
      targetTable: 'doctor_specialty',
      sqlPreview,
      bcnfRule: 'No Insert Anomaly: Doctor registered independently without needing a patient.',
      status: 'SUCCESS',
      detail: `Registered ${doctor} (${specialty}).`,
    });
    res.status(201).json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

clinicRouter.patch('/doctors/:doctor', async (req: Request, res: Response) => {
  const doctor = decodeURIComponent(String(req.params.doctor ?? '')).trim();
  const specialty = String(req.body?.specialty ?? '').trim();

  if (!doctor || !specialty) {
    res.status(400).json({ error: 'Doctor and new specialty are required.' });
    return;
  }

  const sqlPreview = `UPDATE doctor_specialty SET specialty = '${escapeSql(specialty)}' WHERE doctor = '${escapeSql(doctor)}';`;

  try {
    const supabase = getSupabaseClient();

    // Verify doctor exists first
    const { data: existing, error: fetchErr } = await supabase
      .from('doctor_specialty')
      .select('doctor, specialty')
      .eq('doctor', doctor)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      res.status(404).json({ error: `Doctor "${doctor}" not found.` });
      return;
    }

    const { error } = await supabase
      .from('doctor_specialty')
      .update({ specialty })
      .eq('doctor', doctor);

    if (error) {
      const log = addSqlLog({
        operation: 'UPDATE',
        targetTable: 'doctor_specialty',
        sqlPreview,
        bcnfRule: 'Guarded (Patient, Specialty) -> Doctor rule.',
        status: 'BLOCKED',
        detail: error.message,
      });
      res.status(error.code === '23505' ? 409 : 400).json({ error: error.message, latestLog: log });
      return;
    }

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'UPDATE',
      targetTable: 'doctor_specialty',
      sqlPreview,
      bcnfRule: 'No Update Anomaly: Updated 1 single row in doctor_specialty; all joined patient rows stay consistent.',
      status: 'SUCCESS',
      detail: `Updated ${doctor}'s specialty from "${existing.specialty}" to "${specialty}".`,
    });
    res.json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

clinicRouter.delete('/doctors/:doctor', async (req: Request, res: Response) => {
  const doctor = decodeURIComponent(String(req.params.doctor ?? '')).trim();
  if (!doctor) {
    res.status(400).json({ error: 'Doctor name is required.' });
    return;
  }

  const sqlPreview = `DELETE FROM doctor_specialty WHERE doctor = '${escapeSql(doctor)}';`;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('doctor_specialty')
      .delete()
      .eq('doctor', doctor);

    if (error) {
      const isFkBlock = error.code === '23503';
      const detail = isFkBlock
        ? `Foreign Key constraint blocked deletion: "${doctor}" still has active appointments in patient_doctor.`
        : error.message;
      const log = addSqlLog({
        operation: 'DELETE',
        targetTable: 'doctor_specialty',
        sqlPreview,
        bcnfRule: 'Referential Integrity (FOREIGN KEY patient_doctor.doctor -> doctor_specialty.doctor).',
        status: 'BLOCKED',
        detail,
      });
      res.status(isFkBlock ? 409 : 400).json({ error: detail, latestLog: log });
      return;
    }

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'DELETE',
      targetTable: 'doctor_specialty',
      sqlPreview,
      bcnfRule: 'Clean deletion of unreferenced doctor from doctor_specialty.',
      status: 'SUCCESS',
      detail: `Removed ${doctor} from doctor_specialty.`,
    });
    res.json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

clinicRouter.post('/appointments', async (req: Request, res: Response) => {
  const patient = String(req.body?.patient ?? '').trim();
  const doctor = String(req.body?.doctor ?? '').trim();
  const replaceExisting = Boolean(req.body?.replaceExisting);

  if (!patient || !doctor) {
    res.status(400).json({ error: 'Both patient and doctor are required.' });
    return;
  }

  const sqlPreview = `INSERT INTO patient_doctor (patient, doctor) VALUES ('${escapeSql(patient)}', '${escapeSql(doctor)}');`;

  try {
    const supabase = getSupabaseClient();

    // Look up the target doctor's specialty to check (Patient, Specialty) -> Doctor cleanly
    const { data: docRow, error: docErr } = await supabase
      .from('doctor_specialty')
      .select('doctor, specialty')
      .eq('doctor', doctor)
      .maybeSingle();

    if (docErr) throw docErr;
    if (!docRow) {
      const log = addSqlLog({
        operation: 'INSERT',
        targetTable: 'patient_doctor',
        sqlPreview,
        bcnfRule: 'Foreign Key constraint: doctor must exist in doctor_specialty.',
        status: 'BLOCKED',
        detail: `Doctor "${doctor}" does not exist in doctor_specialty.`,
      });
      res.status(404).json({ error: log.detail, latestLog: log });
      return;
    }

    // Check if patient already sees a different doctor for this specialty
    const { data: existingAppts, error: existingErr } = await supabase
      .from('patient_doctor')
      .select('patient, doctor')
      .eq('patient', patient);

    if (existingErr) throw existingErr;

    const existingDoctors = (existingAppts ?? []).map((a) => a.doctor);
    if (existingDoctors.includes(doctor)) {
      const log = addSqlLog({
        operation: 'INSERT',
        targetTable: 'patient_doctor',
        sqlPreview,
        bcnfRule: 'Composite PRIMARY KEY (patient, doctor) prevents duplicate rows.',
        status: 'BLOCKED',
        detail: `${patient} already has an appointment with ${doctor}.`,
      });
      res.status(409).json({ error: log.detail, latestLog: log });
      return;
    }

    if (existingDoctors.length > 0) {
      const { data: existingDocsInfo, error: infoErr } = await supabase
        .from('doctor_specialty')
        .select('doctor, specialty')
        .in('doctor', existingDoctors);

      if (infoErr) throw infoErr;

      const conflict = (existingDocsInfo ?? []).find(
        (d) => d.specialty === docRow.specialty && d.doctor !== doctor
      );

      if (conflict) {
        if (!replaceExisting) {
          const detail = `BCNF Business Rule ((Patient, Specialty) -> Doctor): ${patient} already sees ${conflict.doctor} for ${docRow.specialty}.`;
          const log = addSqlLog({
            operation: 'INSERT',
            targetTable: 'patient_doctor',
            sqlPreview,
            bcnfRule: 'Enforces (Patient, Specialty) -> Doctor: one doctor per specialty for each patient.',
            status: 'BLOCKED',
            detail,
          });
          res.status(409).json({
            error: detail,
            conflictDoctor: conflict.doctor,
            specialty: docRow.specialty,
            canReplace: true,
            latestLog: log,
          });
          return;
        }

        // Replace existing doctor for that specialty
        const { error: delErr } = await supabase
          .from('patient_doctor')
          .delete()
          .eq('patient', patient)
          .eq('doctor', conflict.doctor);

        if (delErr) throw delErr;
      }
    }

    const { error: insertErr } = await supabase
      .from('patient_doctor')
      .insert({ patient, doctor });

    if (insertErr) {
      const log = addSqlLog({
        operation: 'INSERT',
        targetTable: 'patient_doctor',
        sqlPreview,
        bcnfRule: 'BCNF constraint enforcement on patient_doctor.',
        status: 'BLOCKED',
        detail: insertErr.message,
      });
      res.status(400).json({ error: insertErr.message, latestLog: log });
      return;
    }

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'INSERT',
      targetTable: 'patient_doctor',
      sqlPreview,
      bcnfRule: 'Composite Key (patient, doctor) + (Patient, Specialty) -> Doctor verified.',
      status: 'SUCCESS',
      detail: `Booked ${patient} with ${doctor} (${docRow.specialty}).`,
    });
    res.status(201).json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

clinicRouter.delete('/appointments', async (req: Request, res: Response) => {
  const patient = String(req.body?.patient ?? req.query.patient ?? '').trim();
  const doctor = String(req.body?.doctor ?? req.query.doctor ?? '').trim();

  if (!patient || !doctor) {
    res.status(400).json({ error: 'Both patient and doctor are required.' });
    return;
  }

  const sqlPreview = `DELETE FROM patient_doctor WHERE patient = '${escapeSql(patient)}' AND doctor = '${escapeSql(doctor)}';`;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('patient_doctor')
      .delete()
      .eq('patient', patient)
      .eq('doctor', doctor);

    if (error) throw error;

    const snapshot = await fetchClinicSnapshot();
    const log = addSqlLog({
      operation: 'DELETE',
      targetTable: 'patient_doctor',
      sqlPreview,
      bcnfRule: 'No Delete Anomaly: Removing appointment keeps the doctor & specialty intact in doctor_specialty.',
      status: 'SUCCESS',
      detail: `Cancelled ${patient}'s appointment with ${doctor}; ${doctor}'s specialty remains preserved.`,
    });
    res.json({ ...snapshot, latestLog: log });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
