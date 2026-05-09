# Inventario tecnico para CUSTOMS_COMPLIANCE

Fecha de inventario: 2026-05-09

## 1. Resumen ejecutivo

El repositorio actual es una aplicacion Next.js 16.2.2 con React 19 orientada a dashboard y carga documental. La arquitectura local no contiene todavia el pipeline completo de auditoria documental descrito para STPS/PEMEX: no hay scripts Python, carpetas `incoming`, `processing`, `processed`, `reports`, `norms`, `catalog`, motor local de chunking, generador PDF local, bot Telegram ni reglas normativas ejecutables en este checkout.

Lo que si existe es una primera capa web reutilizable:

- Dashboard ejecutivo con datos mock de auditorias, hallazgos, modulos, bitacora y detalle.
- Pantalla de nueva auditoria con formulario mock de contexto, contratante, contratista, riesgo y carga multiple.
- Pantalla real de carga de un PDF individual para auditoria documental.
- Endpoint `POST /api/auditor/upload` que valida PDF, persiste el archivo en temporal y delega a un backend remoto si `AUDITOR_PIPELINE_URL` esta configurado.
- Fallback local que confirma almacenamiento pero no ejecuta extraccion, chunking, auditoria ni generacion de reporte.

Para extender la plataforma hacia `CUSTOMS_COMPLIANCE`, la recomendacion es **extend** con una refactorizacion acotada: conservar el dashboard y el contrato de carga, pero introducir una capa de frameworks/audit modules, modelos JSON versionados, extractores por tipo documental y reglas configurables. La plataforma aun esta en buen momento para desacoplar supuestos STPS/PEMEX antes de consolidar deuda tecnica.

## 2. Mapa de arquitectura actual

### Aplicacion web y ruteo

- `app/layout.tsx`: layout raiz App Router. Define metadata generica de Create Next App y HTML en ingles.
- `app/page.tsx`: dashboard principal con KPIs, auditorias recientes, hallazgos y resumen de modulos.
- `app/nueva-auditoria/page.tsx`: flujo visual para crear auditoria; actualmente usa datos mock y no ejecuta backend.
- `app/auditorias/[id]/page.tsx`: detalle de auditoria por ID mock; usa `params` asincrono, consistente con App Router de Next 16.
- `app/dashboard/documentacion-contratista/carga/page.tsx`: pantalla de carga real de PDF individual y disparo de endpoint interno.
- `app/api/auditor/upload/route.ts`: Route Handler Node.js para recibir `multipart/form-data`.

Nota Next.js: el proyecto usa App Router. La guia local `node_modules/next/dist/docs/01-app/index.md` confirma que el ruteo esta basado en filesystem y usa Server Components/Server Functions. Cualquier cambio futuro debe revisarse contra docs locales de Next 16 en `node_modules/next/dist/docs/`.

### Servicios

- `lib/auditor/service.ts`: servicio principal local. Maneja persistencia temporal de PDF, metadatos, seleccion entre backend remoto y fallback local.
- `lib/auditor/types.ts`: tipos de respuesta de carga, estado UI y metadatos del documento almacenado.

### Pipeline de ingesta

Implementacion local actual:

1. UI recibe un solo PDF y un texto `query`.
2. `DocumentAuditForm` envia `multipart/form-data` a `/api/auditor/upload`.
3. Route Handler valida que exista `file` y que sea PDF.
4. `persistUploadedPdf` crea `documentId`, normaliza filename, crea directorio temporal y guarda:
   - PDF original.
   - `meta.json` con `createdAt`, `documentId`, `originalFilename`, `query`, `storedFilename`.
5. `executeDocumentAudit` envia el archivo a `AUDITOR_PIPELINE_URL`, o devuelve fallback local.

No existe todavia un pipeline local con etapas `incoming -> processing -> processed -> reports`.

### Extraccion de texto

No hay extraccion local de texto. No hay dependencias como `pdf-parse`, `tesseract`, `pymupdf`, `pdfplumber` o servicios OCR en `package.json`. La extraccion se asume externa en el backend remoto referenciado como servicio que encapsula `run_pipeline(...)`.

### Chunking

