"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Video,
} from "lucide-react";
import { isRoomCode } from "@/lib/validation";
import { useAuth } from "@/lib/auth-context";

type DeviceOption = { deviceId: string; label: string };

export default function LobbyPage() {
  const { user } = useAuth();
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomCode = params.roomId.toUpperCase();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [name, setName] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startPreview = useCallback(async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (!cameraOn && !micOn) {
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraOn
          ? cameraId
            ? { deviceId: { exact: cameraId } }
            : true
          : false,
        audio: micOn
          ? microphoneId
            ? { deviceId: { exact: microphoneId } }
            : true
          : false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(
        devices
          .filter((device) => device.kind === "videoinput")
          .map(({ deviceId, label }) => ({
            deviceId,
            label: label || "Camera",
          })),
      );
      setMicrophones(
        devices
          .filter((device) => device.kind === "audioinput")
          .map(({ deviceId, label }) => ({
            deviceId,
            label: label || "Microphone",
          })),
      );
      setError("");
    } catch {
      setError(
        "Camera or microphone permission was denied. You can still join with them turned off.",
      );
      streamRef.current = null;
    }
  }, [cameraOn, micOn, cameraId, microphoneId]);

  useEffect(() => {
    if (!isRoomCode(roomCode)) return;
    let active = true;
    void fetch("/api/guest")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const savedName =
          window.localStorage.getItem("vibemeet-name") ??
          data.guest?.displayName ??
          "";
        setName(savedName);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [roomCode]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void startPreview();
    });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [startPreview]);

  async function joinMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!user || user.isGuest) {
        const guestRes = await fetch("/api/guest");
        const currentGuest = await guestRes.json().catch(() => null);
        if (
          !currentGuest?.guest ||
          currentGuest.guest.displayName !== name.trim()
        ) {
          const sessionResponse = await fetch("/api/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: name.trim() }),
          });
          const session = await sessionResponse.json().catch(() => null);
          if (!sessionResponse.ok)
            throw new Error(
              session?.error ?? "Could not start your guest session.",
            );
        }
      }
      window.localStorage.setItem("vibemeet-name", name.trim());
      const response = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error ?? `Could not join this meeting (${response.status}).`,
        );
      window.sessionStorage.setItem(
        `vibemeet-room-${roomCode}`,
        JSON.stringify(data),
      );
      router.push(`/meeting/${roomCode}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not join this meeting.",
      );
      setBusy(false);
    }
  }

  if (!isRoomCode(roomCode)) {
    return (
      <main className="page-shell">
        <header className="app-header">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Video size={18} />
            </span>
            vibe<span className="brand-light">meet</span>
          </Link>
        </header>
        <section className="app-main">
          <div className="panel empty-state">
            <span className="empty-state-icon">
              <Video size={20} />
            </span>
            <h1 className="page-title">That code doesn&apos;t look right.</h1>
            <p className="muted">Meeting codes look like RAJ-123-456.</p>
            <Link className="button button-dark" href="/">
              Back to VibeMeet
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Video size={18} />
          </span>
          vibe<span className="brand-light">meet</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {!user || user.isGuest ? (
            <Link
              href={`/login?redirect=/meeting/${roomCode}/lobby`}
              className="text-link"
            >
              Log in
            </Link>
          ) : (
            <span
              className="user-profile-badge"
              style={{ padding: "4px 10px" }}
            >
              <span
                className="user-initials"
                style={{ width: 22, height: 22, fontSize: 10 }}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="user-name-text">{user.name}</span>
            </span>
          )}
          <Link href="/" className="text-link">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </header>
      <section className="app-main">
        <div className="page-kicker">
          MEETING LOBBY <span className="meeting-code">{roomCode}</span>
        </div>
        <h1 className="page-title">A moment before hello.</h1>
        <p className="page-description">
          Check your camera and microphone, then you&apos;re good to go.
        </p>
        <form className="lobby-layout" onSubmit={joinMeeting}>
          <div>
            <div className="lobby-preview-wrap">
              {cameraOn ? (
                <video
                  ref={videoRef}
                  className="lobby-video"
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <div className="lobby-placeholder">
                  <CameraOff size={34} />
                </div>
              )}
              <span className="lobby-name-tag">{name || "Your name"}</span>
            </div>
            <div className="lobby-toggle-row">
              <button
                type="button"
                className={`toggle-button ${micOn ? "active" : ""}`}
                onClick={() => setMicOn((value) => !value)}
              >
                {micOn ? <Mic size={15} /> : <MicOff size={15} />}
                {micOn ? "Mic on" : "Mic off"}
              </button>
              <button
                type="button"
                className={`toggle-button ${cameraOn ? "active" : ""}`}
                onClick={() => setCameraOn((value) => !value)}
              >
                {cameraOn ? <Camera size={15} /> : <CameraOff size={15} />}
                {cameraOn ? "Camera on" : "Camera off"}
              </button>
            </div>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="panel">
            <div className="form-group">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <label className="form-label" htmlFor="guest-name">
                  Your name
                </label>
                {user && !user.isGuest && (
                  <span style={{ fontSize: 11, color: "#6e7465" }}>
                    Signed in as <strong>{user.email}</strong>
                  </span>
                )}
              </div>
              <input
                id="guest-name"
                className="form-input"
                required
                minLength={1}
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="How should we introduce you?"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="camera-device">
                Camera
              </label>
              <select
                className="form-select"
                id="camera-device"
                value={cameraId}
                onChange={(event) => setCameraId(event.target.value)}
                disabled={!cameras.length}
              >
                <option value="">Default camera</option>
                {cameras.map((device) => (
                  <option value={device.deviceId} key={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mic-device">
                Microphone
              </label>
              <select
                className="form-select"
                id="mic-device"
                value={microphoneId}
                onChange={(event) => setMicrophoneId(event.target.value)}
                disabled={!microphones.length}
              >
                <option value="">Default microphone</option>
                {microphones.map((device) => (
                  <option value={device.deviceId} key={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="muted">
              Your browser will ask for camera and microphone access when you
              join.
            </p>
            <button
              type="submit"
              className="button button-dark lobby-join"
              disabled={busy || !name.trim()}
            >
              {busy ? "Joining…" : "Join meeting"} <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
