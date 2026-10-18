import type { ReactNode } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";

type AgendaView = "dag" | "week" | "mijn";

export function AgendaToolbar({ dateControls, filters, value, onChange }: {
  dateControls: ReactNode;
  filters: ReactNode;
  value: AgendaView;
  onChange: (value: AgendaView) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-center gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-3">{dateControls}</div>
        <SegmentedControl className="w-fit justify-self-end" label="Weergave" value={value} onChange={onChange}
          options={[{ value: "dag", label: "Dag" }, { value: "week", label: "Week" }, { value: "mijn", label: "Mijn dag" }]} />
      </div>
      <div className="flex min-h-11 flex-wrap items-center gap-3">{filters}</div>
    </div>
  );
}