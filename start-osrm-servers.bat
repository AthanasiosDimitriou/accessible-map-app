@echo off
echo Starting OSRM Foot Server...
echo.

REM Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running!
    echo Please install Docker Desktop and start it.
    pause
    exit /b 1
)

REM Start the OSRM server
echo Starting OSRM server with foot profile...
docker-compose up -d

if errorlevel 1 (
    echo ERROR: Failed to start OSRM server!
    pause
    exit /b 1
)

echo.
echo OSRM server is starting...
echo This may take several minutes for the first time as it processes the Greece OSM data.
echo.
echo You can check the status with: check-servers.bat
echo.
pause



