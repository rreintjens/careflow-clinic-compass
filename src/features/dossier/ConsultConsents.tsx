import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {PillButton} from '@/components/PillButton';
import {SignaturePad} from '@/components/SignaturePad';
import {readConsultConsents,signConsultConsent} from '@/data/consent.functions';
import {toast} from 'sonner';
export function ConsultConsents({noteId}:{noteId:string}){
 const read=useServerFn(readConsultConsents),sign=useServerFn(signConsultConsent);const qc=useQueryClient();const [signing,setSigning]=useState<string|null>(null);
 const {data,error}=useQuery({queryKey:['consult-consents',noteId],queryFn:()=>read({data:{noteId}})});
 const form=data?.forms.find(f=>f.kind===signing);
 const pdf=async(kind:string)=>{const signed=data?.signatures.find(s=>s.kind===kind);const text=signed?.text_snapshot??data?.forms.find(f=>f.kind===kind)?.text;if(!text){toast.error('De kliniek heeft nog geen toestemmingstekst ingesteld.');return;}
  const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);let page=doc.addPage();let y=790;const add=(line:string)=>{if(y<60){page=doc.addPage();y=790;}page.drawText(line,{x:40,y,size:11,font});y-=17;};add(`Toestemmingsformulier: ${kind}`);
  for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(' ')){if(font.widthOfTextAtSize(`${line} ${word}`,11)>510){add(line);line=word;}else line=line?`${line} ${word}`:word;}add(line);}
  if(signed?.signature){add(`Ondertekend: ${signed.created_at}`);const image=await doc.embedPng(signed.signature);if(y<140){page=doc.addPage();y=790;}page.drawImage(image,{x:40,y:y-100,width:260,height:100});}
  const bytes=await doc.save();const blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='toestemming.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 if(error)return <p role='alert' className='mt-4 text-sm'>Toestemmingen konden niet worden geladen.</p>;
 return <>{data?.forms.map(f=><div key={f.kind} className='mt-4 flex flex-wrap items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm'><span className='flex-1'>Toestemmingsformulier: {f.kind}{data.signatures.some(s=>s.kind===f.kind)?' · Ondertekend':''}</span><PillButton size='sm' variant='outline' onClick={()=>void pdf(f.kind).catch(()=>toast.error('PDF maken is niet gelukt.'))}>Bekijk PDF</PillButton><PillButton size='sm' variant='outline' disabled={!f.text} onClick={()=>setSigning(f.kind)}>Op tablet</PillButton>{!f.text&&<p className='w-full text-muted-foreground'>Toestemmingstekst ontbreekt in de kliniekinstellingen.</p>}</div>)}
 {form?.text&&<SignaturePad title='Toestemmingsformulier ondertekenen' text={form.text} onClose={()=>setSigning(null)} onSign={async signature=>{try{await sign({data:{noteId,kind:form.kind,signature}});await qc.invalidateQueries({queryKey:['consult-consents',noteId]});setSigning(null);toast.success('Toestemming ondertekend');}catch(e){toast.error(e instanceof Error?e.message:'Ondertekenen is niet gelukt.');}}}/>}</>;
}