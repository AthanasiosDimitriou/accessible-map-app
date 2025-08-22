@echo off
echo Stopping OSRM Server...
echo.

REM Stop the OSRM server
docker-compose down

if errorlevel 1 (
    echo ERROR: Failed to stop OSRM server!
    pause
    exit /b 1
)

echo.
echo ✅ OSRM server has been stopped.
echo.
pause



