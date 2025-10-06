

export default function SpringButton({ as: Comp = 'button', className = '', children, ...rest }) {
const base = 'anim-pop';
return (
<Comp className={`${base} ${className}`} {...rest}>
{children}
</Comp>
);
}