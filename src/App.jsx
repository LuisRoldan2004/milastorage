import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  ClipboardList,
  Download,
  History,
  LogOut,
  PackageOpen,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import products from "./data/products.json";

const STORAGE_KEY = "inventario-qr.registros.v1";
const LEGACY_STORAGE_KEY = "inventario-qr.existencias.v1";
const DEMO_TASK_ID = "inventario-general-demo";
const DEMO_TASK_NAME = "Inventario general · Demo";

const DEMO_USERS = [
  {
    id: "1001",
    name: "Lucía Martínez",
    pin: "1234",
    role: "admin",
  },
  {
    id: "2001",
    name: "Carlos Rivera",
    pin: "1234",
    role: "registrar",
  },
  {
    id: "2002",
    name: "Ana Gómez",
    pin: "1234",
    role: "registrar",
  },
];

const productById = new Map(products.map((product) => [product.id, product]));
const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function isValidRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.id === "string" &&
    typeof record.taskId === "string" &&
    typeof record.productId === "string" &&
    typeof record.productName === "string" &&
    typeof record.category === "string" &&
    typeof record.unit === "string" &&
    Number.isFinite(record.quantity) &&
    record.quantity >= 0 &&
    typeof record.createdBy === "string" &&
    typeof record.createdByName === "string" &&
    typeof record.createdAt === "string" &&
    Array.isArray(record.editHistory) &&
    record.editHistory.every(
      (edit) =>
        edit !== null &&
        typeof edit === "object" &&
        typeof edit.changedBy === "string" &&
        typeof edit.changedByName === "string" &&
        Number.isFinite(edit.fromQuantity) &&
        Number.isFinite(edit.toQuantity) &&
        typeof edit.changedAt === "string",
    )
  );
}

