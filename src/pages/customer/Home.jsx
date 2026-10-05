import { useEffect, useState } from "react";
import { getActiveStores, getHomeCategories, getHomeProducts } from "../../services/homeService";
import HeroBanner, {
  homeBanners,
} from "../../components/customerComponents/HeroBanner";
import CustomerHeader from "../../components/customerComponents/CustomerHeader";
import SectionBoundary from "../../components/customerComponents/SectionBoundary";
import CategoryComponent from "../../components/customerComponents/CategoryComponent";
import OfferBannerCategory, {
  homeOffers,
} from "../../components/customerComponents/OfferBannerCategory";
import ProductComponent from "../../components/customerComponents/ProductComponent";
import WhyTaazlyComponent from "../../components/customerComponents/WhyTaazlyComponent";
import Footer from "../../components/Footer";

function Home() {
const [activeCategory, setActiveCategory] = useState("all");
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState("");
  const [storesRefresh, setStoresRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadStores() {
      setStoresLoading(true);
      setStoresError("");

      try {
        const list = await getActiveStores({
          signal: controller.signal,
        });

        if (cancelled) return;

        let savedStore = "";

        try {
          savedStore = localStorage.getItem("customer_store_id") || "";
        } catch {
          // Store selection still works if storage is unavailable.
        }

        const savedStoreExists = list.some(
          (store) => String(store.id) === savedStore
        );

        const nextStore = savedStoreExists
          ? savedStore
          : list.length > 0
            ? String(list[0].id)
            : "";

        setStores(list);
        setSelectedStore(nextStore);

        try {
          if (nextStore) {
            localStorage.setItem("customer_store_id", nextStore);
          } else {
            localStorage.removeItem("customer_store_id");
          }
        } catch {
          // Saving selection is optional.
        }
      } catch (error) {
        if (cancelled) return;

        setStoresError(
          error.response?.data?.message ||
          error.message ||
          "Unable to load stores."
        );
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    }

    loadStores();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [storesRefresh]);

  function handleStoreChange(storeId) {
    setSelectedStore(storeId);
    setActiveCategory("all");

    try {
      localStorage.setItem("customer_store_id", storeId);
    } catch {
      // Selection remains available for this session.
    }
  }

  // get category
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoriesRefresh, setCategoriesRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setCategories([]);
    setCategoriesError("");
    setActiveCategory("all");

    if (!selectedStore) {
      setCategoriesLoading(false);
      return () => controller.abort();
    }

    setCategoriesLoading(true);

    async function loadCategories() {
      try {
        const list = await getHomeCategories(selectedStore, {
          signal: controller.signal,
        });

        if (!cancelled) setCategories(list);
      } catch (error) {
        if (cancelled) return;

        setCategoriesError(
          error.response?.data?.message ||
          error.message ||
          "Unable to load categories."
        );
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedStore, categoriesRefresh]);

  // Get products
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productsRefresh, setProductsRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setProducts([]);
    setProductsError("");

    if (!selectedStore) {
      setProductsLoading(false);
      return () => controller.abort();
    }

    setProductsLoading(true);

    async function loadProducts() {
      try {
        const list = await getHomeProducts(selectedStore, {
          signal: controller.signal,
        });

        if (!cancelled) setProducts(list);
      } catch (error) {
        if (cancelled) return;

        setProductsError(
          error.response?.data?.message ||
          error.message ||
          "Unable to load products."
        );
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedStore, productsRefresh]);

  const filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter(
        (product) =>
          String(product.category_id) === String(activeCategory)
      );





  return (
    <div className="flex min-h-screen flex-col bg-white text-taazly-text">

      <CustomerHeader
        stores={stores}
        selectedStore={selectedStore}
        onStoreChange={handleStoreChange}
        storesLoading={storesLoading}
        storesError={storesError}
      />

      {/* ================= MAIN ================= */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8">

        {storesError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <span>{storesError}</span>

            <button
              type="button"
              onClick={() => setStoresRefresh((value) => value + 1)}
              className="shrink-0 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ================= HERO BANNER ================= */}
        <SectionBoundary name="Home banner">
          <HeroBanner banners={homeBanners} />
        </SectionBoundary>

        {/*================== Category ===================== */}
        <SectionBoundary name="Categories">
          {!selectedStore ? (
            <p className="mt-8 text-sm text-taazly-secondary">
              Select a store to view categories.
            </p>
          ) : categoriesLoading ? (
            <div
              role="status"
              className="mt-8 rounded-2xl border border-green-100 bg-taazly-light p-6 text-sm text-taazly-primary"
            >
              Loading categories...
            </div>
          ) : categoriesError ? (
            <div
              role="alert"
              className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
            >
              <p>{categoriesError}</p>

              <button
                type="button"
                onClick={() => setCategoriesRefresh((value) => value + 1)}
                className="mt-3 font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <CategoryComponent
              key={selectedStore}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onViewAll={() => setActiveCategory("all")}
            />
          )}
        </SectionBoundary>


        {/* ================= OFFER BANNERS ================= */}
        <SectionBoundary name="Offers">
          <OfferBannerCategory offers={homeOffers} />
        </SectionBoundary>


        {/* ================= PRODUCT LIST ================= */}
        <SectionBoundary name="Products">
          {!selectedStore ? (
            <p className="mt-8 text-sm text-taazly-secondary">
              Select a store to view products.
            </p>
          ) : productsLoading ? (
            <div
              role="status"
              className="mt-8 rounded-2xl border border-green-100 bg-taazly-light p-6 text-sm text-taazly-primary"
            >
              Loading products...
            </div>
          ) : productsError ? (
            <div
              role="alert"
              className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
            >
              <p>{productsError}</p>

              <button
                type="button"
                onClick={() => setProductsRefresh((value) => value + 1)}
                className="mt-3 font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <ProductComponent
              key={selectedStore}
              title={
                activeCategory === "all"
                  ? "Shop Products"
                  : categories.find(
                    (category) =>
                      String(category.id) === String(activeCategory)
                  )?.name || "Products"
              }
              description="Explore products from your selected store"
              products={filteredProducts}
              onViewAll={
                activeCategory !== "all"
                  ? () => setActiveCategory("all")
                  : undefined
              }
            />
          )}
        </SectionBoundary>





        {/* ================= WHY TAAZLY ================= */}
        <SectionBoundary name="Why TAAZLY">
          <WhyTaazlyComponent />
        </SectionBoundary>

      </main>

      <Footer />

      {/* ================= MOBILE NAV ================= */}
      <nav className="sticky bottom-0 z-40 border-t border-taazly-border bg-white sm:hidden">
        <div className="grid grid-cols-4">

          <button className="flex flex-col items-center gap-1 py-3 text-taazly-primary">
            <span>🏠</span>
            <span className="text-[10px] font-semibold">
              Home
            </span>
          </button>

          <button className="flex flex-col items-center gap-1 py-3 text-taazly-secondary">
            <span>📂</span>
            <span className="text-[10px] font-semibold">
              Categories
            </span>
          </button>

          <button className="flex flex-col items-center gap-1 py-3 text-taazly-secondary">
            <span>🛒</span>
            <span className="text-[10px] font-semibold">
              Cart
            </span>
          </button>

          <button className="flex flex-col items-center gap-1 py-3 text-taazly-secondary">
            <span>👤</span>
            <span className="text-[10px] font-semibold">
              Account
            </span>
          </button>

        </div>
      </nav>

    </div>
  );
}

export default Home;