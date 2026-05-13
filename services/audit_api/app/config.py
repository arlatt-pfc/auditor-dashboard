from functools import lru_cache
from pathlib import Path
import os
import sys


class Settings:
    def __init__(self) -> None:
        self.api_key = os.getenv("AUDIT_API_KEY", "").strip()
        self.pipeline_script = Path(
            os.getenv("AUDIT_PIPELINE_SCRIPT", "/opt/lda/auditor-dashboard/pipeline/run_full_audit.py")
        )
        self.python_bin = os.getenv("AUDIT_PYTHON_BIN", sys.executable)
        self.report_base_url = os.getenv("AUDIT_REPORT_BASE_URL", "").rstrip("/")
        self.timeout_seconds = int(os.getenv("AUDIT_PIPELINE_TIMEOUT_SECONDS", "900"))
        self.tmp_dir = Path(os.getenv("AUDIT_API_TMP_DIR", "/tmp/lda-audit-api"))


@lru_cache
def get_settings() -> Settings:
    return Settings()

