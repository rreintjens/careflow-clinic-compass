import {PDFDocument,StandardFonts} from 'pdf-lib';
import type {Database} from '@/integrations/supabase/types';
import {euros} from '@/domain/consult-steps';
type Invoice=Database['public']['Tables']['billing_settlements']['Row'];
export async function downloadInvoice(invoice:Invoice){
 if(invoice.without_invoice||!invoice.invoice_number)throw new Error('Geen factuur.');
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);let page=doc.addPage();let y=790;
 const add=(s:string)=>{for(let i=0;i<s.length||i===0;i+=85){if(y<50){page=doc.addPage();y=790;}page.drawText(s.slice(i,i+85).replace(/[^\x20-\x7e\xa0-\xff€]/g,' '),{x:40,y,size:11,font});y-=18;}};
 const issuer=invoice.issuer_snapshot&&typeof invoice.issuer_snapshot==='object'&&!Array.isArray(invoice.issuer_snapshot)?invoice.issuer_snapshot:{};
 add(String(issuer['clinic']??''));add(`Factuur ${invoice.invoice_number}`);add(new Date(invoice.created_at).toLocaleDateString('nl-NL'));add('Demofactuur - geen echte betaling');add('');
 const legal=issuer['legal'];if(legal&&typeof legal==='object'&&!Array.isArray(legal))for(const [k,v] of Object.entries(legal)){if(typeof v==='string'&&/big|agb|btw|vat|kvk|address|adres|legal_name/i.test(k))add(`${k}: ${v}`);}
 const details=issuer['invoiceDetails'];if(details&&typeof details==='object'&&!Array.isArray(details))for(const [k,v] of Object.entries(details)){if(typeof v==='string'&&v.trim())add(`${k.replace('invoice_','')}: ${v}`);}
 if(Array.isArray(invoice.lines))for(const l of invoice.lines){if(l&&typeof l==='object'&&!Array.isArray(l)){add(`${l['name']} - ${l['qty']} ${l['unit']} - ${euros(Number(l['totalCents']))}`);add(`Btw ${l['vatRate']}%: ${euros(Number(l['vatCents']))} | Korting: ${euros(Number(l['discountCents']))}`);}}
 add('');add(`Totaal betaald: ${euros(invoice.total_cents)}`);add(`Btw: ${euros(invoice.vat_cents)}`);
 const fiscal=invoice.fiscal_snapshot;if(fiscal&&typeof fiscal==='object'&&!Array.isArray(fiscal)&&fiscal['exempt'])add(`Btw-vrijstelling vastgelegd door ${fiscal['by']} op ${fiscal['at']}`);
 const bytes=await doc.save();const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=`factuur-${invoice.invoice_number}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}