function parseRecords(raw) {
  const parsed = JSON.parse(raw);
  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.records) ||
    !parsed.records.every(isValidRecord)
  ) {
    throw new Error("Los registros guardados no tienen el formato esperado.");
  }
  const keys = parsed.records.map(
    (record) => `${record.taskId}:${record.productId}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("Hay registros duplicados para un mismo producto y tarea.");
  }
  return parsed.records;
}

function migrateLegacyRecords() {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null) return [];

  const parsed = JSON.parse(raw);
  if (
    parsed?.version !== 1 ||
    parsed.quantities === null ||
    typeof parsed.quantities !== "object" ||
    Array.isArray(parsed.quantities) ||
    !Object.values(parsed.quantities).every(
      (quantity) => Number.isSafeInteger(quantity) && quantity >= 0,
    )
  ) {
    throw new Error(
      "No se pudieron migrar las cantidades guardadas de la versión anterior.",
    );
  }

  const now = new Date().toISOString();
  return Object.entries(parsed.quantities)
    .filter(([productId]) => productById.has(productId))
    .map(([productId, quantity]) => {
      const product = productById.get(productId);
      return {
        id: `migrado-${productId}`,
        taskId: DEMO_TASK_ID,
        productId,
        productName: product.name,
        category: product.category,
        quantity,
        unit: product.unit || "Unidad",
        createdBy: "sistema",
        createdByName: "Inventario anterior",
        createdAt: now,
        updatedBy: "sistema",
        updatedByName: "Inventario anterior",
        updatedAt: now,
        editHistory: [],
      };
    });
}

function newId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha desconocida" : dateFormatter.format(date);
}

function formatQuantity(value) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(value);
}

function roleName(role) {
  return role === "admin" ? "Administrador" : "Registrador";
}

function StatusNotice({ children, tone = "success" }) {
  return (
    <div className={`status-notice status-notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {tone === "error" ? (
        <CircleAlert size={18} aria-hidden="true" />
      ) : (
        <Check size={18} aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <a className="brand" href="#" aria-label="Inventario QR, inicio">
      <span className="brand-icon">
        <Boxes size={21} strokeWidth={2.2} aria-hidden="true" />
      </span>
      {!compact && (
        <span className="brand-name">
          inventario<span>qr</span>
        </span>
      )}
    </a>
  );
}

function LoginScreen({ onLogin }) {
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const user = DEMO_USERS.find(
      (candidate) =>
        candidate.id === employeeId.trim() && candidate.pin === pin.trim(),
    );
    if (!user) {
      setError("El identificador o PIN no es correcto. Revisa las cuentas de demo.");
      return;
    }
    setError("");
    onLogin({ id: user.id, name: user.name, role: user.role });
  }

  return (
    <main className="login-page">
      <header className="login-topbar">
        <Brand />
        <span className="demo-badge">DEMO LOCAL</span>
      </header>
      <div className="login-layout">
        <section className="login-intro">
          <div className="login-decoration login-decoration-one" />
          <div className="login-decoration login-decoration-two" />
          <p className="eyebrow">CONTROL DE INVENTARIO</p>
          <h1>Un inventario claro. Un equipo conectado.</h1>
          <p className="login-intro-copy">
            Escanea los productos en el almacén, registra lo que encontraste y
            consulta la actividad de tu equipo.
          </p>
          <div className="login-feature-list">
            <div className="login-feature">
              <span><QrCode size={18} aria-hidden="true" /></span>
              <div><strong>Escaneo de productos</strong><small>La clave QR identifica cada producto.</small></div>
            </div>
            <div className="login-feature">
              <span><History size={18} aria-hidden="true" /></span>
              <div><strong>Registro con historial</strong><small>Cada cambio conserva quién lo realizó.</small></div>
            </div>
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <span className="login-card-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
          <p className="eyebrow">PORTAL DEL EQUIPO</p>
          <h2 id="login-title">Inicia sesión</h2>
          <p className="login-card-subtitle">Ingresa con tu identificador de empleado y PIN.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="employee-id">Identificador de empleado</label>
            <div className="login-input">
              <UserRound size={17} aria-hidden="true" />
              <input
                autoComplete="username"
                id="employee-id"
                inputMode="numeric"
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="Ej. 2001"
                required
                value={employeeId}
              />
            </div>
            <label htmlFor="employee-pin">PIN</label>
            <input
              autoComplete="current-password"
              className="pin-input"
              id="employee-pin"
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Ingresa tu PIN"
              required
              type="password"
              value={pin}
            />
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit">
              Ingresar <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="demo-accounts">
            <p className="demo-accounts-title">Cuentas de prueba</p>
            {DEMO_USERS.map((user) => (
              <button
                className="demo-account"
                key={user.id}
                onClick={() => {
                  setEmployeeId(user.id);
                  setPin(user.pin);
                  setError("");
                }}
                type="button"
              >
                <span className={`demo-avatar demo-avatar-${user.role}`}>
                  {user.role === "admin" ? <ShieldCheck size={15} /> : <Smartphone size={15} />}
                </span>
                <span className="demo-account-info">
                  <strong>{user.name}</strong>
                  <small>{roleName(user.role)} · ID {user.id}</small>
                </span>
                <span className="demo-account-enter">Usar <span aria-hidden="true">→</span></span>
              </button>
            ))}
            <p className="demo-pin-note">PIN de las cuentas de prueba: <strong>1234</strong></p>
          </div>
        </section>
      </div>
      <p className="login-disclaimer">
        Demostración local · No usar con información real ni PINs de empleados.
      </p>
    </main>
  );
}

function AppHeader({ user, onLogout, activePage, onPageChange }) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <Brand />
        {user.role === "admin" && (
          <nav className="main-nav" aria-label="Navegación principal">
            <button
              className={`nav-link${activePage === "records" ? " nav-link-active" : ""}`}
              onClick={() => onPageChange("records")}
              type="button"
            >
              <ClipboardList size={16} aria-hidden="true" /> Registros
            </button>
            <button
              className={`nav-link${activePage === "catalog" ? " nav-link-active" : ""}`}
              onClick={() => onPageChange("catalog")}
              type="button"
            >
              <QrCode size={16} aria-hidden="true" /> Catálogo QR
            </button>
          </nav>
        )}
        <div className="user-menu">
          <span className="demo-header-chip">
            <i aria-hidden="true" /> DEMO · solo este navegador
          </span>
          <span className={`role-chip role-chip-${user.role}`}>
            {user.role === "admin" ? <ShieldCheck size={13} /> : <Smartphone size={13} />}
            {roleName(user.role)}
          </span>
          <div className="user-identity">
            <strong>{user.name}</strong>
            <span>Empleado {user.id}</span>
          </div>
          <button className="logout-button" onClick={onLogout} title="Cerrar sesión" type="button">
            <LogOut size={17} aria-hidden="true" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function MetricCard({ icon: Icon, label, value, tone = "green", detail }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon metric-icon-${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <div className="metric-content">
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </article>
  );
}

