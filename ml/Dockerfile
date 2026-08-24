FROM python:3.10-alpine

WORKDIR /app

COPY requirements.txt .

# Install dependencies offline/online during build, no external calls at runtime
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
