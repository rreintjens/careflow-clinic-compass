import { useQuery } from "@tanstack/react-query";

import { appFlagsQuery } from "@/data/staff";

/** Visible on every page while the app runs in test mode (setting `test_mode`). */
export function TestModeBanner() {
  const { data } = useQuery(appFlagsQuery);
  if (!data?.test_mode) return null;
  return (
    <div role="status" className="sticky top-0 z-30 border-b border-signal-border bg-signal px-4 py-1.5 text-center text-xs font-medium">
      {data.banner}
    </div>
  );
}
