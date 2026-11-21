"use client";

import { useUser } from "@/components/AuthGate";
import ScanStation, {
  ConfirmButtons,
  GuestDetails,
  SAVE_FAILED,
} from "@/components/ScanStation";
import { AlreadyDoneError, claimFood } from "@/lib/guests";
import { formatTime, useGuests } from "@/lib/useGuests";

export default function FoodPage() {
  const user = useUser();
  const guests = useGuests();
  const by = user.email ?? user.uid;

  return (
    <ScanStation
      guests={guests}
      intro="Food counter: scan the QR code on the guest's ID card, or find them by name."
      searchStatus={(g) =>
        g.foodClaimedAt && (
          <span className="text-xs text-orange-700">🍽 {formatTime(g.foodClaimedAt)}</span>
        )
      }
      renderReview={(guest, actions) =>
        guest.foodClaimedAt ? (
          <div className="card flex flex-col gap-3 border-amber-300 bg-amber-50">
            <p className="font-semibold text-amber-900">
              ⚠️ Food already claimed at {formatTime(guest.foodClaimedAt)}
            </p>
            <GuestDetails guest={guest} />
            <p className="text-sm text-amber-900">
              Marked by {guest.foodClaimedBy}. If this person says they
              haven&apos;t had food yet, their QR may have been used by someone
              else. Inform the coordinator.
            </p>
            <button className="btn-secondary" onClick={actions.cancel}>
              Back
            </button>
          </div>
        ) : (
          <div className="card flex flex-col gap-3">
            <GuestDetails guest={guest} />
            {!guest.checkedInAt && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Note: this guest hasn&apos;t been checked in at the entrance.
              </p>
            )}
            <ConfirmButtons
              label="Mark food given"
              onCancel={actions.cancel}
              onConfirm={async () => {
                try {
                  await claimFood(guest.id, by);
                  actions.done(`🍽 Food marked for ${guest.name}.`);
                } catch (e) {
                  actions.notify(
                    e instanceof AlreadyDoneError
                      ? {
                          tone: "warn",
                          text: `${guest.name} already claimed food at ${formatTime(e.at)}.`,
                        }
                      : SAVE_FAILED,
                  );
                }
              }}
            />
          </div>
        )
      }
    />
  );
}
