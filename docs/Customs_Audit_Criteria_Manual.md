# Manual Ejecutivo y Técnico del Customs Rules Engine

Módulo: Customs Compliance

Fuente del documento: `services/audit_api/app/customs_rules_catalog.json`, `services/audit_api/app/customs_rules_engine.py` y `docs/customs_rules_inventory.md`.

## 1. Resumen Ejecutivo

El Customs Rules Engine es el componente de evaluación automatizada del módulo Customs Compliance. Su objetivo es convertir evidencia documental y datos normalizados del pedimento en hallazgos estructurados, trazables y accionables para auditoría aduanera.

- Total de reglas en catálogo: **64**
- Reglas activas (`enabled=true`): **14**
- Reglas inactivas (`enabled=false`): **50**
- Reglas con evaluador real en `customs_rules_engine.py`: **15**
- Reglas activas sin evaluador: **0**
- Número de categorías de control: **10**
- Severidades soportadas: **Critical, High, Medium, Low**
- Tolerancias configurables: definidas en `parameters`, incluyendo `allowed_variance_percent`, `tolerance_percent` y umbrales específicos por regla.
- Modelo de Compliance Score: escala **0-100**, ajustada por brechas documentales y penalizaciones por severidad de hallazgos.

Estado de consistencia: no existe ninguna regla activa sin evaluador real. Existe una regla con evaluador disponible pero desactivada: `DATA_SHEET_AUTHENTICITY`.

## 2. Arquitectura del Customs Rules Engine

### 2.1 Catálogo parametrizable

`customs_rules_catalog.json` funciona como repositorio declarativo de reglas. Cada entrada define `rule_code`, `rule_name`, `category`, `severity`, `enabled`, `parameters`, `legal_basis` y `recommendation_template`. Este diseño permite administrar reglas como configuración y no como lógica dispersa en la aplicación.

### 2.2 Motor de evaluación

`customs_rules_engine.py` carga únicamente reglas activas mediante `load_active_rules()` y las evalúa con `evaluate_customs_rules(context)`. El contexto incluye datos del pedimento, facturas extraídas, documentos cargados, documentos faltantes y metadata generada durante la ejecución.

### 2.3 Dispatcher por `rule_code`

El motor usa `_RULE_DISPATCHER` para asociar cada `rule_code` implementado con su evaluador. Esto evita ejecutar reglas sin implementación funcional y permite activar nuevas reglas cuando exista evaluador validado.

### 2.4 Parámetros, severidad y tolerancias

Cada regla puede tener parámetros de materialidad. Las reglas financieras usan tolerancias porcentuales; las documentales usan listas de documentos aceptados o condiciones de activación. La severidad controla la materialidad del hallazgo y alimenta el scoring.

### 2.5 `legal_basis`, recomendaciones y evidencia

Cada finding generado por el motor incluye `rule_code`, `category`, `severity`, `title`, `description`, `recommendation`, `legal_basis` y `evidence`. La evidencia contiene datos calculados, como diferencias de valor, tolerancias, documentos faltantes o señales detectadas.

### 2.6 Scoring engine y `execution_log`

El resultado de auditoría calcula `compliance_percent` de 0 a 100. En el flujo actual del VPS, el puntaje parte de 100 y descuenta brechas documentales y penalizaciones por severidad: Critical 14, High 10, Medium 5 y Low 2 puntos, excluyendo el hallazgo informativo `CUSTOMS_RULES_NO_GAPS`.

La ejecución también produce `execution_log` con etapas como `received`, `save_files`, `ocr`, `parse_invoices`, `rules_engine`, `scoring` y `result_ready`, cada una con estado, mensaje y duración.

## 3. Categorías de Control

1. Document Integrity
2. Financial Validation
3. Origin & Trade Agreements
4. Incoterms & Customs Valuation
5. Tariff Classification
6. Regulatory Compliance
7. Taxes & Duties
8. Customs Broker Controls
9. Preventive Risk Analytics En el catálogo actual esta categoría está registrada como `Preventive Risk`.
10. Governance & Continuous Audit

