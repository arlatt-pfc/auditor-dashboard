# Customs Rules Engine Inventory

Inventario generado a partir del estado actual de `services/audit_api/app/customs_rules_catalog.json` y `services/audit_api/app/customs_rules_engine.py`.

## Resumen

- Total de reglas en catálogo: **64**
- Reglas `enabled=true`: **14**
- Reglas `enabled=false`: **50**
- Reglas con evaluador real en `_RULE_DISPATCHER`: **15**
- Reglas activas sin evaluador: **0**
- Detalle activas sin evaluador: ninguna

## Reglas Activas

### 1. `COVE_REQUIRED`

- Rule name: COVE requerido
- Category: Document Integrity
- Severity: Medium
- Parameters/tolerance: `{"priority": true, "required_when_invoices_present": true}`
- Legal basis: Reglas de Comercio Exterior aplicables a transmisión de valor y comercialización mediante COVE.
- Recommendation template: Adjuntar acuse o detalle COVE asociado a las facturas comerciales declaradas.
- Evaluador real: sí

### 2. `TRANSLATION_REQUIRED`

- Rule name: Traducción o anexo aclaratorio requerido
- Category: Document Integrity
- Severity: Medium
- Parameters/tolerance: `{"accepted_documents": ["translation", "annex"], "detect_foreign_provider": true, "priority": true}`
- Legal basis: Obligación de conservar documentación comprobatoria comprensible y suficiente para revisión de comercio exterior.
- Recommendation template: Integrar traducción, anexo o carta aclaratoria cuando la factura o evidencia soporte esté en idioma extranjero.
- Evaluador real: sí

### 3. `INV_PED_VALUE_MATCH`

- Rule name: Coincidencia de valor factura vs pedimento
- Category: Financial Validation
- Severity: High
- Parameters/tolerance: `{"allowed_variance_percent": 3, "priority": true}`
- Legal basis: Ley Aduanera arts. 64-78; reglas generales de valoración aduanera aplicables.
- Recommendation template: Validar que el valor comercial de facturas coincida razonablemente con el valor declarado en pedimento. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 4. `MULTI_INVOICE_TOTAL_MATCH`

- Rule name: Conciliación de total multipágina de facturas
- Category: Financial Validation
- Severity: High
- Parameters/tolerance: `{"priority": true, "tolerance_percent": 3}`
- Legal basis: Ley Aduanera arts. 64-78; valoración aduanera y soporte del valor comercial con facturas.
- Recommendation template: Conciliar el total de facturas comerciales detectadas contra el valor en dólares del pedimento. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 5. `EXCHANGE_RATE_VALIDATION`

- Rule name: Validación de tipo de cambio
- Category: Financial Validation
- Severity: High
- Parameters/tolerance: `{"priority": true, "tolerance_percent": 3}`
- Legal basis: Ley Aduanera y reglas fiscales aplicables a conversión de moneda en operaciones de comercio exterior.
- Recommendation template: Validar el tipo de cambio declarado y su conversión contra valor en dólares y valor comercial pagado. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 6. `CERTIFICATE_OF_ORIGIN_REQUIRED`

- Rule name: Certificado de origen requerido
- Category: Origin & Trade Agreements
- Severity: Medium
- Parameters/tolerance: `{"priority": true, "required_when_tariff_preference_claimed": true}`
- Legal basis: T-MEC y reglas de certificación de origen aplicables cuando se solicita trato preferencial.
- Recommendation template: Integrar certificado o certificación de origen cuando exista trato preferencial o riesgo de origen.
- Evaluador real: sí

### 7. `COUNTRY_OF_ORIGIN_MATCH`

- Rule name: Coincidencia de país de origen
- Category: Origin & Trade Agreements
- Severity: Medium
- Parameters/tolerance: `{"compare_pedimento_invoice_certificate": true, "priority": true}`
- Legal basis: Control de origen, proveedor y cadena de suministro.
- Recommendation template: Validar que el país de origen coincida entre pedimento, factura y certificado cuando esos datos estén disponibles.
- Evaluador real: sí

### 8. `INCOTERM_CONSISTENCY`

