/* eslint-disable @next/next/no-img-element -- photos are inline data URLs */

export default function GuestPhoto({
  src,
  label,
  size = "lg",
}: {
  src: string | null;
  label: string;
  size?: "sm" | "lg";
}) {
  const box = size === "lg" ? "h-48 w-40" : "h-10 w-10";
  return src ? (
    <img
      src={src}
      alt={label}
      className={`${box} rounded-md border border-zinc-200 object-cover`}
    />
  ) : (
    <div
      className={`${box} flex items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-center text-xs text-zinc-400`}
    >
      {size === "lg" ? "No photo on file" : "—"}
    </div>
  );
}
