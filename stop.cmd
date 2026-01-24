@echo off
setlocal

set PID_FILE=dev.pid

if not exist "%PID_FILE%" (
  echo PID файл не найден
  exit /b 1
)

set PORT=3030

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen | Select-Object -ExpandProperty OwningProcess |Sort-Object -Unique |ForEach-Object {Stop-Process -Id $_ -Force}"

echo Процесс остановлен

endlocal