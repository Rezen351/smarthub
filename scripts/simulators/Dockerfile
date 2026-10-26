FROM python:3.12-alpine
WORKDIR /app
COPY modbus_scale_simulator.py .
EXPOSE 5020 5021 5022 8088
CMD ["python3", "-u", "modbus_scale_simulator.py"]
