@echo off
cd /d "%~dp0"
call npx expo start --lan > expo.log 2>&1
