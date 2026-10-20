export function cancellationFee(status:string,start:string,now:number,policy:{hours:number;feeCents:number}):number {
 if(status==="no_show")return Math.max(0,policy.feeCents);
 return status==="cancelled"&&Date.parse(start)-now<policy.hours*3_600_000?Math.max(0,policy.feeCents):0;
}
export interface FeePaymentProvider {pay(requestId:string):Promise<{paid:boolean}>;}
export const mockFeePaymentProvider:FeePaymentProvider={pay:async()=>({paid:true})};