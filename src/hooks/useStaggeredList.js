import { useMemo } from 'react';
export default function useStaggeredList(length, step = 60, start = 40) {
return useMemo(() => (
Array.from({ length }, (_, i) => ({
'--stagger': `${start + i * step}ms`
}))
), [length, step, start]);
}