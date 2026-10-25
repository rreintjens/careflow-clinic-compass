import { expect, it } from 'vitest';
import { BOOKING_TAP_MS, BOOKING_SLIDE_MS, BOOKING_FADE_MS, bookingScreenKey, bookingHistoryDirection } from './booking-transition';
it('gives tiles 100ms feedback and slides for 250–300ms',()=>{expect(BOOKING_TAP_MS).toBe(100);expect(BOOKING_SLIDE_MS).toBeGreaterThanOrEqual(250);expect(BOOKING_SLIDE_MS).toBeLessThanOrEqual(300);});
it('uses a short reduced-motion fade',()=>{expect(BOOKING_FADE_MS).toBe(120);});
it('reverses for browser back, including multiple entries',()=>{expect(bookingHistoryDirection(4,2)).toBe('back');expect(bookingHistoryDirection(2,4)).toBe('forward');});
it('planner choices do not change screen identity',()=>{const step={kind:'planner' as const,treatment:'laser',location:'Amsterdam',practitioner:null,canChoose:true};expect(bookingScreenKey(step)).toBe(bookingScreenKey({...step,practitioner:'doctor'}));});
it('menu levels and hold phase identify real new screens',()=>{expect(bookingScreenKey({kind:'menu',group:'laser',items:[]})).not.toBe(bookingScreenKey({kind:'menu',group:null,items:[]}));const step={kind:'planner' as const,treatment:'laser',location:'Amsterdam',practitioner:null,canChoose:true};expect(bookingScreenKey(step,'hold')).not.toBe(bookingScreenKey(step));});
