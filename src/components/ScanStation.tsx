"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { guestIdFromQr, type Guest } from "@/lib/guests";
import { useCamera, useQrScanner } from "@/lib/useCamera";

export type Banner = { tone: "ok" | "warn" | "error"; text: string };

export const SAVE_FAILED: Banner = {
  tone: "error",
  text: "Could not save. Check the internet connection and try again.",
};

export interface StationActions {
  /** Shows a success banner and goes back to scanning. */
  done: (text: string) => void;
  /** Shows a banner without leaving the current panel. */
  notify: (banner: Banner) => void;
  /** Goes back to scanning. */
  cancel: () => void;
}

type Mode =
  | { kind: "scan" }
  | { kind: "review"; guestId: string }
  | { kind: "extra" };

/**
 * A QR-scanning desk: camera view, guest search, and a panel for the guest
 * that was scanned or picked. Used by the check-in desk and the food counter.
 */
export default function ScanStation({
  guests,
  intro,
  searchStatus,
  renderReview,
  extra,
}: {
  guests: Guest[] | null;
  intro: string;
  /** Shown next to each search result, e.g. "✓ 10:42". */
  searchStatus: (g: Guest) => React.ReactNode;
  renderReview: (guest: Guest, actions: StationActions) => React.ReactNode;
  /** An optional extra action below the search box, e.g. on-spot registration. */
  extra?: {
    label: string;
    render: (actions: StationActions) => React.ReactNode;
  };
}) {
  const { videoRef, error: cameraError, facing, canFlip, flip } = useCamera();
  const [mode, setMode] = useState<Mode>({ kind: "scan" });
  const [banner, setBanner] = useState<Banner | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // On a phone the panel sits below the camera; bring the guest details or
  // the form into view so the volunteer doesn't have to scroll.
  useEffect(() => {
    if (mode.kind !== "scan") {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mode]);

  // The guest usually keeps holding their QR after being served; ignore
  // repeat scans of the same code for a few seconds so that doesn't pop up
  // an "already done" warning straight away.
  const lastScan = useRef({ text: "", at: 0 });
  // Counts finished guests; restarts the repeat-scan timer after each one.
  const [doneCount, setDoneCount] = useState(0);
  useEffect(() => {
    if (doneCount) lastScan.current.at = Date.now();
  }, [doneCount]);

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

  const actions: StationActions = {
    done(text) {
      setDoneCount((c) => c + 1);
      setBanner({ tone: "ok", text });
      setMode({ kind: "scan" });
    },
    notify: setBanner,
    cancel: () => setMode({ kind: "scan" }),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:gap-6">
      {/* The camera isn't needed while typing into a form; give a phone screen to the form. */}
      <section
        className={`flex-col gap-3 ${mode.kind === "extra" ? "hidden lg:flex" : "flex"}`}
      >
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
            <p className="text-sm text-zinc-600">{intro}</p>
            <GuestSearch
              guests={guests ?? []}
              status={searchStatus}
              onPick={(g) => setMode({ kind: "review", guestId: g.id })}
            />
            {extra && (
              <button
                className="btn-secondary"
                onClick={() => setMode({ kind: "extra" })}
              >
                {extra.label}
              </button>
            )}
          </>
        )}
        {reviewing && renderReview(reviewing, actions)}
        {mode.kind === "extra" && extra?.render(actions)}
      </aside>
    </div>
  );
}

function GuestSearch({
  guests,
  status,
  onPick,
}: {
  guests: Guest[];
  status: (g: Guest) => React.ReactNode;
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
          <span className="flex-1">
            <span className="block text-sm font-medium">{g.name}</span>
            <span className="block text-xs text-zinc-500">
              {g.designation}, {g.institution}
            </span>
          </span>
          {status(g)}
        </button>
      ))}
    </div>
  );
}

export function GuestDetails({ guest }: { guest: Guest }) {
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

/** Confirm / cancel buttons with a "Saving…" state. */
export function ConfirmButtons({
  label,
  cancelLabel = "Not them",
  onConfirm,
  onCancel,
}: {
  label: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
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
        {busy ? "Saving…" : label}
      </button>
      <button className="btn-secondary" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </button>
    </div>
  );
}
