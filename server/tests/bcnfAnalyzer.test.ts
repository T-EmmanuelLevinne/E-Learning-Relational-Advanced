import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeBcnf,
  computeClosure,
  findCandidateKeys,
  getClinicBcnfReport,
} from '../src/services/bcnfAnalyzer.js';

test('Clinic Dilemma (Slides 14-16) detects Doctor -> Specialty BCNF violation and decomposes into doctor_specialty + patient_doctor', () => {
  const report = getClinicBcnfReport();

  assert.equal(report.isBcnf, false);
  assert.equal(report.violations.length, 1);
  assert.deepEqual(report.violations[0].dependency, {
    lhs: ['Doctor'],
    rhs: ['Specialty'],
  });
  assert.deepEqual(computeClosure(['Doctor'], report.dependencies), [
    'Doctor',
    'Specialty',
  ]);

  const sortedKeys = report.candidateKeys.map((k) => [...k].sort().join(',')).sort();
  assert.deepEqual(sortedKeys, ['Doctor,Patient', 'Patient,Specialty']);

  assert.equal(report.decomposedTables.length, 2);
  const tableNames = report.decomposedTables.map((t) => t.name).sort();
  assert.deepEqual(tableNames, ['doctor_specialty', 'patient_doctor']);

  const doctorSpecialty = report.decomposedTables.find(
    (t) => t.name === 'doctor_specialty'
  )!;
  assert.deepEqual(doctorSpecialty.primaryKey, ['Doctor']);
  assert.equal(doctorSpecialty.isBcnf, true);

  const patientDoctor = report.decomposedTables.find(
    (t) => t.name === 'patient_doctor'
  )!;
  assert.deepEqual([...patientDoctor.primaryKey].sort(), ['Doctor', 'Patient']);
  assert.equal(patientDoctor.isBcnf, true);
  assert.equal(patientDoctor.foreignKeys.length, 1);
  assert.equal(patientDoctor.foreignKeys[0].referencesTable, 'doctor_specialty');
});

test('University Example (Slides 8-10) detects Instructor -> Course violation and decomposes cleanly', () => {
  const report = analyzeBcnf(
    'Student_Course_Instructor',
    ['Student', 'Course', 'Instructor'],
    [
      { lhs: ['Student', 'Course'], rhs: ['Instructor'] },
      { lhs: ['Instructor'], rhs: ['Course'] },
    ]
  );

  assert.equal(report.isBcnf, false);
  assert.equal(report.violations.length, 1);
  assert.deepEqual(report.violations[0].dependency.lhs, ['Instructor']);
  assert.deepEqual(report.violations[0].dependency.rhs, ['Course']);
  assert.equal(report.decomposedTables.length, 2);
  assert.ok(report.decomposedTables.every((t) => t.isBcnf));
});

test('A relation where every determinant is a superkey passes BCNF with zero decompositions', () => {
  const keys = findCandidateKeys(
    ['Doctor', 'Specialty'],
    [{ lhs: ['Doctor'], rhs: ['Specialty'] }]
  );
  assert.deepEqual(keys, [['Doctor']]);

  const report = analyzeBcnf(
    'doctor_specialty',
    ['Doctor', 'Specialty'],
    [{ lhs: ['Doctor'], rhs: ['Specialty'] }]
  );
  assert.equal(report.isBcnf, true);
  assert.equal(report.violations.length, 0);
  assert.equal(report.decomposedTables.length, 1);
});
