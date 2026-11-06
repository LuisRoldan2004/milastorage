# Inventario QR

Aplicación local de React + Vite para consultar los productos del inventario, ver el QR asociado a su clave y registrar existencias. Los datos se guardan en `localStorage` del navegador donde se abre la aplicación. La hoja original no incluye cantidades, así que los artículos empiezan con existencia cero.

## Iniciar la aplicación

Requiere Node.js y npm. Desde la carpeta del proyecto:

```powershell
npm install
npm run dev
```

Abre la dirección local que muestra Vite en la terminal. Para preparar una versión de producción, usa `npm run build`.

## Actualizar los productos desde Excel

Coloca el archivo `.xls` actualizado junto a `inventario03112026.xls` o indica su ruta al importador. El script requiere Python y `xlrd`:

```powershell
python -m pip install xlrd
python scripts/import_inventory.py
```

Para elegir otro archivo:

```powershell
python scripts/import_inventory.py "C:\ruta\inventario.xls"
```

El importador reemplaza `src/data/products.json`; reinicia Vite para ver los nuevos productos. Las existencias registradas en este navegador se guardan por separado y se relacionan con cada clave.

## Notas

- Cada QR contiene la clave del producto, lista para escanear.
- El filtro de stock bajo incluye existencias entre 1 y 5; el filtro de agotados muestra cantidades en cero.
- **Exportar inventario** descarga un CSV con claves, productos y cantidades actuales.
- El navegador no sincroniza ni comparte automáticamente los cambios entre computadoras o usuarios. Para uso compartido o multiusuario se necesitaría agregar una base de datos y un servidor.