No existe implementacion local de chunking. No hay utilidades de particion de texto, embeddings, vector store ni almacenamiento de chunks.

### Motor de auditoria

El motor local no existe como componente ejecutable. Hay representaciones mock de scoring, dictamen, hallazgos, criterios, evidencia y acciones en `components/dashboard/data.ts`. El backend real queda delegado a `AUDITOR_PIPELINE_URL`.

### Generacion de PDF

No hay generador local de PDF. La UI solo muestra un link `outputPdfUrl` cuando el backend remoto lo devuelve. Los botones "Descargar PDF" y "Descargar CSV" del detalle son visuales y no estan conectados.

### Bot Telegram

No hay bot Telegram local. Solo aparece como integracion futura en el texto mock de `components/dashboard/data.ts`.

### Carpetas operativas

Estado actual en repo:

- `app/`: rutas Next App Router y API route.
- `components/dashboard/`: componentes visuales y datos mock del dashboard.
- `lib/auditor/`: servicio y tipos de carga/auditoria.
- `public/`: assets SVG default de Next.
- `docs/`: documentacion tecnica; esta carpeta se crea para este inventario.

Carpetas mencionadas en el objetivo pero ausentes:

- `incoming/`
- `processing/`
- `processed/`
- `reports/`
- `norms/`
- `catalog/`
- `schemas/`
- `scripts/`
- `services/`
- `bot/`

## 3. Inventario de archivos relevantes

### Configuracion base

- `package.json`: define scripts `dev`, `build`, `start`, `lint`; dependencias limitadas a Next, React, Tailwind, TypeScript y ESLint.
- `package-lock.json`: lockfile npm.
- `next.config.ts`: configuracion vacia de Next.
- `tsconfig.json`: TypeScript estricto, path alias `@/*`, `moduleResolution: bundler`, incluye `.next/types` y `.next/dev/types`.
- `eslint.config.mjs`: configuracion lint del proyecto.
- `postcss.config.mjs`: configuracion PostCSS/Tailwind.
- `netlify.toml`: build Netlify con `npm run build` y publish `.next`.
- `AGENTS.md`: instruccion operativa para revisar docs locales de Next antes de escribir codigo.
- `CLAUDE.md`: archivo de instrucciones/contexto para otra herramienta, no usado por la app.
- `README.md`: README default de Create Next App, no describe la arquitectura real de auditoria.

### Rutas Next

- `app/layout.tsx`: layout global; metadata todavia generica.
- `app/globals.css`: import Tailwind 4 y variables CSS base.
- `app/page.tsx`: dashboard raiz con datos estaticos importados.
- `app/nueva-auditoria/page.tsx`: pantalla de configuracion documental mock; no persiste ni sube documentos.
- `app/auditorias/[id]/page.tsx`: detalle de auditoria mock con dictamen, brechas, criterios, evidencia, acciones y bitacora.
- `app/dashboard/documentacion-contratista/carga/page.tsx`: integra `DocumentAuditForm` con `getDefaultAuditQuery`.
- `app/api/auditor/upload/route.ts`: valida y recibe PDFs; usa runtime `nodejs`.

### Servicio de auditoria

- `lib/auditor/service.ts`: contiene:
  - `getDefaultAuditQuery()`
  - `persistUploadedPdf()`
  - `executeDocumentAudit()`
  - `executeRemoteAudit()`
  - `executeLocalFallbackAudit()`
  - `sanitizeFilename()`
- `lib/auditor/types.ts`: define:
  - `AuditUploadResponse`
  - `DocumentAuditUiStatus`
  - `StoredAuditDocument`

### Componentes dashboard

- `components/dashboard/PageShell.tsx`: layout con sidebar.
- `components/dashboard/Sidebar.tsx`: menu lateral basado en `menuSections`.
- `components/dashboard/Header.tsx`: encabezado reutilizable.
- `components/dashboard/StatsGrid.tsx`: KPIs.
- `components/dashboard/AuditsTable.tsx`: tabla de auditorias mock con link a detalle.
- `components/dashboard/FindingsPanel.tsx`: panel de hallazgos mock.
- `components/dashboard/ModulesOverview.tsx`: resumen de modulos.
- `components/dashboard/AuditFlowCard.tsx`: pasos del flujo de auditoria.
- `components/dashboard/data.ts`: fuente central de datos mock y supuestos funcionales actuales.
- `components/dashboard/types.ts`: tipos de UI para auditorias, hallazgos, modulos y menu.

