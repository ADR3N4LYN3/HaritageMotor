"use client";

import { useI18n } from "@/lib/i18n";
import { eventItemI18n } from "@/lib/translations";
import type { Event } from "@/lib/types";

interface EventItemProps {
  event: Event;
  operatorName?: string;
}

const eventColors: Record<string, string> = {
  vehicle_intake: "text-success",
  vehicle_exit: "text-danger",
  vehicle_moved: "text-[#3b82f6]",
  task_completed: "text-success",
  document_added: "text-gold",
  photo_added: "text-gold",
  status_changed: "text-warning",
  note_added: "text-white",
  incident_reported: "text-danger",
};

export function EventItem({ event, operatorName }: EventItemProps) {
  const { t } = useI18n(eventItemI18n);
  const color = eventColors[event.event_type] || "text-white";
  const label = t[event.event_type] || event.event_type;
  const date = new Date(event.occurred_at);

  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <div className={`mt-0.5 ${color}`}>
        <EventIcon type={event.event_type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${color}`}>{label}</span>
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

function EventIcon({ type }: { type: string }) {
  const cls = "w-[18px] h-[18px]";
  const sw = 2;
  switch (type) {
    case "vehicle_intake":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M12 3v12M5 10l7 7 7-7" /><line x1="5" y1="21" x2="19" y2="21" />
        </svg>
      );
    case "vehicle_exit":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M12 19V7M5 12l7-7 7 7" /><line x1="5" y1="3" x2="19" y2="3" />
        </svg>
      );
    case "vehicle_moved":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      );
    case "task_completed":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "document_added":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "photo_added":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "status_changed":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      );
    case "note_added":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "incident_reported":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}
