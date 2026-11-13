import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export type GuestSource = "pre-registered" | "on-spot";

export interface Guest {
  id: string;
  name: string;
  designation: string;
  institution: string;
  phone: string;
  email: string;
  awardCategory: string;
  title: string;
  /** Reference photo (small JPEG data URL), shown to the desk volunteer on scan. */
  photo: string | null;
  source: GuestSource;
  checkedInAt: Timestamp | null;
  checkedInBy: string | null;
}

export interface CheckIn {
  /** Webcam snapshot taken at the desk at the moment of check-in. */
  snapshot: string | null;
  at: Timestamp;
  by: string;
}

export type GuestTextField =
  | "name"
  | "designation"
  | "institution"
  | "phone"
  | "email"
  | "awardCategory"
  | "title";

export type NewGuest = Pick<Guest, GuestTextField | "photo">;

/** The text fields of a guest, in form order, with their CSV column names. */
export const GUEST_FIELDS: {
  key: GuestTextField;
  label: string;
  csv: string;
  required?: boolean;
  type?: "email" | "tel";
}[] = [
  { key: "title", label: "Title", csv: "title", required: true },
  { key: "name", label: "Name", csv: "name", required: true },
  { key: "designation", label: "Designation", csv: "designation", required: true },
  { key: "institution", label: "Institution", csv: "institution", required: true },
  { key: "phone", label: "Phone", csv: "phone", type: "tel" },
  { key: "email", label: "Email", csv: "email", type: "email" },
  { key: "awardCategory", label: "Award category", csv: "award_category" },
];

export const emptyGuestFields = () =>
  Object.fromEntries(GUEST_FIELDS.map((f) => [f.key, ""])) as Record<
    GuestTextField,
    string
  >;

// Guest documents use Firestore's random 20-character IDs, which are
// unguessable, so the QR code only needs to carry the ID. Nobody can
// forge a valid QR for someone else without access to the database.
const QR_PREFIX = "EVT-ATT:";

export const qrPayload = (guestId: string) => QR_PREFIX + guestId;

export function guestIdFromQr(text: string): string | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  const id = text.slice(QR_PREFIX.length);
  return /^[A-Za-z0-9]{20}$/.test(id) ? id : null;
}

const guestsCol = () => collection(db(), "guests");
const checkinsCol = () => collection(db(), "checkins");

export function watchGuests(onChange: (guests: Guest[]) => void) {
  return onSnapshot(query(guestsCol(), orderBy("name")), (snap) =>
    onChange(
      snap.docs.map(
        // Defaults keep guests added before a field existed working.
        (d) => ({ id: d.id, ...emptyGuestFields(), ...d.data() }) as Guest,
      ),
    ),
  );
}

export async function getCheckIn(guestId: string): Promise<CheckIn | null> {
  const snap = await getDoc(doc(checkinsCol(), guestId));
  return snap.exists() ? (snap.data() as CheckIn) : null;
}

export async function addGuests(guests: NewGuest[]) {
  // Firestore batches are limited to 500 writes; guest lists here are far smaller.
  const batch = writeBatch(db());
  for (const g of guests) {
    batch.set(doc(guestsCol()), {
      ...g,
      source: "pre-registered",
      checkedInAt: null,
      checkedInBy: null,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export function setGuestPhoto(guestId: string, photo: string) {
  return updateDoc(doc(guestsCol(), guestId), { photo });
}

export class AlreadyCheckedInError extends Error {
  constructor(public at: Timestamp | null) {
    super("Guest is already checked in");
  }
}

/**
 * Marks a guest present and stores the desk snapshot. Runs as a transaction
 * so the same QR can never be used twice, even from two desks at once.
 */
export async function checkIn(
  guestId: string,
  snapshot: string | null,
  by: string,
) {
  const guestRef = doc(guestsCol(), guestId);
  await runTransaction(db(), async (tx) => {
    const guest = await tx.get(guestRef);
    if (!guest.exists()) throw new Error("Guest not found");
    if (guest.data().checkedInAt) {
      throw new AlreadyCheckedInError(guest.data().checkedInAt);
    }
    tx.update(guestRef, { checkedInAt: serverTimestamp(), checkedInBy: by });
    tx.set(doc(checkinsCol(), guestId), {
      snapshot,
      at: serverTimestamp(),
      by,
    });
  });
}

/** Registers a walk-in guest and checks them in in one step. */
export async function registerOnSpot(
  guest: Omit<NewGuest, "photo">,
  snapshot: string | null,
  by: string,
) {
  const batch = writeBatch(db());
  const guestRef = doc(guestsCol());
  batch.set(guestRef, {
    ...guest,
    // The desk snapshot doubles as their reference photo.
    photo: snapshot,
    source: "on-spot",
    checkedInAt: serverTimestamp(),
    checkedInBy: by,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(checkinsCol(), guestRef.id), {
    snapshot,
    at: serverTimestamp(),
    by,
  });
  await batch.commit();
  return guestRef.id;
}
