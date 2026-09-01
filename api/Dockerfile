FROM python:3.12-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY rithmos_api ./rithmos_api
COPY schema ./schema
ENV PORT=8000
CMD ["sh", "-c", "python -m rithmos_api.migrate && uvicorn rithmos_api.main:app --host 0.0.0.0 --port ${PORT}"]
