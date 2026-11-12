"use client";

import { useState } from "react";
import { ProductImage } from "@/components/ProductImage";

export function Gallery({ images, name, icon }: { images: string[]; name: string; icon?: string | null }) {
  const [i, setI] = useState(0);
  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <ProductImage src={images[i]} alt={name} icon={icon} className="aspect-square" />
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, idx) => (
            <button
              key={src}
              type="button"
              onClick={() => setI(idx)}
              className={`size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                idx === i ? "ring-brand-600" : "ring-slate-200 hover:ring-slate-300"
              }`}
              aria-label={`Photo ${idx + 1}`}
            >
              <ProductImage src={src} alt="" className="size-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
