@echo off
echo [INFO] Starting OSRM preprocessing for foot profile...
echo.

REM Έλεγχος αν υπάρχει το OSM αρχείο
if not exist "osrm-server\greece-latest.osm.pbf" (
    echo [ERROR] File osrm-server\greece-latest.osm.pbf not found!
    echo Please download the Greece OSM data first.
    pause
    exit /b 1
)

echo [INFO] Running OSRM preprocessing...
echo This may take 10-30 minutes depending on your system...
echo.

REM Τρέχουμε το preprocessing σε ένα container
docker run --rm -v "%cd%\osrm-server:/data" osrm/osrm-backend:latest osrm-extract -p /opt/foot.lua /data/greece-latest.osm.pbf

if errorlevel 1 (
    echo [ERROR] OSRM extract failed!
    pause
    exit /b 1
)

docker run --rm -v "%cd%\osrm-server:/data" osrm/osrm-backend:latest osrm-partition /data/greece-latest.osrm

if errorlevel 1 (
    echo [ERROR] OSRM partition failed!
    pause
    exit /b 1
)

docker run --rm -v "%cd%\osrm-server:/data" osrm/osrm-backend:latest osrm-customize /data/greece-latest.osrm

if errorlevel 1 (
    echo [ERROR] OSRM customize failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] OSRM preprocessing completed!
echo [INFO] You can now start the server with: start-osrm-servers.bat
echo.
pause
