import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../services/api';
import type { ClinicSnapshotResponse } from '../types/clinic';

interface ClinicDbmsTabProps {
  snapshot: ClinicSnapshotResponse;
  onSnapshotUpdate: (next: ClinicSnapshotResponse) => void;
  onRefreshLogs: () => void;
}

export function ClinicDbmsTab({
  snapshot,
  onSnapshotUpdate,
  onRefreshLogs,
}: ClinicDbmsTabProps) {
  const [newDoctor, setNewDoctor] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [editingDoctor, setEditingDoctor] = useState<string | null>(null);
  const [editingSpecialty, setEditingSpecialty] = useState('');

  const [patientName, setPatientName] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(
    snapshot.doctors[0]?.doctor ?? ''
  );

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    canReplace?: boolean;
    pendingPatient?: string;
    pendingDoctor?: string;
  } | null>(null);

  const activeDoctor =
    selectedDoctor && snapshot.doctors.some((d) => d.doctor === selectedDoctor)
      ? selectedDoctor
      : snapshot.doctors[0]?.doctor ?? '';

  async function handleAddDoctor(e: FormEvent) {
    e.preventDefault();
    if (!newDoctor.trim() || !newSpecialty.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.addDoctor(newDoctor.trim(), newSpecialty.trim());
      onSnapshotUpdate(next);
      setNewDoctor('');
      setNewSpecialty('');
      setFeedback({
        type: 'success',
        message: `Added ${newDoctor.trim()} (${newSpecialty.trim()}) to doctor_specialty.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  async function handleSaveSpecialty(doctor: string) {
    if (!editingSpecialty.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.updateDoctorSpecialty(doctor, editingSpecialty.trim());
      onSnapshotUpdate(next);
      setEditingDoctor(null);
      setFeedback({
        type: 'success',
        message: `Updated ${doctor}'s specialty in one row.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  async function handleDeleteDoctor(doctor: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.deleteDoctor(doctor);
      onSnapshotUpdate(next);
      setFeedback({
        type: 'success',
        message: `Removed ${doctor} from doctor_specialty.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  async function handleBookAppointment(e: FormEvent, replaceExisting = false) {
    e.preventDefault();
    const patient = patientName.trim();
    if (!patient || !activeDoctor) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.bookAppointment(patient, activeDoctor, replaceExisting);
      onSnapshotUpdate(next);
      setPatientName('');
      setFeedback({
        type: 'success',
        message: replaceExisting
          ? `Reassigned ${patient} to ${activeDoctor}.`
          : `Booked ${patient} with ${activeDoctor}.`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.canReplace) {
        setFeedback({
          type: 'error',
          message: err.message,
          canReplace: true,
          pendingPatient: patient,
          pendingDoctor: activeDoctor,
        });
      } else {
        setFeedback({ type: 'error', message: (err as Error).message });
      }
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  async function handleReassign() {
    if (!feedback?.pendingPatient || !feedback?.pendingDoctor) return;
    setBusy(true);
    try {
      const next = await api.bookAppointment(
        feedback.pendingPatient,
        feedback.pendingDoctor,
        true
      );
      onSnapshotUpdate(next);
      setPatientName('');
      setFeedback({
        type: 'success',
        message: `Reassigned ${feedback.pendingPatient} to ${feedback.pendingDoctor}.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  async function handleCancelAppointment(patient: string, doctor: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await api.cancelAppointment(patient, doctor);
      onSnapshotUpdate(next);
      setFeedback({
        type: 'success',
        message: `Removed (${patient}, ${doctor}). ${doctor}'s specialty stays intact.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  return (
    <div className="space-y-6">
      {/* Simple Overview Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Doctors</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.doctors.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Table: doctor_specialty</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Appointments</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot.appointments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Table: patient_doctor</p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
          <p className="text-xs font-medium text-blue-700">Normalization</p>
          <p className="mt-1 text-2xl font-semibold text-blue-950">BCNF</p>
          <p className="mt-1 text-xs text-blue-700">
            Every determinant is a primary key
          </p>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-blue-200 bg-blue-50 text-blue-900'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <div className="flex items-center gap-2">
            {feedback.canReplace && (
              <button
                type="button"
                disabled={busy}
                onClick={handleReassign}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Reassign to {feedback.pendingDoctor}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleAddDoctor}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            Add doctor and specialty
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Inserts into <code>doctor_specialty</code> (Doctor → Specialty).
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={newDoctor}
              onChange={(e) => setNewDoctor(e.target.value)}
              placeholder="Doctor (e.g. Dr. Ortho)"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              required
            />
            <input
              type="text"
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              placeholder="Specialty (e.g. Orthopedics)"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add doctor
          </button>
        </form>

        <form
          onSubmit={(e) => handleBookAppointment(e, false)}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            Book patient appointment
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Inserts into <code>patient_doctor</code> (one doctor per specialty per patient).
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient (e.g. Alice)"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              required
            />
            <select
              value={activeDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              required
            >
              {snapshot.doctors.map((d) => (
                <option key={d.doctor} value={d.doctor}>
                  {d.doctor} ({d.specialty})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || snapshot.doctors.length === 0}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Book appointment
          </button>
        </form>
      </div>

      {/* BCNF Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Table 1: doctor_specialty */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">doctor_specialty</h3>
              <p className="text-xs text-slate-500">Primary key: doctor</p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              Table 1
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th className="py-2 pr-3">doctor (PK)</th>
                  <th className="py-2 pr-3">specialty</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.doctors.map((doc) => (
                  <tr key={doc.doctor}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {doc.doctor}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {editingDoctor === doc.doctor ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingSpecialty}
                            onChange={(e) => setEditingSpecialty(e.target.value)}
                            className="w-32 rounded border border-blue-400 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSaveSpecialty(doc.doctor)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDoctor(null)}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        doc.specialty
                      )}
                    </td>
                    <td className="py-2.5 text-right text-xs">
                      {editingDoctor !== doc.doctor && (
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDoctor(doc.doctor);
                              setEditingSpecialty(doc.specialty);
                            }}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDeleteDoctor(doc.doctor)}
                            className="font-medium text-slate-500 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: patient_doctor */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">patient_doctor</h3>
              <p className="text-xs text-slate-500">
                Primary key: (patient, doctor) · FK → doctor_specialty
              </p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              Table 2
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th className="py-2 pr-3">patient (PK)</th>
                  <th className="py-2 pr-3">doctor (PK, FK)</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.appointments.map((appt) => (
                  <tr key={`${appt.patient}::${appt.doctor}`}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {appt.patient}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{appt.doctor}</td>
                    <td className="py-2.5 text-right text-xs">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCancelAppointment(appt.patient, appt.doctor)}
                        className="font-medium text-slate-500 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Joined Schedule */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Combined Clinic Schedule
            </h3>
            <p className="text-xs text-slate-500">
              Joined view of <code>patient_doctor</code> and <code>doctor_specialty</code>
            </p>
          </div>
          <span className="text-xs text-slate-400">Read-only JOIN</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
              <tr>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Specialty</th>
                <th className="py-2">Doctor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.joinedSchedule.map((row) => (
                <tr key={`${row.patient}::${row.doctor}`}>
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{row.patient}</td>
                  <td className="py-2.5 pr-4">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {row.specialty}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-600">{row.doctor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