### Carga documental

- `components/dashboard/documentation/DocumentAuditForm.tsx`: cliente React; valida PDF, maneja estados `idle/uploading/processing/success/error`, envia `XMLHttpRequest` para tener eventos de upload.
- `components/dashboard/documentation/DocumentAuditResult.tsx`: muestra resultado, summary, modo backend y link `outputPdfUrl` si existe.

### Public

- `public/*.svg`: assets default de Next, sin relevancia directa para auditoria.

## 4. Flujo actual end-to-end PDF a reporte

Flujo implementado localmente:

1. Usuario entra a `/dashboard/documentacion-contratista/carga`.
2. La pagina obtiene `defaultQuery` desde `AUDITOR_DEFAULT_QUERY` o usa `"trabajos en altura"`.
3. Usuario selecciona un PDF y define contexto de auditoria.
4. `DocumentAuditForm` valida extension/MIME PDF.
5. El formulario envia `POST /api/auditor/upload` con `file` y `query`.
6. `app/api/auditor/upload/route.ts` valida el request.
7. `persistUploadedPdf` guarda el archivo en:
   - `AUDITOR_UPLOAD_TMP_DIR/<documentId>/` si existe la variable.
   - `os.tmpdir()/auditor-ai-uploads/<documentId>/` por defecto.
8. Se guarda `meta.json` en el mismo directorio temporal.
9. `executeDocumentAudit` decide:
   - Si `AUDITOR_PIPELINE_URL` existe: reenvia PDF, `query` y `documentId` al backend remoto con `Authorization: Bearer <AUDITOR_PIPELINE_API_KEY>` si aplica.
   - Si no existe: devuelve `mode: local-fallback`.
10. UI muestra resumen.
11. Si el backend remoto devuelve `outputPdfUrl`, UI muestra link "Ver PDF de salida".

Flujo no implementado localmente:

- Extraccion de texto del PDF.
- OCR.
- Chunking.
- Recuperacion contra normas/catalogos.
- Evaluacion de reglas.
- Generacion de hallazgos estructurados.
- Generacion de PDF/Excel/CSV.
- Archivado en `processed` o `reports`.
- Bot Telegram.

## 5. Componentes reutilizables para CUSTOMS_COMPLIANCE

- `POST /api/auditor/upload`: reutilizable como base, pero debe evolucionar de un solo PDF a paquete documental por operacion.
- `persistUploadedPdf`: reutilizable para guardar binarios y metadata, pero debe soportar `framework`, `operation_id`, `document_type`, multiples archivos y versionado.
- `executeRemoteAudit`: reutilizable como adaptador a backend externo, pero debe recibir payload estructurado de operacion aduanera.
- `AuditUploadResponse`: reutilizable conceptualmente, pero debe extenderse con `framework`, `operationId`, `findings`, `metrics`, `reportUrls`.
- `DocumentAuditForm`: reutilizable como patron de UX de carga, no como formulario final; CUSTOMS necesita slots obligatorios 1:1 por tipo documental.
- `DocumentAuditResult`: reutilizable para resumen ejecutivo y links de salida.
- `PageShell`, `Header`, `Sidebar`, tablas y paneles: reutilizables para navegacion y visualizacion.
- `auditDetails` mock: util para prototipar estructura visual de dictamen/hallazgos/evidencia antes de conectar datos reales.

## 6. Hardcoded assumptions STPS/PEMEX a desacoplar

