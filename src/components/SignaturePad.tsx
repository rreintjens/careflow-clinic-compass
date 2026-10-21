import {useRef,useState,type PointerEvent} from 'react';
import {Modal} from './Modal';
import {PillButton} from './PillButton';
export function SignaturePad({onSign,onClose,title='Onderteken het recept',text}:{onSign:(image:string)=>void;onClose:()=>void;title?:string;text?:string}){
 const ref=useRef<HTMLCanvasElement>(null);const drawing=useRef(false);const [empty,setEmpty]=useState(true);
 const pointer=(e:PointerEvent<HTMLCanvasElement>)=>{const canvas=ref.current;if(!canvas)return null;const r=canvas.getBoundingClientRect();return {canvas,x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 const start=(e:PointerEvent<HTMLCanvasElement>)=>{const p=pointer(e);const c=p?.canvas.getContext('2d');if(!p||!c)return;p.canvas.setPointerCapture(e.pointerId);drawing.current=true;c.strokeStyle=getComputedStyle(p.canvas).color;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);};
 const move=(e:PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const p=pointer(e);const c=p?.canvas.getContext('2d');if(!p||!c)return;c.lineTo(p.x,p.y);c.stroke();setEmpty(false);};
 return <Modal open onOpenChange={o=>{if(!o)onClose();}} title={title} footer={<><PillButton variant='outline' onClick={onClose}>Annuleren</PillButton><PillButton disabled={empty} onClick={()=>{const canvas=ref.current;if(canvas)onSign(canvas.toDataURL('image/png'));}}>Ondertekenen</PillButton></>}>
 {text&&<p className='mb-4 whitespace-pre-wrap text-sm'>{text}</p>}<canvas aria-label='Handtekening' ref={ref} width={520} height={200} className='w-full touch-none rounded-[14px] bg-sand text-foreground' onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/>
 </Modal>;
}