- Rule name: Consistencia de Incoterm
- Category: Incoterms & Customs Valuation
- Severity: Low
- Parameters/tolerance: `{"allowed_incoterms": ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"], "priority": true}`
- Legal basis: Incoterms ICC vigentes y soporte documental de términos de compraventa.
- Recommendation template: Verificar que el Incoterm de factura sea válido y consistente con transporte, valor declarado y gastos incrementables.
- Evaluador real: sí

### 9. `BILL_OF_LADING_REQUIRED`

- Rule name: Bill of Lading o documento de transporte requerido
- Category: Incoterms & Customs Valuation
- Severity: Medium
- Parameters/tolerance: `{"accepted_documents": ["bill_of_lading", "transport_document"], "priority": true}`
- Legal basis: Reglas de valoración aduanera e Incoterms ICC.
- Recommendation template: Adjuntar Bill of Lading, Air Waybill o documento de transporte equivalente para soportar embarque y logística.
- Evaluador real: sí

### 10. `TECHNICAL_SUPPORT_REQUIRED`

- Rule name: Soporte técnico requerido
- Category: Tariff Classification
- Severity: Medium
- Parameters/tolerance: `{"accepted_documents": ["data_sheet", "catalog", "technical_spec"], "priority": true}`
- Legal basis: Ley Aduanera art. 59; obligaciones de clasificación y documentación soporte.
- Recommendation template: Integrar ficha técnica, catálogo o especificación técnica que soporte la identificación y clasificación de la mercancía.
- Evaluador real: sí

### 11. `PRODUCT_DESCRIPTION_COMPLETENESS`

- Rule name: Completitud de descripción de producto
- Category: Tariff Classification
- Severity: Medium
- Parameters/tolerance: `{"min_description_length": 12, "priority": true}`
- Legal basis: Obligaciones de clasificación arancelaria y descripción comercial de mercancías.
- Recommendation template: Complementar la descripción de mercancía con marca, modelo, función, material, uso y características técnicas suficientes.
- Evaluador real: sí

### 12. `TAX_BASE_CONSISTENCY`

- Rule name: Consistencia de base gravable y contribuciones
- Category: Taxes & Duties
- Severity: High
- Parameters/tolerance: `{"max_contribution_ratio_percent": 60, "priority": true, "tolerance_percent": 5}`
- Legal basis: Ley Aduanera y disposiciones fiscales aplicables a contribuciones de comercio exterior.
- Recommendation template: Revisar valor aduana, valor comercial pagado y contribuciones declaradas. Diferencia detectada: {variance_percent}%.
- Evaluador real: sí

### 13. `CFDI_XML_REQUIRED`

- Rule name: CFDI XML del agente requerido
- Category: Customs Broker Controls
- Severity: Medium
- Parameters/tolerance: `{"accepted_documents": ["cfdi_xml", "cfdi_xml_agent"], "priority": true}`
- Legal basis: Disposiciones fiscales aplicables a comprobantes por servicios del agente aduanal.
- Recommendation template: Adjuntar CFDI XML del agente aduanal para validar datos fiscales timbrados.
- Evaluador real: sí

### 14. `CFDI_PDF_REQUIRED`

- Rule name: CFDI PDF del agente requerido
- Category: Customs Broker Controls
- Severity: Medium
- Parameters/tolerance: `{"accepted_documents": ["cfdi_pdf", "cfdi_pdf_agent"], "priority": true}`
- Legal basis: Disposiciones fiscales aplicables a comprobantes por servicios del agente aduanal.
- Recommendation template: Adjuntar representación impresa PDF del CFDI del agente aduanal.
- Evaluador real: sí

## Reglas Configuradas Pero No Activas

