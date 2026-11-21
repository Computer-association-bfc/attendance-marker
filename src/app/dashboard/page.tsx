"use client";

import { useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { GUEST_FIELDS } from "@/lib/guests";
import { formatTime, useGuests } from "@/lib/useGuests";

type Filter = "all" | "present" | "absent" | "on-spot" | "food";

export default function DashboardPage() {
  const guests = useGuests() ?? [];
  const [filter, setFilter] = useState<Filter>("all");

  const present = guests.filter((g) => g.checkedInAt);
  const onSpot = guests.filter((g) => g.source === "on-spot");
  const fed = guests.filter((g) => g.foodClaimedAt);
  const shown = guests
    .filter(
      (g) =>
        filter === "all" ||
        (filter === "present" && g.checkedInAt) ||
        (filter === "absent" && !g.checkedInAt) ||
        (filter === "on-spot" && g.source === "on-spot") ||
        (filter === "food" && g.foodClaimedAt),
    )
    // Latest arrivals first, then the rest alphabetically.
    .sort(
      (a, b) =>
        (b.checkedInAt?.toMillis() ?? 0) - (a.checkedInAt?.toMillis() ?? 0) ||
        a.name.localeCompare(b.name),
    );

  function exportCsv() {
    downloadCsv(`attendance-${new Date().toISOString().slice(0, 10)}.csv`, [
      [...GUEST_FIELDS.map((f) => f.label), "Status", "Check-in time", "Registration", "Checked in by", "Food claimed", "Food time", "Food marked by"],
      ...guests.map((g) => [
        ...GUEST_FIELDS.map((f) => g[f.key]),
        g.checkedInAt ? "Present" : "Absent",
        g.checkedInAt ? g.checkedInAt.toDate().toLocaleString("en-IN") : "",
        g.source,
        g.checkedInBy ?? "",
        g.foodClaimedAt ? "Yes" : "No",
        g.foodClaimedAt ? g.foodClaimedAt.toDate().toLocaleString("en-IN") : "",
        g.foodClaimedBy ?? "",
      ]),
    ]);
  }

  const stats: { label: string; value: number; filter: Filter }[] = [
    { label: "Expected + walk-ins", value: guests.length, filter: "all" },
    { label: "Present", value: present.length, filter: "present" },
    { label: "Yet to arrive", value: guests.length - present.length, filter: "absent" },
    { label: "On-spot registrations", value: onSpot.length, filter: "on-spot" },
    { label: "Food claimed", value: fed.length, filter: "food" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Live dashboard</h1>
        <button className="btn-secondary ml-auto" onClick={exportCsv}>
          Export to Excel (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <button
            key={s.filter}
            onClick={() => setFilter(s.filter)}
            className={`card text-left ${filter === s.filter ? "ring-2 ring-zinc-900" : ""}`}
          >
            <span className="block text-3xl font-semibold tabular-nums">{s.value}</span>
            <span className="text-sm text-zinc-500">{s.label}</span>
          </button>
        ))}
      </div>

      <ul className="card divide-y divide-zinc-100 p-0">
        {shown.map((g) => (
          <li key={g.id} className="flex items-center gap-3 p-3">
            <span className="flex-1">
              <span className="block font-medium">{g.name}</span>
              <span className="block text-sm text-zinc-500">
                {g.designation}, {g.institution}
              </span>
            </span>
            {g.foodClaimedAt && (
              <span className="text-sm text-orange-700">🍽 {formatTime(g.foodClaimedAt)}</span>
            )}
            {g.checkedInAt ? (
              <span className="text-sm text-green-700">✓ {formatTime(g.checkedInAt)}</span>
            ) : (
              <span className="text-sm text-zinc-400">Not arrived</span>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="p-6 text-center text-sm text-zinc-500">Nobody here yet.</li>}
      </ul>
    </div>
  );
}
