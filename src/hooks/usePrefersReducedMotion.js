export default function usePrefersReducedMotion() {
if (typeof window === 'undefined') return true;
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
return mq.matches;
}