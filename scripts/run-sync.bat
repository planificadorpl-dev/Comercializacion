@echo off
setlocal
cd /d "c:\Users\jlima\Desktop\ventas"
echo [%date% %time%] Sincronizando con Google Sheets... >> "c:\Users\jlima\Desktop\ventas\scripts\sync.log"
node scripts\sync-sheets.js >> "c:\Users\jlima\Desktop\ventas\scripts\sync.log" 2>&1
echo [%date% %time%] Fin de sincronizacion. >> "c:\Users\jlima\Desktop\ventas\scripts\sync.log"
endlocal
