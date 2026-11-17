import type { HealthStatus } from '../types/clinic';

interface SetupBannerProps {
  health: HealthStatus;
  onRetry: () => void;
}

export function SetupBanner({ health, onRetry }: SetupBannerProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
      <div className="rounded-md border border-blue-100 bg-blue-50/70 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Connect Supabase to get started
        </h2>
        <p className="mt-1 text-sm text-slate-600">{health.message}</p>
      </div>

      <ol className="mt-5 list-inside list-decimal space-y-2.5 text-sm text-slate-700">
        <li>
          Copy <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">server/.env.example</code> to{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">server/.env</code> and add your{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">SUPABASE_SERVICE_ROLE_KEY</code>.
        </li>
        <li>
          Run <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">server/sql/schema.sql</code> in your Supabase SQL Editor.
        </li>
        <li>Restart the server and click Retry below.</li>
      </ol>

      <div className="mt-5">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}
