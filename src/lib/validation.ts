import { z } from "zod";

export const ROOM_CODE_PATTERN = /^RAJ-\d{3}-\d{3}$/;

export const isRoomCode = (value: string) => ROOM_CODE_PATTERN.test(value);

export const meetingInputSchema = z.object({
  title: z.string().trim().min(1).max(100).default("Instant meeting"),
  description: z.string().trim().max(1000).optional().default(""),
  scheduledAt: z.string().datetime().optional(),
});

export const guestInputSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
});

export const tokenInputSchema = z.object({
  roomCode: z.string().regex(ROOM_CODE_PATTERN),
});

export const signupInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginInputSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
