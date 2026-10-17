"use client";

import { useEffect, useState } from "react";
import { NATIVE_TOKEN, parseContractError, stroopsToXlm, topUpSchedule, type ScheduleData } from "@/lib/stellar";
import { maxEndTime } from "@/lib/streamHealth";
import { useWallet } from "@/lib/WalletContext";
import { useToast } from "@/components/Toast";

interface Props {
  schedules: ScheduleData[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchTopUpModal({ schedules, open, onClose, onSuccess }: Props) {
  const { publicKey } = useWallet();
  const { addToast, updateToast } = useToast();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmounts({});
    setErr("");
    setLoading(false);
  }, [open]);

  if (!open) return null;

  const now = Math.floor(Date.now() / 1000);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!publicKey) return;

    const entries = schedules.map((schedule) => ({
      schedule,
      amount: (amounts[schedule.id] ?? "").trim(),
    }));

    if (entries.some(({ amount }) => isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      setErr("Enter a top-up amount for every stream.");
      return;
    }

    setErr("");
    setLoading(true);
    const toastId = addToast({
      status: "pending",
      title: "Topping up streams…",
      message: "Confirm each transaction in your wallet.",
      duration: 0,
    });

    const failures: string[] = [];
    let toppedUp = 0;

    for (const { schedule, amount } of entries) {
      try {
        await topUpSchedule(publicKey, schedule.id, amount);
        toppedUp += 1;
      } catch (error) {
        const message = parseContractError(error instanceof Error ? error : new Error(String(error)));
        failures.push(`#${schedule.id}: ${message}`);
      }
    }

    if (failures.length > 0) {
      const message = `${toppedUp} of ${entries.length} streams topped up. ${failures.join(" ")}`;
      setErr(message);
      updateToast(toastId, {
        status: "error",
        title: "Batch top-up incomplete",
        message,
        duration: 8000,
      });
    } else {
      updateToast(toastId, {
        status: "success",
        title: "Batch top-up confirmed",
        message: `${toppedUp} streams topped up successfully.`,
        duration: 5000,
      });
      onSuccess();
      onClose();
    }

    setLoading(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Top up expiring streams"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold">Top Up Expiring Streams</h2>
            <p className="text-sm text-zinc-400">
              {schedules.length} streams end within seven days.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="divide-y divide-white/10 rounded-xl border border-white/10">
            {schedules.map((schedule) => {
              const token = schedule.token === NATIVE_TOKEN ? "XLM" : `${schedule.token.slice(0, 5)}…`;
              const daysLeft = Math.max(0, Math.ceil((maxEndTime(schedule) - now) / 86400));
              return (
                <div key={schedule.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-200">Schedule #{schedule.id}</p>
                    <p className="text-xs text-zinc-500">
                      Ends in {daysLeft}d · Total {stroopsToXlm(schedule.total_amount)} {token}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 sm:w-40">
                    <label htmlFor={`batch-topup-${schedule.id}`} className="text-xs text-zinc-500">
                      Amount
                    </label>
                    <input
                      id={`batch-topup-${schedule.id}`}
                      type="number"
                      min="0.0000001"
                      step="any"
                      value={amounts[schedule.id] ?? ""}
                      onChange={(event) =>
                        setAmounts((current) => ({ ...current, [schedule.id]: event.target.value }))
                      }
                      placeholder="0.00"
                      required
                      disabled={loading}
                      className="input"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {err && (
            <p className="text-xs text-red-400" role="alert">
              {err}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-zinc-300 hover:border-white/20 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary rounded-xl py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Topping up…" : "Top Up All"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
