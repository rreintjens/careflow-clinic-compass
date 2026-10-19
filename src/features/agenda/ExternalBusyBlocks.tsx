import { fmtTime } from "@/domain/slots";
export function ExternalBusyBlock({ start, end, top, height, className = "inset-x-1" }: { start: number; end: number; top: number; height: number; className?: string }) {
  return <div className={`hatch absolute z-10 flex flex-col justify-center overflow-hidden rounded-[8px] px-2 text-[11px] leading-tight ${className}`} style={{ top, height }} title={`Bezet in eKis · ${fmtTime(start)}–${fmtTime(end)}`}><span className="font-semibold">Bezet in eKis</span><span>{fmtTime(start)}–{fmtTime(end)}</span></div>;
}