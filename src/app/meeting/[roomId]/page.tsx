import MeetingRoom from "@/components/meeting-room";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <MeetingRoom roomCode={roomId.toUpperCase()} />;
}