## 4. Reglas Activas (14)

### 1. `COVE_REQUIRED`

- `rule_code`: `COVE_REQUIRED`
- `rule_name`: COVE requerido
- `category`: Document Integrity
- `severity`: Medium
- `parameters/tolerance`: `{"priority": true, "required_when_invoices_present": true}`
- `legal_basis`: Reglas de Comercio Exterior aplicables a transmisión de valor y comercialización mediante COVE.
- `recommendation_template`: Adjuntar acuse o detalle COVE asociado a las facturas comerciales declaradas.
- Evaluador real: sí

### 2. `TRANSLATION_REQUIRED`

- `rule_code`: `TRANSLATION_REQUIRED`
- `rule_name`: Traducción o anexo aclaratorio requerido
- `category`: Document Integrity
- `severity`: Medium
- `parameters/tolerance`: `{"accepted_documents": ["translation", "annex"], "detect_foreign_provider": true, "priority": true}`
- `legal_basis`: Obligación de conservar documentación comprobatoria comprensible y suficiente para revisión de comercio exterior.
- `recommendation_template`: Integrar traducción, anexo o carta aclaratoria cuando la factura o evidencia soporte esté en idioma extranjero.
- Evaluador real: sí

### 3. `INV_PED_VALUE_MATCH`

- `rule_code`: `INV_PED_VALUE_MATCH`
- `rule_name`: Coincidencia de valor factura vs pedimento
- `category`: Financial Validation
- `severity`: High
- `parameters/tolerance`: `{"allowed_variance_percent": 3, "priority": true}`
- `legal_basis`: Ley Aduanera arts. 64-78; reglas generales de valoración aduanera aplicables.
- `recommendation_template`: Validar que el valor comercial de facturas coincida razonablemente con el valor declarado en pedimento. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 4. `MULTI_INVOICE_TOTAL_MATCH`

- `rule_code`: `MULTI_INVOICE_TOTAL_MATCH`
- `rule_name`: Conciliación de total multipágina de facturas
- `category`: Financial Validation
- `severity`: High
- `parameters/tolerance`: `{"priority": true, "tolerance_percent": 3}`
- `legal_basis`: Ley Aduanera arts. 64-78; valoración aduanera y soporte del valor comercial con facturas.
- `recommendation_template`: Conciliar el total de facturas comerciales detectadas contra el valor en dólares del pedimento. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 5. `EXCHANGE_RATE_VALIDATION`

- `rule_code`: `EXCHANGE_RATE_VALIDATION`
- `rule_name`: Validación de tipo de cambio
- `category`: Financial Validation
- `severity`: High
- `parameters/tolerance`: `{"priority": true, "tolerance_percent": 3}`
- `legal_basis`: Ley Aduanera y reglas fiscales aplicables a conversión de moneda en operaciones de comercio exterior.
- `recommendation_template`: Validar el tipo de cambio declarado y su conversión contra valor en dólares y valor comercial pagado. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 6. `CERTIFICATE_OF_ORIGIN_REQUIRED`

- `rule_code`: `CERTIFICATE_OF_ORIGIN_REQUIRED`
- `rule_name`: Certificado de origen requerido
- `category`: Origin & Trade Agreements
- `severity`: Medium
- `parameters/tolerance`: `{"priority": true, "required_when_tariff_preference_claimed": true}`
- `legal_basis`: T-MEC y reglas de certificación de origen aplicables cuando se solicita trato preferencial.
- `recommendation_template`: Integrar certificado o certificación de origen cuando exista trato preferencial o riesgo de origen.
- Evaluador real: sí

### 7. `COUNTRY_OF_ORIGIN_MATCH`

