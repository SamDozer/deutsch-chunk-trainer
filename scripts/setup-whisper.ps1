# ==============================================================================
# ChunkTrainer — Whisper AI Setup & Model Downloader
# ==============================================================================
[CmdletBinding()]
param(
    [ValidateSet('base', 'turbo')]
    [string]$Model = 'base',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ChunkTrainer - إعداد محرك التعرف الصوتي Whisper AI" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$appDataDir = Join-Path $env:APPDATA 'ChunkTrainer'
$whisperDir = Join-Path $appDataDir 'whisper'

if (-not (Test-Path $whisperDir)) {
    New-Item -ItemType Directory -Path $whisperDir -Force | Out-Null
}

# Specs check
$os = Get-CimInstance Win32_OperatingSystem
$totalRamGB = [Math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeRamGB = [Math]::Round($os.FreePhysicalMemory / 1MB, 1)
Write-Host "مواصفات جهازك: $totalRamGB GB RAM (المتاح: $freeRamGB GB)" -ForegroundColor Gray

# Models definition
$models = @{
    'base' = @{
        Name = 'ggml-base.bin'
        Url = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
        SizeLabel = '~142 MB'
        Desc = 'النموذج الخفيف والسريع — مناسب لكل الأجهزة حتى العادية'
    }
    'turbo' = @{
        Name = 'ggml-large-v3-turbo.bin'
        Url = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin'
        SizeLabel = '~1.5 GB'
        Desc = 'النموذج الاحترافي فائق الدقة — يحتاج جهاز قوي (8GB+ RAM)'
    }
}

$chosen = $models[$Model]
$targetPath = Join-Path $whisperDir $chosen.Name

Write-Host "`nالنموذج المختار: $($chosen.Name) ($($chosen.SizeLabel))" -ForegroundColor Cyan
Write-Host "$($chosen.Desc)" -ForegroundColor Gray

if ((Test-Path $targetPath) -and (-not $Force)) {
    $len = (Get-Item $targetPath).Length
    $lenMB = [Math]::Round($len / 1MB, 1)
    Write-Host "`nالنموذج موجود بالفعل في: $targetPath ($lenMB MB) ✅" -ForegroundColor Green
    Write-Host "إذا أردت إعادة التحميل، أضف بارامتر -Force" -ForegroundColor DarkGray
    exit 0
}

Write-Host "`nجاري تحميل النموذج من سيرفرات HuggingFace الرسمية..." -ForegroundColor Yellow
Write-Host "المسار الهدف: $targetPath" -ForegroundColor DarkGray

$tempPath = "$targetPath.part"
if (Test-Path $tempPath) { Remove-Item $tempPath -Force }

try {
    # Using WebClient or Invoke-WebRequest with progress
    $client = New-Object System.Net.WebClient
    $client.Headers.Add("User-Agent", "ChunkTrainer-CLI-Downloader")

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $client.DownloadFile($chosen.Url, $tempPath)
    $sw.Stop()

    Move-Item -Path $tempPath -Destination $targetPath -Force
    $finalMB = [Math]::Round((Get-Item $targetPath).Length / 1MB, 1)
    Write-Host "`nتم التحميل والتثبيت بنجاح في $($sw.Elapsed.TotalSeconds.ToString('F1')) ثانية! ($finalMB MB) 🎉" -ForegroundColor Green
    Write-Host "الآن يمكنك فتح التطبيق واستخدام ميزة تحويل الصوت لنص ألماني مباشرة." -ForegroundColor Cyan
} catch {
    if (Test-Path $tempPath) { Remove-Item $tempPath -Force -ErrorAction SilentlyContinue }
    Write-Host "`nحدث خطأ أثناء التحميل: $_" -ForegroundColor Red
    exit 1
}
