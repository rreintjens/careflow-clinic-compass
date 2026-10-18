import { fmtWhen, type TimelineEvent } from "./timeline";

export function TimelineList({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p className="text-[14px] text-muted-foreground">Nog geen gebeurtenissen.</p>;
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="grid grid-cols-[130px_36px_1fr] gap-4">
          <p className="pt-2 text-right text-[12px] text-muted-foreground">{fmtWhen(e.at)}</p>
          <div className="flex flex-col items-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-sand"><img src={`/ui-icons/${e.icon}.svg`} alt="" className="size-4" /></span>
            {i < events.length - 1 && <span className="w-px flex-1 bg-mist" />}
          </div>
          <div className="pb-6 pt-1.5">
            <p className="text-[15px] font-semibold">{e.title}</p>
            <p className="text-[14px]">{e.body}</p>
            <p className="text-[12px] text-muted-foreground">{e.who}{e.meet && <> · <a href={e.meet} target="_blank" rel="noreferrer" className="text-primary underline">Start Google Meet</a></>}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
