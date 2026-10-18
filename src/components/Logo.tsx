/** Wordmark placeholder (the logo image is not in the package). mark = only the three dots. */
export function Logo({ small = false, mark = false }: { small?: boolean; mark?: boolean }) {
  if (mark) {
    return (
      <span className="inline-flex gap-[4px]" aria-label="The Body Clinic">
        <span className="size-[12px] rounded-full bg-primary" />
        <span className="size-[12px] rounded-full bg-primary" />
        <span className="size-[12px] rounded-full bg-primary/50" />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${small ? "text-[16px]" : "text-[19px]"} font-medium tracking-tight text-primary`} aria-label="The Body Clinic">
      the body clinic
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        <span className="size-[7px] rounded-full bg-primary" />
        <span className="size-[7px] rounded-full bg-primary" />
        <span className="size-[7px] rounded-full bg-primary/50" />
      </span>
    </span>
  );
}
