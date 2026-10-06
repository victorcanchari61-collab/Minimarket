@echo off
rem Arranca la API de MiniMarket (puerto 8080) en segundo plano, sin ventana.
rem Si ya esta corriendo, no hace nada. El registro queda en bin\api.log.
tasklist /FI "IMAGENAME eq api.exe" | find /I "api.exe" >nul && (echo La API ya esta corriendo. & exit /b 0)
cd /d "%~dp0"
if not exist bin\api.exe (
    set "PATH=%PATH%;C:\Program Files\Go\bin"
    go build -o bin\api.exe .\cmd\api || exit /b 1
)
start "" /B /MIN cmd /c "bin\api.exe >> bin\api.log 2>&1"
echo API iniciada en http://localhost:8080
