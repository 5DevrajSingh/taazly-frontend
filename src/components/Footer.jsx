export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-green-100 bg-taazly-light">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-taazly-primary">
            TAAZLY
          </p>

          <p className="mt-1 text-xs text-taazly-secondary">
            Freshness at your doorstep
          </p>
        </div>

        <p className="text-xs leading-5 text-taazly-secondary">
          © {currentYear} TAAZLY. All rights reserved.
        </p>
      </div>
    </footer>
  );
}