function ProductQrCard({ product, quantity, registration }) {
  return (
    <article className="admin-product-card">
      <div className="admin-product-head">
        <div className="admin-product-copy">
          <span className="category-label">{product.category}</span>
          <h3 title={product.name}>{product.name}</h3>
          <p>Clave <strong>{product.id}</strong></p>
        </div>
        <span className={`qr-thumb${registration ? "" : " qr-thumb-muted"}`}>
          <QRCodeSVG value={product.id} size={64} level="M" marginSize={1} />
        </span>
      </div>
      <div className="admin-product-foot">
        <span><PackageOpen size={15} /> {product.unit || "Unidad"}</span>
        {registration ? (
          <strong className="product-quantity">{formatQuantity(quantity)} <small>{product.unit}</small></strong>
        ) : (
          <span className="not-counted">Sin capturar</span>
        )}
      </div>
    </article>
  );
}

function AdminDashboard({ records, setPage }) {
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("todos");
  const [expandedRecord, setExpandedRecord] = useState("");

  const activeRecords = useMemo(
    () => records.filter((record) => record.taskId === DEMO_TASK_ID),
    [records],
  );
  const registeredEmployeeIds = useMemo(
    () => [
      ...new Set(
        activeRecords
          .map((record) => record.createdBy)
          .filter((employeeId) =>
            DEMO_USERS.some(
              (user) => user.id === employeeId && user.role === "registrar",
            ),
          ),
      ),
    ],
    [activeRecords],
  );
  const pendingCount = Math.max(0, products.length - activeRecords.length);

  const employees = useMemo(() => {
    const summaries = new Map();
    for (const record of activeRecords) {
      if (record.createdBy === "sistema") continue;
      const current = summaries.get(record.createdBy) ?? {
        id: record.createdBy,
        name: record.createdByName,
        count: 0,
        updatedAt: record.updatedAt || record.createdAt,
      };
      current.count += 1;
      if (new Date(record.updatedAt || record.createdAt) > new Date(current.updatedAt)) {
        current.updatedAt = record.updatedAt || record.createdAt;
      }
      summaries.set(record.createdBy, current);
    }
    return [...summaries.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [activeRecords]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return [...activeRecords]
      .filter((record) => {
        const matchesQuery =
          !query ||
          record.productName.toLocaleLowerCase("es").includes(query) ||
          record.productId.includes(query) ||
          record.createdByName.toLocaleLowerCase("es").includes(query) ||
          (record.updatedByName || "").toLocaleLowerCase("es").includes(query);
        const matchesEmployee =
          employeeFilter === "todos" || record.createdBy === employeeFilter;
        return matchesQuery && matchesEmployee;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
      );
  }, [activeRecords, employeeFilter, search]);

  function downloadCsv() {
    const rows = [
      ["Tarea", "Clave", "Producto", "Categoría", "Cantidad", "Unidad", "Registró", "ID empleado", "Fecha registro", "Última modificación", "Modificó"],
      ...filteredRecords.map((record) => [
        DEMO_TASK_NAME,
        record.productId,
        record.productName,
        record.category,
        record.quantity,
        record.unit,
        record.createdByName,
        record.createdBy,
        formatDate(record.createdAt),
        formatDate(record.updatedAt || record.createdAt),
        record.updatedByName || record.createdByName,
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
    link.download = "registros-inventario-demo.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="dashboard-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PANEL DE ADMINISTRACIÓN</p>
          <h1>Resumen del inventario</h1>
          <p>Supervisa las capturas del equipo y revisa el historial de cada producto.</p>
        </div>
        <span className="task-chip">
          <ClipboardList size={15} aria-hidden="true" />
          {DEMO_TASK_NAME}
        </span>
      </section>

      <section className="metrics-grid" aria-label="Resumen del inventario">
        <MetricCard icon={QrCode} label="Productos capturados" value={activeRecords.length} detail={`de ${products.length} en el catálogo`} tone="green" />
        <MetricCard icon={Boxes} label="Pendientes de contar" value={pendingCount} detail="productos en esta tarea" tone="blue" />
        <MetricCard icon={Users} label="Registradores activos" value={registeredEmployeeIds.length} detail="con registros en esta tarea" tone="amber" />
      </section>

      <section className="team-section">
        <div className="section-title-row">
          <div>
            <h2>Actividad del equipo</h2>
            <p>Productos con registro por empleado; las cantidades conservan su unidad.</p>
          </div>
          <button className="subtle-button" onClick={() => setPage("catalog")} type="button">
            Ver catálogo QR <span aria-hidden="true">→</span>
          </button>
        </div>
        {employees.length ? (
          <div className="employee-grid">
            {employees.map((employee) => (
              <article className="employee-card" key={employee.id}>
                <span className="employee-avatar"><UserRound size={18} aria-hidden="true" /></span>
                <div className="employee-details">
                  <strong>{employee.name}</strong>
                  <span>ID empleado {employee.id}</span>
                </div>
                <div className="employee-activity">
                  <strong>{employee.count}</strong>
                  <span>{employee.count === 1 ? "producto" : "productos"}</span>
                </div>
                <p className="employee-last">Última actividad · {formatDate(employee.updatedAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <span className="empty-panel-icon"><Users size={20} /></span>
            <strong>Aún no hay capturas del equipo</strong>
            <p>Los registros de los empleados aparecerán aquí al guardar un producto.</p>
          </div>
        )}
      </section>

      <section className="records-section">
        <div className="section-title-row">
          <div>
            <h2>Historial de registros</h2>
            <p>{activeRecords.length} {activeRecords.length === 1 ? "producto registrado" : "productos registrados"} · Una fila por producto en esta tarea</p>
          </div>
          <button className="outline-button" disabled={!filteredRecords.length} onClick={downloadCsv} type="button">
            <Download size={15} aria-hidden="true" /> Exportar CSV
          </button>
        </div>

        <div className="records-filters">
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Buscar por producto, clave o empleado</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto, clave o empleado..."
              type="search"
              value={search}
            />
          </label>
          <label className="select-wrap">
            <span className="sr-only">Filtrar por empleado</span>
            <select onChange={(event) => setEmployeeFilter(event.target.value)} value={employeeFilter}>
              <option value="todos">Todos los empleados</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredRecords.length ? (
          <div className="records-table-wrap">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad encontrada</th>
                  <th>Registró</th>
                  <th>Última actividad</th>
                  <th>Historial</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const editorName = record.updatedByName || record.createdByName;
                  return (
                    <tr key={record.id}>
                      <td>
                        <div className="table-product">
                          <span className="table-product-qr"><QRCodeSVG value={record.productId} size={33} /></span>
                          <span><strong>{record.productName}</strong><small>Clave {record.productId} · {record.category}</small></span>
                        </div>
                      </td>
                      <td className="table-quantity">
                        <strong>{formatQuantity(record.quantity)}</strong>
                        <span>{record.unit}</span>
                      </td>
                      <td>
                        <strong className="table-person">{record.createdByName}</strong>
                        <small className="table-secondary">ID {record.createdBy}</small>
                      </td>
                      <td>
                        <strong className="table-person">{formatDate(record.updatedAt || record.createdAt)}</strong>
                        {editorName !== record.createdByName && (
                          <small className="table-secondary">Modificó: {editorName}</small>
                        )}
                        {editorName === record.createdByName && (
                          <small className="table-secondary">Captura original</small>
                        )}
                      </td>
                      <td>
                        {record.editHistory.length ? (
                          <button
                            className="history-toggle"
                            onClick={() => setExpandedRecord(expandedRecord === record.id ? "" : record.id)}
                            type="button"
                          >
                            <History size={14} aria-hidden="true" />
                            {record.editHistory.length} {record.editHistory.length === 1 ? "cambio" : "cambios"}
                          </button>
                        ) : (
                          <span className="no-edits">Sin cambios</span>
                        )}
                        {expandedRecord === record.id && (
                          <div className="edit-history">
                            {record.editHistory.map((edit, index) => (
                              <p key={`${record.id}-${edit.changedAt}-${index}`}>
                                <strong>{edit.changedByName}</strong> · {formatQuantity(edit.fromQuantity)} → {formatQuantity(edit.toQuantity)} {record.unit}
                                <small>{formatDate(edit.changedAt)}</small>
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-panel empty-panel-table">
            <span className="empty-panel-icon"><ClipboardList size={20} /></span>
            <strong>{activeRecords.length ? "No hay resultados para estos filtros" : "Aún no hay registros"}</strong>
            <p>{activeRecords.length ? "Prueba con otro nombre, clave o empleado." : "Cuando el equipo capture productos, aparecerán aquí con su cantidad y unidad."}</p>
          </div>
        )}
      </section>
      <footer className="app-footer">Los registros se almacenan solo en este navegador durante la demostración.</footer>
    </main>
  );
}

function AdminCatalog({ records }) {
  const [search, setSearch] = useState("");
  const inventoryTotals = useMemo(() => {
    const totals = new Map();
    for (const record of records) {
      if (record.taskId === DEMO_TASK_ID) {
        totals.set(
          record.productId,
          (totals.get(record.productId) || 0) + record.quantity,
        );
      }
    }
    return totals;
  }, [records]);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return products
      .filter(
        (product) =>
          !query ||
          product.name.toLocaleLowerCase("es").includes(query) ||
          product.id.includes(query) ||
          product.category.toLocaleLowerCase("es").includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [search]);

  return (
    <main className="dashboard-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">CATÁLOGO DE PRODUCTOS</p>
          <h1>Productos y códigos QR</h1>
          <p>La etiqueta identifica el producto; la cantidad se captura una vez por tarea.</p>
        </div>
        <span className="catalog-count"><Boxes size={16} /> {products.length} productos</span>
      </section>
      <label className="search-box catalog-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Buscar producto o clave</span>
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por producto, clave o categoría..." type="search" value={search} />
      </label>
      <div className="admin-product-grid">
        {visibleProducts.map((product) => {
          const quantity = inventoryTotals.get(product.id);
          const record = quantity === undefined ? null : { quantity };
          return (
            <ProductQrCard
              key={product.id}
              product={product}
              quantity={quantity}
              registration={record}
            />
          );
        })}
      </div>
      {!visibleProducts.length && (
        <div className="empty-panel">
          <span className="empty-panel-icon"><Search size={20} /></span>
          <strong>No encontramos productos</strong>
          <p>Prueba con otro nombre, clave o categoría.</p>
        </div>
      )}
      <footer className="app-footer">Los QR conservan la clave del inventario original · La cantidad y unidad se guardan en el registro.</footer>
    </main>
  );
}

function Scanner({ onScan }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");

  onScanRef.current = onScan;

  useEffect(() => {
    if (!cameraOpen) return undefined;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite usar la cámara. Usa una conexión segura (HTTPS) o escribe la clave manualmente.");
      setCameraOpen(false);
      return undefined;
    }

    let active = true;
    let hasScanned = false;

    import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (!active) return undefined;
        const reader = new BrowserQRCodeReader();
        return reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (!active || !result || hasScanned) return;
            hasScanned = true;
            controlsRef.current?.stop();
            setCameraOpen(false);
            setError("");
            onScanRef.current(result.getText());
          },
        );
      })
      .then((controls) => {
        if (active && controls) {
          controlsRef.current = controls;
        } else {
          controls?.stop();
        }
      })
      .catch((scanError) => {
        if (!active) return;
        console.error("No fue posible iniciar la cámara.", scanError);
        const message =
          scanError?.name === "NotAllowedError"
            ? "Permite el acceso a la cámara en tu navegador y vuelve a intentarlo."
            : scanError?.name === "NotFoundError"
              ? "No encontramos una cámara disponible en este dispositivo."
              : "No se pudo abrir la cámara. Comprueba los permisos y que la página use HTTPS.";
        setError(message);
        setCameraOpen(false);
      });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraOpen]);

  function startCamera() {
    setError("");
    setCameraOpen(true);
  }

  function stopCamera() {
    controlsRef.current?.stop();
    setCameraOpen(false);
  }

  return (
    <section className={`scanner-panel${cameraOpen ? " scanner-panel-open" : ""}`}>
      <div className="scanner-panel-heading">
        <div>
          <span className="scanner-title-icon"><QrCode size={19} aria-hidden="true" /></span>
          <span><strong>Escanear producto</strong><small>Apunta la cámara al QR de la etiqueta.</small></span>
        </div>
        {cameraOpen && <span className="camera-live"><i /> Cámara activa</span>}
      </div>
      <div className={`camera-frame${cameraOpen ? " camera-frame-active" : ""}`}>
        <video aria-label="Vista de la cámara para escanear productos" muted playsInline ref={videoRef} />
        {!cameraOpen && (
          <div className="camera-placeholder">
            <span className="camera-placeholder-icon"><QrCode size={30} aria-hidden="true" /></span>
            <strong>Escanea el código QR</strong>
            <span>Se activa la cámara posterior del dispositivo.</span>
            <button className="camera-button" onClick={startCamera} type="button">
              <Camera size={17} aria-hidden="true" /> Activar cámara
            </button>
          </div>
        )}
        {cameraOpen && (
          <div className="camera-focus" aria-hidden="true"><span /><i /></div>
        )}
      </div>
      {error && <StatusNotice tone="error">{error}</StatusNotice>}
      {cameraOpen && (
        <button className="camera-stop-button" onClick={stopCamera} type="button">
          <CameraOff size={16} aria-hidden="true" /> Detener cámara
        </button>
      )}
      {!cameraOpen && !error && (
        <p className="camera-tip">Si no puedes usar la cámara, ingresa la clave manualmente.</p>
      )}
    </section>
  );
}

function RegistrarDashboard({ user, records, onSaveRecord }) {
  const [manualId, setManualId] = useState("");
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const currentRecord = useMemo(
    () =>
      product
        ? records.find(
            (record) =>
              record.taskId === DEMO_TASK_ID && record.productId === product.id,
          ) || null
        : null,
    [product, records],
  );

  const myRecords = useMemo(
    () =>
      records
        .filter((record) => record.createdBy === user.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt) -
            new Date(a.updatedAt || a.createdAt),
        ),
    [records, user.id],
  );

  const suggestions = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");
    if (!value) return [];
    return products
      .filter(
        (item) =>
          item.id.includes(value) ||
          item.name.toLocaleLowerCase("es").includes(value),
      )
      .slice(0, 5);
  }, [query]);

  const handleScan = useCallback((code) => {
    const normalizedCode = String(code).trim();
    const found = productById.get(normalizedCode);
    setMessage("");
    setError("");
    if (!found) {
      setProduct(null);
      setError(`No encontramos la clave «${normalizedCode}» en el catálogo.`);
      return;
    }
    const existing = recordsRef.current.find(
      (record) => record.taskId === DEMO_TASK_ID && record.productId === found.id,
    );
    setProduct(found);
    setQuantity(existing ? String(existing.quantity) : "");
    setError("");
    setMessage("");
  }, []);

  function selectProduct(found) {
    setQuery("");
    setMessage("");
    setError("");
    handleScan(found.id);
  }

  function handleManualSubmit(event) {
    event.preventDefault();
    handleScan(manualId);
  }

  function submitRecord(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!product) return;
    const parsedQuantity = Number(quantity);
    if (
      quantity.trim() === "" ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity < 0 ||
      (product.unit === "PZA" && !Number.isInteger(parsedQuantity))
    ) {
      if (product.unit === "PZA" && Number.isFinite(parsedQuantity) && !Number.isInteger(parsedQuantity)) {
        setError("Ingresa una cantidad entera para los productos por pieza.");
        return;
      }
      setError("Ingresa una cantidad válida, igual o mayor que cero.");
      return;
    }
    const saved = onSaveRecord(product, parsedQuantity, user);
    if (!saved.ok) {
      setError(saved.error);
      if (saved.existingRecord) {
        setQuantity(String(saved.existingRecord.quantity));
      }
      return;
    }
    setQuantity(String(saved.record.quantity));
    setMessage(saved.updated ? "Registro actualizado. El historial conserva quién realizó cada cambio." : "Producto registrado correctamente.");
  }

  return (
    <main className="registrar-page">
      <section className="registrar-welcome">
        <div>
          <p className="eyebrow">CAPTURA DE INVENTARIO</p>
          <h1>Hola, {user.name.split(" ")[0]} <span aria-hidden="true">👋</span></h1>
          <p>Escanea un producto, confirma la unidad del catálogo e ingresa la cantidad encontrada.</p>
        </div>
        <div className="registrar-task"><ClipboardList size={15} /><span><small>Tarea activa</small><strong>{DEMO_TASK_NAME}</strong></span></div>
      </section>

      <section className="registrar-workspace">
        <div className="registrar-capture">
          <Scanner onScan={handleScan} />
          <div className="manual-search-panel">
            <div className="manual-heading"><strong>Ingresar clave manualmente</strong><span>Alternativa a la cámara</span></div>
            <form className="manual-form" onSubmit={handleManualSubmit}>
              <label className="search-box">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Buscar producto o ingresar clave</span>
                <input
                  autoComplete="off"
                  onChange={(event) => {
                    setManualId(event.target.value);
                    setQuery(event.target.value);
                  }}
                  placeholder="Nombre del producto o clave QR..."
                  value={manualId}
                />
              </label>
              <button className="outline-button" type="submit">Buscar clave</button>
            </form>
            {suggestions.length > 0 && (
              <div className="product-suggestions">
                {suggestions.map((item) => (
                  <button key={item.id} onClick={() => selectProduct(item)} type="button">
                    <span><strong>{item.name}</strong><small>Clave {item.id} · {item.category}</small></span>
                    <span className="suggestion-unit">{item.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="capture-side">
          <div className="capture-form-card">
            <div className="capture-form-heading">
              <span className="capture-step">01</span>
              <span><strong>Producto encontrado</strong><small>Confirma los datos antes de guardar.</small></span>
            </div>
            {product ? (
              <>
                <div className="selected-product">
                  <span className="selected-product-qr"><QRCodeSVG value={product.id} size={54} /></span>
                  <span><small>{product.category} · Clave {product.id}</small><strong>{product.name}</strong></span>
                </div>
                {currentRecord && (
                  <div className="duplicate-notice" role="status">
                    <History size={16} aria-hidden="true" />
                    <span>
                      <strong>Este producto ya tiene registro.</strong>
                      Cantidad actual: {formatQuantity(currentRecord.quantity)} {currentRecord.unit}, capturada por {currentRecord.createdByName}. Guarda solo si vas a corregirla.
                    </span>
                  </div>
                )}
                <form className="quantity-form" onSubmit={submitRecord}>
                  <label htmlFor="found-quantity">Cantidad encontrada</label>
                  <div className="quantity-entry">
                    <input
                      autoComplete="off"
                      id="found-quantity"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="0"
                      required
                      step={product.unit === "PZA" ? "1" : "any"}
                      type="number"
                      value={quantity}
                    />
                    <span className="quantity-unit">{product.unit || "Unidad"}</span>
                  </div>
                  <p className="unit-locked-note"><PackageOpen size={14} /> Unidad tomada del catálogo · no editable</p>
                  {error && <StatusNotice tone="error">{error}</StatusNotice>}
                  {message && <StatusNotice>{message}</StatusNotice>}
                  <button className="primary-button save-record-button" type="submit">
                    {currentRecord ? <History size={16} /> : <Check size={16} />}
                    {currentRecord ? "Guardar corrección" : "Guardar registro"}
                  </button>
                </form>
              </>
            ) : (
              <div className="capture-empty">
                <span><QrCode size={25} aria-hidden="true" /></span>
                <strong>Esperando un producto</strong>
                <p>Escanea el QR o ingresa una clave para comenzar el registro.</p>
              </div>
            )}
          </div>

          <section className="my-history">
            <div className="my-history-heading">
              <span><History size={17} aria-hidden="true" /></span>
              <div><strong>Mis registros previos</strong><small>{myRecords.length} {myRecords.length === 1 ? "producto" : "productos"} en esta demo</small></div>
            </div>
            {myRecords.length ? (
              <div className="my-history-list">
                {myRecords.slice(0, 5).map((record) => (
                  <button
                    className="my-history-row"
                    key={record.id}
                    onClick={() => {
                      const found = productById.get(record.productId);
                      if (found) {
                        setProduct(found);
                        setQuantity(String(record.quantity));
                        setMessage("");
                        setError("");
                      }
                    }}
                    type="button"
                  >
                    <span className="history-product-info"><strong>{record.productName}</strong><small>Clave {record.productId} · {formatDate(record.updatedAt || record.createdAt)}</small></span>
                    <span className="history-quantity">{formatQuantity(record.quantity)} <small>{record.unit}</small></span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="history-empty">Aquí aparecerán los productos que registres.</p>
            )}
          </section>
        </aside>
      </section>
      <footer className="app-footer">Registrador · Empleado {user.id} · Los registros se guardan localmente en este navegador.</footer>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [activePage, setActivePage] = useState("records");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setRecords(parseRecords(stored));
      } else {
        const migrated = migrateLegacyRecords();
        setRecords(migrated);
        if (migrated.length) {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: 1, records: migrated }),
          );
        }
      }
    } catch (error) {
      console.error("No fue posible cargar el historial de inventario.", error);
      setStorageError(
        error instanceof Error ? error.message : "No fue posible leer los registros guardados.",
      );
    } finally {
      setDataReady(true);
    }
  }, []);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY || event.newValue === null) return;
      try {
        setRecords(parseRecords(event.newValue));
        setStorageError("");
      } catch (error) {
        console.error("No fue posible sincronizar el historial entre pestañas.", error);
        setStorageError("No se pudieron sincronizar los registros guardados en otra pestaña.");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveRecord = useCallback(
    (product, quantity, currentUser) => {
      if (!dataReady || storageError) {
        return { ok: false, error: "No se puede guardar hasta que se recupere el historial del navegador." };
      }

      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const currentRecords = stored === null ? records : parseRecords(stored);
        const existingIndex = currentRecords.findIndex(
          (record) =>
            record.taskId === DEMO_TASK_ID && record.productId === product.id,
        );
        const now = new Date().toISOString();
        let nextRecord;
        let updated = false;

        if (existingIndex >= 0) {
          const existingRecord = currentRecords[existingIndex];
          if (existingRecord.quantity === quantity) {
            setRecords(currentRecords);
            return {
              ok: false,
              error: `Este producto ya está registrado con ${formatQuantity(quantity)} ${existingRecord.unit}. Cambia la cantidad para guardar una corrección.`,
              existingRecord,
            };
          }
          updated = true;
          nextRecord = {
            ...existingRecord,
            updatedBy: currentUser.id,
            updatedByName: currentUser.name,
            updatedAt: now,
            editHistory: [
              ...existingRecord.editHistory,
              {
                changedBy: currentUser.id,
                changedByName: currentUser.name,
                fromQuantity: existingRecord.quantity,
                toQuantity: quantity,
                changedAt: now,
              },
            ],
            quantity,
          };
        } else {
          if (quantity <= 0) {
            return { ok: false, error: "Ingresa una cantidad mayor que cero para registrar un producto encontrado." };
          }
          nextRecord = {
            id: newId(),
            taskId: DEMO_TASK_ID,
            productId: product.id,
            productName: product.name,
            category: product.category,
            quantity,
            unit: product.unit || "Unidad",
            createdBy: currentUser.id,
            createdByName: currentUser.name,
            createdAt: now,
            updatedBy: currentUser.id,
            updatedByName: currentUser.name,
            updatedAt: now,
            editHistory: [],
          };
        }

        const nextRecords =
          existingIndex >= 0
            ? currentRecords.map((record, index) =>
                index === existingIndex ? nextRecord : record,
              )
            : [...currentRecords, nextRecord];
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, records: nextRecords }),
        );
        setRecords(nextRecords);
        setStorageError("");
        return { ok: true, record: nextRecord, updated };
      } catch (error) {
        console.error("No fue posible guardar el registro del producto.", error);
        const message =
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "El almacenamiento local está lleno; elimina datos del navegador o prepara el servidor central."
            : "No se pudo guardar en este navegador. Revisa sus permisos de almacenamiento.";
        return { ok: false, error: message };
      }
    },
    [dataReady, records, storageError],
  );

  if (!dataReady) {
    return (
      <main className="loading-screen">
        <span className="brand-icon"><Boxes size={21} /></span>
        <p>Cargando el inventario…</p>
      </main>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  const adminPage = user.role === "admin" ? activePage : "registrar";
  return (
    <div className="app-shell">
      <AppHeader
        user={user}
        activePage={adminPage}
        onLogout={() => {
          setUser(null);
          setActivePage("records");
        }}
        onPageChange={setActivePage}
      />
      {storageError && (
        <div className="global-storage-error">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{storageError} No realices nuevas capturas hasta resolverlo.</span>
        </div>
      )}
      {user.role === "admin" ? (
        adminPage === "catalog" ? (
          <AdminCatalog records={records} />
        ) : (
          <AdminDashboard records={records} setPage={setActivePage} />
        )
      ) : (
        <RegistrarDashboard key={user.id} user={user} records={records} onSaveRecord={saveRecord} />
      )}
    </div>
  );
}
