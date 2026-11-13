# Event Attendance

QR-code check-in for a one-day event, built with Next.js, TypeScript and Firebase
(Auth + Firestore).

## How it works

- **Guest list**: add guests one by one or import a CSV exported from Excel
  (`name, designation, institution, phone, email, award_category, title`;
  only `name` is required, see `sample-guests.csv`). You can also
  attach a reference photo for each guest.
- **QR badges** (`/guests/badges`): print them, or save individual QR codes and send
  them on WhatsApp.
- **Check-in desk** (`/checkin`): scan a QR code with the webcam, or search by name.
  The volunteer sees the guest's reference photo and confirms that the person at the
  desk matches it. A webcam snapshot is saved as proof.
- **On-spot registration**: walk-in guests are registered at the desk. Their photo
  is taken and they are checked in straight away.
- **Dashboard** (`/dashboard`): live counts, list of who has arrived, and an
  export to Excel (CSV).

### Proxy protection

- QR codes contain the guest's random 20-character Firestore ID, so they can't be
  guessed or forged.
- Each QR works only once. This is enforced in a Firestore transaction *and* by
  `firestore.rules`, so it can't be bypassed from the browser.
- When a used QR is scanned again, the desk shows a warning with the original check-in time and
  snapshot, so a shared QR is caught immediately.
- Check-in records (snapshots) can't be edited or deleted.

Photos are stored as small JPEGs inside Firestore, so you don't need Firebase Storage
(which requires the paid Blaze plan). The free Spark plan is enough.

## Run locally without a Firebase project (emulators)

Requires Java 11+ and the Firebase CLI (`npm i -g firebase-tools`).

```bash
cp .env.local.example .env.local      # then uncomment the emulator lines
npm install
npm run emulators                     # terminal 1
npm run dev                           # terminal 2
```

Create a volunteer login in the emulator UI at http://127.0.0.1:4000/auth.
Emulator data is wiped every time the emulators are restarted.

## Set up the real Firebase project

1. Create a project at https://console.firebase.google.com (Spark/free plan is fine).
2. **Build > Authentication**: enable the *Email/Password* provider. Under
   *Settings > User actions*, untick **Enable create (sign-up)** so only the accounts you
   add can sign in. Then add one account per desk volunteer under *Users*.
3. **Build > Firestore Database**: create a database (choose region `asia-south1`).
4. **Project settings > General > Your apps**: add a Web app and copy its config
   into `.env.local` (see `.env.local.example`). Remove the emulator lines.
5. Deploy the security rules:
   ```bash
   firebase login
   firebase deploy --only firestore:rules --project <your-project-id>
   ```

## On the event day

- Use a laptop with a webcam (or an external USB webcam facing the guest), running
  Chrome. Open `/checkin` and allow camera access.
- The app needs internet to save check-ins. Keep a **mobile hotspot** as a backup to
  the venue Wi-Fi, and keep a **paper register** in case everything fails.
- Do a full rehearsal the day before, using the real QR badges.
- After the event, export the CSV and then delete the photos/snapshots from Firestore.
  They are personal data and you shouldn't keep them longer than needed.
