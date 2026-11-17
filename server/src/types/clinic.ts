export interface DoctorSpecialtyRow {
  doctor: string;
  specialty: string;
  created_at?: string;
}

export interface PatientDoctorRow {
  patient: string;
  doctor: string;
  created_at?: string;
}

export interface JoinedScheduleRow {
  patient: string;
  specialty: string;
  doctor: string;
  created_at?: string;
}

export interface FlawedAppointmentRow {
  patient: string;
  specialty: string;
  doctor: string;
}

export interface SqlLogEntry {
  id: string;
  timestamp: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'RESET' | 'CHECK';
  targetTable: string;
  sqlPreview: string;
  bcnfRule: string;
  status: 'SUCCESS' | 'BLOCKED';
  detail: string;
}

export interface FunctionalDependency {
  lhs: string[];
  rhs: string[];
}

export interface BcnfViolation {
  dependency: FunctionalDependency;
  lhsClosure: string[];
  reason: string;
}

export interface DecomposedRelation {
  name: string;
  attributes: string[];
  primaryKey: string[];
  foreignKeys: { column: string; referencesTable: string; referencesColumn: string }[];
  dependencies: FunctionalDependency[];
  isBcnf: boolean;
}

export interface BcnfAnalysisResult {
  relationName: string;
  attributes: string[];
  dependencies: FunctionalDependency[];
  candidateKeys: string[][];
  isBcnf: boolean;
  violations: BcnfViolation[];
  decomposedTables: DecomposedRelation[];
}
