# Base image
FROM python:3.12-slim

# Working directory
WORKDIR /app

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy pipeline package, public claims catalogue and the daily workflow that one claim reads
COPY pipeline /app/pipeline
COPY CLAIMS.md /app/CLAIMS.md
COPY .github/workflows/pages.yml /app/.github/workflows/pages.yml

# Install package with developer and test dependencies and configure non root user
RUN pip install --no-cache-dir -e "./pipeline[dev]" \
    && useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app

# Run as a non root user
USER appuser

# Default verification command
CMD ["python", "-m", "macro_event_lab", "verify"]
