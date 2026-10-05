export const homeOffers = [
  {
    id: 1,
    label: "Limited Offer",
    title: "Up to 30% OFF",
    description: "On fresh vegetables",
    buttonText: "Shop Now",
    targetId: "home-products",
    theme: "light",
  },
  {
    id: 2,
    label: "Fresh Deals",
    title: "Fresh Fruits",
    description: "Farm fresh products delivered fast",
    buttonText: "Explore",
    targetId: "home-categories",
    theme: "green",
  },
];

const themes = {
  light: {
    card: "border-green-100 bg-taazly-light",
    label: "text-taazly-primary",
    title: "text-taazly-text",
    description: "text-taazly-secondary",
    button: "bg-taazly-primary text-white hover:bg-green-700",
  },
  green: {
    card: "border-taazly-primary bg-taazly-primary",
    label: "text-green-100",
    title: "text-white",
    description: "text-green-50",
    button: "bg-white text-taazly-primary hover:bg-green-50",
  },
};

export default function OfferBannerCategory({ offers = [] }) {
  if (!offers.length) return null;

  function handleOfferClick(offer) {
    document.getElementById(offer.targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="mt-8">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-taazly-text">
          Today's Offers
        </h2>

        <p className="mt-1 text-xs text-taazly-secondary">
          Grab the best deals before they are gone
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {offers.map((offer) => {
          const theme = themes[offer.theme] || themes.light;

          return (
            <div
              key={offer.id}
              className={`flex flex-col items-start overflow-hidden rounded-3xl border p-6 sm:p-8 ${theme.card}`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wider ${theme.label}`}
              >
                {offer.label}
              </p>

              <h3
                className={`mt-3 text-2xl font-extrabold sm:text-3xl ${theme.title}`}
              >
                {offer.title}
              </h3>

              <p
                className={`mt-2 text-sm leading-6 ${theme.description}`}
              >
                {offer.description}
              </p>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={() => handleOfferClick(offer)}
                  className={`rounded-xl px-5 py-2.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${theme.button}`}
                >
                  {offer.buttonText} →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}