import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../services/api';
import type {
  BcnfAnalysisResult,
  ClinicBcnfReportResponse,
  FunctionalDependency,
} from '../types/clinic';

export function BcnfInspectorTab() {
  const [clinicData, setClinicData] = useState<ClinicBcnfReportResponse | null>(null);
  const [relationName, setRelationName] = useState('Patient_Appointments');
  const [attributesInput, setAttributesInput] = useState('Patient, Specialty, Doctor');
  const [fdsInput, setFdsInput] = useState(
    'Patient, Specialty -> Doctor\nDoctor -> Specialty'
  );
  const [customResult, setCustomResult] = useState<BcnfAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getClinicBcnfReport().then((data) => {
      setClinicData(data);
      setCustomResult(data.report);
    });
  }, []);

  function loadPreset(preset: 'clinic' | 'university') {
    setError(null);
    if (preset === 'clinic') {
      setRelationName('Patient_Appointments');
      setAttributesInput('Patient, Specialty, Doctor');
      setFdsInput('Patient, Specialty -> Doctor\nDoctor -> Specialty');
    } else {
      setRelationName('Student_Course_Instructor');
      setAttributesInput('Student, Course, Instructor');
      setFdsInput('Student, Course -> Instructor\nInstructor -> Course');
    }
  }

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const attributes = attributesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const dependencies: FunctionalDependency[] = [];
    for (const line of fdsInput.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('->');
      if (parts.length !== 2) {
        setError(`Invalid dependency syntax: "${trimmed}". Use "A, B -> C".`);
        return;
      }
      const lhs = parts[0]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const rhs = parts[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (lhs.length === 0 || rhs.length === 0) {
        setError(`Both sides of "${trimmed}" must have at least one attribute.`);
        return;
      }
      dependencies.push({ lhs, rhs });
    }

    try {
      const res = await api.analyzeCustomBcnf(relationName, attributes, dependencies);
      setCustomResult(res.report);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {clinicData && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Clinic Schema Diagnosis (Slides 14–16)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Rule: Every determinant must be a superkey.
              </p>
            </div>
            <span className="rounded bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              BCNF Engine
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-medium text-slate-500">Candidate Keys</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {clinicData.report.candidateKeys.map((key) => (
                  <span
                    key={key.join(',')}
                    className="rounded border border-blue-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-800"
                  >
                    ({key.join(', ')})
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-medium text-slate-500">Closures (X⁺)</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-slate-700">
                <li>
                  {'{Doctor}'}⁺ = {'{'}
                  {clinicData.doctorClosure.join(', ')}
                  {'}'}
                </li>
                <li>
                  {'{Patient, Specialty}'}⁺ = {'{'}
                  {clinicData.patientSpecialtyClosure.join(', ')}
                  {'}'}
                </li>
              </ul>
            </div>

            <div className="rounded-md border border-rose-200 bg-rose-50/70 p-3.5">
              <p className="text-xs font-medium text-rose-800">Why Single Table Fails</p>
              <p className="mt-2 text-xs leading-relaxed text-rose-700">
                {clinicData.report.violations[0]?.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleAnalyze}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Test Functional Dependencies
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadPreset('clinic')}
                className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Clinic preset
              </button>
              <button
                type="button"
                onClick={() => loadPreset('university')}
                className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                University preset
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Table Name
              </label>
              <input
                type="text"
                value={relationName}
                onChange={(e) => setRelationName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                Columns (comma-separated)
              </label>
              <input
                type="text"
                value={attributesInput}
                onChange={(e) => setAttributesInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                Functional Dependencies (one per line)
              </label>
              <textarea
                rows={4}
                value={fdsInput}
                onChange={(e) => setFdsInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Analyze BCNF
            </button>
          </div>
        </form>

        {customResult && (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Result: <code>{customResult.relationName}</code>
              </h3>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  customResult.isBcnf
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {customResult.isBcnf ? 'BCNF Compliant' : 'Fails BCNF'}
              </span>
            </div>

            {customResult.violations.length > 0 && (
              <div className="mt-3 space-y-2">
                {customResult.violations.map((v, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800"
                  >
                    <p className="font-mono font-semibold">
                      Violation: {v.dependency.lhs.join(', ')} → {v.dependency.rhs.join(', ')}
                    </p>
                    <p className="mt-1">{v.reason}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Decomposed Tables ({customResult.decomposedTables.length})
              </p>
              <div className="space-y-2.5">
                {customResult.decomposedTables.map((table) => (
                  <div
                    key={table.name}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {table.name}
                      </span>
                      <span className="text-xs font-medium text-blue-700">
                        {table.isBcnf ? 'BCNF' : 'Check'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Columns: <span className="font-mono">{table.attributes.join(', ')}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-700">
                      Primary Key:{' '}
                      <span className="font-mono">({table.primaryKey.join(', ')})</span>
                    </p>
                    {table.foreignKeys.length > 0 && (
                      <p className="mt-0.5 text-xs text-blue-700">
                        Foreign Key:{' '}
                        <span className="font-mono">
                          {table.foreignKeys
                            .map(
                              (fk) =>
                                `${fk.column} → ${fk.referencesTable}(${fk.referencesColumn})`
                            )
                            .join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
