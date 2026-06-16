@echo off
REM ============================================================
REM  Simpan perubahan ke GitHub (klik dua kali file ini)
REM  Pustaka Tunas Harapan
REM ============================================================
cd /d "%~dp0"

echo.
echo === Menyimpan perubahan ke GitHub ===
echo.

git add -A
git commit -m "Update %date% %time%"
git push

echo.
echo === Selesai. Tekan tombol apa saja untuk menutup. ===
pause >nul
