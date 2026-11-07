# Inventario QR

Demo local de React + Vite para consultar los productos del inventario, registrar capturas de empleados con QR y revisar el historial. Los registros se guardan en `localStorage` del navegador donde se abre la aplicación: no se comparten con otros equipos o navegadores. La hoja original no incluye cantidades.

## Iniciar la aplicación

Requiere Node.js y npm. Desde la carpeta del proyecto:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la dirección local que muestra Vite en la terminal. Para preparar una versión de producción, usa `npm.cmd run build`.

## Iniciar sesión en la demo

La pantalla de acceso incluye selectores de cuentas de prueba. También puedes usar estas cuentas:

| Rol | Identificador | PIN |
|---|---|---|
| Administradora | `1001` | `1234` |
| Registrador | `2001` | `1234` |
| Registradora | `2002` | `1234` |

El inicio de sesión, los roles y los PIN están simulados en el cliente para facilitar la demostración. **No son una medida de seguridad y no deben usarse para proteger datos reales.** No guardes PIN personales ni información sensible en esta demo.

### Registradores

- La cámara identifica el QR existente del producto; también se puede ingresar su clave manualmente.
- La unidad de medida se toma del catálogo y no se puede cambiar al capturar.
- Las cantidades para unidades `PZA` deben ser enteras; unidades como `KGS` aceptan decimales.
- Al guardar, la cantidad debe ser mayor que cero. Una corrección de un producto ya capturado puede dejar su cantidad en cero.
- Cada producto tiene una sola captura en la tarea de demostración. Al volver a escanearlo se muestra la cantidad previa; una corrección explícita actualiza el registro y añade al historial quién la hizo.
- Se muestran los registros previos del empleado que inició sesión.

### Administradores

- Consulta los productos registrados, los pendientes y la actividad de cada empleado.
- Revisa quién realizó la captura original, quién modificó la cantidad y el historial de cambios.
- Usa **Catálogo QR** para ver el código asociado a cada clave y las cantidades registradas; exporta el historial a CSV.
- Usa **Cargar XLS** para importar un archivo `.xls` o `.xlsx` con vista previa. Se requieren las columnas `clave` y `descripcion`; `descripciongrupo`, `grupo` y `unidad` son opcionales. Se conservan los ceros iniciales de las claves.
- La carga combina el archivo con el catálogo actual: actualiza las claves coincidentes, añade las nuevas y conserva los productos omitidos. No modifica las cantidades ni el historial guardados.
- Para un producto que ya tiene una captura, no se cambia la unidad si el Excel indica otra: la vista previa avisa y conserva la unidad vigente para evitar interpretar mal las cantidades registradas.
- Archivos de hasta 10 MB. El navegador los lee localmente; no se suben a un servidor. Las claves duplicadas o filas con clave/descripción incompletas rechazan el archivo completo.

### Cámara en móvil

El navegador solo permite utilizar la cámara en un contexto seguro: `localhost` o una dirección servida por **HTTPS**, y después de otorgar permiso. Una dirección de red local con HTTP normal puede impedir el acceso a la cámara; si eso ocurre, se puede buscar la clave manualmente.

## Actualizar los productos al desarrollar

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

- Cada QR contiene la clave del producto y se reutiliza para contar sus existencias. No es necesario generar otro código por cada unidad encontrada.
- La demo utiliza una sola tarea general. No declara tareas por zona ni coordina capturas simultáneas entre distintos equipos.
- La versión anterior de cantidades se migra al historial local cuando se abre la demo por primera vez.
- El navegador no sincroniza ni comparte automáticamente los cambios entre computadoras o usuarios.

## Recomendación para el sistema central

Cuando la demo se convierta en el sistema del equipo, una API y una base de datos compartida deberán validar los roles (no solo la interfaz), autenticar cada identificador con un PIN almacenado únicamente en forma segura, y guardar cada captura como un registro auditable. Para impedir duplicados simultáneos, la base de datos debe imponer una restricción única por **tarea + producto**, guardar cantidades y su unidad de catálogo y añadir cada corrección al historial dentro de una transacción. Si se divide el conteo entre registradores, las tareas deben asignar áreas o categorías y evitar asignaciones solapadas.

El QR identifica el producto, no cada pieza. Solo hacen falta códigos únicos por unidad cuando se desea rastrear objetos individualmente (por ejemplo, equipo con número de serie), no para el conteo de existencias agrupadas que utiliza esta demo. Las cantidades de distintas unidades (por ejemplo, piezas y kilogramos) deben conservarse por separado, no sumarse como una cifra común.
