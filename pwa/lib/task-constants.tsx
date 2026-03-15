import type { ReactNode } from "react";

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ── SVG icon components per task type ── */
function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <rect x="2" y="7" width="18" height="12" rx="2" />
      <path d="M22 11v4" />
      <path d="M7 11v4M11 11v4" />
    </svg>
  );
}

function TireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </svg>
  );
}

function WashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M12 2v4M8 4v2M16 4v2" />
      <path d="M3 10h18" />
      <path d="M5 10c0 6 2 10 7 10s7-4 7-10" />
      <path d="M8 14h8" />
    </svg>
  );
}

function FluidIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M12 2v6" />
      <path d="M6 12c0 4 2.69 8 6 8s6-4 6-8c0-3-6-8-6-8S6 9 6 12z" />
    </svg>
  );
}

function InspectionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6M11 8v6" />
    </svg>
  );
}

function DetailingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function CoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M3 18v-3a9 9 0 0 1 18 0v3" />
      <path d="M3 18h18" />
      <path d="M7 18v2M17 18v2" />
    </svg>
  );
}

function ClimateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z" />
      <path d="M12 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
    </svg>
  );
}

function CustomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

/* ── Task type definitions ── */
export interface TaskTypeDef {
  value: string;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
}

export const TASK_TYPES: TaskTypeDef[] = [
  { value: "battery_start", label: "Battery Start", icon: BatteryIcon },
  { value: "tire_pressure", label: "Tire Pressure", icon: TireIcon },
  { value: "wash", label: "Wash", icon: WashIcon },
  { value: "fluid_check", label: "Fluid Check", icon: FluidIcon },
  { value: "inspection", label: "Inspection", icon: InspectionIcon },
  { value: "detailing", label: "Detailing", icon: DetailingIcon },
  { value: "cover", label: "Cover", icon: CoverIcon },
  { value: "climate_check", label: "Climate Check", icon: ClimateIcon },
  { value: "custom", label: "Custom", icon: CustomIcon },
];

/** Get icon component for a task type */
export function TaskIcon({ type, className }: { type: string; className?: string }) {
  const def = TASK_TYPES.find((t) => t.value === type);
  if (def) {
    const Icon = def.icon;
    return <Icon className={className || "w-4 h-4"} />;
  }
  return <CustomIcon className={className || "w-4 h-4"} />;
}

/** Legacy compat — map type to label */
export const TASK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TASK_TYPES.map((t) => [t.value, t.label])
);
