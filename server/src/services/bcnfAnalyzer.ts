import type {
  BcnfAnalysisResult,
  BcnfViolation,
  DecomposedRelation,
  FunctionalDependency,
} from '../types/clinic.js';

function normalizeSet(attrs: string[]): string[] {
  return Array.from(new Set(attrs.map((a) => a.trim()).filter(Boolean)));
}

function isSubset(subset: string[], superset: string[]): boolean {
  const set = new Set(superset);
  return subset.every((item) => set.has(item));
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return isSubset(a, b) && isSubset(b, a);
}

/**
 * Computes the attribute closure X+ under a set of functional dependencies.
 */
export function computeClosure(
  attrs: string[],
  fds: FunctionalDependency[]
): string[] {
  const closure = new Set(normalizeSet(attrs));
  let changed = true;

  while (changed) {
    changed = false;
    for (const fd of fds) {
      if (fd.lhs.length > 0 && isSubset(fd.lhs, Array.from(closure))) {
        for (const target of fd.rhs) {
          if (!closure.has(target)) {
            closure.add(target);
            changed = true;
          }
        }
      }
    }
  }

  return Array.from(closure);
}

/**
 * Discovers all minimal candidate keys for a relation given its attributes and FDs.
 */
export function findCandidateKeys(
  attributes: string[],
  fds: FunctionalDependency[]
): string[][] {
  const attrs = normalizeSet(attributes);
  if (attrs.length === 0) return [];

  // Build all subsets ordered by size (BFS by size) so minimal keys are found first.
  const candidateKeys: string[][] = [];
  const total = 1 << attrs.length;

  const subsetsBySize: string[][] = [];
  for (let mask = 1; mask < total; mask++) {
    const sub: string[] = [];
    for (let i = 0; i < attrs.length; i++) {
      if (mask & (1 << i)) sub.push(attrs[i]);
    }
    subsetsBySize.push(sub);
  }
  subsetsBySize.sort((a, b) => a.length - b.length);

  for (const subset of subsetsBySize) {
    // Skip if already contains a known candidate key
    if (candidateKeys.some((ck) => isSubset(ck, subset))) {
      continue;
    }
    const closure = computeClosure(subset, fds);
    if (isSubset(attrs, closure)) {
      candidateKeys.push(subset);
    }
  }

  return candidateKeys;
}

function projectDependencies(
  subAttrs: string[],
  allFds: FunctionalDependency[]
): FunctionalDependency[] {
  const projected: FunctionalDependency[] = [];
  for (const fd of allFds) {
    if (!isSubset(fd.lhs, subAttrs)) continue;
    const validRhs = fd.rhs.filter((r) => subAttrs.includes(r) && !fd.lhs.includes(r));
    if (validRhs.length > 0) {
      projected.push({ lhs: [...fd.lhs], rhs: validRhs });
    }
  }
  return projected;
}

export function checkBcnfViolations(
  attributes: string[],
  fds: FunctionalDependency[]
): BcnfViolation[] {
  const attrs = normalizeSet(attributes);
  const violations: BcnfViolation[] = [];

  for (const fd of fds) {
    const nontrivialRhs = fd.rhs.filter((r) => !fd.lhs.includes(r) && attrs.includes(r));
    if (nontrivialRhs.length === 0 || !isSubset(fd.lhs, attrs)) continue;

    const closure = computeClosure(fd.lhs, fds);
    const isSuperkey = isSubset(attrs, closure);

    if (!isSuperkey) {
      violations.push({
        dependency: { lhs: fd.lhs, rhs: nontrivialRhs },
        lhsClosure: closure,
        reason: `Determinant (${fd.lhs.join(', ')}) determines (${nontrivialRhs.join(', ')}), but its closure {${closure.join(', ')}} does not cover all attributes {${attrs.join(', ')}} — so it is NOT a superkey.`,
      });
    }
  }

  return violations;
}

function decomposeRecursively(
  attrs: string[],
  allFds: FunctionalDependency[],
  results: { attrs: string[]; fds: FunctionalDependency[] }[]
): void {
  const localFds = projectDependencies(attrs, allFds);
  const violations = checkBcnfViolations(attrs, localFds);

  if (violations.length === 0) {
    results.push({ attrs, fds: localFds });
    return;
  }

  const violating = violations[0].dependency;
  const r1Attrs = normalizeSet([...violating.lhs, ...violating.rhs]);
  const r2Attrs = attrs.filter(
    (a) => !violating.rhs.includes(a) || violating.lhs.includes(a)
  );

  // Guard against degenerate split if r1 equals attrs
  if (setsEqual(r1Attrs, attrs) || r2Attrs.length === 0) {
    results.push({ attrs, fds: localFds });
    return;
  }

  decomposeRecursively(r1Attrs, allFds, results);
  decomposeRecursively(r2Attrs, allFds, results);
}

/**
 * Runs a full BCNF analysis and decomposition on any relation + FD set.
 */
export function analyzeBcnf(
  relationName: string,
  rawAttributes: string[],
  rawDependencies: FunctionalDependency[]
): BcnfAnalysisResult {
  const attributes = normalizeSet(rawAttributes);
  const dependencies = rawDependencies.map((fd) => ({
    lhs: normalizeSet(fd.lhs),
    rhs: normalizeSet(fd.rhs),
  }));

  const candidateKeys = findCandidateKeys(attributes, dependencies);
  const violations = checkBcnfViolations(attributes, dependencies);

  const rawPieces: { attrs: string[]; fds: FunctionalDependency[] }[] = [];
  decomposeRecursively(attributes, dependencies, rawPieces);

  const decomposedTables: DecomposedRelation[] = rawPieces.map((piece, idx) => {
    const pieceKeys = findCandidateKeys(piece.attrs, piece.fds);
    const primaryKey = pieceKeys[0] ?? piece.attrs;
    const isClinicTable1 =
      piece.attrs.length === 2 &&
      piece.attrs.includes('Doctor') &&
      piece.attrs.includes('Specialty');
    const isClinicTable2 =
      piece.attrs.length === 2 &&
      piece.attrs.includes('Patient') &&
      piece.attrs.includes('Doctor');

    const name = isClinicTable1
      ? 'doctor_specialty'
      : isClinicTable2
        ? 'patient_doctor'
        : `${relationName.toLowerCase()}_part_${idx + 1}`;

    return {
      name,
      attributes: piece.attrs,
      primaryKey,
      foreignKeys: [],
      dependencies: piece.fds,
      isBcnf: checkBcnfViolations(piece.attrs, piece.fds).length === 0,
    };
  });

  // Wire foreign keys between decomposed tables when a table's PK appears in another table
  for (const table of decomposedTables) {
    for (const other of decomposedTables) {
      if (table.name === other.name) continue;
      if (
        other.primaryKey.length === 1 &&
        table.attributes.includes(other.primaryKey[0]) &&
        !setsEqual(table.primaryKey, other.primaryKey)
      ) {
        table.foreignKeys.push({
          column: other.primaryKey[0],
          referencesTable: other.name,
          referencesColumn: other.primaryKey[0],
        });
      }
    }
  }

  return {
    relationName,
    attributes,
    dependencies,
    candidateKeys,
    isBcnf: violations.length === 0,
    violations,
    decomposedTables,
  };
}

export function getClinicBcnfReport(): BcnfAnalysisResult {
  return analyzeBcnf('Patient_Appointments', ['Patient', 'Specialty', 'Doctor'], [
    { lhs: ['Patient', 'Specialty'], rhs: ['Doctor'] },
    { lhs: ['Doctor'], rhs: ['Specialty'] },
  ]);
}
