"use client";

import Link from "next/link";
import { useState } from "react";
import { parseCsv } from "@/lib/csv";
import {
  addGuests,
  emptyGuestFields,
  GUEST_FIELDS,
  type NewGuest,
} from "@/lib/guests";
import { formatTime, useGuests } from "@/lib/useGuests";

const CSV_HEADERS = GUEST_FIELDS.map((f) => f.csv);

export default function GuestsPage() {
  const guests = useGuests();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Guest list</h1>
        <span className="text-sm text-zinc-500">{guests?.length ?? 0} guests</span>
        <Link href="/guests/badges" className="btn-secondary ml-auto">
          Print QR badges
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AddGuestForm />
        <CsvImport />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              {GUEST_FIELDS.map((f) => (
                <th key={f.key} className="p-3">
                  {f.label}
                </th>
              ))}
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {guests?.map((g) => (
              <tr key={g.id} className="border-t border-zinc-100">
                {GUEST_FIELDS.map((f) => (
                  <td
                    key={f.key}
                    className={`p-3 ${f.key === "name" ? "font-medium" : ""}`}
                  >
                    {g[f.key]}
                  </td>
                ))}
                <td className="p-3">
                  {g.checkedInAt ? (
                    <span className="text-green-700">✓ {formatTime(g.checkedInAt)}</span>
                  ) : (
                    <span className="text-zinc-400">Not arrived</span>
                  )}
                  {g.source === "on-spot" && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">on-spot</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddGuestForm() {
  const [form, setForm] = useState(emptyGuestFields);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const trimmed = Object.fromEntries(
          Object.entries(form).map(([k, v]) => [k, v.trim()]),
        ) as typeof form;
        await addGuests([trimmed]);
        setForm(emptyGuestFields());
        setBusy(false);
      }}
    >
      <p className="font-semibold">Add a guest</p>
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
      <button className="btn-primary" disabled={busy}>
        {busy ? "Adding…" : "Add guest"}
      </button>
    </form>
  );
}

function CsvImport() {
  const [preview, setPreview] = useState<NewGuest[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setError("");
    const rows = parseCsv(await file.text());
    // Accept "Award Category", "award category" and "award_category" alike.
    const header =
      rows[0]?.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")) ?? [];
    const cols = CSV_HEADERS.map((h) => header.indexOf(h));
    if (cols[0] < 0) {
      setPreview(null);
      setError(`The first row must be a header with: ${CSV_HEADERS.join(", ")}`);
      return;
    }
    setPreview(
      rows
        .slice(1)
        .map((r) => {
          const guest: NewGuest = emptyGuestFields();
          GUEST_FIELDS.forEach((f, i) => {
            if (cols[i] >= 0) guest[f.key] = r[cols[i]]?.trim() ?? "";
          });
          return guest;
        })
        .filter((g) => g.name),
    );
  }

  return (
    <div className="card flex flex-col gap-2">
      <p className="font-semibold">Import from Excel / CSV</p>
      <p className="text-sm text-zinc-600">
        In Excel, save the sheet as <b>CSV UTF-8</b> with the columns{" "}
        <code>{CSV_HEADERS.join(", ")}</code>. Only <code>name</code> is
        required; other columns can be left out.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-sm"
        onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {preview && (
        <>
          <p className="text-sm">
            Found <b>{preview.length}</b> guests, e.g.{" "}
            {preview.slice(0, 3).map((g) => g.name).join(", ")}
            {preview.length > 3 && "…"}
          </p>
          <button
            className="btn-primary"
            disabled={busy || preview.length === 0}
            onClick={async () => {
              setBusy(true);
              await addGuests(preview);
              setPreview(null);
              setBusy(false);
            }}
          >
            {busy ? "Importing…" : `Import ${preview.length} guests`}
          </button>
        </>
      )}
    </div>
  );
}
