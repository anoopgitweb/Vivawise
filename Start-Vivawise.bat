@echo off
setlocal
title Vivawise - Local App
color 0B

cd /d "%~dp0"

set "CODEX_NODE_DIR=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"

if not exist ".env.local" (
    echo.
    echo  NOTE: OpenAI is not configured for local AI responses yet.
    echo  Run Configure-OpenAI-Key.bat to enable the real examiner.
    echo.
)

echo.
echo  =====================================================
echo                  VIVAWISE LOCAL APP
echo  =====================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    if exist "%CODEX_NODE_DIR%\node.exe" (
        set "PATH=%CODEX_NODE_DIR%;%PATH%"
        echo  Using the Node.js runtime included with Codex.
        echo.
    ) else (
        echo  Node.js was not found on this computer.
        echo.
        echo  Please install Node.js 22 or newer from:
        echo  https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 22 (
    echo  Vivawise requires Node.js 22 or newer.
    echo  Your installed version is:
    node --version
    echo.
    echo  Download the current version from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\vinext.cmd" (
    echo  Preparing Vivawise for its first run...
    echo  This may take a few minutes.
    echo.

    if exist "%CODEX_PNPM%" (
        call "%CODEX_PNPM%" install
    ) else (
        where corepack >nul 2>&1
        if errorlevel 1 (
            call npm install
        ) else (
            call corepack pnpm install
        )
    )

    if errorlevel 1 (
        echo.
        echo  Vivawise could not install its required packages.
        echo  Please check your internet connection and try again.
        echo.
        pause
        exit /b 1
    )
)

set "WRANGLER_LOG_PATH=.wrangler\wrangler.log"

echo  Starting Vivawise...
echo  Your browser will open at http://localhost:3000
echo.
echo  Keep this window open while using the app.
echo  Press Ctrl+C in this window when you want to stop it.
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"

if exist "%CODEX_PNPM%" (
    call "%CODEX_PNPM%" exec vinext dev
) else (
    where corepack >nul 2>&1
    if errorlevel 1 (
        call npx vinext dev
    ) else (
        call corepack pnpm exec vinext dev
    )
)

echo.
echo  Vivawise has stopped.
pause
endlocal
