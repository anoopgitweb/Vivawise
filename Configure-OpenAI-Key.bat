@echo off
setlocal
title Vivawise - Configure OpenAI
color 0B
cd /d "%~dp0"

echo.
echo  =====================================================
echo               VIVAWISE OPENAI SETUP
echo  =====================================================
echo.
echo  Your key will be stored locally in .env.local.
echo  It will not be displayed or added to GitHub.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$secure = Read-Host 'Enter your OpenAI API key' -AsSecureString; $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); if ([string]::IsNullOrWhiteSpace($key) -or -not $key.StartsWith('sk-')) { throw 'That does not look like an OpenAI API key.' }; $path='.env.local'; $lines=if(Test-Path $path){@(Get-Content -LiteralPath $path | Where-Object { $_ -notmatch '^OPENAI_(API_KEY|MODEL)=' })}else{@()}; $lines += ('OPENAI_API_KEY=' + $key); $lines += 'OPENAI_MODEL=gpt-5.6-terra'; $lines | Set-Content -LiteralPath $path -Encoding utf8; Write-Host ''; Write-Host 'Vivawise OpenAI configuration saved successfully.' -ForegroundColor Green } catch { Write-Host ''; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 } finally { if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) } }"

if errorlevel 1 (
    echo.
    echo  Configuration was not saved.
    pause
    exit /b 1
)

echo.
echo  You can now run Start-Vivawise.bat.
echo.
pause
endlocal
