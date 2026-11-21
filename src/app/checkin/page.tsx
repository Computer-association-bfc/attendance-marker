"use client";

import { useState } from "react";
import { useUser } from "@/components/AuthGate";
import ScanStation, {
  ConfirmButtons,
  GuestDetails,
  SAVE_FAILED,
  type StationActions,
} from "@/components/ScanStation";
import {
  AlreadyDoneError,
  checkIn,
  emptyGuestFields,
  GUEST_FIELDS,
  registerOnSpot,
  type Guest,
  type NewGuest,
} from "@/lib/guests";
import { formatTime, useGuests } from "@/lib/useGuests";

export default function CheckInPage() {
  const user = useUser();
  const guests = useGuests();
  const by = user.email ?? user.uid;

  return (
    <ScanStation
      guests={guests}
      intro="Point the camera at the QR code on the guest's ID card, or find them by name."
      searchStatus={(g) =>
        g.checkedInAt && (
          <span className="text-xs text-green-700">✓ {formatTime(g.checkedInAt)}</span>
        )
      }
      renderReview={(guest, actions) => (
        <ReviewPanel
          guest={guest}
          actions={actions}
          onConfirm={async () => {
            try {
              await checkIn(guest.id, by);
              actions.done(`✅ ${guest.name} checked in.`);
            } catch (e) {
              actions.notify(
                e instanceof AlreadyDoneError
                  ? {
                      tone: "warn",
                      text: `${guest.name} was already checked in at ${formatTime(e.at)}.`,
                    }
                  : SAVE_FAILED,
              );
            }
          }}
        />
      )}
      extra={{
        label: "+ On-spot registration",
        render: (actions) => (
          <OnSpotForm
            onCancel={actions.cancel}
            onSubmit={async (details) => {
              try {
                await registerOnSpot(details, by);
                actions.done(`✅ ${details.name} registered and checked in.`);
              } catch {
                actions.notify(SAVE_FAILED);
              }
            }}
          />
        ),
      }}
    />
  );
}

function ReviewPanel({
  guest,
  actions,
  onConfirm,
}: {
  guest: Guest;
  actions: StationActions;
  onConfirm: () => Promise<void>;
}) {
  if (guest.checkedInAt) {
    return (
      <div className="card flex flex-col gap-3 border-amber-300 bg-amber-50">
        <p className="font-semibold text-amber-900">
          ⚠️ Already checked in at {formatTime(guest.checkedInAt)}
        </p>
        <GuestDetails guest={guest} />
        <p className="text-sm text-amber-900">
          Checked in by {guest.checkedInBy}. If this person says they haven&apos;t
          checked in yet, their QR may have been used by someone else. Inform
          the coordinator.
        </p>
        <button className="btn-secondary" onClick={actions.cancel}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <GuestDetails guest={guest} />
      <p className="text-sm text-zinc-600">
        Check that the name matches the guest&apos;s ID card before confirming.
      </p>
      <ConfirmButtons
        label="Confirm check-in"
        onConfirm={onConfirm}
        onCancel={actions.cancel}
      />
    </div>
  );
}

function OnSpotForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (d: NewGuest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(emptyGuestFields);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit(
          Object.fromEntries(
            Object.entries(form).map(([k, v]) => [k, v.trim()]),
          ) as typeof form,
        );
        setBusy(false);
      }}
    >
      <p className="font-semibold">On-spot registration</p>
      {GUEST_FIELDS.map((f) => (
        <input
          key={f.key}
          className="input"
          type={f.type ?? "text"}
          placeholder={f.required ? f.label : `${f.label} (optional)`}
          required={f.required}
          value={form[f.key]}
          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
        />
      ))}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>
          {busy ? "Saving…" : "Register & check in"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
