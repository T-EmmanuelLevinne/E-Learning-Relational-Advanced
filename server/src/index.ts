import 'dotenv/config';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { getSupabaseClient, getSupabaseConfigStatus } from './db/supabaseClient.js';
import { bcnfRouter } from './routes/bcnf.js';
import { clinicRouter } from './routes/clinic.js';
import { simulatorRouter } from './routes/simulator.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get('/api/health', async (_req: Request, res: Response) => {
  const config = getSupabaseConfigStatus();
  if (!config.configured) {
    res.status(200).json({
      server: 'ok',
      supabaseConfigured: false,
      tablesReady: false,
      missingEnv: config.missing,
      message: `Configure ${config.missing.join(', ')} in server/.env`,
    });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const [docCheck, apptCheck, flawedCheck] = await Promise.all([
      supabase.from('doctor_specialty').select('doctor', { count: 'exact', head: true }),
      supabase.from('patient_doctor').select('patient', { count: 'exact', head: true }),
      supabase
        .from('flawed_patient_appointments')
        .select('patient', { count: 'exact', head: true }),
    ]);

    const errors = [docCheck.error, apptCheck.error, flawedCheck.error].filter(Boolean);
    if (errors.length > 0) {
      res.status(200).json({
        server: 'ok',
        supabaseConfigured: true,
        tablesReady: false,
        message: `Connected to Supabase, but schema tables are missing or inaccessible. Run server/sql/schema.sql in Supabase SQL Editor. (${errors[0]?.message})`,
      });
      return;
    }

    res.json({
      server: 'ok',
      supabaseConfigured: true,
      tablesReady: true,
      message: 'Connected to Supabase PostgreSQL with BCNF Clinic tables ready.',
    });
  } catch (err) {
    res.status(500).json({
      server: 'ok',
      supabaseConfigured: true,
      tablesReady: false,
      message: (err as Error).message,
    });
  }
});

app.use('/api/clinic', clinicRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/bcnf', bcnfRouter);

app.listen(port, () => {
  console.log(`Clinic BCNF DBMS API running at http://localhost:${port}`);
});
