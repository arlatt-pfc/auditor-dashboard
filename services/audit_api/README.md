# Audit API Service

FastAPI wrapper for the operational audit pipeline. It exposes:

```text
POST /audit/run
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
```