- `DEFAULT_AUDIT_QUERY = "trabajos en altura"` en `lib/auditor/service.ts`.
- `suggestedContexts = [...newAuditOptions.risks, "Plan de emergencias", "Anexos SSPA"]` en carga documental.
- `newAuditOptions.risks` limitado a riesgos de seguridad industrial: trabajos en altura, espacios confinados, EPP, izaje, seguridad electrica.
- Menu lateral mezcla "STPS", "PEMEX", "Anexos SSPA", "Documentacion Contratista" y "Aduanal" como etiquetas estaticas, sin framework modelado.
- `Audit`, `AuditDetail` y UI usan `client`, `contractor`, `risk`, `document`, `score`, `level`; para customs se requieren `importer`, `supplier`, `broker`, `pedimento`, `invoice`, `certificate`, `operation`.
- `AuditStatus = "Bajo" | "Parcial" | "Alto"` representa cumplimiento, no riesgo aduanero/financiero.
- Datos mock y dictamen estan redactados para contratistas y seguridad operativa.
- Endpoint acepta un unico PDF; customs requiere multiples documentos con relacion 1:1.
- `query` libre como contexto unico; customs requiere schema estructurado y validaciones por tipo documental.
- No existe campo `framework`; el backend remoto infiere o recibe solo `query`.
- No existe concepto de catalogos versionados ni reglas por framework.
- La UI de nueva auditoria permite Word/Excel en mock, pero el endpoint real solo acepta PDF.

## 7. Propuesta tecnica para agregar frameworks

Crear una capa explicita de frameworks:

```ts
type AuditFramework = "STPS" | "PEMEX" | "CUSTOMS_COMPLIANCE";

type AuditFrameworkConfig = {
  id: AuditFramework;
  label: string;
  documentTypes: DocumentTypeConfig[];
  rulesetVersion: string;
  catalogVersion?: string;
  outputProfiles: ("executive_pdf" | "findings_xlsx" | "json")[];
};
```

Responsabilidades:

- UI: seleccionar framework antes de cargar documentos.
- API: recibir `framework` y validar documentos esperados.
- Servicio: enrutar a pipeline/reglas por framework.
- Catalogos: cargar tarifas, SLA, normas y criterios versionados.
- Reportes: elegir template por framework.

Estrategia:

- `STPS`: conservar flujo actual de PDF + contexto, pero mapearlo como framework formal.
- `PEMEX`: crear reglas/configuracion separada para anexos SSPA y requisitos cliente.
- `CUSTOMS_COMPLIANCE`: paquete documental 1:1 con extractores y reglas deterministicas iniciales.

## 8. Estructura de carpetas propuesta para CUSTOMS_COMPLIANCE

```text
norms/
  stps/
  pemex/
  customs/
    tmec/
    tigie/
    sat/
catalog/
  customs/
    tariff_rates/
    incoterms.json
    authorized_charges.json
    broker_fee_catalog.json
    country_codes.json
    document_types.json
schemas/
  customs/
    operation.schema.json
    pedimento.schema.json
    commercial_invoice.schema.json
    certificate_origin.schema.json
    broker_expense_account.schema.json
    forwarding_invoice.schema.json
    sla.schema.json
reports/
  customs/
    templates/
    generated/
processed/
  customs/
    <operation_id>/
      raw/
      extracted/
      normalized/
      findings/
      reports/
incoming/
  customs/
processing/
  customs/
scripts/
  customs/
    extract_pedimento.py
    extract_commercial_invoice.py
    extract_certificate_origin.py
    extract_broker_expense_account.py
    extract_forwarding_invoice.py
    extract_sla.py
services/
  customs/
    operation_loader.ts
    rules_engine.ts
    report_builder.ts
```

## 9. Modelo de datos JSON propuesto

