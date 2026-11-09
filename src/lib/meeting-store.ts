import { create } from "zustand";

type MeetingStore = {
  roomCode: string | null;
  joinedAt: number | null;
  setMeeting: (roomCode: string) => void;
  clearMeeting: () => void;
};

export const useMeetingStore = create<MeetingStore>((set) => ({
  roomCode: null,
  joinedAt: null,
  setMeeting: (roomCode) => set({ roomCode, joinedAt: Date.now() }),
  clearMeeting: () => set({ roomCode: null, joinedAt: null }),
}));
