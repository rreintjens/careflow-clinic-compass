import { useState } from "react";
import { Select } from "@/components/Select";
import { SegmentedControl } from "@/components/SegmentedControl";
import { readStartScreen,type StartScreen } from "@/domain/start-screen";
import { MessageFields } from "./MessageFields";

export function StartScreenEditor({value,onChange,defaultButton}:{value:unknown;onChange:(value:StartScreen)=>void;defaultButton:string}){
 const [lang,setLang]=useState("nl");const screen=readStartScreen(value)??{enabled:false,form:"none",title:"",body:"",button:defaultButton};
 return <div className="flex flex-col gap-4"><Select label="Startscherm in de boekingsflow" value={screen.enabled?"on":"off"} onChange={v=>onChange({...screen,enabled:v==="on"})} options={[{value:"off",label:"Uit"},{value:"on",label:"Aan"}]}/>{screen.enabled&&<><SegmentedControl label="Taal startscherm" value={lang} onChange={setLang} options={[{value:"nl",label:"Nederlands"},{value:"en",label:"English"}]}/><MessageFields lang={lang} page={{id:"start",...screen,bullets:screen.bullets??[]}} maxText={300} onChange={page=>onChange({...screen,...page} as StartScreen)}/></>}</div>;
}