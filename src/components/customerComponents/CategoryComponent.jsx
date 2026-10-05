import { useRef, useState } from "react";

function CategoryImage({ src, name }) {
  const [failedSrc, setFailedSrc] = useState(null);

  const hasImage =
    typeof src === "string" &&
    src.trim() !== "" &&
    failedSrc !== src;

  return (
  <div className="flex h-40 w-full items-center justify-center overflow-hidden bg-taazly-light sm:h-44">
    {hasImage ? (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
      />
    ) : (
      <span className="px-3 text-center text-xs text-taazly-secondary">
        Image unavailable
      </span>
    )}
  </div>
);
}

export default function CategoryComponent({
  categories = [],
  activeCategory,
  onCategoryChange,
  onViewAll,
}) {
  const scrollRef = useRef(null);

  function scrollCategories(direction) {
    const container = scrollRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    container.scrollBy({
      left: direction * container.clientWidth * 0.8,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  const arrowClass =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-green-200 bg-white text-2xl text-taazly-primary shadow-md transition hover:border-taazly-primary hover:bg-taazly-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary sm:h-12 sm:w-12";

  return (
    <section
      id="home-categories"
      className="mt-10 scroll-mt-24 sm:mt-12"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-taazly-primary">
            Fresh picks for you
          </p>

          <h2 className="text-xl font-bold tracking-tight text-taazly-text sm:text-2xl">
            Shop by Category
          </h2>

          <p className="mt-1.5 text-xs text-taazly-secondary sm:text-sm">
            Everything you need, all in one place
          </p>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 rounded-full border border-green-200 bg-white px-4 py-2.5 text-xs font-semibold text-taazly-primary transition hover:bg-taazly-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary sm:text-sm"
          >
            View All →
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 p-6 text-sm text-taazly-secondary">
          No categories available.
        </p>
      ) : (
        <div className="relative">
          <button
            type="button"
            aria-label="Scroll categories left"
            onClick={() => scrollCategories(-1)}
            className={`${arrowClass} -left-2 sm:-left-4`}
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div
            ref={scrollRef}
            className="flex flex-nowrap gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
          >
            {categories.map((category) => {
              const isSelected =
                activeCategory != null &&
                String(activeCategory) === String(category.id);

              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onCategoryChange?.(category.id)}
                  className={`group flex w-44 shrink-0 flex-col items-center overflow-hidden rounded-3xl border pb-5 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary sm:w-48 ${
  isSelected
    ? "border-taazly-primary bg-taazly-light shadow-sm"
    : "border-slate-200 bg-white hover:border-green-300 hover:shadow-md"
}`}
                >
                  <CategoryImage
                    src={category.image_url || category.image}
                    name={category.name}
                  />

                  <span
                    className={`mt-4 flex min-h-10 items-center justify-center text-center text-base font-semibold sm:text-lg ${isSelected
                        ? "text-taazly-primary"
                        : "text-taazly-text"
                      }`}
                  >
                    {category.name}
                  </span>

                  {category.product_count != null && (
                    <span className="mt-1 text-xs text-taazly-secondary">
                      {category.product_count} items
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => scrollCategories(1)}
            className={`${arrowClass} -right-2 sm:-right-4`}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </section>
  );
}


// export default function CategoryComponent({
//   categories = [],
//   activeCategory,
//   onCategoryChange,
//   onViewAll,
// }) {
//   return (
//     <section id="home-categories" className="mt-8 scroll-mt-24">
//       <div className="mb-5 flex items-center justify-between gap-4">
//         <div>
//           <h2 className="text-xl font-bold text-taazly-text">
//             Shop by Category
//           </h2>

//           <p className="mt-1 text-xs text-taazly-secondary">
//             Everything you need, all in one place
//           </p>
//         </div>

//         {onViewAll && (
//           <button
//             type="button"
//             onClick={onViewAll}
//             className="shrink-0 rounded-xl bg-taazly-light px-3 py-2 text-xs font-semibold text-taazly-primary transition hover:bg-green-100 sm:text-sm"
//           >
//             View All →
//           </button>
//         )}
//       </div>

//       <div className="flex gap-3 overflow-x-auto pb-3 sm:gap-4">
//         {categories.map((category) => {
//           const isSelected = activeCategory === category.id;

//           return (
//             <button
//               key={category.id}
//               type="button"
//               aria-pressed={isSelected}
//               onClick={() => onCategoryChange?.(category.id)}
//               className={`flex w-28 shrink-0 flex-col items-center gap-3 rounded-2xl border p-4 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary sm:w-32 ${
//                 isSelected
//                   ? "border-taazly-primary bg-taazly-primary text-white shadow-md"
//                   : "border-green-100 bg-taazly-light text-taazly-text hover:border-green-300 hover:bg-green-100"
//               }`}
//             >
//               <div
//                 aria-hidden="true"
//                 className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm"
//               >
//                 {category.image}
//               </div>

//               <span className="flex min-h-8 items-center justify-center text-center text-xs font-semibold">
//                 {category.name}
//               </span>
//             </button>
//           );
//         })}
//       </div>
//     </section>
//   );
// }