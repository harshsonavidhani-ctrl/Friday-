import { CategoryIcon } from "./CategoryIcon";

/** Product photo on white, or a neat placeholder when no photo yet. */
export function ProductImage({
  src,
  alt,
  icon,
  className = "",
}: {
  src?: string | null;
  alt: string;
  icon?: string | null;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300 ${className}`}
      >
        <CategoryIcon icon={icon} className="size-1/3 max-h-16 max-w-16" />
      </div>
    );
  }
  return (
    <div className={`bg-white ${className}`}>
      <img src={src} alt={alt} loading="lazy" className="size-full object-contain p-2" />
    </div>
  );
}
