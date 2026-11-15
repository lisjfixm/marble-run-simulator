@echo off
cd /d "%~dp0"
echo Marble Run Simulator v1.0.0
echo Serving on http://127.0.0.1:8775/
py -m http.server 8775
pause
