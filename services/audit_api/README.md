# Audit API Service

FastAPI wrapper for the operational audit pipeline. It exposes:

```text
POST /audit/run
POST /customs/parse-pedimento
```

The endpoint accepts one PDF plus metadata:

- `audit_topic`
- `engine_id`
- `company_id`
- `user_id`

It stores the upload in a temporary working directory, executes `run_full_audit.py`, and returns normalized JSON:

- `compliance_percent`
- `risk_level`
- `executive_dictamen`
- `top_critical_gaps`
- `report_pdf_url`

## Customs Pedimento Parsing

`POST /customs/parse-pedimento` accepts one multipart `file` containing either:

- XML del pedimento
- PDF del pedimento

It returns normalized JSON for the dashboard wizard:

- `document_type`
- `is_supported_as_primary_xml`
- `is_supported_as_primary_document`
- `confidence`
- `user_message`
- `detected_fields`
- `missing_fields`
- `data`
- `error_code`
- `warning`

For PDFs, the service first tries `pdftotext` from Poppler and falls back to a lightweight Python extractor. Install Poppler on Ubuntu:

```bash
sudo apt install poppler-utils -y
```

If neither strategy extracts enough text, the endpoint returns `PDF_TEXT_NOT_EXTRACTABLE`.

## Environment

```bash
AUDIT_PIPELINE_SCRIPT=/opt/lda/auditor-dashboard/pipeline/run_full_audit.py
AUDIT_PYTHON_BIN=/opt/lda/audit-api/.venv/bin/python
AUDIT_API_TMP_DIR=/tmp/lda-audit-api
AUDIT_REPORT_BASE_URL=https://your-domain.example/reports
AUDIT_PIPELINE_TIMEOUT_SECONDS=900
AUDIT_API_KEY=optional-shared-secret
```

If `AUDIT_API_KEY` is set, requests must send:

```text
Authorization: Bearer <AUDIT_API_KEY>
```

## Local Run

```bash
cd services/audit_api
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Ubuntu VPS Deployment

```bash
sudo mkdir -p /opt/lda/audit-api /opt/lda/auditor-dashboard
sudo cp -R services/audit_api/* /opt/lda/audit-api/
cd /opt/lda/audit-api
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
sudo cp deploy/lda-audit-api.service /etc/systemd/system/lda-audit-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now lda-audit-api
sudo systemctl status lda-audit-api
```

Point the Next.js app to:

```bash
AUDITOR_PIPELINE_URL=https://your-domain.example/audit/run
AUDIT_API_BASE_URL=https://your-domain.example
AUDIT_API_URL=https://your-domain.example/audit/run
AUDIT_API_KEY=shared-secret
```

`AUDIT_API_BASE_URL` is preferred for dashboard customs parsing. If it is not present, the Next.js proxy derives the base origin from `AUDIT_API_URL`.
