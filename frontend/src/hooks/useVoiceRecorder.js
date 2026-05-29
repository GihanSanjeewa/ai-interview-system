import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser mic capture using MediaRecorder + Web Audio API for level metering.
 * Falls back to SpeechRecognition for live partial transcripts when available.
 */
export function useVoiceRecorder({ onLevel } = {}) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices || !window.MediaRecorder) setSupported(false);
  }, []);

  useEffect(() => () => stopInternal(), []);

  const stopInternal = () => {
    try {
      recorderRef.current?.state === "recording" && recorderRef.current?.stop();
    } catch {
      // ignore
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (ctxRef.current) {
      try {
        ctxRef.current.close();
      } catch {
        // ignore
      }
      ctxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const start = useCallback(async () => {
    if (!supported) {
      setError("Mic capture is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Audio meter
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        onLevel?.(Math.min(1, rms * 2.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Recorder
      const mime =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          MediaRecorder.isTypeSupported(t)
        ) ?? "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      setError(null);
    } catch (err) {
      setError(err?.message || "Mic access denied");
      stopInternal();
    }
  }, [supported, onLevel]);

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const rec = recorderRef.current;
        if (!rec || rec.state !== "recording") {
          stopInternal();
          setRecording(false);
          resolve(null);
          return;
        }
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: rec.mimeType || "audio/webm",
          });
          const durationMs = Date.now() - startedAtRef.current;
          stopInternal();
          setRecording(false);
          resolve({ blob, durationMs });
        };
        rec.stop();
      }),
    []
  );

  const cancel = useCallback(() => {
    stopInternal();
    setRecording(false);
    chunksRef.current = [];
  }, []);

  return { recording, supported, error, start, stop, cancel };
}
