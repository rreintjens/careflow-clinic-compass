import {useState} from 'react';
import {useSuspenseQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {toast} from 'sonner';
import {ListPage,DataTable,RowChevron} from '@/components/ListPage';
import {PageHeader} from '@/components/PageHeader';
import {PillButton} from '@/components/PillButton';
import {Modal} from '@/components/Modal';
import {SearchField,TextField,TextArea,Tag} from '@/components/Field';
import {Select} from '@/components/Select';
import {careFormsQuery,careFormKindsQuery,type CareForm} from '@/data/care-forms';
import {templatesQuery} from '@/data/dossier';
import {saveCareForm,changeCareForm} from '@/data/care-forms.functions';
import {careFormSchema} from '@/domain/care-forms';

export function CareFormManagement(){
 const {data:rows}=useSuspenseQuery(careFormsQuery);const {data:templates}=useSuspenseQuery(templatesQuery);
 const [search,setSearch]=useState('');const [editing,setEditing]=useState<CareForm|null|undefined>();const [versions,setVersions]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const qc=useQueryClient();const change=useServerFn(changeCareForm);
 const refresh=()=>qc.invalidateQueries({queryKey:careFormsQuery.queryKey});
 const grouped=[...new Set(rows.map(r=>r.code))].map(code=>rows.find(r=>r.code===code&&r.status==='concept')??rows.find(r=>r.code===code&&r.status==='live')??rows.find(r=>r.code===code)).filter((r):r is CareForm=>!!r).filter(r=>`${r.name} ${r.code}`.toLowerCase().includes(search.toLowerCase()));
 const concept=async(row:CareForm)=>{setBusy(true);try{const id=await change({data:{id:row.id,action:'concept'}});await refresh();const updated=qc.getQueryData(careFormsQuery.queryKey)?.find(r=>r.id===id);if(updated)setEditing(updated);}catch(e){toast.error(e instanceof Error?e.message:'Concept maken is niet gelukt.');}finally{setBusy(false);}};
 return <ListPage><PageHeader title='Formulieren en nazorg' actions={<PillButton onClick={()=>setEditing(null)}>Toevoegen</PillButton>}/><SearchField aria-label='Zoek formulieren en nazorg' placeholder='Zoeken' value={search} onChange={e=>setSearch(e.target.value)}/><DataTable count={grouped.length}><table className='w-full text-left text-sm'><thead><tr><th>Naam</th><th>Soort</th><th>Sjabloon</th><th>Versie</th><th/></tr></thead><tbody>{grouped.map(r=><tr key={r.code} data-list-row><td><PillButton data-row-action variant='ghost' className='h-auto justify-start whitespace-normal px-0 text-left' onClick={()=>setEditing(r)}>{r.name}</PillButton><p className='text-xs text-muted-foreground'>{r.code}</p></td><td>{r.kind==='consent'?'Toestemming':'Nazorg'}</td><td>{templates.templates.find(t=>t.id===r.template_id)?.name??'–'}</td><td><Tag tone={r.status==='concept'?'sand':'teal'}>v{r.version} · {r.status==='concept'?'Concept':r.status==='live'?'Live':'Archief'}</Tag></td><td><PillButton variant='ghost' aria-label={`Open ${r.name}`} onClick={()=>setEditing(r)}><RowChevron/></PillButton></td></tr>)}</tbody></table></DataTable>
 {editing!==undefined&&<CareFormEditor key={editing?.id??'new'} row={editing} templates={templates.templates} busy={busy} onConcept={concept} onClose={()=>setEditing(undefined)} onVersions={code=>setVersions(code)} onSaved={refresh}/>}
 {versions&&<Modal open title='Versies' onOpenChange={()=>setVersions(null)} width='lg'><DataTable><table className='w-full text-left text-sm'><thead><tr><th>Versie</th><th>Status</th><th>Gepubliceerd</th><th/></tr></thead><tbody>{rows.filter(r=>r.code===versions).map(r=><tr key={r.id}><td>v{r.version}</td><td>{r.status==='live'?'Live':r.status==='concept'?'Concept':'Archief'}</td><td>{r.published_at?new Date(r.published_at).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}):'–'}</td><td><PillButton variant='ghost' onClick={()=>{setVersions(null);setEditing(r);}}>Bekijken</PillButton></td></tr>)}</tbody></table></DataTable></Modal>}
 </ListPage>;
}
function CareFormEditor({row,templates,busy,onConcept,onClose,onVersions,onSaved}:{row:CareForm|null;templates:Array<{id:string;name:string}>;busy:boolean;onConcept:(row:CareForm)=>Promise<void>;onClose:()=>void;onVersions:(code:string)=>void;onSaved:()=>Promise<unknown>}){
 const {data:kinds}=useSuspenseQuery(careFormKindsQuery);
 const [d,setD]=useState({id:row?.id??null,code:row?.code??'',kind:(row?.kind==='aftercare'?'aftercare':'consent') as 'consent'|'aftercare',templateId:row?.template_id??null,name:row?.name??'',textNl:row?.text_nl??'',textEn:row?.text_en??''});
 const [saving,setSaving]=useState(false);const [error,setError]=useState('');const save=useServerFn(saveCareForm);const change=useServerFn(changeCareForm);const readonly=!!row&&row.status!=='concept';
 const submit=async(publish:boolean)=>{setSaving(true);setError('');try{const id=await save({data:careFormSchema.parse(d)});if(publish){if(!id)throw new Error('Formulier niet gevonden.');await change({data:{id,action:'publish'}});}await onSaved();toast.success(publish?'Live gezet':'Concept opgeslagen');onClose();}catch(e){setError(e instanceof Error?e.message:'Opslaan is niet gelukt.');}finally{setSaving(false);}};
 return <Modal open onOpenChange={onClose} title={row?.name??'Formulier of nazorg toevoegen'} width='lg' footer={<><PillButton variant='ghost' onClick={onClose}>Sluiten</PillButton>{row&&<PillButton variant='outline' onClick={()=>onVersions(row.code)}>Versies</PillButton>}{readonly?<PillButton disabled={busy} onClick={()=>row&&void onConcept(row)}>Aanpassen</PillButton>:<><PillButton variant='outline' disabled={saving} onClick={()=>void submit(false)}>Concept opslaan</PillButton><PillButton disabled={saving||!d.textNl.trim()} onClick={()=>void submit(true)}>Live zetten</PillButton></>}</>}>
 <div className='flex flex-col gap-4'>{row&&<Tag tone={readonly?'teal':'sand'}>v{row.version} · {row.status==='live'?'Live':row.status==='concept'?'Concept':'Archief'}</Tag>}<div className='grid grid-cols-2 gap-4'><TextField label='Naam' value={d.name} disabled={readonly} onChange={e=>setD({...d,name:e.target.value})}/><TextField label='Code' value={d.code} disabled={!!row} onChange={e=>setD({...d,code:e.target.value})}/><Select label='Soort' value={d.kind} disabled={!!row} options={kinds} onChange={v=>setD({...d,kind:v==='aftercare'?'aftercare':'consent'})}/><Select label='Dossiersjabloon' value={d.templateId??''} disabled={!!row} options={templates.map(t=>({value:t.id,label:t.name}))} onChange={v=>setD({...d,templateId:v||null})}/></div><TextArea label='Tekst Nederlands' rows={9} value={d.textNl} readOnly={readonly} onChange={e=>setD({...d,textNl:e.target.value})}/><TextArea label='Tekst Engels' rows={6} value={d.textEn} readOnly={readonly} onChange={e=>setD({...d,textEn:e.target.value})}/>{error&&<p role='alert' className='text-sm text-warning'>{error}</p>}</div>
 </Modal>;
}