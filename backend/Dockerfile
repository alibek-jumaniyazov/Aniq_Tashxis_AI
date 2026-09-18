FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-rus && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.lock.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ARG INSTALL_AI=false
COPY backend/requirements-ai.txt /tmp/requirements-ai.txt
RUN if [ "$INSTALL_AI" = "true" ]; then pip install --no-cache-dir -r /tmp/requirements-ai.txt; fi
COPY backend /app/backend
COPY frontend/dist /app/frontend/dist
COPY scripts /app/scripts
RUN useradd --create-home --uid 10001 aniq && mkdir -p /app/runtime/files && chown -R aniq:aniq /app/runtime
USER aniq
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
