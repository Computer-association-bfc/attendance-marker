"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Starts the webcam and attaches it to the returned <video> ref. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
      })
      .catch(() =>
        setError(
          "Camera unavailable. Allow camera access in the browser, or use the search box instead.",
        ),
      );

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, error };
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
