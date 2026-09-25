import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MeetingView } from "@/components/meeting/meeting-view";

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId) || meetingId < 1) notFound();
  return (
    <Suspense>
      <MeetingView id={meetingId} />
    </Suspense>
  );
}