- `rule_code`: `COUNTRY_OF_ORIGIN_MATCH`
- `rule_name`: Coincidencia de país de origen
- `category`: Origin & Trade Agreements
- `severity`: Medium
- `parameters/tolerance`: `{"compare_pedimento_invoice_certificate": true, "priority": true}`
- `legal_basis`: Control de origen, proveedor y cadena de suministro.
- `recommendation_template`: Validar que el país de origen coincida entre pedimento, factura y certificado cuando esos datos estén disponibles.
- Evaluador real: sí

### 8. `INCOTERM_CONSISTENCY`

- `rule_code`: `INCOTERM_CONSISTENCY`
- `rule_name`: Consistencia de Incoterm
- `category`: Incoterms & Customs Valuation
- `severity`: Low
- `parameters/tolerance`: `{"allowed_incoterms": ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"], "priority": true}`
- `legal_basis`: Incoterms ICC vigentes y soporte documental de términos de compraventa.
- `recommendation_template`: Verificar que el Incoterm de factura sea válido y consistente con transporte, valor declarado y gastos incrementables.
- Evaluador real: sí

### 9. `BILL_OF_LADING_REQUIRED`

- `rule_code`: `BILL_OF_LADING_REQUIRED`
- `rule_name`: Bill of Lading o documento de transporte requerido
- `category`: Incoterms & Customs Valuation
- `severity`: Medium
- `parameters/tolerance`: `{"accepted_documents": ["bill_of_lading", "transport_document"], "priority": true}`
- `legal_basis`: Reglas de valoración aduanera e Incoterms ICC.
- `recommendation_template`: Adjuntar Bill of Lading, Air Waybill o documento de transporte equivalente para soportar embarque y logística.
- Evaluador real: sí

### 10. `TECHNICAL_SUPPORT_REQUIRED`

- `rule_code`: `TECHNICAL_SUPPORT_REQUIRED`
- `rule_name`: Soporte técnico requerido
- `category`: Tariff Classification
- `severity`: Medium
- `parameters/tolerance`: `{"accepted_documents": ["data_sheet", "catalog", "technical_spec"], "priority": true}`
- `legal_basis`: Ley Aduanera art. 59; obligaciones de clasificación y documentación soporte.
- `recommendation_template`: Integrar ficha técnica, catálogo o especificación técnica que soporte la identificación y clasificación de la mercancía.
- Evaluador real: sí

### 11. `PRODUCT_DESCRIPTION_COMPLETENESS`

- `rule_code`: `PRODUCT_DESCRIPTION_COMPLETENESS`
- `rule_name`: Completitud de descripción de producto
- `category`: Tariff Classification
- `severity`: Medium
- `parameters/tolerance`: `{"min_description_length": 12, "priority": true}`
- `legal_basis`: Obligaciones de clasificación arancelaria y descripción comercial de mercancías.
- `recommendation_template`: Complementar la descripción de mercancía con marca, modelo, función, material, uso y características técnicas suficientes.
- Evaluador real: sí

### 12. `TAX_BASE_CONSISTENCY`

- `rule_code`: `TAX_BASE_CONSISTENCY`
- `rule_name`: Consistencia de base gravable y contribuciones
- `category`: Taxes & Duties
- `severity`: High
- `parameters/tolerance`: `{"max_contribution_ratio_percent": 60, "priority": true, "tolerance_percent": 5}`
- `legal_basis`: Ley Aduanera y disposiciones fiscales aplicables a contribuciones de comercio exterior.
- `recommendation_template`: Revisar valor aduana, valor comercial pagado y contribuciones declaradas. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 13. `CFDI_XML_REQUIRED`

- `rule_code`: `CFDI_XML_REQUIRED`
- `rule_name`: CFDI XML del agente requerido
- `category`: Customs Broker Controls
- `severity`: Medium
- `parameters/tolerance`: `{"accepted_documents": ["cfdi_xml", "cfdi_xml_agent"], "priority": true}`
- `legal_basis`: Disposiciones fiscales aplicables a comprobantes por servicios del agente aduanal.
- `recommendation_template`: Adjuntar CFDI XML del agente aduanal para validar datos fiscales timbrados.
- Evaluador real: sí

