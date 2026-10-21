import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { readPortalTreatment } from '@/data/portal-treatment.functions';
import { treatmentReminderDate } from '@/domain/portal-treatment';
import { Modal } from '@/components/Modal';
import { PillButton } from '@/components/PillButton';
import { fmtDay } from './PortalStart';
import demoBefore from '@/assets/demo-botox-before.jpg';

export function PortalTreatment({ appointmentId, startsAt, treatmentId, practitionerId, fallbackAftercare = [] }: {
  appointmentId: string; startsAt: string; treatmentId: string; practitionerId: string | null; fallbackAftercare?: string[];
}) {
  const read = useServerFn(readPortalTreatment);
  const { data, error, isPending } = useQuery({ queryKey: ['portal-treatment', appointmentId], queryFn: () => read({ data: { appointmentId } }) });
  const [document, setDocument] = useState<{ title: string; text: string } | null>(null);
  if (error) return <p role='alert'>Je behandeling kon niet worden geladen.</p>;
  if (isPending || !data) return <p role='status' className='portal-sub'>Behandeling laden…</p>;
  return <>
    {!data.notes.some(note => note.aftercare) && fallbackAftercare.length > 0 && <div className='portal-detail-section'><h2>Nazorg</h2><ul className='portal-tips'>{fallbackAftercare.map((tip, i) => <li key={i}>{tip}</li>)}</ul></div>}
    {data.notes.map(note => {
      const reminder = treatmentReminderDate(startsAt, note.reminderDays);
      return <div key={note.id}>
        {note.patientNote && <div className='portal-detail-section'><h2>Notitie van je behandelaar</h2><p className='whitespace-pre-wrap'>{note.patientNote}</p></div>}
        {note.aftercare && <div className='portal-detail-section'><h2>Nazorg</h2><p className='whitespace-pre-wrap'>{note.aftercare}</p></div>}
        {note.gpLetter && <PillButton variant='ghost' block className='portal-row portal-row-link justify-between' onClick={() => setDocument({ title: 'Huisartsbrief', text: note.gpLetter })}>Huisartsbrief<ChevronRight size={16}/></PillButton>}
        {reminder && <div className='portal-detail-section'><h2>Herinnering</h2><p className='portal-sub'>{fmtDay(`${reminder}T12:00:00Z`)}</p><Link to='/boeken' search={{ t: treatmentId, p: practitionerId ?? undefined }} className='portal-btn-secondary'>Opnieuw boeken</Link></div>}
      </div>;
    })}
    {data.prescriptions.length > 0 && <div className='portal-detail-section'><h2>Recept</h2>{data.prescriptions.map(rx => <div key={rx.id} className='portal-row'><div className='min-w-0 flex-1'><p className='portal-row-title'>{rx.medication}</p><p className='portal-sub whitespace-pre-wrap'>{rx.instructions}</p><p className='portal-sub'>Ondertekend {fmtDay(rx.signedAt)}</p></div><span className='portal-sub'>{rx.status}</span></div>)}</div>}
    {data.photos.length > 0 && <div className='portal-detail-section'><h2>Gedeelde foto's</h2><div className='grid grid-cols-2 gap-3'>{data.photos.map(photo => { const image = photo.image === 'demo:botox-before' ? demoBefore : photo.image; return <figure key={photo.id}><a href={image} download={`behandelfoto-${photo.id}.jpg`} aria-label={`Download foto ${photo.slot}`}><img src={image} alt={`Behandelfoto ${photo.slot}`} loading='lazy' width={768} height={768} className='aspect-square w-full rounded-xl object-cover'/></a><figcaption className='portal-sub'>{photo.slot} · {fmtDay(photo.createdAt)}</figcaption></figure>; })}</div></div>}
    {data.consents.length > 0 && <div className='portal-detail-section'><h2>Formulieren</h2>{data.consents.map(form => <PillButton key={form.id} variant='ghost' block className='portal-row portal-row-link justify-between' onClick={() => setDocument({ title: form.kind, text: form.text ?? '' })}><span className='min-w-0 whitespace-normal text-left'>{form.kind}<span className='portal-sub block'>{form.granted ? 'Ondertekend' : 'Ingetrokken'} · {fmtDay(form.signedAt)}</span></span><ChevronRight size={16}/></PillButton>)}</div>}
    <Modal open={document !== null} onOpenChange={open => { if (!open) setDocument(null); }} title={document?.title ?? ''} description=''><p className='whitespace-pre-wrap'>{document?.text}</p></Modal>
  </>;
}