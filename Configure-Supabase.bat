@echo off
setlocal
title Vivawise - Configure Supabase
color 0B
cd /d "%~dp0"

echo.
echo  =====================================================
echo              VIVAWISE SUPABASE SETUP
echo  =====================================================
echo.
echo  Project: xvcjshnguzddzvpfxjmy
echo  Keys will be stored only in the Git-ignored .env.local file.
echo  The secret key will not be displayed.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$url='https://xvcjshnguzddzvpfxjmy.supabase.co'; $publishable=Read-Host 'Enter the Supabase publishable key (sb_publishable_...)'; $secure=Read-Host 'Enter the Supabase secret key (sb_secret_...)' -AsSecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); if (-not $publishable.StartsWith('sb_publishable_')) { throw 'That does not look like a Supabase publishable key.' }; if (-not $secret.StartsWith('sb_secret_')) { throw 'That does not look like a Supabase secret key.' }; $path='.env.local'; $lines=if(Test-Path $path){@(Get-Content -LiteralPath $path | Where-Object { $_ -notmatch '^SUPABASE_(URL|PUBLISHABLE_KEY|SECRET_KEY)=' })}else{@()}; $lines += 'SUPABASE_URL=' + $url; $lines += 'SUPABASE_PUBLISHABLE_KEY=' + $publishable; $lines += 'SUPABASE_SECRET_KEY=' + $secret; $lines | Set-Content -LiteralPath $path -Encoding utf8; Write-Host ''; Write-Host 'Vivawise Supabase configuration saved successfully.' -ForegroundColor Green } catch { Write-Host ''; Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 } finally { if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)} }"

if errorlevel 1 (
  echo.
  echo  Configuration was not saved.
  pause
  exit /b 1
)

echo.
echo  Return to Codex after this completes so the database can be initialized.
echo.
pause
endlocal
