# Deploy All Services with Visible Windows
# Sistema Herbario Digital IFN
# Despliega todos los servicios con ventanas de PowerShell visibles

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     HERBARIO DIGITAL IFN - DEPLOYMENT CON VENTANAS" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Directorio raíz del proyecto (Scripts/..)
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Write-Host "Proyecto: $Root" -ForegroundColor Cyan

# Definición de servicios PRIMERA ENTREGA (igual que Deploy-All-Services.ps1)
$services = @(
  # Servicios CORE
  @{ Name = 'Auth_Service';         Path = (Join-Path $Root 'Servicios/Auth_Service');         Port = 3001; Health = '/health'; Start = 'npm start' },
  @{ Name = 'Gest_Herb_service';    Path = (Join-Path $Root 'Servicios/Gest_Herb_service');    Port = 3002; Health = '/health'; Start = 'npm start' },
  @{ Name = 'Api_Gateway';          Path = (Join-Path $Root 'Servicios/Api_Gateway');          Port = 3000; Health = '/health'; Start = 'npm start' },
  
  # Servicios de NEGOCIO
  @{ Name = 'Recepcion_service';    Path = (Join-Path $Root 'Servicios/Recepcion_service');    Port = 3004; Health = '/health'; Start = 'npm start' },
  @{ Name = 'Lab_Service';          Path = (Join-Path $Root 'Servicios/Lab_Service');          Port = 3005; Health = '/health'; Start = 'npm start' },
  
  # Servicio EXTERNO (Datos de Campo IFN - Conglomerados)
  @{ Name = 'Servicio_Externo_API'; Path = (Join-Path $Root 'Servicio_Externo_API');           Port = 4000; Health = '/health'; Start = 'npm start' },
  
  # Interfaces FRONTEND
  @{ Name = 'Herbario_IFN';         Path = (Join-Path $Root 'Frontend/Herbario-ifn');          Port = 5173; Health = '/'; Start = 'npm run dev' }
)

# Utilidades visuales
function Write-Ok($msg){ Write-Host $msg -ForegroundColor Green }
function Write-WarnLine($msg){ Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host $msg -ForegroundColor Red }
function Write-Info($msg){ Write-Host $msg -ForegroundColor Cyan }

# Verificar si necesita npm install
function Test-NeedsInstall($svcPath){
  $pkg = Join-Path $svcPath 'package.json'
  $mods = Join-Path $svcPath 'node_modules'
  
  # Si no existe package.json, no es un proyecto Node.js
  if (-not (Test-Path $pkg)) { return $false }
  
  # Si no existe node_modules, necesita instalación
  if (-not (Test-Path $mods)) { return $true }
  
  # Verificar si node_modules está vacío o corrupto
  $modsContent = Get-ChildItem $mods -ErrorAction SilentlyContinue
  if (-not $modsContent -or $modsContent.Count -eq 0) { return $true }
  
  return $false
}

# Instalar dependencias de un servicio
function Install-ServiceDeps($svc){
  if (Test-NeedsInstall $svc.Path) {
    Write-Info "[${($svc.Name)}] Instalando dependencias npm..."
    Push-Location $svc.Path
    try {
      # Verificar que npm esté disponible
      $npmVersion = npm --version 2>$null
      if (-not $npmVersion) {
        Write-Err "[${($svc.Name)}] npm no está disponible. Instala Node.js primero."
        return $false
      }
      
      # Ejecutar npm install
      Write-Info "[${($svc.Name)}] npm install (esto puede tomar un momento...)"
      $installResult = npm install --no-audit --prefer-offline 2>&1
      
      if ($LASTEXITCODE -eq 0) {
        Write-Ok "[${($svc.Name)}] Dependencias instaladas correctamente"
        return $true
      } else {
        Write-Err "[${($svc.Name)}] npm install falló con código $LASTEXITCODE"
        return $false
      }
    } catch {
      Write-Err "[${($svc.Name)}] Error durante npm install: $($_.Exception.Message)"
      return $false
    } finally { 
      Pop-Location 
    }
  } else {
    Write-Info "[${($svc.Name)}] Dependencias ya están instaladas"
    return $true
  }
}

