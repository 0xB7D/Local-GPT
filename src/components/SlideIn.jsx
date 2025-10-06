

import { useEffect, useRef, useState } from 'react';


export default function SlideIn({ children, className = '', once = true, style }) {
const ref = useRef(null);
const [seen, setSeen] = useState(false);


useEffect(() => {
const el = ref.current;
if (!el) return;
const io = new IntersectionObserver(([entry]) => {
if (entry.isIntersecting) {
setSeen(true);
if (once) io.disconnect();
} else if (!once) {
setSeen(false);
}
}, { threshold: 0.1 });
io.observe(el);
return () => io.disconnect();
}, [once]);


const cls = `anim-slide-up anim-stagger ${seen ? 'inview' : ''} ${className}`.trim();
return (
<div ref={ref} className={cls} style={style}>{children}</div>
);
}