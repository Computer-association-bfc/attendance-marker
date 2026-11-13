"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export type Facing = "environment" | "user";

const FACING_KEY = "attendance:camera-facing";

function savedFacing(): Facing {
  try {
    return localStorage.getItem(FACING_KEY) === "user" ? "user" : "environment";
  } catch {
    return "environment";
  }
}

/**
 * Starts the camera and attaches it to the returned <video> ref. Defaults to
 * the rear camera (for scanning ID cards with a phone); `flip` switches
 * between rear and front, and the choice is remembered on this device.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Safe to read localStorage here: <AuthGate> only renders pages in the browser.
  const [facing, setFacing] = useState<Facing>(savedFacing);
  const [canFlip, setCanFlip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        // `ideal` so laptops with a single webcam still get that webcam.
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        // Device labels/count are only reliable once permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Camera unavailable. Allow camera access in the browser, or use the search box instead.",
          );
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  function flip() {
    const next: Facing = facing === "environment" ? "user" : "environment";
    setError(null);
    setFacing(next);
    try {
      localStorage.setItem(FACING_KEY, next);
    } catch {
      // Not remembered; it still switches for this session.
    }
  }

  return { videoRef, error, facing, canFlip, flip };
}

/** Calls onScan with the text of any QR code seen while `active` is true. */
export function useQrScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  onScan: (text: string) => void,
) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!active) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA) return;
      // Decode a downscaled frame; plenty for a QR held up to the camera.
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) onScanRef.current(code.data);
    }, 200);

    return () => clearInterval(timer);
  }, [videoRef, active]);
}
