/** Wordmark placeholder (the logo image is not in the package). */
export function Logo({ small = false }: { small?: boolean }) {
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
