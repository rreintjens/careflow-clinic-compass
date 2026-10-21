import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {readPatientInvoice} from '@/data/billing.functions';
import {PillButton} from '@/components/PillButton';
import {downloadInvoice} from './invoice-pdf';
import {toast} from 'sonner';
export function PortalInvoice({appointmentId}:{appointmentId:string}){
 const read=useServerFn(readPatientInvoice);const {data,error}=useQuery({queryKey:['patient-invoice',appointmentId],queryFn:()=>read({data:{appointmentId}})});
 if(error)return <p role='alert'>Je factuur kon niet worden geladen.</p>;if(!data)return null;
 return <div className='portal-detail-section flex items-center justify-between gap-3'><div><h2>Factuur</h2><p className='portal-sub'>{data.invoice_number}</p></div><PillButton onClick={()=>void downloadInvoice(data).catch(()=>toast.error('Je factuur kon niet worden gedownload.'))}>Bekijk</PillButton></div>;
}