import type { Event } from "@/lib/types";

interface EventItemProps {
  event: Event;
  operatorName?: string;
}

const eventLabels: Record<string, { label: string; icon: string; color: string }> = {
  vehicle_intake: { label: "Vehicle Intake", icon: "\u{1F4E5}", color: "text-success" },
  vehicle_exit: { label: "Vehicle Exit", icon: "\u{1F4E4}", color: "text-danger" },
  vehicle_moved: { label: "Vehicle Moved", icon: "\u{1F504}", color: "text-[#3b82f6]" },
  task_completed: { label: "Task Completed", icon: "\u2705", color: "text-success" },
  document_added: { label: "Document Added", icon: "\u{1F4C4}", color: "text-gold" },
  photo_added: { label: "Photo Added", icon: "\u{1F4F7}", color: "text-gold" },
  status_changed: { label: "Status Changed", icon: "\u{1F500}", color: "text-warning" },
  note_added: { label: "Note Added", icon: "\u{1F4DD}", color: "text-white" },
  incident_reported: { label: "Incident", icon: "\u26A0\uFE0F", color: "text-danger" },
};

export function EventItem({ event, operatorName }: EventItemProps) {
  const info = eventLabels[event.event_type] || { label: event.event_type, icon: "\u{1F4CC}", color: "text-white" };
  const date = new Date(event.occurred_at);

  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <div className="text-lg mt-0.5">{info.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
          <span className="text-xs text-white/40">
            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {event.notes && (
          <p className="text-sm text-white/50 mt-0.5 truncate">{event.notes}</p>
        )}
        {operatorName && (
          <p className="text-xs text-white/40 mt-1">{operatorName}</p>
        )}
      </div>
    </div>
  );
}
