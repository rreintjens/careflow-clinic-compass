import { z } from "zod";
import type { Page } from "./questionnaire/engine";
export const startScreenSchema=z.object({enabled:z.boolean().default(true),form:z.enum(["none","list","steps","testimonial","practitioner"]),title:z.string().max(150),title_en:z.string().max(150).optional(),body:z.string().max(300),body_en:z.string().max(300).optional(),button:z.string().max(80),button_en:z.string().max(80).optional(),bullets:z.array(z.string().max(300)).max(4).optional(),bullets_en:z.array(z.string().max(300)).max(4).optional(),step_items:z.array(z.string().max(300)).max(4).optional(),step_items_en:z.array(z.string().max(300)).max(4).optional(),quote:z.string().max(500).optional(),quote_en:z.string().max(500).optional(),quote_name:z.string().max(100).optional()});
export type StartScreen=z.infer<typeof startScreenSchema>;
export function readStartScreen(value:unknown):StartScreen|null {const parsed=startScreenSchema.safeParse(value);return parsed.success?parsed.data:null;}
export function resolveStartScreen(link:{treatmentId:string|null;mode:string;screen:unknown}|null,treatment:unknown):StartScreen|null{
 if(!link?.treatmentId || link.mode==="none")return null;
 const screen=readStartScreen(link.mode==="custom"?link.screen:treatment);
 return screen?.enabled?screen:null;
}
export function startScreenPage(screen:StartScreen,lang:string):Page{
 const en=lang==="en";return {id:"start",type:"boodschap",...screen,title:en&&screen.title_en?screen.title_en:screen.title,body:en&&screen.body_en?screen.body_en:screen.body,button:en&&screen.button_en?screen.button_en:screen.button,bullets:en&&screen.bullets_en?.length?screen.bullets_en:screen.bullets??[],step_items:en&&screen.step_items_en?.length?screen.step_items_en:screen.step_items,quote:en&&screen.quote_en?screen.quote_en:screen.quote};
}