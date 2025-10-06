

export default function FloatingOrbs() {
return (
<div aria-hidden className="orbs-layer">
<div className="orb o1" />
<div className="orb o2" />
<div className="orb o3" />
</div>
);
}


/* Styles for the orbs (co-locate here or move into App.css) */
const styles = `
.orbs-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.orb {
position: absolute; width: 220px; height: 220px; border-radius: 999px;
filter: blur(30px); opacity: .18; mix-blend-mode: screen;
background: radial-gradient(circle at 30% 30%, rgba(59,130,246,.9), rgba(59,130,246,0));
animation: float-orb 10s ease-in-out infinite;
}
.o1 { top: 8%; left: -40px; }
.o2 { bottom: 10%; right: -60px; animation-duration: 12s; }
.o3 { top: 50%; left: 55%; width: 160px; height: 160px; animation-duration: 9s; }
`;


if (typeof document !== 'undefined' && !document.getElementById('orb-styles')) {
const tag = document.createElement('style');
tag.id = 'orb-styles';
tag.textContent = styles;
document.head.appendChild(tag);
}