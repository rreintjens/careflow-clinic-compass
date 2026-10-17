import { useQuery } from "@tanstack/react-query";

import { photoUrl } from "@/data/organisation";
import { cn } from "@/lib/utils";

/** Practitioner photo (signed URL) or a neutral placeholder. */
export function Avatar({ path, size = 40, className }: { path: string | null; size?: number; className?: string }) {
  const { data: url } = useQuery({ queryKey: ["photo", path], queryFn: () => photoUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 });
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-mist", className)} style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="h-[18%] w-[34%] rounded-sm bg-background/70" />}
    </span>
  );
}
