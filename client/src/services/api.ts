import type {
  BcnfAnalysisResult,
  ClinicBcnfReportResponse,
  ClinicSnapshotResponse,
  FunctionalDependency,
  HealthStatus,
  SqlLogEntry,
} from '../types/clinic';

export class ApiError extends Error {
  status: number;
  conflictDoctor?: string;
  specialty?: string;
  canReplace?: boolean;
  latestLog?: SqlLogEntry;

  constructor(
    message: string,
    status: number,
    extra?: {
      conflictDoctor?: string;
      specialty?: string;
      canReplace?: boolean;
      latestLog?: SqlLogEntry;
    }
  ) {
    super(message);
    this.status = status;
    this.conflictDoctor = extra?.conflictDoctor;
    this.specialty = extra?.specialty;
    this.canReplace = extra?.canReplace;
    this.latestLog = extra?.latestLog;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, {
      conflictDoctor: data.conflictDoctor,
      specialty: data.specialty,
      canReplace: data.canReplace,
      latestLog: data.latestLog,
    });
  }
  return data as T;
}

export const api = {
  getHealth: () => request<HealthStatus>('/api/health'),
  getOverview: () => request<ClinicSnapshotResponse>('/api/clinic/overview'),
  addDoctor: (doctor: string, specialty: string) =>
    request<ClinicSnapshotResponse>('/api/clinic/doctors', {
      method: 'POST',
      body: JSON.stringify({ doctor, specialty }),
    }),
  updateDoctorSpecialty: (doctor: string, specialty: string) =>
    request<ClinicSnapshotResponse>(`/api/clinic/doctors/${encodeURIComponent(doctor)}`, {
      method: 'PATCH',
      body: JSON.stringify({ specialty }),
    }),
  deleteDoctor: (doctor: string) =>
    request<ClinicSnapshotResponse>(`/api/clinic/doctors/${encodeURIComponent(doctor)}`, {
      method: 'DELETE',
    }),
  bookAppointment: (patient: string, doctor: string, replaceExisting = false) =>
    request<ClinicSnapshotResponse>('/api/clinic/appointments', {
      method: 'POST',
      body: JSON.stringify({ patient, doctor, replaceExisting }),
    }),
  cancelAppointment: (patient: string, doctor: string) =>
    request<ClinicSnapshotResponse>('/api/clinic/appointments', {
      method: 'DELETE',
      body: JSON.stringify({ patient, doctor }),
    }),
  resetSlideDataset: () =>
    request<ClinicSnapshotResponse>('/api/simulator/reset', { method: 'POST' }),
  runUpdateAnomaly: (specialty: string) =>
    request<ClinicSnapshotResponse>('/api/simulator/update-anomaly', {
      method: 'POST',
      body: JSON.stringify({ specialty }),
    }),
  runInsertAnomaly: (doctor: string, specialty: string) =>
    request<ClinicSnapshotResponse>('/api/simulator/insert-anomaly', {
      method: 'POST',
      body: JSON.stringify({ doctor, specialty }),
    }),
  runDeleteAnomaly: () =>
    request<ClinicSnapshotResponse>('/api/simulator/delete-anomaly', {
      method: 'POST',
    }),
  getClinicBcnfReport: () =>
    request<ClinicBcnfReportResponse>('/api/bcnf/clinic-report'),
  analyzeCustomBcnf: (
    relationName: string,
    attributes: string[],
    dependencies: FunctionalDependency[]
  ) =>
    request<{ report: BcnfAnalysisResult }>('/api/bcnf/analyze', {
      method: 'POST',
      body: JSON.stringify({ relationName, attributes, dependencies }),
    }),
  getLogs: () => request<{ logs: SqlLogEntry[] }>('/api/bcnf/logs'),
  clearLogs: () => request<{ logs: SqlLogEntry[] }>('/api/bcnf/logs', { method: 'DELETE' }),
};
