import { roomsForKinds, roomsForKind, type DeviceLite, type RoomRef } from "./equipment";
export function appointmentResources(args: { locationId: string; date: string; roomId?: string | undefined; kinds: string[]; rooms: readonly RoomRef[]; devices: readonly DeviceLite[]; busy: ReadonlyArray<{ room_id: string | null; equipment_ids: string[] }> }) {
  const available = args.devices.filter(d => !args.busy.some(b => b.equipment_ids.includes(d.id)));
  const candidates = roomsForKinds({ ...args, devices: available }).filter(id => !args.busy.some(b => b.room_id === id));
  const roomId = args.roomId ? (candidates.includes(args.roomId) ? args.roomId : null) : candidates[0] ?? null;
  if (!roomId) return { roomId: null, equipmentIds: [] as string[] };
  const equipmentIds: string[] = [];
  for (const kind of args.kinds) {
    const d = args.devices.find(d => d.kind === kind && !args.busy.some(b => b.equipment_ids.includes(d.id)) && roomsForKind({ ...args, kind, devices: [d] }).includes(roomId));
    if (!d) return { roomId: null, equipmentIds: [] as string[] };
    equipmentIds.push(d.id);
  }
  return { roomId, equipmentIds };
}