### 14. `CFDI_PDF_REQUIRED`

- `rule_code`: `CFDI_PDF_REQUIRED`
- `rule_name`: CFDI PDF del agente requerido
- `category`: Customs Broker Controls
- `severity`: Medium
- `parameters/tolerance`: `{"accepted_documents": ["cfdi_pdf", "cfdi_pdf_agent"], "priority": true}`
- `legal_basis`: Disposiciones fiscales aplicables a comprobantes por servicios del agente aduanal.
- `recommendation_template`: Adjuntar representación impresa PDF del CFDI del agente aduanal.
- Evaluador real: sí

## 5. Roadmap de Reglas Configuradas para Implementación Progresiva

Las siguientes reglas están configuradas en catálogo, pero permanecen `enabled=false`. Representan el roadmap de expansión progresiva del motor. No se ejecutan actualmente salvo que sean activadas y cuenten con evaluador funcional.

### Customs Broker Controls

- `BROKER_PATENT_PRESENT` - Patente de agente aduanal presente | severity: Medium | evaluador real: no
- `BROKER_NAME_PRESENT` - Nombre de agente/agencia presente | severity: Low | evaluador real: no
- `BROKER_EXPENSES_MATCH_TAXES` - Cuenta de gastos contra contribuciones | severity: High | evaluador real: no
- `BROKER_RFC_VALIDATION` - Validación RFC del agente | severity: Low | evaluador real: no
- `BROKER_AUTHORIZATION_TRACE` - Trazabilidad de encargo conferido | severity: Medium | evaluador real: no

### Document Integrity

- `DOC_BASE_PEDIMENTO_REQUIRED` - Pedimento base requerido | severity: Critical | evaluador real: no
- `COMMERCIAL_INVOICE_REQUIRED` - Factura comercial requerida | severity: Critical | evaluador real: no
- `BROKER_EXPENSE_ACCOUNT_REQUIRED` - Cuenta de gastos requerida | severity: Critical | evaluador real: no
- `DOC_FILE_TEXT_EXTRACTABLE` - Documento legible y extraíble | severity: High | evaluador real: no
- `DOC_DUPLICATE_FILE_DETECTED` - Documento duplicado detectado | severity: Low | evaluador real: no
- `DOC_REQUIRED_METADATA_COMPLETE` - Metadata documental completa | severity: Medium | evaluador real: no

### Financial Validation

- `CUSTOMS_VALUE_PRESENT` - Valor aduana presente | severity: High | evaluador real: no
- `COMMERCIAL_VALUE_USD_PRESENT` - Valor en dólares presente | severity: Medium | evaluador real: no
- `INVOICE_CURRENCY_DECLARED` - Moneda de factura declarada | severity: Medium | evaluador real: no
- `INVOICE_DATE_PRESENT` - Fecha de factura presente | severity: Low | evaluador real: no

### Governance & Continuous Audit

- `AUDIT_VERSION_DELTA_REVIEW` - Revisión de cambios entre versiones | severity: Low | evaluador real: no
- `MISSING_DOCUMENTS_AGING` - Antigüedad de brechas documentales | severity: Medium | evaluador real: no
- `RERUN_REASON_REQUIRED` - Motivo de reauditoría requerido | severity: Low | evaluador real: no
- `ARCHIVED_AUDIT_EXCLUDED` - Auditoría archivada excluida | severity: Low | evaluador real: no
- `EVIDENCE_MINIMUM_SET_COMPLETE` - Evidencia mínima completa | severity: Critical | evaluador real: no
- `EXECUTIVE_REPORT_READY` - Reporte ejecutivo disponible | severity: Low | evaluador real: no

### Incoterms & Customs Valuation

