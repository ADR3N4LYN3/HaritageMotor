import type { Event } from "@/lib/types";

interface EventItemProps {
  event: Event;
  operatorName?: string;
}

const eventLabels: Record<string, { label: string; icon: string; color: string }> = {
  vehicle_intake: { label: "Vehicle Intake", icon: "\u{1F4E5}", color: "text-[#22c55e]" },
  vehicle_exit: { label: "Vehicle Exit", icon: "\u{1F4E4}", color: "text-[#ef4444]" },
  vehicle_moved: { label: "Vehicle Moved", icon: "\u{1F504}", color: "text-[#3b82f6]" },
  task_completed: { label: "Task Completed", icon: "\u2705", color: "text-[#22c55e]" },
  document_added: { label: "Document Added", icon: "\u{1F4C4}", color: "text-[#b8955a]" },
  photo_added: { label: "Photo Added", icon: "\u{1F4F7}", color: "text-[#b8955a]" },
  status_changed: { label: "Status Changed", icon: "\u{1F500}", color: "text-[#f59e0b]" },
  note_added: { label: "Note Added", icon: "\u{1F4DD}", color: "text-[#0e0d0b]" },
  incident_reported: { label: "Incident", icon: "\u26A0\uFE0F", color: "text-[#ef4444]" },
};

export function EventItem({ event, operatorName }: EventItemProps) {
  const info = eventLabels[event.event_type] || { label: event.event_type, icon: "\u{1F4CC}", color: "text-[#0e0d0b]" };
  const date = new Date(event.occurred_at);

  return (
    <div className="flex gap-3 py-3 border-b border-[#0e0d0b]/5 last:border-0">
      <div className="text-lg mt-0.5">{info.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
          <span className="text-xs text-[#0e0d0b]/40">
            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {event.notes && (
          <p className="text-sm text-[#0e0d0b]/60 mt-0.5 truncate">{event.notes}</p>
        )}
        {operatorName && (
          <p className="text-xs text-[#0e0d0b]/40 mt-1">{operatorName}</p>
        )}
      </div>
    </div>
  );
}
