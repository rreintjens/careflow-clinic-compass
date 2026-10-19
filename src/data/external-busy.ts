import { queryOptions } from "@tanstack/react-query";
import { getExternalBusy } from "./external-busy.functions";
export const externalBusyQuery = queryOptions({ queryKey: ["external-busy"], queryFn: () => getExternalBusy() });