- `INCREMENTABLES_SUPPORT_REQUIRED` - Soporte de incrementables requerido | severity: High | evaluador real: no
- `NON_INCREMENTABLES_SEPARATED` - No incrementables separados | severity: Medium | evaluador real: no
- `INSURANCE_SUPPORT_REQUIRED` - Soporte de seguro requerido | severity: Low | evaluador real: no
- `ASSIST_ROYALTY_REVIEW` - Revisión de asistencias y regalías | severity: Medium | evaluador real: no

### Origin & Trade Agreements

- `ORIGIN_COUNTRY_DECLARED` - País de origen declarado | severity: Medium | evaluador real: no
- `TMEC_CERT_MINIMUM_DATA` - Datos mínimos de certificación T-MEC | severity: High | evaluador real: no
- `PREFERENTIAL_DUTY_SUPPORT` - Soporte de trato arancelario preferencial | severity: High | evaluador real: no
- `ORIGIN_CERT_VALIDITY_PERIOD` - Vigencia de certificado de origen | severity: Medium | evaluador real: no

### Preventive Risk Analytics

- `HIGH_VALUE_OPERATION_REVIEW` - Revisión de operación de alto valor | severity: Medium | evaluador real: no
- `NEW_PROVIDER_REVIEW` - Revisión de proveedor nuevo | severity: Medium | evaluador real: no
- `RELATED_PARTY_REVIEW` - Revisión de partes relacionadas | severity: High | evaluador real: no
- `COUNTRY_RISK_REVIEW` - Revisión de país de riesgo | severity: Medium | evaluador real: no
- `UNUSUAL_VALUE_VARIATION` - Variación inusual de valor | severity: Medium | evaluador real: no
- `FORCED_LABOR_RISK_SCREENING` - Screening de riesgo de trabajo forzoso | severity: High | evaluador real: no

### Regulatory Compliance

- `NOM_COMPLIANCE_REVIEW` - Revisión de cumplimiento NOM | severity: High | evaluador real: no
- `RRNA_PERMIT_REQUIRED` - Permiso o RRNA requerido | severity: High | evaluador real: no
- `SERIAL_NUMBER_TRACEABILITY` - Trazabilidad de números de serie | severity: Medium | evaluador real: no
- `HAZMAT_DOCUMENTATION_REQUIRED` - Documentación de mercancía peligrosa | severity: High | evaluador real: no
- `ANTIDUMPING_REVIEW` - Revisión de cuotas compensatorias | severity: High | evaluador real: no
- `IMPORTER_REGISTRY_VALIDATION` - Validación de padrón de importadores | severity: Medium | evaluador real: no

### Tariff Classification

- `TARIFF_ITEM_VALID_FORMAT` - Formato válido de fracción arancelaria | severity: High | evaluador real: no
- `DATA_SHEET_AUTHENTICITY` - Autenticidad de hoja de datos | severity: Low | evaluador real: sí
- `TARIFF_NICO_PRESENT` - NICO presente cuando aplique | severity: Low | evaluador real: no
- `UOM_CONSISTENCY` - Consistencia de unidad de medida | severity: Medium | evaluador real: no

### Taxes & Duties

- `IGI_PRESENT` - IGI presente | severity: High | evaluador real: no
- `IVA_PRESENT` - IVA presente | severity: High | evaluador real: no
- `DTA_PRESENT` - DTA presente | severity: Medium | evaluador real: no
- `PRV_PRESENT` - PRV presente | severity: Low | evaluador real: no
- `PAYMENT_DATE_PRESENT` - Fecha de pago presente | severity: Medium | evaluador real: no

## 6. Severidades y Materialidad

- **Critical:** riesgo material alto que puede impedir cerrar una auditoría sin remediación. Puede representar ausencia de evidencia esencial, exposición fiscal grave o incumplimiento regulatorio crítico.
- **High:** hallazgo con impacto financiero o regulatorio relevante. Requiere análisis y acción correctiva prioritaria.
- **Medium:** brecha documental o inconsistencia que no necesariamente bloquea la operación, pero debe documentarse y remediarse para reducir riesgo.
- **Low:** observación de control, trazabilidad o mejora documental. Normalmente no representa exposición inmediata, pero ayuda a fortalecer el expediente.

