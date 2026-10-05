import { useState } from "react";

export const homeBanners = [
  {
    id: 1,
    image: "/images/banners/banner1.png",
    alt: "TAAZLY fresh groceries banner",
  },
  {
    id: 2,
    image: "/images/banners/banner2.png",
    alt: "TAAZLY fresh fruits banner",
  },
];

export default function HeroBanner({ banners = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!banners.length) return null;

  const currentIndex = Math.min(activeIndex, banners.length - 1);
  const banner = banners[currentIndex];

  function changeBanner(direction) {
    setActiveIndex(
      (currentIndex + direction + banners.length) % banners.length
    );
  }

  return (
  <section
  aria-label="Featured banners"
  aria-roledescription="carousel"
  className="overflow-hidden rounded-xl border border-green-200 bg-white shadow-lg shadow-green-200 sm:rounded-3xl"
>
    <div className="aspect-[3/1] w-full bg-taazly-light">
      <img
        src={banner.image}
        alt={banner.alt || "TAAZLY featured banner"}
        className="h-full w-full object-contain"
        decoding="async"
      />
    </div>
  </section>
);
}

// export const homeBanners = [
//     {
//         id: 1,
//         eyebrow: "Fresh • Fast • Affordable",
//         title: "Fresh groceries, delivered to your door.",
//         description:
//             "Vegetables, fruits, dairy and everyday essentials — shop your daily needs with TAAZLY.",
//         buttonText: "Shop Essentials",
//         targetId: "home-products",
//         illustration: "🥦 🥕 🍅",
//         theme: "green",
//     },
//     {
//         id: 2,
//         eyebrow: "A little freshness, every day",
//         title: "Fresh fruits for your daily routine.",
//         description:
//             "Explore colourful fruits and fill your basket with your favourites.",
//         buttonText: "Explore Categories",
//         targetId: "home-categories",
//         illustration: "🍎 🍊 🍇",
//         theme: "orange",
//     },
// ];

// const themes = {
//     green: {
//         background: "from-green-700 via-green-600 to-emerald-500",
//         button: "text-green-700",
//     },
//     orange: {
//         background: "from-orange-600 via-orange-500 to-amber-400",
//         button: "text-orange-700",
//     },
// };

// export default function HeroBanner({ banners = [] }) {
//     const [activeIndex, setActiveIndex] = useState(0);

//     if (!banners.length) return null;

//     const currentIndex = Math.min(activeIndex, banners.length - 1);
//     const banner = banners[currentIndex];
//     const theme = themes[banner.theme] || themes.green;

//     function changeBanner(direction) {
//         setActiveIndex(
//             (currentIndex + direction + banners.length) % banners.length
//         );
//     }

//     function handleShop() {
//         document.getElementById(banner.targetId)?.scrollIntoView({
//             behavior: "smooth",
//             block: "start",
//         });
//     }

//     return (
//         <section
//             aria-label="Featured offers"
//             aria-roledescription="carousel"
//             className={`relative h-[560px] overflow-hidden rounded-3xl bg-gradient-to-br sm:h-[580px] lg:h-[380px] ${theme.background}`}
//         >
//             {/* Decorative shapes */}
//             <div
//                 aria-hidden="true"
//                 className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10"
//             />

//             <div
//                 aria-hidden="true"
//                 className="pointer-events-none absolute bottom-0 right-20 h-40 w-40 rounded-full bg-white/10"
//             />

//             <div className="relative grid h-full grid-rows-[1fr_auto] gap-4 px-6 pb-20 pt-10 sm:px-10 sm:pt-12 lg:grid-cols-2 lg:grid-rows-1 lg:gap-6 lg:px-16">
//                 <div
//                     aria-live="polite"
//                     aria-atomic="true"
//                     className="min-w-0 self-start"
//                 >
//                     <p className="text-xs font-bold uppercase tracking-widest text-white/90 sm:text-sm">
//                         {banner.eyebrow}
//                     </p>

//                     <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
//                         {banner.title}
//                     </h2>

//                     <p className="mt-4 max-w-lg text-sm leading-6 text-white/90 sm:text-base">
//                         {banner.description}
//                     </p>

//                     <button
//                         type="button"
//                         onClick={handleShop}
//                         className={`mt-6 rounded-xl bg-white px-6 py-3 text-sm font-bold shadow-sm transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${theme.button}`}
//                     >
//                         {banner.buttonText} →
//                     </button>
//                 </div>

//                 <div
//                     aria-hidden="true"
//                     className="flex self-center items-center justify-center rounded-3xl border border-white/20 bg-white/10 px-4 py-8 text-6xl sm:text-7xl lg:py-14 lg:text-8xl"
//                 >
//                     {banner.illustration}
//                 </div>
//             </div>

//             {banners.length > 1 && (
//                 <div className="absolute inset-x-0 bottom-5 flex items-center justify-between px-6 sm:px-10 lg:px-16">
//                     <div className="flex gap-2" aria-label="Select banner">
//                         {banners.map((item, index) => (
//                             <button
//                                 key={item.id}
//                                 type="button"
//                                 aria-label={`Show banner ${index + 1}`}
//                                 aria-current={currentIndex === index ? "true" : undefined}
//                                 onClick={() => setActiveIndex(index)}
//                                 className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
//                             >
//                                 <span
//                                     className={`h-2 rounded-full transition-all ${currentIndex === index
//                                             ? "w-6 bg-white"
//                                             : "w-2 bg-white/50"
//                                         }`}
//                                 />
//                             </button>
//                         ))}
//                     </div>

//                     <div className="flex gap-2">
//                         <button
//                             type="button"
//                             aria-label="Previous banner"
//                             onClick={() => changeBanner(-1)}
//                             className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/20"
//                         >
//                             ←
//                         </button>

//                         <button
//                             type="button"
//                             aria-label="Next banner"
//                             onClick={() => changeBanner(1)}
//                             className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/20"
//                         >
//                             →
//                         </button>
//                     </div>
//                 </div>
//             )}
//         </section>
//     );
// }