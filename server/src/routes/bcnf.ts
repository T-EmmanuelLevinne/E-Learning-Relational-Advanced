import { Router, type Request, type Response } from 'express';
import { analyzeBcnf, computeClosure, getClinicBcnfReport } from '../services/bcnfAnalyzer.js';
import { addSqlLog, clearSqlLogs, getSqlLogs } from '../services/sqlLogger.js';
import type { FunctionalDependency } from '../types/clinic.js';

export const bcnfRouter = Router();

bcnfRouter.get('/clinic-report', (_req: Request, res: Response) => {
  const report = getClinicBcnfReport();
  res.json({
    report,
    doctorClosure: computeClosure(['Doctor'], report.dependencies),
    patientSpecialtyClosure: computeClosure(['Patient', 'Specialty'], report.dependencies),
    patientDoctorClosure: computeClosure(['Patient', 'Doctor'], report.dependencies),
  });
});

bcnfRouter.post('/analyze', (req: Request, res: Response) => {
  const relationName = String(req.body?.relationName ?? 'Custom_Relation').trim() || 'Custom_Relation';
  const attributes = Array.isArray(req.body?.attributes)
    ? req.body.attributes.map((a: unknown) => String(a).trim()).filter(Boolean)
    : [];
  const dependencies = Array.isArray(req.body?.dependencies)
    ? (req.body.dependencies as FunctionalDependency[])
    : [];

  if (attributes.length === 0 || dependencies.length === 0) {
    res.status(400).json({
      error: 'Provide non-empty attributes[] and dependencies[] ({ lhs: string[], rhs: string[] }).',
    });
    return;
  }

  const report = analyzeBcnf(relationName, attributes, dependencies);
  addSqlLog({
    operation: 'CHECK',
    targetTable: relationName,
    sqlPreview: `-- Analyzed ${attributes.length} attributes and ${dependencies.length} functional dependencies for BCNF compliance`,
    bcnfRule: report.isBcnf
      ? 'BCNF Passed: Every determinant is a superkey.'
      : `BCNF Violated: ${report.violations.length} non-superkey determinant(s) detected.`,
    status: report.isBcnf ? 'SUCCESS' : 'BLOCKED',
    detail: report.isBcnf
      ? `${relationName} satisfies BCNF.`
      : report.violations.map((v) => v.reason).join(' '),
  });

  res.json({ report });
});

bcnfRouter.get('/logs', (_req: Request, res: Response) => {
  res.json({ logs: getSqlLogs() });
});

bcnfRouter.delete('/logs', (_req: Request, res: Response) => {
  clearSqlLogs();
  res.json({ logs: [] });
});