```json
{
  "operation_id": "CUSTOMS-2026-000001",
  "framework": "CUSTOMS_COMPLIANCE",
  "version": "1.0.0",
  "pedimento": {
    "document_id": "pedimento-pdf-id",
    "pedimento_number": "string",
    "customs_office": "string",
    "patent": "string",
    "payment_date": "YYYY-MM-DD",
    "importer": {
      "name": "string",
      "tax_id": "string"
    },
    "supplier": {
      "name": "string",
      "country": "USA"
    },
    "origin_country": "USA",
    "invoice_numbers": ["string"],
    "incoterm": "EXW|FOB|CIF|DAP|...",
    "transport_mode": "truck|rail|air|sea|multimodal",
    "currency": "USD",
    "invoice_value": 0,
    "customs_value": 0,
    "tariff_lines": [
      {
        "line_id": "string",
        "hs_code": "string",
        "description": "string",
        "quantity": 0,
        "unit": "string",
        "unit_price": 0,
        "amount": 0,
        "origin_country": "USA",
        "igi_rate_declared": 0,
        "igi_paid": 0,
        "iva_paid": 0,
        "dta_paid": 0,
        "prv_paid": 0
      }
    ],
    "sat_totals": {
      "igi": 0,
      "iva": 0,
      "dta": 0,
      "prv": 0,
      "other": 0,
      "total": 0
    },
    "rectifications": [
      {
        "rectification_id": "string",
        "date": "YYYY-MM-DD",
        "reason": "string",
        "amount_recovered": 0,
        "pending_recovery": 0
      }
    ]
  },
  "commercial_invoice": {
    "document_id": "invoice-pdf-id",
    "invoice_number": "string",
    "invoice_date": "YYYY-MM-DD",
    "supplier": "string",
    "importer": "string",
    "currency": "USD",
    "incoterm": "string",
    "transport_mode": "string",
    "origin_country": "USA",
    "total_value": 0,
    "lines": [
      {
        "sku": "string",
        "description": "string",
        "hs_code": "string",
        "quantity": 0,
        "unit_price": 0,
        "amount": 0,
        "origin_country": "USA"
      }
    ]
  },
  "certificate_of_origin": {
    "document_id": "certificate-pdf-id",
    "exists": true,
    "agreement": "T-MEC/USMCA",
    "issuer": "string",
    "certifier": "importer|exporter|producer",
    "blanket_period": {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD"
    },
    "origin_criterion": "A|B|C|D",
    "covered_invoice_numbers": ["string"],
    "covered_hs_codes": ["string"],
    "valid": true,
    "validation_notes": []
  },
  "broker_expense_account": {
    "document_id": "broker-account-pdf-id",
    "broker": "string",
    "pedimento_number": "string",
    "payment_date": "YYYY-MM-DD",
    "sat_taxes": {
      "igi": 0,
      "iva": 0,
      "dta": 0,
      "prv": 0,
      "other": 0,
      "total": 0
    },
    "broker_fees": 0,
    "logistics_expenses": [],
    "misc_expenses": [],
    "total_charged": 0
  },
  "forwarding_invoice": {
    "document_id": "forwarding-pdf-id",
    "provider": "string",
    "invoice_number": "string",
    "charges": [
      {
        "charge_code": "string",
        "description": "string",
        "amount": 0,
        "currency": "USD",
        "support_document_id": "string"
      }
    ],
    "total": 0
  },
  "sla": {
    "document_id": "sla-pdf-id",
    "broker": "string",
    "effective_from": "YYYY-MM-DD",
    "effective_to": "YYYY-MM-DD",
    "authorized_charges": [],
    "fee_rules": [],
    "service_levels": []
  },
  "findings": [
    {
      "finding_id": "string",
      "rule_id": "CUSTOMS_TMEC_IGI_001",
      "severity": "critical|high|medium|low",
      "title": "string",
      "description": "string",
      "evidence": [],
      "recommendation": "string",
      "potential_recovery_amount": 0,
      "currency": "MXN",
      "status": "open|validated|dismissed|recovered"
    }
  ],
  "metrics": {
    "risk_score": 0,
    "total_sat_pedimento": 0,
    "total_sat_broker_account": 0,
    "sat_difference": 0,
    "duplicate_charges_amount": 0,
    "unsupported_charges_amount": 0,
    "potential_recovery_amount": 0,
    "documents_complete": true
  }
}
```

## 10. Extractores propuestos

### `extract_pedimento.py`

Extrae numero de pedimento, aduana, patente, fechas, importador, proveedor, pais origen, facturas, incoterm, transporte, fracciones arancelarias, cantidades, valores, contribuciones SAT, rectificaciones y totales. Debe tener parser especifico por layout y validacion de sumatorias.

### `extract_commercial_invoice.py`

Extrae factura comercial USA: numero, fecha, proveedor, importador, moneda, incoterm, transporte, pais origen, partidas, cantidades, precios unitarios, importes, fracciones si vienen declaradas y total factura.

### `extract_certificate_origin.py`

