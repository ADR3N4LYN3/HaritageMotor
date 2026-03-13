import type { ReactNode } from "react";

function GoldRule() {
  return <div className="gold-sep" />;
}

export function SectionHeading({ tag, title, action }: { tag?: string; title: string; action?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          {tag && (
            <div className="section-tag mb-3">
              <span>{tag}</span>
            </div>
          )}
          <h2 className="text-[1.4rem] lg:text-[1.75rem] font-light text-white tracking-[0.03em] leading-[1.2]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <GoldRule />
    </div>
  );
}
