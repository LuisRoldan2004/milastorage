import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Check,
  PackageOpen,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import products from "./data/products.json";

const STORAGE_KEY = "inventario-qr.existencias.v1";
const LOW_STOCK_LIMIT = 5;

function isQuantityMap(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (quantity) =>
        Number.isSafeInteger(quantity) && quantity >= 0,
    )
  );
}

function ProductCard({ product, quantity, onQuantityChange }) {
  const isLowStock = quantity <= LOW_STOCK_LIMIT;

  function adjustQuantity(amount) {
    onQuantityChange(product.id, Math.max(0, quantity + amount));
  }

  return (
    <article className="product-card">
      <div className="product-main">
        <div className="product-info">
          <p className="product-category">{product.category}</p>
          <h2 className="product-name" title={product.name}>
            {product.name}
          </h2>
          <p className="product-id">Clave {product.id}</p>
          <span className={`stock-badge${isLowStock ? " stock-badge-low" : ""}`}>
            <span className="stock-dot" />
            {quantity === 0
              ? "Sin existencias"
              : isLowStock
                ? "Stock bajo"
                : "Disponible"}
          </span>
        </div>
        <div
          className="qr-container"
          role="img"
          aria-label={`Código QR del producto ${product.name}, clave ${product.id}`}
        >
          <QRCodeSVG value={product.id} size={94} level="M" marginSize={1} />
        </div>
      </div>

      <div className="product-footer">
        <div className="unit-label">
          <PackageOpen size={16} aria-hidden="true" />
          <span>{product.unit || "Unidad"}</span>
        </div>
        <div className="quantity-control">
          <button
            className="quantity-button"
            type="button"
            aria-label={`Restar una unidad de ${product.name}`}
            onClick={() => adjustQuantity(-1)}
            disabled={quantity === 0}
          >
            <ArrowDownToLine size={15} aria-hidden="true" />
          </button>
          <label className="quantity-input-wrap">
            <span className="sr-only">Existencias de {product.name}</span>
            <input
              className="quantity-input"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "") {
                  onQuantityChange(product.id, 0);
                } else {
                  const parsed = Number(nextValue);
                  if (Number.isSafeInteger(parsed) && parsed >= 0) {
                    onQuantityChange(product.id, parsed);
                  }
                }
              }}
            />
          </label>
          <button
            className="quantity-button quantity-button-add"
            type="button"
            aria-label={`Sumar una unidad de ${product.name}`}
            onClick={() => adjustQuantity(1)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas las categorías");
  const [stockFilter, setStockFilter] = useState("todos");
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (parsed.version !== 1 || !isQuantityMap(parsed.quantities)) {
          throw new Error(
            "Los datos guardados no tienen el formato esperado. Se conservan sin cambios.",
          );
        }
        setQuantities(parsed.quantities);
      }
    } catch (error) {
      console.error("No fue posible leer las existencias guardadas.", error);
      setStorageError(
        error instanceof Error
          ? error.message
          : "No fue posible leer las existencias guardadas.",
      );
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady || storageError) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, quantities }),
      );
    } catch (error) {
      console.error("No fue posible guardar las existencias.", error);
      setStorageError("No fue posible guardar los cambios en este navegador.");
    }
  }, [quantities, storageReady, storageError]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort((a, b) =>
      a.localeCompare(b, "es"),
    ),
    [],
  );

  const productQuantities = useMemo(
    () =>
      products.map((product) => ({
        ...product,
        quantity: quantities[product.id] ?? 0,
      })),
    [quantities],
  );

  const totalUnits = useMemo(
    () => productQuantities.reduce((total, product) => total + product.quantity, 0),
    [productQuantities],
  );

  const lowStockCount = useMemo(
    () =>
      productQuantities.filter((product) => product.quantity <= LOW_STOCK_LIMIT)
        .length,
    [productQuantities],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return productQuantities
      .filter((product) => {
        const matchesSearch =
          !query ||
          product.name.toLocaleLowerCase("es").includes(query) ||
          product.id.toLocaleLowerCase("es").includes(query);
        const matchesCategory =
          category === "Todas las categorías" || product.category === category;
        const matchesStock =
          stockFilter === "todos" ||
          (stockFilter === "bajo" &&
            product.quantity <= LOW_STOCK_LIMIT &&
            product.quantity > 0) ||
          (stockFilter === "agotado" && product.quantity === 0);
        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [category, productQuantities, search, stockFilter]);

  function updateQuantity(productId, nextQuantity) {
    setQuantities((current) => ({ ...current, [productId]: nextQuantity }));
  }

  function downloadCsv() {
    const rows = [
      ["Clave", "Producto", "Categoría", "Unidad", "Existencias"],
      ...productQuantities.map((product) => [
        product.id,
        product.name,
        product.category,
        product.unit,
        product.quantity,
      ]),
    ];
    const csv = `\uFEFF${rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventario.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Inventario QR, inicio">
          <span className="brand-icon">
            <Boxes size={22} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="brand-name">
            inventario<span>qr</span>
          </span>
        </a>
        <span className="local-indicator">
          <span className="local-indicator-dot" />
          Guardado localmente
        </span>
      </header>

      <div className="page-content">
        <section className="welcome-section">
          <div>
            <p className="eyebrow">CONTROL DE ALMACÉN</p>
            <h1>Tu inventario, de un vistazo.</h1>
            <p className="welcome-subtitle">
              Consulta tus productos, escanea sus códigos QR y mantén las
              existencias al día.
            </p>
          </div>
          <button className="export-button" type="button" onClick={downloadCsv}>
            <ArrowUpFromLine size={16} aria-hidden="true" />
            Exportar inventario
          </button>
        </section>

        <section className="summary-grid" aria-label="Resumen del inventario">
          <div className="summary-card">
            <span className="summary-icon summary-icon-green">
              <Boxes size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="summary-label">Productos</p>
              <p className="summary-value">{products.length}</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon summary-icon-blue">
              <PackageOpen size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="summary-label">Unidades en inventario</p>
              <p className="summary-value">{totalUnits.toLocaleString("es-MX")}</p>
            </div>
          </div>
          <button
            className={`summary-card summary-card-clickable${stockFilter === "bajo" || stockFilter === "agotado" ? " summary-card-active" : ""}`}
            type="button"
            onClick={() => setStockFilter(stockFilter === "todos" ? "bajo" : "todos")}
            aria-pressed={stockFilter === "bajo"}
          >
            <span className="summary-icon summary-icon-amber">
              <TriangleAlert size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="summary-label">Por revisar <span className="summary-hint">≤ 5 uds.</span></span>
              <span className="summary-value">{lowStockCount}</span>
            </span>
            <span className="summary-link">
              {stockFilter === "bajo" ? "Ver todo" : "Revisar"}
            </span>
          </button>
        </section>

        <div className="notice" role="note">
          <span className="notice-icon">
            <Check size={16} aria-hidden="true" />
          </span>
          <p>
            Las existencias comienzan en cero: el archivo de inventario no
            contiene cantidades. Actualiza el stock de cada producto; los cambios
            se guardan automáticamente en este navegador.
          </p>
        </div>

        {storageError && (
          <div className="storage-warning" role="alert">
            <TriangleAlert size={17} aria-hidden="true" />
            <span>{storageError} Tus cambios podrían no guardarse.</span>
          </div>
        )}

        <section className="catalog-section" aria-label="Productos">
          <div className="catalog-heading">
            <div>
              <h2>Productos</h2>
              <p>
                Mostrando {filteredProducts.length} de {products.length} productos
              </p>
            </div>
            <span className="scan-hint">
              Los códigos QR contienen la clave de cada producto
            </span>
          </div>

          <div className="filters">
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Buscar producto o clave</span>
              <input
                type="search"
                placeholder="Buscar producto o clave..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="select-wrap">
              <span className="sr-only">Filtrar por categoría</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option>Todas las categorías</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="stock-tabs" role="group" aria-label="Filtrar por existencias">
              {[
                ["todos", "Todos"],
                ["bajo", "Stock bajo"],
                ["agotado", "Agotados"],
              ].map(([value, label]) => (
                <button
                  className={stockFilter === value ? "stock-tab stock-tab-active" : "stock-tab"}
                  type="button"
                  key={value}
                  onClick={() => setStockFilter(value)}
                  aria-pressed={stockFilter === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={product.quantity}
                  onQuantityChange={updateQuantity}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Search size={23} aria-hidden="true" />
              </span>
              <h3>No encontramos productos</h3>
              <p>Prueba otra búsqueda o cambia los filtros.</p>
              <button
                className="clear-filters"
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("Todas las categorías");
                  setStockFilter("todos");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>

        <footer className="page-footer">
          Las claves QR corresponden al inventario importado · Gestión de
          existencias para uso local
        </footer>
      </div>
    </main>
  );
}