# Desplegar un servicio en ventana visible
function Deploy-ServiceWithWindow {
    param(
        [PSCustomObject]$Service
    )
    
    $Name = $Service.Name
    $Path = $Service.Path
    $Port = $Service.Port
    $Cmd = $Service.Start
    
    Write-Info "[$Name] Iniciando en ventana visible (Puerto $Port)..."
    
    if (-not (Test-Path $Path)) {
        Write-Err "  [ERROR] Directorio no encontrado: $Path"
        return $false
    }
    
    # Instalar dependencias si es necesario
    $installSuccess = Install-ServiceDeps $Service
    if (-not $installSuccess) {
        Write-Err "[$Name] No se pudo instalar dependencias. Omitiendo servicio."
        return $false
    }
    
    # Crear comando para la nueva ventana con validación mejorada
    $escapedPath = $Path -replace '"', '""'
    $commandLine = @"
`$ErrorActionPreference = 'Continue'
Set-Location '$escapedPath'
Write-Host '=====================================' -ForegroundColor Cyan
Write-Host '  $Name (Puerto $Port)' -ForegroundColor Cyan
Write-Host '=====================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Iniciando: $Cmd' -ForegroundColor Yellow
Write-Host ''
$Cmd
"@
    
    # Abrir nueva ventana de PowerShell
    try {
        Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-Command", $commandLine -ErrorAction Stop | Out-Null
        Write-Ok "  [OK] Ventana abierta para $Name"
        return $true
    } catch {
        Write-Err "  [ERROR] No se pudo abrir ventana: $($_.Exception.Message)"
        return $false
    }
}

# Iniciar despliegue
Write-Host ""
Write-Info "=== INSTALANDO DEPENDENCIAS Y ABRIENDO VENTANAS ===" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failedServices = @()

foreach ($svc in $services) {
  if (-not (Test-Path $svc.Path)) {
    Write-WarnLine "[$($svc.Name)] No existe en el proyecto. Se omite."
    $failedServices += $svc.Name
    continue
  }

  # Verificar que tiene package.json
  $pkgPath = Join-Path $svc.Path 'package.json'
  if (-not (Test-Path $pkgPath)) {
    Write-WarnLine "[$($svc.Name)] No es un proyecto Node.js (falta package.json). Se omite."
    $failedServices += $svc.Name
    continue
  }

  $result = Deploy-ServiceWithWindow -Service $svc
  
  if ($result) {
    $successCount++
  } else {
    $failedServices += $svc.Name
  }
  
  Start-Sleep -Seconds 1
}

Write-Host ""
Write-Info "========================================================" -ForegroundColor Cyan
Write-Info "  DEPLOYMENT INICIADO" -ForegroundColor Cyan
Write-Info "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Ok "Servicios lanzados: $successCount"
if ($failedServices.Count -gt 0) {
  Write-Err "Servicios que fallaron: $($failedServices -join ', ')"
}
Write-Host ""
Write-WarnLine "NOTA: Cada servicio tiene su propia ventana de PowerShell" 
Write-WarnLine "      Revisa cada ventana para ver logs y errores"
Write-Host ""
Write-Info "Esperando 10 segundos para que los servicios inicien..." -ForegroundColor Cyan

Start-Sleep -Seconds 10

Write-Host ""
Write-Info "=== HEALTH CHECK ===" -ForegroundColor Cyan
Write-Host ""

# Health check de cada servicio
foreach ($svc in $services) {
    if (-not (Test-Path $svc.Path)) { continue }
    
    Write-Host "Verificando $($svc.Name)..." -NoNewline
    
    try {
        $url = "http://localhost:$($svc.Port)$($svc.Health)"
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Ok " [OK] Puerto $($svc.Port)"
    } catch {
        Write-Err " [ERROR] No responde"
    }
}

Write-Host ""
Write-Info \"========================================================\" -ForegroundColor Cyan
Write-Host \"\"
Write-Info \"URLs de los servicios:\" -ForegroundColor Cyan
Write-Host \"  - Auth Service:         http://localhost:3001\" -ForegroundColor Green
Write-Host \"  - Gest Herb Service:    http://localhost:3002\" -ForegroundColor Yellow
Write-Host \"  - API Gateway:          http://localhost:3000\" -ForegroundColor Magenta
Write-Host \"  - Recepcion Service:    http://localhost:3004\" -ForegroundColor Cyan
Write-Host \"  - Lab Service:          http://localhost:3005\" -ForegroundColor Blue
Write-Host \"  - Servicio Externo:     http://localhost:4000\" -ForegroundColor DarkCyan
Write-Host \"  - Frontend (Herbario):  http://localhost:5173\" -ForegroundColor White
Write-Host ""
Write-WarnLine "CREDENCIALES DE ACCESO:" -ForegroundColor Yellow
Write-Host "  Admin:         admin@ifn.gov.co / admin123" -ForegroundColor Cyan
Write-Host "  Recepcionista: maria.rodriguez@ifn.gov.co / password123" -ForegroundColor Cyan
Write-Host "  Laboratorista: carlos.vargas@ifn.gov.co / password123" -ForegroundColor Cyan
Write-Host ""
Write-WarnLine "Para detener los servicios:" -ForegroundColor Yellow
Write-Host "  - Cierra cada ventana de PowerShell manualmente" -ForegroundColor Yellow
Write-Host "  - O ejecuta: .\Stop-All-Services.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Info "========================================================" -ForegroundColor Cyan
Write-Host ""