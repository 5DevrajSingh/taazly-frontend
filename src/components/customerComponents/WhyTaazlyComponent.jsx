const features = [
  {
    id: "delivery",
    icon: "🚴",
    title: "Fast Delivery",
    description: "Get your groceries delivered quickly.",
  },
  {
    id: "freshness",
    icon: "🥬",
    title: "Fresh Products",
    description: "Quality products selected for you.",
  },
  {
    id: "security",
    icon: "🔒",
    title: "Secure Shopping",
    description: "Safe and reliable shopping experience.",
  },
];

export default function WhyTaazlyComponent() {
  return (
    <section className="mt-10 rounded-3xl border border-green-100 bg-taazly-light p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-xl font-bold text-taazly-text">
          Why Choose TAAZLY?
        </h2>

        <p className="mt-2 text-sm text-taazly-secondary">
          Fresh products and a better grocery shopping experience.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="rounded-2xl border border-green-100 bg-white p-6 text-center transition hover:border-green-300 hover:shadow-sm"
          >
            <div
              aria-hidden="true"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-taazly-primary text-2xl"
            >
              {feature.icon}
            </div>

            <h3 className="mt-4 text-sm font-bold text-taazly-text">
              {feature.title}
            </h3>

            <p className="mt-2 text-xs leading-5 text-taazly-secondary">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}