Extrae certificado T-MEC/USMCA: existencia, vigencia, certificador, criterio de origen, facturas cubiertas, fracciones cubiertas, paises USA/CAN/MEX y notas de validez documental.

### `extract_broker_expense_account.py`

Extrae cuenta de gastos del agente aduanal: pedimento, fecha de pago, impuestos SAT, IGI, IVA, DTA, PRV, honorarios, gastos logisticos, gastos varios, total cobrado y desglose por concepto.

### `extract_forwarding_invoice.py`

Extrae facturas/comprobantes de forwarding y gastos vinculados: proveedor, factura, conceptos, montos, moneda, referencia de embarque/pedimento y soporte asociado.

### `extract_sla.py`

Extrae contrato/SLA del agente aduanal: vigencia, tarifa de honorarios, cargos autorizados, cargos prohibidos, reglas por operacion, limites, tiempos y penalizaciones.

Recomendacion comun: cada extractor debe producir JSON conforme a `schemas/customs/*.schema.json`, conservar `raw_text`, `page_refs`, `confidence`, `extraction_warnings` y coordenadas/fragmentos de evidencia cuando sea posible.

## 11. Reglas iniciales propuestas

### `CUSTOMS_TMEC_IGI_001`: preferencia T-MEC vs IGI

Si `origin_country` es USA o CAN, existe certificado T-MEC valido, la factura/pedimento estan cubiertos y la preferencia aplica, entonces el IGI esperado debe ser 0 o la tasa preferencial configurada. Si `igi_paid > expected_igi`, generar hallazgo de posible sobrepago y monto potencial recuperable.

### `CUSTOMS_RECON_INVOICE_PEDIMENTO_001`: factura vs pedimento

Comparar factura, proveedor, importador, valor factura, moneda, incoterm, transporte, pais origen, fracciones arancelarias, cantidades e importes. Generar hallazgos por diferencias mayores a tolerancias configuradas.

### `CUSTOMS_RECON_BROKER_PEDIMENTO_001`: cuenta de gastos vs pedimento

Comparar pedimento, fecha de pago, impuestos SAT, IGI, IVA, DTA, PRV y total SAT. Diferencias exactas o por tolerancia monetaria deben quedar evidenciadas.

### `CUSTOMS_SLA_FEES_001`: honorarios vs SLA

Calcular honorarios esperados por reglas del SLA y comparar contra cuenta de gastos. Generar hallazgo si excede tarifa, no cumple minimo/maximo o aplica cargo no pactado.

### `CUSTOMS_UNAUTHORIZED_CHARGES_001`: cargos no autorizados

Cruzar conceptos de cuenta de gastos y forwarding contra catalogo/SLA de cargos autorizados. Marcar cargos no soportados, no contemplados, sin comprobante o fuera de vigencia.

### `CUSTOMS_DUPLICATE_CHARGES_001`: cargos duplicados

Detectar conceptos duplicados por proveedor, referencia, monto, fecha, concepto normalizado y soporte documental. Sugerir recuperacion si el mismo cargo aparece en forwarding y cuenta de gastos.

### `CUSTOMS_SAT_DIFF_001`: diferencias SAT

Comparar `pedimento.sat_totals.total` vs `broker_expense_account.sat_taxes.total`. Hallazgo si hay diferencia distinta de cero o superior a tolerancia configurada.

### `CUSTOMS_RECTIFICATION_RECOVERY_001`: rectificaciones y recuperaciones

Identificar rectificaciones, pagos en exceso, recuperaciones pendientes y estado de devolucion/compensacion. Calcular monto potencial recuperable.

## 12. Riesgos tecnicos

