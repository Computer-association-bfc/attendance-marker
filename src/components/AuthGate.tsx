"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const UserContext = createContext<User | null>(null);

/** The signed-in desk volunteer. Only usable inside <AuthGate>. */
export function useUser(): User {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside <AuthGate>");
  return user;
}

const NAV = [
  { href: "/checkin", label: "Check-in desk" },
  { href: "/guests", label: "Guest list" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => onAuthStateChanged(auth(), setUser), []);

  if (user === undefined) {
    return <p className="m-auto text-zinc-500">Loading…</p>;
  }
  if (!user) return <LoginForm />;

  return (
    <UserContext.Provider value={user}>
      <header className="no-print border-b border-zinc-200 bg-white">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2">
          <span className="mr-4 hidden font-semibold sm:inline">Event Attendance</span>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded px-3 py-1.5 text-sm ${
                pathname.startsWith(n.href)
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <span className="ml-auto hidden text-xs text-zinc-500 sm:inline">{user.email}</span>
          <button
            onClick={() => signOut(auth())}
            className="ml-auto rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 sm:ml-0"
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </UserContext.Provider>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth(), email, password);
    } catch {
      setError("Wrong email or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="m-auto flex w-full max-w-sm flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6"
    >
      <h1 className="text-lg font-semibold">Volunteer sign in</h1>
      <input
        className="input"
        type="email"
        placeholder="Email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