La severidad impacta el Compliance Score, prioriza hallazgos y orienta la materialidad financiera/regulatoria del dictamen.

## 7. Tolerancias Configurables

Tolerancias activas reales del sistema:

- `INV_PED_VALUE_MATCH` -> **3%** (`allowed_variance_percent`)
- `MULTI_INVOICE_TOTAL_MATCH` -> **3%** (`tolerance_percent`)
- `EXCHANGE_RATE_VALIDATION` -> **3%** (`tolerance_percent`)
- `TAX_BASE_CONSISTENCY` -> **5%** (`tolerance_percent`)

Cada regla puede definir sus propios thresholds y parámetros de materialidad dentro de `parameters`. El motor lee esos valores al evaluar discrepancias o condiciones documentales.

## 8. Compliance Score (0-100)

El Compliance Score resume el estado preliminar del expediente en una escala de 0 a 100. En la implementación actual se calcula con base en:

- Hallazgos por severidad.
- Documentos faltantes.
- Reglas incumplidas.
- Riesgo financiero asociado a diferencias de valor, tipo de cambio o base gravable.
- Riesgo regulatorio asociado a origen, transporte, CFDI, COVE, soporte técnico y consistencia documental.

Interpretación ejecutiva:

- **90-100:** Excelente, riesgo bajo.
- **75-89:** Adecuado, riesgo moderado.
- **50-74:** Riesgo relevante.
- **0-49:** Riesgo alto.

## 9. Base Legal Aplicable

- Ley Aduanera.
- Reglamento de la Ley Aduanera.
- Reglas Generales de Comercio Exterior (RGCE).
- TIGIE / LIGIE.
- T-MEC / USMCA.
- Tratados de Libre Comercio aplicables.
- NOMs y Regulaciones y Restricciones No Arancelarias (RRNA).
- Disposiciones fiscales del SAT aplicables a CFDI, contribuciones y conservación documental.

## 10. Impacto Potencial de los Hallazgos

Los hallazgos pueden derivar en impactos operativos, financieros y regulatorios, incluyendo:

- Multas.
- Créditos fiscales.
- Diferencias de contribuciones.
- Pérdida de preferencias arancelarias.
- Cuotas compensatorias.
- Incumplimiento de RRNA o NOMs.
- Observaciones del SAT u otras autoridades.
- Rectificaciones, recuperaciones potenciales o ajustes documentales.

## 11. Hoja de Ruta de Evolución

Actualmente existen **14 reglas operativas** y el catálogo contiene **64 reglas parametrizadas**. Las **50 reglas restantes** representan un roadmap de expansión. La arquitectura por catálogo y dispatcher permite incorporar nuevas reglas sin modificar la interfaz del dashboard: se agrega o valida el evaluador, se activa la regla y se parametrizan sus umbrales.

Próximos frentes naturales de evolución:

- Evaluadores de RRNA, NOM y cuotas compensatorias.
- Validación avanzada de fracciones arancelarias y NICO.
- Conciliación contra cuenta de gastos y contribuciones detalladas.
- Análisis histórico de proveedores y variaciones de valor.
- Gobierno de reauditorías, aging de brechas y controles de cierre.

## 12. Archivos de Salida

- `docs/Customs_Audit_Criteria_Manual.md`
- `docs/Customs_Audit_Criteria_Manual.pdf`
- `docs/Customs_Audit_Criteria_Manual.pptx`: no generado; es opcional y no hay infraestructura de presentación configurada en el proyecto.

## 13. Validación

Validación requerida:

```bash
python3 -m compileall services/audit_api/app
```

Este documento sólo describe el estado actual. No modifica lógica del motor ni cambia reglas `enabled/disabled`.