- `DOC_BASE_PEDIMENTO_REQUIRED` - Pedimento base requerido | Document Integrity | severity: Critical | evaluador real: no
- `COMMERCIAL_INVOICE_REQUIRED` - Factura comercial requerida | Document Integrity | severity: Critical | evaluador real: no
- `BROKER_EXPENSE_ACCOUNT_REQUIRED` - Cuenta de gastos requerida | Document Integrity | severity: Critical | evaluador real: no
- `DOC_FILE_TEXT_EXTRACTABLE` - Documento legible y extraíble | Document Integrity | severity: High | evaluador real: no
- `DOC_DUPLICATE_FILE_DETECTED` - Documento duplicado detectado | Document Integrity | severity: Low | evaluador real: no
- `DOC_REQUIRED_METADATA_COMPLETE` - Metadata documental completa | Document Integrity | severity: Medium | evaluador real: no
- `CUSTOMS_VALUE_PRESENT` - Valor aduana presente | Financial Validation | severity: High | evaluador real: no
- `COMMERCIAL_VALUE_USD_PRESENT` - Valor en dólares presente | Financial Validation | severity: Medium | evaluador real: no
- `INVOICE_CURRENCY_DECLARED` - Moneda de factura declarada | Financial Validation | severity: Medium | evaluador real: no
- `INVOICE_DATE_PRESENT` - Fecha de factura presente | Financial Validation | severity: Low | evaluador real: no
- `ORIGIN_COUNTRY_DECLARED` - País de origen declarado | Origin & Trade Agreements | severity: Medium | evaluador real: no
- `TMEC_CERT_MINIMUM_DATA` - Datos mínimos de certificación T-MEC | Origin & Trade Agreements | severity: High | evaluador real: no
- `PREFERENTIAL_DUTY_SUPPORT` - Soporte de trato arancelario preferencial | Origin & Trade Agreements | severity: High | evaluador real: no
- `ORIGIN_CERT_VALIDITY_PERIOD` - Vigencia de certificado de origen | Origin & Trade Agreements | severity: Medium | evaluador real: no
- `INCREMENTABLES_SUPPORT_REQUIRED` - Soporte de incrementables requerido | Incoterms & Customs Valuation | severity: High | evaluador real: no
- `NON_INCREMENTABLES_SEPARATED` - No incrementables separados | Incoterms & Customs Valuation | severity: Medium | evaluador real: no
- `INSURANCE_SUPPORT_REQUIRED` - Soporte de seguro requerido | Incoterms & Customs Valuation | severity: Low | evaluador real: no
- `ASSIST_ROYALTY_REVIEW` - Revisión de asistencias y regalías | Incoterms & Customs Valuation | severity: Medium | evaluador real: no
- `TARIFF_ITEM_VALID_FORMAT` - Formato válido de fracción arancelaria | Tariff Classification | severity: High | evaluador real: no
- `DATA_SHEET_AUTHENTICITY` - Autenticidad de hoja de datos | Tariff Classification | severity: Low | evaluador real: sí
- `TARIFF_NICO_PRESENT` - NICO presente cuando aplique | Tariff Classification | severity: Low | evaluador real: no
- `UOM_CONSISTENCY` - Consistencia de unidad de medida | Tariff Classification | severity: Medium | evaluador real: no
- `NOM_COMPLIANCE_REVIEW` - Revisión de cumplimiento NOM | Regulatory Compliance | severity: High | evaluador real: no
- `RRNA_PERMIT_REQUIRED` - Permiso o RRNA requerido | Regulatory Compliance | severity: High | evaluador real: no
- `SERIAL_NUMBER_TRACEABILITY` - Trazabilidad de números de serie | Regulatory Compliance | severity: Medium | evaluador real: no
- `HAZMAT_DOCUMENTATION_REQUIRED` - Documentación de mercancía peligrosa | Regulatory Compliance | severity: High | evaluador real: no
- `ANTIDUMPING_REVIEW` - Revisión de cuotas compensatorias | Regulatory Compliance | severity: High | evaluador real: no
- `IMPORTER_REGISTRY_VALIDATION` - Validación de padrón de importadores | Regulatory Compliance | severity: Medium | evaluador real: no
- `IGI_PRESENT` - IGI presente | Taxes & Duties | severity: High | evaluador real: no
- `IVA_PRESENT` - IVA presente | Taxes & Duties | severity: High | evaluador real: no
- `DTA_PRESENT` - DTA presente | Taxes & Duties | severity: Medium | evaluador real: no
- `PRV_PRESENT` - PRV presente | Taxes & Duties | severity: Low | evaluador real: no
- `PAYMENT_DATE_PRESENT` - Fecha de pago presente | Taxes & Duties | severity: Medium | evaluador real: no
- `BROKER_PATENT_PRESENT` - Patente de agente aduanal presente | Customs Broker Controls | severity: Medium | evaluador real: no
- `BROKER_NAME_PRESENT` - Nombre de agente/agencia presente | Customs Broker Controls | severity: Low | evaluador real: no
- `BROKER_EXPENSES_MATCH_TAXES` - Cuenta de gastos contra contribuciones | Customs Broker Controls | severity: High | evaluador real: no
- `BROKER_RFC_VALIDATION` - Validación RFC del agente | Customs Broker Controls | severity: Low | evaluador real: no
- `BROKER_AUTHORIZATION_TRACE` - Trazabilidad de encargo conferido | Customs Broker Controls | severity: Medium | evaluador real: no
- `HIGH_VALUE_OPERATION_REVIEW` - Revisión de operación de alto valor | Preventive Risk | severity: Medium | evaluador real: no
- `NEW_PROVIDER_REVIEW` - Revisión de proveedor nuevo | Preventive Risk | severity: Medium | evaluador real: no
- `RELATED_PARTY_REVIEW` - Revisión de partes relacionadas | Preventive Risk | severity: High | evaluador real: no
- `COUNTRY_RISK_REVIEW` - Revisión de país de riesgo | Preventive Risk | severity: Medium | evaluador real: no
- `UNUSUAL_VALUE_VARIATION` - Variación inusual de valor | Preventive Risk | severity: Medium | evaluador real: no
- `FORCED_LABOR_RISK_SCREENING` - Screening de riesgo de trabajo forzoso | Preventive Risk | severity: High | evaluador real: no
- `AUDIT_VERSION_DELTA_REVIEW` - Revisión de cambios entre versiones | Governance & Continuous Audit | severity: Low | evaluador real: no
- `MISSING_DOCUMENTS_AGING` - Antigüedad de brechas documentales | Governance & Continuous Audit | severity: Medium | evaluador real: no
- `RERUN_REASON_REQUIRED` - Motivo de reauditoría requerido | Governance & Continuous Audit | severity: Low | evaluador real: no
- `ARCHIVED_AUDIT_EXCLUDED` - Auditoría archivada excluida | Governance & Continuous Audit | severity: Low | evaluador real: no
- `EVIDENCE_MINIMUM_SET_COMPLETE` - Evidencia mínima completa | Governance & Continuous Audit | severity: Critical | evaluador real: no
- `EXECUTIVE_REPORT_READY` - Reporte ejecutivo disponible | Governance & Continuous Audit | severity: Low | evaluador real: no

