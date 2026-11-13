"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/components/AuthGate";
import GuestPhoto from "@/components/GuestPhoto";
import {
  AlreadyCheckedInError,
  checkIn,
  emptyGuestFields,
  getCheckIn,
  GUEST_FIELDS,
  guestIdFromQr,
  registerOnSpot,
  type CheckIn,
  type Guest,
  type NewGuest,
} from "@/lib/guests";
import { snapshotFromVideo } from "@/lib/images";
import { useCamera, useQrScanner } from "@/lib/useCamera";
import { formatTime, useGuests } from "@/lib/useGuests";

type Mode =
  | { kind: "scan" }
  | { kind: "review"; guestId: string }
  | { kind: "onspot" };

type Banner = { tone: "ok" | "warn" | "error"; text: string } | null;

export default function CheckInPage() {
  const user = useUser();
  const guests = useGuests();
  const { videoRef, error: cameraError, facing, canFlip, flip } = useCamera();
  const [mode, setMode] = useState<Mode>({ kind: "scan" });
  const [banner, setBanner] = useState<Banner>(null);
  const panelRef = useRef<HTMLElement>(null);

  // On a phone the panel sits below the camera; bring the guest details or
  // the registration form into view so the volunteer doesn't have to scroll.
  useEffect(() => {
    if (mode.kind !== "scan") {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mode]);

  // The guest usually keeps holding their QR after being checked in; ignore
  // repeat scans of the same code for a few seconds so that doesn't pop up
  // an "already checked in" warning straight away.
  const lastScan = useRef({ text: "", at: 0 });

  useQrScanner(videoRef, mode.kind === "scan" && !!guests, (text) => {
    const now = Date.now();
    if (text === lastScan.current.text && now - lastScan.current.at < 8000) return;
    lastScan.current = { text, at: now };

    const id = guestIdFromQr(text);
    if (id && guests?.some((g) => g.id === id)) {
      setBanner(null);
      setMode({ kind: "review", guestId: id });
    } else {
      setBanner({ tone: "error", text: "This QR code is not on the guest list." });
    }
  });

  // Banners clear themselves so the desk is ready for the next guest.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const reviewing =
    mode.kind === "review" ? guests?.find((g) => g.id === mode.guestId) : null;

  function done(text: string) {
    lastScan.current.at = Date.now();
    setBanner({ tone: "ok", text });
    setMode({ kind: "scan" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:gap-6">
      <section className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            // Mirror only the front camera, so it behaves like a mirror.
            className={`aspect-[4/3] w-full object-cover sm:aspect-video ${
              facing === "user" ? "-scale-x-100" : ""
            }`}
          />
          {mode.kind === "scan" && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square w-3/5 max-w-56 rounded-xl border-4 border-white/70" />
            </div>
          )}
          {canFlip && (
            <button
              type="button"
              onClick={flip}
              className="absolute right-2 bottom-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/80"
            >
              ⟲ {facing === "environment" ? "Front camera" : "Rear camera"}
            </button>
          )}
        </div>
        {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
        {banner && (
          <p
            className={`rounded-md px-4 py-3 text-sm font-medium ${
              {
                ok: "bg-green-100 text-green-900",
                warn: "bg-amber-100 text-amber-900",
                error: "bg-red-100 text-red-900",
              }[banner.tone]
            }`}
          >
            {banner.text}
          </p>
        )}
      </section>

      <aside ref={panelRef} className="flex scroll-mt-2 flex-col gap-4">
        {mode.kind === "scan" && (
          <>
            <p className="text-sm text-zinc-600">
              Point the camera at the QR code on the guest&apos;s ID card, or
              find them by name.
            </p>
            <GuestSearch
              guests={guests ?? []}
              onPick={(g) => setMode({ kind: "review", guestId: g.id })}
            />
            <button
              className="btn-secondary"
              onClick={() => setMode({ kind: "onspot" })}
            >
              + On-spot registration
            </button>
          </>
        )}

        {mode.kind === "review" && reviewing && (
          <ReviewPanel
            guest={reviewing}
            onConfirm={async () => {
              const snapshot = videoRef.current
                ? snapshotFromVideo(videoRef.current)
                : null;
              try {
                await checkIn(reviewing.id, snapshot, user.email ?? user.uid);
                done(`✅ ${reviewing.name} checked in.`);
              } catch (e) {
                setBanner(
                  e instanceof AlreadyCheckedInError
                    ? {
                        tone: "warn",
                        text: `${reviewing.name} was already checked in at ${formatTime(e.at)}.`,
                      }
                    : { tone: "error", text: "Could not save. Check the internet connection and try again." },
                );
              }
            }}
            onCancel={() => setMode({ kind: "scan" })}
          />
        )}

        {mode.kind === "onspot" && (
          <OnSpotForm
            onSubmit={async (details) => {
              const snapshot = videoRef.current
                ? snapshotFromVideo(videoRef.current)
                : null;
              try {
                await registerOnSpot(details, snapshot, user.email ?? user.uid);
                done(`✅ ${details.name} registered and checked in.`);
              } catch {
                setBanner({ tone: "error", text: "Could not save. Check the internet connection and try again." });
              }
            }}
            onCancel={() => setMode({ kind: "scan" })}
          />
        )}
      </aside>
    </div>
  );
}

function GuestSearch({
  guests,
  onPick,
}: {
  guests: Guest[];
  onPick: (g: Guest) => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return guests
      .filter((g) =>
        [g.name, g.institution, g.phone, g.email].some((f) =>
          f.toLowerCase().includes(needle),
        ),
      )
      .slice(0, 8);
  }, [guests, q]);

  return (
    <div className="flex flex-col gap-2">
      <input
        className="input"
        placeholder="Search name, college, phone or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {matches.map((g) => (
        <button
          key={g.id}
          onClick={() => onPick(g)}
          className="card flex items-center gap-3 p-2 text-left hover:bg-zinc-50"
        >
          <GuestPhoto src={g.photo} label={g.name} size="sm" />
          <span className="flex-1">
            <span className="block text-sm font-medium">{g.name}</span>
            <span className="block text-xs text-zinc-500">
              {g.designation}, {g.institution}
            </span>
          </span>
          {g.checkedInAt && (
            <span className="text-xs text-green-700">✓ {formatTime(g.checkedInAt)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function ReviewPanel({
  guest,
  onConfirm,
  onCancel,
}: {
  guest: Guest;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [previous, setPrevious] = useState<CheckIn | null>(null);

  useEffect(() => {
    if (guest.checkedInAt) void getCheckIn(guest.id).then(setPrevious);
  }, [guest.id, guest.checkedInAt]);

  if (guest.checkedInAt) {
    return (
      <div className="card flex flex-col gap-3 border-amber-300 bg-amber-50">
        <p className="font-semibold text-amber-900">
          ⚠️ Already checked in at {formatTime(guest.checkedInAt)}
        </p>
        <GuestDetails guest={guest} />
        <div className="flex gap-3">
          <figure>
            <GuestPhoto src={guest.photo} label="Photo on file" />
            <figcaption className="mt-1 text-xs text-zinc-500">On file</figcaption>
          </figure>
          <figure>
            <GuestPhoto src={previous?.snapshot ?? null} label="Taken at check-in" />
            <figcaption className="mt-1 text-xs text-zinc-500">
              At check-in ({guest.checkedInBy})
            </figcaption>
          </figure>
        </div>
        <p className="text-sm text-amber-900">
          If this is a different person, this QR may have been shared. Inform
          the coordinator.
        </p>
        <button className="btn-secondary" onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <GuestDetails guest={guest} />
      <GuestPhoto src={guest.photo} label={guest.name} />
      <p className="text-sm text-zinc-600">
        {guest.photo
          ? "Check the person at the desk matches this photo."
          : "No photo on file. Verify identity (e.g. ID card) before confirming."}{" "}
        A camera snapshot is saved when you confirm.
      </p>
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : "Confirm check-in"}
        </button>
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>
          Not them
        </button>
      </div>
    </div>
  );
}

function GuestDetails({ guest }: { guest: Guest }) {
  return (
    <div>
      <p className="text-lg font-semibold">{guest.name}</p>
      <p className="text-sm text-zinc-600">
        {guest.designation}, {guest.institution}
      </p>
      {guest.title && <p className="text-sm text-zinc-600">{guest.title}</p>}
      {guest.awardCategory && (
        <p className="text-sm text-zinc-600">Award: {guest.awardCategory}</p>
      )}
      {(guest.phone || guest.email) && (
        <p className="text-sm text-zinc-500">
          {[guest.phone, guest.email].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function OnSpotForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (d: Omit<NewGuest, "photo">) => Promise<void>;
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
      <p className="text-sm text-zinc-600">
        Point the camera at the guest&apos;s face. Their photo is taken when
        you press register.
      </p>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>
          {busy ? "Saving…" : "Take photo & register"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
