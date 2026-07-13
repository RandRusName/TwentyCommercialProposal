@echo off
setlocal EnableExtensions

set "EXIT_CODE=0"
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "DEPLOY_ARGS="
:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--clean" (
  set "DEPLOY_ARGS=%DEPLOY_ARGS% --clean"
  shift
  goto parse_args
)
if /i "%~1"=="--no-install" (
  set "DEPLOY_ARGS=%DEPLOY_ARGS% --no-install"
  shift
  goto parse_args
)
if /i "%~1"=="--no-bump" (
  set "DEPLOY_ARGS=%DEPLOY_ARGS% --no-bump"
  shift
  goto parse_args
)
echo ERROR: Unknown argument: %~1
echo Usage: deploy.bat [--clean] [--no-install] [--no-bump]
set "EXIT_CODE=1"
goto finish
:args_done

where wsl >nul 2>&1
if errorlevel 1 (
  echo ERROR: WSL is not installed or not available in PATH.
  echo Install WSL2 and a Linux distribution, then run this script again.
  set "EXIT_CODE=1"
  goto finish
)

set "WSL_PROJECT_DIR="
for /f "usebackq delims=" %%i in (`wsl wslpath -a "%PROJECT_DIR%"`) do set "WSL_PROJECT_DIR=%%i"

if not defined WSL_PROJECT_DIR (
  echo ERROR: Failed to convert project path to WSL format.
  echo Project directory: %PROJECT_DIR%
  set "EXIT_CODE=1"
  goto finish
)

echo Project directory (Windows): %PROJECT_DIR%
echo Project directory (WSL):     %WSL_PROJECT_DIR%
echo.

wsl bash "%WSL_PROJECT_DIR%/scripts/deploy-wsl.sh" %DEPLOY_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

:finish
echo.
if %EXIT_CODE% equ 0 (
  echo DEPLOY FINISHED SUCCESSFULLY.
) else (
  echo DEPLOY FAILED with exit code %EXIT_CODE%.
)
pause
exit /b %EXIT_CODE%
