"use client";

import "@livekit/components-styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import {
  ArrowLeft,
  Check,
  Copy,
  DoorOpen,
  LockKeyhole,
  MoreHorizontal,
  Shield,
  UserRoundMinus,
  UsersRound,
  VolumeX,
} from "lucide-react";
import { useMeetingStore } from "@/lib/meeting-store";
import { isRoomCode } from "@/lib/validation";

type JoinCredentials = {
  accessToken: string;
  serverUrl: string;
  isHost: boolean;
  isLocked: boolean;
};
type HostAction =
  | "lock"
  | "mute"
  | "mute-all"
  | "end"
  | "remove"
  | "transfer-host";

function RoomToolbar({
  roomCode,
  isHost,
  initialLocked,
  onLeave,
}: {
  roomCode: string;
  isHost: boolean;
  initialLocked: boolean;
  onLeave: () => void;
}) {
  const participants = useParticipants();
  const room = useRoomContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [locked, setLocked] = useState(initialLocked);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const duration = useMeetingStore((state) => state.joinedAt);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    const timer = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - (duration ?? Date.now())) / 1000),
      );
      setElapsed(
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [duration]);

  async function hostAction(
    action: HostAction,
    extra?: { identity?: string; locked?: boolean },
  ) {
    try {
      const response = await fetch(`/api/meetings/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Host action failed.");
      if (action === "lock") setLocked(Boolean(extra?.locked));
      if (action === "end") {
        room.disconnect();
        onLeave();
      }
      if (action === "transfer-host") {
        setNotice(
          "Host transferred. The new host should rejoin to access host controls.",
        );
        room.disconnect();
        window.setTimeout(onLeave, 1000);
        return;
      }
      setNotice(
        action === "mute-all"
          ? "Everyone has been muted."
          : action === "lock"
            ? extra?.locked
              ? "Meeting locked."
              : "Meeting unlocked."
            : "Host action complete.",
      );
      window.setTimeout(() => setNotice(""), 3000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Host action failed.");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/meeting/${roomCode}/lobby`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="meeting-topbar">
      <Link href="/" className="brand meeting-dark-brand">
        <span className="brand-mark">
          <span className="brand-video">V</span>
        </span>
        vibe<span className="brand-light">meet</span>
      </Link>
      <div className="meeting-top-meta">
        <span className="meeting-code">{roomCode}</span>
        <span className="meeting-elapsed">{elapsed}</span>
        <span className="meeting-people">
          <UsersRound size={14} /> {participants.length}
        </span>
      </div>
      <div className="meeting-actions">
        <button
          className="meeting-icon-button"
          onClick={copyLink}
          aria-label="Copy meeting link"
          title="Copy meeting link"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        {isHost && (
          <div className="host-menu-wrap">
            <button
              className="meeting-icon-button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Host controls"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="host-menu">
                <div className="host-menu-title">
                  Host controls · {participants.length} here
                </div>
                {participants
                  .filter(
                    (participant) =>
                      participant.identity !== room.localParticipant.identity,
                  )
                  .map((participant) => (
                    <div className="host-person" key={participant.identity}>
                      <span>
                        {participant.name || participant.identity.slice(0, 8)}
                      </span>
                      <div>
                        <button
                          title="Transfer host"
                          onClick={() =>
                            void hostAction("transfer-host", {
                              identity: participant.identity,
                            })
                          }
                        >
                          <Shield size={14} />
                        </button>
                        <button
                          title="Mute participant"
                          onClick={() =>
                            void hostAction("mute", {
                              identity: participant.identity,
                            })
                          }
                        >
                          <VolumeX size={14} />
                        </button>
                        <button
                          title="Remove participant"
                          onClick={() =>
                            void hostAction("remove", {
                              identity: participant.identity,
                            })
                          }
                        >
                          <UserRoundMinus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                <button
                  className="host-menu-action"
                  onClick={() => void hostAction("lock", { locked: !locked })}
                >
                  <LockKeyhole size={14} />{" "}
                  {locked ? "Unlock meeting" : "Lock meeting"}
                </button>
                <button
                  className="host-menu-action"
                  onClick={() => void hostAction("mute-all")}
                >
                  <VolumeX size={14} /> Mute everyone
                </button>
                <button
                  className="host-menu-action host-end"
                  onClick={() => void hostAction("end")}
                >
                  <DoorOpen size={14} /> End meeting for all
                </button>
              </div>
            )}
          </div>
        )}
        {!isHost && (
          <span className="meeting-secure-label">
            <Shield size={14} /> Secure
          </span>
        )}
        <button
          className="meeting-leave-button"
          onClick={() => {
            room.disconnect();
            onLeave();
          }}
        >
          Leave <ArrowLeft size={14} />
        </button>
      </div>
      {notice && (
        <span className="meeting-notice" role="status">
          {notice}
        </span>
      )}
    </div>
  );
}

export default function MeetingRoom({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<JoinCredentials | null>(null);
  const [error, setError] = useState("");
  const setMeeting = useMeetingStore((state) => state.setMeeting);
  const clearMeeting = useMeetingStore((state) => state.clearMeeting);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!isRoomCode(roomCode)) {
        setError("This meeting code is invalid.");
        return;
      }
      const serialized = window.sessionStorage.getItem(
        `vibemeet-room-${roomCode}`,
      );
      if (!serialized) {
        setError(
          "Join from the lobby first to check your camera and microphone.",
        );
        return;
      }
      try {
        const parsed = JSON.parse(serialized) as JoinCredentials;
        if (!parsed.accessToken || !parsed.serverUrl)
          throw new Error("Missing meeting credentials.");
        setCredentials(parsed);
        setMeeting(roomCode);
      } catch {
        setError(
          "Your meeting session has expired. Please rejoin from the lobby.",
        );
      }
    });
    return () => {
      active = false;
      clearMeeting();
    };
  }, [roomCode, setMeeting, clearMeeting]);

  async function leave() {
    try {
      await fetch(`/api/meetings/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
    } catch (reason) {
      console.error("Could not save participant leave time", reason);
    }
    window.sessionStorage.removeItem(`vibemeet-room-${roomCode}`);
    clearMeeting();
    router.push("/");
  }

  if (error) {
    return (
      <main className="meeting-screen">
        <header className="meeting-topbar">
          <Link href="/" className="brand meeting-dark-brand">
            vibe<span className="brand-light">meet</span>
          </Link>
        </header>
        <div className="meeting-error">
          <span className="empty-state-icon">
            <Shield size={20} />
          </span>
          <h1 className="page-title">
            {error.includes("invalid")
              ? "Invalid or ended meeting"
              : "You’re not in the room yet."}
          </h1>
          <p className="muted">{error}</p>
          <Link
            href={isRoomCode(roomCode) ? `/meeting/${roomCode}/lobby` : "/"}
            className="button button-green"
          >
            {isRoomCode(roomCode) ? "Back to lobby" : "Go home"}{" "}
            <ArrowLeft size={14} />
          </Link>
        </div>
      </main>
    );
  }

  if (!credentials)
    return (
      <main className="meeting-screen">
        <div className="meeting-loading">
          <div>
            <div className="spinner" />
            <p>Getting your room ready…</p>
          </div>
        </div>
      </main>
    );

  return (
    <main className="meeting-screen">
      <LiveKitRoom
        token={credentials.accessToken}
        serverUrl={credentials.serverUrl}
        connect={true}
        audio={true}
        video={true}
        options={{ adaptiveStream: true, dynacast: true }}
        onError={(error) => {
          console.error("LiveKit room error", error);
          setError(error.message);
        }}
      >
        <RoomToolbar
          roomCode={roomCode}
          isHost={credentials.isHost}
          initialLocked={credentials.isLocked}
          onLeave={leave}
        />
        <div className="meeting-room-content">
          <VideoConference />
        </div>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}