- PDFs escaneados vs texto nativo: requeriran OCR, control de calidad y score de confianza.
- Tablas mal extraidas: pedimentos y cuentas de gastos dependen de tablas; se necesita validacion por sumatorias y fallback manual.
- Variabilidad de layouts: agentes aduanales, forwarders y proveedores usan formatos heterogeneos.
- Fracciones arancelarias cambiantes: TIGIE/IGI requiere versionamiento por fecha de pedimento.
- Validacion legal/fiscal: el sistema debe sugerir hallazgos, no emitir determinaciones fiscales finales sin revision experta.
- Fuente externa o catalogo interno TIGIE/IGI: fase inicial debe permitir carga versionada interna; API externa puede llegar despues.
- Tipo de cambio y moneda: facturas USD y cargos MXN requieren reglas claras de conversion y fecha aplicable.
- Tolerancias: centavos, redondeos, prorrateos y gastos incrementables pueden producir falsos positivos.
- Evidencia trazable: cada hallazgo debe enlazar pagina/campo/fragmento para revision.
- Seguridad documental: pedimentos y facturas pueden contener informacion fiscal sensible; se requiere control de acceso y retencion.

## 13. Recomendacion de integracion

Empezar con reglas internas configurables en JSON/YAML y un pipeline local/servidor controlado. No depender todavia de un servicio externo para TIGIE, certificados o validacion fiscal. Permitir carga manual/versionada de tarifa, SLA, catalogos de cargos y tasas preferenciales. Dejar una interfaz preparada para consultar API externa en fase 2 sin bloquear el MVP.

Interfaz sugerida:

```ts
type CustomsRateProvider = {
  getIgiRate(input: {
    hsCode: string;
    originCountry: string;
    pedimentoDate: string;
    agreement?: "TMEC";
  }): Promise<{
    source: "internal_catalog" | "external_api";
    version: string;
    rate: number;
  }>;
};
```

## 14. Backlog tecnico por fases

### Fase 0: inventario tecnico

- Documentar estado actual del repo.
- Separar componentes existentes vs faltantes.
- Definir arquitectura objetivo para frameworks.
- Identificar primeros archivos a modificar.

### Fase 1: extraccion estructurada de los 4 PDFs dummy

- Crear `schemas/customs`.
- Crear extractores para pedimento, factura comercial, certificado de origen y cuenta de gastos.
- Guardar JSON normalizado por `operation_id`.
- Incluir warnings de extraccion y evidencia por pagina.

### Fase 2: conciliacion documental 1:1

- Crear modelo `CustomsOperation`.
- Implementar loader de paquete documental.
- Validar presencia obligatoria de documentos.
- Conciliar pedimento-factura y pedimento-cuenta de gastos.

### Fase 3: motor de hallazgos customs

- Implementar rules engine configurable.
- Crear reglas TMEC, diferencias SAT, cargos duplicados, cargos no autorizados y honorarios vs SLA.
- Calcular risk score y monto potencial recuperable.

### Fase 4: reporte ejecutivo PDF/Excel

- Crear template de reporte customs.
- Exportar tabla de hallazgos, evidencia, recomendaciones y metricas.
- Generar Excel con conciliaciones y diferencias.
- Exponer `reportUrls` en API.

### Fase 5: dashboard y carga masiva de 10 operaciones

- Nueva pantalla `CUSTOMS_COMPLIANCE`.
- Carga masiva por operacion y tipo documental.
- Bandeja de operaciones con estado, score, recuperable y hallazgos.
- Filtros por broker, importador, periodo, severidad y monto.

## 15. Matriz de impacto/esfuerzo

| Iniciativa | Impacto | Esfuerzo | Comentario |
| --- | --- | --- | --- |
| Agregar `framework` al contrato API/UI | Alto | Medio | Desbloquea STPS, PEMEX y CUSTOMS sin duplicar endpoints. |
| Modelo JSON `CustomsOperation` | Alto | Medio | Base para reglas, reportes y dashboard. |
| Schemas JSON customs | Alto | Bajo | Reduce ambiguedad entre extractores y reglas. |
| Extractor pedimento | Alto | Alto | Documento mas critico y propenso a layouts complejos. |
| Extractor factura comercial | Alto | Medio | Necesario para conciliacion de valor/origen/cantidades. |
| Extractor certificado T-MEC | Alto | Medio | Clave para posible sobrepago IGI. |
| Extractor cuenta de gastos | Alto | Alto | Requiere normalizar conceptos de agentes. |
| Extractor forwarding | Medio | Medio | Importante para duplicados y soporte de gastos. |
| Extractor SLA | Medio | Alto | Contratos pueden ser no estructurados; empezar con carga manual versionada. |
| Reglas internas JSON/YAML | Alto | Medio | Permite iteracion sin redeploy profundo. |
| Catalogo TIGIE/IGI interno versionado | Alto | Alto | Necesario para calculos defendibles. |
| Reporte PDF/Excel customs | Alto | Medio | Entregable ejecutivo y operativo. |
| Bot Telegram | Bajo | Medio | No es bloqueante para MVP customs. |
| Dashboard carga masiva 10 operaciones | Medio | Alto | Conviene despues de validar extraccion/reglas. |
| Integracion API externa TIGIE/SAT | Medio | Alto | Fase 2; no bloquear MVP. |

