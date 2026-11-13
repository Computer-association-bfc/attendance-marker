"use client";

import { useEffect, useState } from "react";
import { watchGuests, type Guest } from "./guests";

/** Live guest list; `null` until the first snapshot arrives. */
export function useGuests() {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  useEffect(() => watchGuests(setGuests), []);
  return guests;
}

export function formatTime(ts: { toDate(): Date } | null) {
  return ts
    ? ts.toDate().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}
