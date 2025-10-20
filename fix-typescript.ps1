# TypeScript Error Fix Script

Write-Host "🔧 Fixing TypeScript errors in Backend..." -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$FixedCount = 0

# Function to fix return type issues
function Fix-ReturnTypes {
    param($FilePath)
    
    Write-Host "Fixing: $FilePath" -ForegroundColor Yellow
    
    $content = Get-Content $FilePath -Raw
    $modified = $false
    
    # Fix async route handlers without return type
    if ($content -match 'async \(req.*?res.*?\) => \{' -and $content -notmatch ': Promise<void>') {
        $content = $content -replace '(async \(req.*?res.*?\)) => \{', '$1: Promise<void> => {'
        $modified = $true
    }
    
    # Fix middleware without return type
    if ($content -match '\(req.*?res.*?next.*?\) => \{' -and $content -notmatch ': void =>') {
        $content = $content -replace '(\(req.*?res.*?next.*?\)) => \{', '$1: void => {'
        $modified = $true
    }
    
    # Fix return statements to not return after res.json/send
    $content = $content -replace 'return res\.(json|send|status)\(', 'res.$1('
    $content = $content -replace '(\s+)(res\.(json|send|status)\([^\)]+\);)', '$1$2' + "`n" + '$1return;'
    
    if ($modified) {
        Set-Content -Path $FilePath -Value $content
        $script:FixedCount++
        Write-Host "  ✓ Fixed" -ForegroundColor Green
    }
}

# Get all TypeScript files in routes and middleware
$files = @(
    "Backend\src\routes\admin.ts",
    "Backend\src\routes\auth.ts",
    "Backend\src\routes\cart.ts",
    "Backend\src\routes\orders.ts",
    "Backend\src\routes\payments.ts",
    "Backend\src\routes\products.ts"
)

Write-Host "Files to fix: $($files.Count)" -ForegroundColor Blue
Write-Host ""

foreach ($file in $files) {
    if (Test-Path $file) {
        try {
            Fix-ReturnTypes -FilePath $file
        } catch {
            Write-Host "  ✗ Error: $_" -ForegroundColor Red
            $ErrorCount++
        }
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Fix Summary:" -ForegroundColor Cyan
Write-Host "  Files Fixed: $FixedCount" -ForegroundColor Green
Write-Host "  Errors: $ErrorCount" -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now running build to check..." -ForegroundColor Yellow

cd Backend
npm run build
