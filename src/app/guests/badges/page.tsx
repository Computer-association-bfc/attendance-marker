"use client";

/* eslint-disable @next/next/no-img-element -- QR codes are inline data URLs */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { qrPayload, type Guest } from "@/lib/guests";
import { useGuests } from "@/lib/useGuests";

export default function BadgesPage() {
  const guests = useGuests();
  const preRegistered = guests?.filter((g) => g.source === "pre-registered") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center gap-3">
        <p className="text-sm text-zinc-600">
          One badge per pre-registered guest. Print and cut, or right-click a
          QR to save it and send it on WhatsApp.
        </p>
        <button className="btn-primary ml-auto" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {preRegistered.map((g) => (
          <Badge key={g.id} guest={g} />
        ))}
      </div>
    </div>
  );
}

function Badge({ guest }: { guest: Guest }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    void QRCode.toDataURL(qrPayload(guest.id), {
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then(setQr);
  }, [guest.id]);

  return (
    <div className="card flex break-inside-avoid flex-col items-center gap-2 text-center">
      {qr && <img src={qr} alt={`QR code for ${guest.name}`} className="w-40" />}
      <p className="font-semibold leading-tight">{guest.name}</p>
      <p className="text-xs text-zinc-600">
        {guest.designation}
        <br />
        {guest.institution}
      </p>
    </div>
  );
}
