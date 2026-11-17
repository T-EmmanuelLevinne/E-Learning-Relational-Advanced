import { useState } from 'react';
import { api } from '../services/api';
import type { ClinicSnapshotResponse } from '../types/clinic';

interface AnomalyLabTabProps {
  snapshot: ClinicSnapshotResponse;
  onSnapshotUpdate: (next: ClinicSnapshotResponse) => void;
  onRefreshLogs: () => void;
}

export function AnomalyLabTab({
  snapshot,
  onSnapshotUpdate,
  onRefreshLogs,
}: AnomalyLabTabProps) {
  const [busy, setBusy] = useState(false);
  const [updateSpecialty, setUpdateSpecialty] = useState('Neurology');
  const [experiment, setExperiment] = useState<ClinicSnapshotResponse['experiment'] | null>(
    null
  );

  const doctorSpecialtiesMap = new Map<string, Set<string>>();
  for (const row of snapshot.flawedAppointments) {
    if (!doctorSpecialtiesMap.has(row.doctor)) {
      doctorSpecialtiesMap.set(row.doctor, new Set());
    }
    doctorSpecialtiesMap.get(row.doctor)!.add(row.specialty);
  }
  const conflictedDoctors = new Set(
    Array.from(doctorSpecialtiesMap.entries())
      .filter(([, specs]) => specs.size > 1)
      .map(([doc]) => doc)
  );

  async function runExperiment(action: () => Promise<ClinicSnapshotResponse>) {
    setBusy(true);
    try {
      const next = await action();
      onSnapshotUpdate(next);
      if (next.experiment) setExperiment(next.experiment);
    } finally {
      setBusy(false);
      onRefreshLogs();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50/70 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            3NF Table vs. BCNF Tables
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Run Update, Insert, and Delete tests to see how the single 3NF table breaks
            while the BCNF tables stay consistent.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setExperiment(null);
            void runExperiment(() => api.resetSlideDataset());
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reset to Slide 15 data
        </button>
      </div>

      {/* 3 Simple Test Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-medium text-blue-700">1. Update Anomaly</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              Change Dr. Heart&apos;s specialty
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Updates only Alice&apos;s row in the 3NF table vs. one row in{' '}
              <code>doctor_specialty</code>.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={updateSpecialty}
              onChange={(e) => setUpdateSpecialty(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => runExperiment(() => api.runUpdateAnomaly(updateSpecialty))}
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Test
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-medium text-blue-700">2. Insert Anomaly</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              Add Dr. Ortho without a patient
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Fails in the 3NF table because patient is part of the primary key.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runExperiment(() => api.runInsertAnomaly('Dr. Ortho', 'Orthopedics'))
            }
            className="mt-4 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Test insert
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-medium text-blue-700">3. Delete Anomaly</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              Delete Bob&apos;s appointment
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Erases Dr. Skin&apos;s specialty in the 3NF table, but preserves it in BCNF.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => runExperiment(() => api.runDeleteAnomaly())}
            className="mt-4 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Test delete
          </button>
        </div>
      </div>

      {/* Result Summary */}
      {experiment && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4">
            <p className="text-xs font-semibold text-rose-800">Single 3NF Table</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">
              {experiment.flawedOutcome}
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
            <p className="text-xs font-semibold text-blue-900">BCNF Tables</p>
            <p className="mt-1 text-xs leading-relaxed text-blue-800">
              {experiment.bcnfOutcome}
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                flawed_patient_appointments
              </h3>
              <p className="text-xs text-slate-500">3NF only (violates BCNF)</p>
            </div>
            <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
              Single Table
            </span>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
              <tr>
                <th className="py-2 pr-3">Patient</th>
                <th className="py-2 pr-3">Specialty</th>
                <th className="py-2">Doctor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.flawedAppointments.map((row) => {
                const isCorrupted = conflictedDoctors.has(row.doctor);
                return (
                  <tr
                    key={`${row.patient}::${row.specialty}`}
                    className={isCorrupted ? 'bg-rose-50' : ''}
                  >
                    <td className="py-2 pr-3 font-medium text-slate-900">{row.patient}</td>
                    <td
                      className={`py-2 pr-3 ${
                        isCorrupted ? 'font-semibold text-rose-700' : 'text-slate-600'
                      }`}
                    >
                      {row.specialty}
                    </td>
                    <td className="py-2 text-slate-600">
                      {row.doctor}
                      {isCorrupted && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          Conflict
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                BCNF Normalized Tables
              </h3>
              <p className="text-xs text-slate-500">
                doctor_specialty + patient_doctor
              </p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              Consistent
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                doctor_specialty
              </p>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3">doctor (PK)</th>
                    <th className="py-1.5">specialty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshot.doctors.map((d) => (
                    <tr key={d.doctor}>
                      <td className="py-1.5 pr-3 font-medium text-slate-900">{d.doctor}</td>
                      <td className="py-1.5 text-blue-700">{d.specialty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                patient_doctor
              </p>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3">patient (PK)</th>
                    <th className="py-1.5">doctor (PK, FK)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshot.appointments.map((a) => (
                    <tr key={`${a.patient}::${a.doctor}`}>
                      <td className="py-1.5 pr-3 font-medium text-slate-900">{a.patient}</td>
                      <td className="py-1.5 text-slate-600">{a.doctor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
