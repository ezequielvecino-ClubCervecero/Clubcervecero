@echo off
chcp 65001 >nul
title Club Cervecero
cd /d "%~dp0"

if not exist package.json (
  echo.
  echo No encuentro package.json en esta carpeta.
  echo Copia este archivo dentro de la carpeta del proyecto club-cervecero y volve a abrirlo.
  echo.
  pause
  exit /b 1
)

:menu
cls
echo ==============================================
echo            CLUB CERVECERO
echo ==============================================
echo.
echo   [1] Iniciar servidor local - localhost
echo   [2] Publicar en Vercel - git add, commit y push
echo   [3] Instalar dependencias - npm install
echo   [4] Salir
echo.
set "op="
set /p op=Elegi una opcion:
if "%op%"=="1" goto local
if "%op%"=="2" goto publicar
if "%op%"=="3" goto instalar
if "%op%"=="4" exit /b 0
goto menu

:local
cls
if not exist node_modules (
  echo Es la primera vez: instalando dependencias...
  call npm install
  if errorlevel 1 goto fallo
)
echo.
echo Iniciando el servidor local. Se abre el navegador en unos segundos.
echo Para detenerlo toca Ctrl + C en esta ventana.
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:5173"
call npm run dev
echo.
pause
goto menu

:instalar
cls
call npm install
if errorlevel 1 goto fallo
echo.
echo Listo: dependencias instaladas.
pause
goto menu

:publicar
cls
where git >nul 2>nul
if errorlevel 1 (
  echo Git no esta instalado o no esta en el PATH.
  pause
  goto menu
)
echo Cambios que se van a publicar:
echo ----------------------------------------------
git status --short
echo ----------------------------------------------
echo.
set "msg="
set /p msg=Describi el cambio, o Enter para usar "actualizacion":
if "%msg%"=="" set "msg=actualizacion"
echo.
git add .
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo No se creo un commit nuevo. Puede ser que no hubiera cambios.
  echo Igual intento enviar lo que tengas pendiente.
)
echo.
git push
if errorlevel 1 goto fallo
echo.
echo ==============================================
echo Listo: se envio a GitHub. Vercel publica solo.
echo En uno o dos minutos esta en tu dominio.
echo Despues abri la pagina y toca Ctrl + F5.
echo ==============================================
pause
goto menu

:fallo
echo.
echo Algo fallo. Lee el mensaje de arriba.
pause
goto menu
