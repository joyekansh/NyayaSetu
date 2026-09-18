'use client';

/**
 * components/CameraCapture.tsx — rear-camera capture with canvas downscaling,
 * plus a file-picker fallback for desktop kiosks and laptops.
 * OWNER: Akash.
 *
 * Compression happens here, before upload, because OCR accuracy plateaus around
 * 1600px on the long edge while file size keeps climbing — and kiosk uplinks are slow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export interface CameraCaptureProps {
  onCapture: (blob: Blob, previewUrl: string) => void;
  disabled?: boolean;
  /** Localised label, e.g. t('upload.capture'). */
  captureLabel?: string;
  chooseFileLabel?: string;
}

type Phase = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported';

export default function CameraCapture({
  onCapture,
  disabled = false,
  captureLabel = 'Take photo',
  chooseFileLabel = 'Choose a file instead',
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('live');
    } catch {
      setPhase('denied');
      setError('Camera access was blocked. Upload a photo from this device instead.');
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const blobPromise = drawToBlob(video, video.videoWidth, video.videoHeight);
    blobPromise.then((blob) => {
      if (!blob) {
        setError('Could not save that photo. Try again.');
        return;
      }
      stopStream();
      setPhase('idle');
      onCapture(blob, URL.createObjectURL(blob));
    });
  }, [onCapture, stopStream]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError('Upload a photo or a PDF of the document.');
        return;
      }
      if (file.type === 'application/pdf') {
        onCapture(file, URL.createObjectURL(file));
        return;
      }
      const bitmapSource = await createImageBitmap(file);
      const blob = await drawToBlob(
        bitmapSource,
        bitmapSource.width,
        bitmapSource.height,
      );
      if (!blob) {
        setError('Could not read that image. Try a different file.');
        return;
      }
      onCapture(blob, URL.createObjectURL(blob));
    },
    [onCapture],
  );

  return (
    <div className="flex flex-col gap-3">
      {phase === 'live' && (
        <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-auto w-full"
            aria-label="Camera preview"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {phase !== 'live' ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={disabled || phase === 'starting'}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {phase === 'starting' ? 'Opening camera…' : captureLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={capture}
              disabled={disabled}
              className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => {
                stopStream();
                setPhase('idle');
              }}
              className="rounded-md border border-slate-300 px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          📁 Upload from device
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          📷 Open camera
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {phase === 'unsupported' && (
        <p className="text-sm text-slate-600">
          This device has no camera available. Upload a photo of the document instead.
        </p>
      )}
    </div>
  );
}

/** Downscale to MAX_EDGE on the long side and encode as JPEG. */
function drawToBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob | null> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY),
  );
}
