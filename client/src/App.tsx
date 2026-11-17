import { useCallback, useEffect, useState } from 'react';
import { AnomalyLabTab } from './components/AnomalyLabTab';
import { BcnfInspectorTab } from './components/BcnfInspectorTab';
import { ClinicDbmsTab } from './components/ClinicDbmsTab';
import { SetupBanner } from './components/SetupBanner';
import { SqlActivityDrawer } from './components/SqlActivityDrawer';
import { api } from './services/api';
import type { ClinicSnapshotResponse, HealthStatus, SqlLogEntry } from './types/clinic';

type TabId = 'clinic' | 'anomalies' | 'bcnf';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('clinic');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [snapshot, setSnapshot] = useState<ClinicSnapshotResponse | null>(null);
  const [logs, setLogs] = useState<SqlLogEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLogs = useCallback(async () => {
    try {
      const res = await api.getLogs();
      setLogs(res.logs);
    } catch {
      // Ignore background log refresh errors
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await api.getHealth();
      setHealth(h);

      if (h.supabaseConfigured && h.tablesReady) {
        const overview = await api.getOverview();
        setSnapshot(overview);
        await refreshLogs();
      } else {
        setSnapshot(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refreshLogs]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleQuickReset() {
    try {
      const next = await api.resetSlideDataset();
      setSnapshot(next);
      await refreshLogs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-slate-800">
      {/* Calm White & Blue Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="border-b border-blue-100 bg-blue-600 text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                Clinic BCNF DBMS
              </h1>
              <p className="text-xs text-blue-100">
                Boyce-Codd Normal Form · Clinic Database Management
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {health && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium text-white">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      health.tablesReady ? 'bg-emerald-300' : 'bg-amber-300'
                    }`}
                  />
                  {health.tablesReady ? 'Connected' : 'Setup Needed'}
                </span>
              )}

              {health?.tablesReady && (
                <button
                  type="button"
                  onClick={handleQuickReset}
                  className="rounded-md bg-white/15 px-3 py-1 font-medium text-white hover:bg-white/25"
                >
                  Reset Data
                </button>
              )}

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-md bg-white px-3 py-1 font-medium text-blue-700 hover:bg-blue-50"
              >
                SQL Log ({logs.length})
              </button>
            </div>
          </div>
        </div>

        {/* Minimal Navigation Tabs */}
        <nav className="mx-auto flex max-w-5xl gap-6 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('clinic')}
            className={`border-b-2 py-3 text-sm font-medium transition ${
              activeTab === 'clinic'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Clinic DBMS
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('anomalies')}
            className={`border-b-2 py-3 text-sm font-medium transition ${
              activeTab === 'anomalies'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3NF vs BCNF
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bcnf')}
            className={`border-b-2 py-3 text-sm font-medium transition ${
              activeTab === 'bcnf'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            BCNF Rules
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loading && (
          <div className="py-16 text-center text-sm text-slate-500">
            Connecting to Supabase...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Backend connection error: {error}. Make sure the Node.js server is running on
            port 4000.
          </div>
        )}

        {!loading && activeTab === 'bcnf' && <BcnfInspectorTab />}

        {!loading &&
          activeTab !== 'bcnf' &&
          health &&
          (!health.supabaseConfigured || !health.tablesReady) && (
            <SetupBanner health={health} onRetry={loadAll} />
          )}

        {!loading && snapshot && activeTab === 'clinic' && (
          <ClinicDbmsTab
            snapshot={snapshot}
            onSnapshotUpdate={setSnapshot}
            onRefreshLogs={refreshLogs}
          />
        )}

        {!loading && snapshot && activeTab === 'anomalies' && (
          <AnomalyLabTab
            snapshot={snapshot}
            onSnapshotUpdate={setSnapshot}
            onRefreshLogs={refreshLogs}
          />
        )}
      </main>

      <SqlActivityDrawer
        open={drawerOpen}
        logs={logs}
        onClose={() => setDrawerOpen(false)}
        onClear={async () => {
          await api.clearLogs();
          setLogs([]);
        }}
      />
    </div>
  );
}

export default App;
