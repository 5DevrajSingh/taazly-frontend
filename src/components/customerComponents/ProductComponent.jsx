import { useRef, useState } from "react";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function ProductImage({ src, name }) {
  const [failedSrc, setFailedSrc] = useState(null);

  const hasImage =
    typeof src === "string" &&
    src.trim() !== "" &&
    failedSrc !== src;

  return hasImage ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
    />
  ) : (
    <span className="px-4 text-center text-xs text-taazly-secondary">
      Image unavailable
    </span>
  );
}

export default function ProductComponent({
  id = "home-products",
  title = "Fresh Vegetables",
  description = "Fresh and quality vegetables for your kitchen",
  products = [],
  onAddToCart,
  onViewAll,
}) {
  const scrollRef = useRef(null);

  function scrollProducts(direction) {
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
    <section id={id} className="mt-10 scroll-mt-24 sm:mt-12">
      {/* Section heading */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-taazly-text sm:text-2xl">
            {title}
          </h2>

          {description && (
            <p className="mt-1.5 text-xs text-taazly-secondary sm:text-sm">
              {description}
            </p>
          )}
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 rounded-full border border-green-200 bg-white px-4 py-2.5 text-xs font-semibold text-taazly-primary transition hover:border-taazly-primary hover:bg-taazly-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary sm:text-sm"
          >
            View All →
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-taazly-secondary">
          No products available.
        </p>
      ) : (
        <div className="relative">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollProducts(-1)}
            className={`${arrowClass} -left-2 sm:-left-4`}
          >
            <span aria-hidden="true">‹</span>
          </button>

          {/* Single-row product listing */}
          <div
            ref={scrollRef}
            className="flex flex-nowrap items-stretch gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5"
          >
            {products.map((product) => {
              const price = Number(
                product.price ?? product.selling_price
              );

              const hasPrice =
                Number.isFinite(price) && price >= 0;

              const mrp = Number(product.mrp);

              const hasDiscount =
                hasPrice &&
                Number.isFinite(mrp) &&
                mrp > price;

              const discountLabel =
                product.discount ||
                (hasDiscount
                  ? `${Math.round(((mrp - price) / mrp) * 100)}% OFF`
                  : "");

              const outOfStock =
                product.is_available === false ||
                product.is_available === 0 ||
                product.is_available === "0" ||
                (product.stock_quantity != null &&
                  Number(product.stock_quantity) <= 0);

              return (
                <article
                  key={product.id}
                  className="group flex w-[190px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:border-green-300 hover:shadow-lg hover:shadow-green-100/50 sm:w-[230px]"
                >
                  {/* Real product image */}
                  <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[#f7f8f7] sm:h-52">
                    <ProductImage
                      src={product.image_url || product.image}
                      name={product.name}
                    />

                    {discountLabel && (
                      <span className="absolute left-3 top-3 rounded-md bg-taazly-accent px-2 py-1 text-[10px] font-bold text-white sm:text-xs">
                        {discountLabel}
                      </span>
                    )}

                    {outOfStock && (
                      <span className="absolute bottom-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                        Out of stock
                      </span>
                    )}
                  </div>

                  {/* Product details */}
                  <div className="flex flex-1 flex-col p-4">
                    <h3
                      title={product.name}
                      className="line-clamp-2 min-h-12 text-base font-bold leading-6 text-taazly-text"
                    >
                      {product.name}
                    </h3>

                    <p className="mt-1 min-h-5 text-sm text-taazly-secondary">
                      {product.unit}
                    </p>

                    {/* Price and ADD button */}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-5">
                      <div>
                        {hasDiscount && (
                          <p className="text-xs text-taazly-secondary line-through">
                            {priceFormatter.format(mrp)}
                          </p>
                        )}

                        <p className="mt-0.5 text-lg font-bold text-taazly-text">
                          {hasPrice
                            ? priceFormatter.format(price)
                            : "—"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          !onAddToCart || outOfStock || !hasPrice
                        }
                        onClick={() => onAddToCart?.(product)}
                        aria-label={`Add ${product.name} to cart`}
                        className="shrink-0 rounded-lg border border-taazly-primary bg-taazly-light px-3 py-2 text-sm font-bold text-taazly-primary transition hover:bg-taazly-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taazly-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:px-4"
                      >
                        + ADD
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollProducts(1)}
            className={`${arrowClass} -right-2 sm:-right-4`}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </section>
  );
}