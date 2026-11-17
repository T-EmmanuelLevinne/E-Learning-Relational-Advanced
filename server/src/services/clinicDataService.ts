import { getSupabaseClient } from '../db/supabaseClient.js';
import type {
  DoctorSpecialtyRow,
  FlawedAppointmentRow,
  JoinedScheduleRow,
  PatientDoctorRow,
} from '../types/clinic.js';

export interface ClinicSnapshot {
  doctors: DoctorSpecialtyRow[];
  appointments: PatientDoctorRow[];
  joinedSchedule: JoinedScheduleRow[];
  flawedAppointments: FlawedAppointmentRow[];
}

export async function fetchClinicSnapshot(): Promise<ClinicSnapshot> {
  const supabase = getSupabaseClient();

  const [doctorsRes, appointmentsRes, flawedRes] = await Promise.all([
    supabase.from('doctor_specialty').select('doctor, specialty, created_at').order('doctor'),
    supabase
      .from('patient_doctor')
      .select('patient, doctor, created_at')
      .order('patient')
      .order('doctor'),
    supabase
      .from('flawed_patient_appointments')
      .select('patient, specialty, doctor')
      .order('patient')
      .order('specialty'),
  ]);

  if (doctorsRes.error) throw doctorsRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;
  if (flawedRes.error) throw flawedRes.error;

  const doctors = (doctorsRes.data ?? []) as DoctorSpecialtyRow[];
  const appointments = (appointmentsRes.data ?? []) as PatientDoctorRow[];
  const flawedAppointments = (flawedRes.data ?? []) as FlawedAppointmentRow[];

  const specialtyByDoctor = new Map(doctors.map((d) => [d.doctor, d.specialty]));
  const joinedSchedule: JoinedScheduleRow[] = appointments
    .map((appt) => ({
      patient: appt.patient,
      specialty: specialtyByDoctor.get(appt.doctor) ?? 'Unknown',
      doctor: appt.doctor,
      created_at: appt.created_at,
    }))
    .sort((a, b) =>
      a.patient === b.patient
        ? a.specialty.localeCompare(b.specialty)
        : a.patient.localeCompare(b.patient)
    );

  return {
    doctors,
    appointments,
    joinedSchedule,
    flawedAppointments,
  };
}
