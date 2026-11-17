import type { SqlLogEntry } from '../types/clinic';

interface SqlActivityDrawerProps {
  open: boolean;
  logs: SqlLogEntry[];
  onClose: () => void;
  onClear: () => void;
}

export function SqlActivityDrawer({
  open,
  logs,
  onClose,
  onClear,
}: SqlActivityDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">SQL Activity Log</h2>
          <p className="text-xs text-slate-500">Read-only history of queries</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={onClear}
            className="font-medium text-slate-500 hover:text-slate-900"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {logs.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-500">
            No operations recorded yet.
          </p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">
                    {entry.operation}
                  </span>
                  <span className="font-mono text-slate-600">{entry.targetTable}</span>
                </div>
                <span
                  className={`font-medium ${
                    entry.status === 'SUCCESS' ? 'text-blue-700' : 'text-rose-600'
                  }`}
                >
                  {entry.status}
                </span>
              </div>

              <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-800">
                {entry.sqlPreview}
              </pre>

              <p className="mt-2 text-slate-700">{entry.detail}</p>
              <p className="mt-1 text-[11px] text-slate-500">{entry.bcnfRule}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