## 16. Recomendacion final: build / refactor / extend

Recomendacion: **extend con refactorizacion previa minima**.

No conviene reescribir el dashboard. La base Next, el layout, la carga PDF y el adaptador remoto son reutilizables. Tampoco conviene solo "build encima" sin refactor, porque el sistema actual codifica conceptos STPS/contratista/riesgo/contexto como si fueran universales.

Decision propuesta:

1. Refactor minimo para introducir `framework`, `document_type`, `operation_id` y contratos tipados.
2. Extender el flujo actual con una pantalla customs de paquete documental 1:1.
3. Construir extractores y reglas customs como modulo aislado.
4. Mantener backend remoto opcional, pero soportar reglas internas configurables desde el inicio.

## Comandos utiles de validacion

No destructivos:

```bash
npm run lint
npm run build
rg -n "trabajos en altura|Anexos SSPA|PEMEX|STPS|AUDITOR_|run_pipeline|PDF" -S . -g '!node_modules/**' -g '!.next/**'
find . -maxdepth 3 -type d
rg --files
```

Para probar flujo actual sin modificar codigo:

```bash
npm run dev
```

Luego abrir:

- `http://localhost:3000/`
- `http://localhost:3000/nueva-auditoria`
- `http://localhost:3000/dashboard/documentacion-contratista/carga`

Variables relevantes:

```bash
AUDITOR_DEFAULT_QUERY="trabajos en altura"
AUDITOR_UPLOAD_TMP_DIR="/ruta/tmp/auditor-ai-uploads"
AUDITOR_PIPELINE_URL="https://backend.example.com/audit"
AUDITOR_PIPELINE_API_KEY="..."
```

## Primeros archivos a modificar

1. `lib/auditor/types.ts`: agregar `AuditFramework`, `DocumentType`, `operationId`, respuestas con findings/metrics/reportUrls.
2. `lib/auditor/service.ts`: desacoplar `DEFAULT_AUDIT_QUERY`, agregar persistencia por framework/operacion/documento y enrutar pipelines.
3. `app/api/auditor/upload/route.ts`: aceptar `framework`, `operation_id`, `document_type` y multiples documentos para customs.
4. `components/dashboard/data.ts`: mover datos mock y menus a configuracion por framework; eliminar supuestos globales de STPS/PEMEX.
5. `app/dashboard/documentacion-contratista/carga/page.tsx`: convertir a flujo STPS/PEMEX explicito o renombrar segun framework.
6. `components/dashboard/documentation/DocumentAuditForm.tsx`: separar componente generico de uploader vs formularios especificos por framework.
7. Crear `schemas/customs/operation.schema.json`: contrato base para el paquete aduanero.
8. Crear `catalog/customs/authorized_charges.json`: catalogo inicial de cargos permitidos/no permitidos.
9. Crear `catalog/customs/tariff_rates/`: carga versionada interna para tasas TIGIE/IGI.
10. Crear `scripts/customs/extract_pedimento.py`: primer extractor por criticidad.
11. Crear `scripts/customs/extract_commercial_invoice.py`: segundo extractor para conciliacion base.
12. Crear `scripts/customs/extract_certificate_origin.py`: tercer extractor para regla T-MEC.
13. Crear `scripts/customs/extract_broker_expense_account.py`: cuarto extractor para diferencias SAT y cargos.
14. Crear `services/customs/rules_engine.ts`: motor inicial de reglas deterministicas configurables.
15. Crear `app/dashboard/customs-compliance/page.tsx`: pantalla dedicada a carga y resultado customs.
