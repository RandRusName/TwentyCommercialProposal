@echo off
setlocal EnableExtensions

set "EXIT_CODE=0"
set "PROJECT_DIR=%~dp0"

set "CLEAN_FLAG="
if /i "%~1"=="--clean" set "CLEAN_FLAG=--clean"

where wsl >nul 2>&1
if errorlevel 1 (
  echo ERROR: WSL is not installed or not available in PATH.
  echo Install WSL2 and a Linux distribution, then run this script again.
  set "EXIT_CODE=1"
  goto :finish
)

set "WSL_PROJECT_DIR="
for /f "usebackq delims=" %%i in (`wsl wslpath -a "%PROJECT_DIR%"`) do set "WSL_PROJECT_DIR=%%i"

if not defined WSL_PROJECT_DIR (
  echo ERROR: Failed to convert project path to WSL format.
  echo Project directory: %PROJECT_DIR%
  set "EXIT_CODE=1"
  goto :finish
)

echo Project directory (Windows): %PROJECT_DIR%
echo Project directory (WSL):     %WSL_PROJECT_DIR%
echo.

wsl bash "%WSL_PROJECT_DIR%/scripts/build-wsl.sh" %CLEAN_FLAG%
set "EXIT_CODE=%ERRORLEVEL%"

:finish
echo.
if %EXIT_CODE% equ 0 (
  echo BUILD FINISHED SUCCESSFULLY.
) else (
  echo BUILD FAILED with exit code %EXIT_CODE%.
)
pause
exit /b %EXIT_CODE%
