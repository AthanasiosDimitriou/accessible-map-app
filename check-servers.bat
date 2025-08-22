@echo off
echo Checking OSRM Server Status...
echo.

REM Check if container is running
docker ps --filter "name=osrm-foot-server" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo Testing OSRM API...
echo.

REM Test the OSRM API
curl -s "http://localhost:5000/route/v1/foot/23.7275,37.9838;23.7345,37.975?overview=full&geometries=geojson" >nul 2>&1

if errorlevel 1 (
    echo OSRM server is not responding
    echo.
    echo Possible issues:
    echo - Server is still starting up (wait a few minutes)
    echo - Server failed to start
    echo - Port 5000 is blocked
    echo.
    echo Check logs with: docker logs osrm-foot-server
) else (
    echo ✅ OSRM server is running and responding!
    echo.
    echo Test URL: http://localhost:5000/route/v1/foot/23.7275,37.9838;23.7345,37.975
)

echo.
pause