## Evaluadores Registrados En El Motor

- `BILL_OF_LADING_REQUIRED` - enabled=true
- `CERTIFICATE_OF_ORIGIN_REQUIRED` - enabled=true
- `CFDI_PDF_REQUIRED` - enabled=true
- `CFDI_XML_REQUIRED` - enabled=true
- `COUNTRY_OF_ORIGIN_MATCH` - enabled=true
- `COVE_REQUIRED` - enabled=true
- `DATA_SHEET_AUTHENTICITY` - enabled=false/no activo
- `EXCHANGE_RATE_VALIDATION` - enabled=true
- `INCOTERM_CONSISTENCY` - enabled=true
- `INV_PED_VALUE_MATCH` - enabled=true
- `MULTI_INVOICE_TOTAL_MATCH` - enabled=true
- `PRODUCT_DESCRIPTION_COMPLETENESS` - enabled=true
- `TAX_BASE_CONSISTENCY` - enabled=true
- `TECHNICAL_SUPPORT_REQUIRED` - enabled=true
- `TRANSLATION_REQUIRED` - enabled=true

## Consistencia Catálogo vs Motor

- Reglas `enabled=true` sin evaluador: ninguna
- Reglas con evaluador pero no activas: DATA_SHEET_AUTHENTICITY
- No se modificó lógica del motor ni estado `enabled` de ninguna regla.
