"use client";

import { useEffect, useRef, type RefObject } from 'react';

const focusableSelector = 'button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]';
let locks = 0;
let originalOverflow = '';

/** Keep keyboard navigation and background scrolling inside the active dialog. */
export function useModal(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!active || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    if (locks++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    const elements = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])
      .filter(element => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => elements()[0]?.focus({ preventScroll: true }));
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = elements();
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      if (--locks === 0) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
