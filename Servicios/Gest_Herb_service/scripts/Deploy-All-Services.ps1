param(
  [switch]$Install,                 # Fuerza npm install incluso si node_modules existe
  [switch]$Windows,                 # Si se especifica, abre ventanas separadas para cada servicio
  [int]$HealthTimeoutSec = 45       # Timeout por servicio para health check (aumentado para Vite)
)

# Este script automáticamente detecta y instala dependencias npm faltantes:
# - Verifica si existe node_modules en cada servicio
# - Instala dependencias automáticamente si faltan o están corruptas
# - Solo usa -Install para forzar reinstalación completa
# - Por defecto ejecuta servicios como jobs en background
# - Usa -Windows para abrir ventanas separadas de PowerShell

# Utilidades visuales
function Write-Info($msg){ Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg){ Write-Host $msg -ForegroundColor Green }
function Write-WarnLine($msg){ Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host $msg -ForegroundColor Red }

# Directorio raíz del proyecto (Scripts/..)
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Write-Info "Proyecto: $Root"

# Definición de servicios PRIMERA ENTREGA (50% Casos de Uso)
# Basado en: Autenticacion + Recepcion + Laboratorio + Admin + Interfaces Frontend
$services = @(
  # Servicios CORE (Primera Entrega)
  @{ Name = 'Auth_Service';         Path = (Join-Path $Root 'Servicios/Auth_Service');         Port = 3001; Health = '/health'; Start = 'node src/app.js' },
  @{ Name = 'Gest_Herb_service';    Path = (Join-Path $Root 'Servicios/Gest_Herb_service');    Port = 3002; Health = '/health'; Start = 'node src/app.js' },
  @{ Name = 'Api_Gateway';          Path = (Join-Path $Root 'Servicios/Api_Gateway');          Port = 3000; Health = '/health'; Start = 'node src/app.js' },
  
  # Servicios de NEGOCIO (Primera Entrega - Casos de Uso Prioritarios)
  @{ Name = 'Recepcion_service';    Path = (Join-Path $Root 'Servicios/Recepcion_service');    Port = 3004; Health = '/health'; Start = 'npm start' },
  @{ Name = 'Lab_Service';          Path = (Join-Path $Root 'Servicios/Lab_Service');          Port = 3005; Health = '/health'; Start = 'npm start' },
  
  # Servicio EXTERNO (Datos de Campo IFN - Conglomerados)
  @{ Name = 'Servicio_Externo_API'; Path = (Join-Path $Root 'Servicio_Externo_API');           Port = 4000; Health = '/health'; Start = 'npm start' },
  
  # Interfaces FRONTEND (Primera Entrega)
  @{ Name = 'Herbario_IFN';         Path = (Join-Path $Root 'Frontend/Herbario-ifn');          Port = 5173; Health = '/'; Start = 'npm run dev' }
)

function Test-NeedsInstall($svcPath){
  $pkg = Join-Path $svcPath 'package.json'
  $mods = Join-Path $svcPath 'node_modules'
  
  # Si no existe package.json, no es un proyecto Node.js
  if (-not (Test-Path $pkg)) { return $false }
  
  # Si se fuerza con -Install, siempre instalar
  if ($Install) { return $true }
  
  # Si no existe node_modules, necesita instalación
  if (-not (Test-Path $mods)) { return $true }
  
  # Verificar si node_modules está vacío o corrupto
  $modsContent = Get-ChildItem $mods -ErrorAction SilentlyContinue
  if (-not $modsContent -or $modsContent.Count -eq 0) { return $true }
  
  return $false
}

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
      
      # Ejecutar npm install con verbose para mejor debugging
      Write-Info "[${($svc.Name)}] npm install (esto puede tomar un momento...)"
      $installResult = npm install --no-audit --prefer-offline 2>&1
      
      if ($LASTEXITCODE -eq 0) {
        Write-Ok "[${($svc.Name)}] Dependencias instaladas correctamente"
        return $true
      } else {
        Write-Err "[${($svc.Name)}] npm install falló con código $LASTEXITCODE"
        Write-Err "Salida: $installResult"
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

function Start-ServiceProcess($svc){
  $path = $svc.Path
  $cmd = $svc.Start
  if ($Windows) {
    Write-Info "[${($svc.Name)}] Iniciando (ventana nueva)..."
    $escapedPath = $path -replace '"', '""'
    $commandLine = "Set-Location `"$escapedPath`"; $cmd"
    Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoExit','-Command', $commandLine) -WindowStyle Normal | Out-Null
  } else {
    Write-Info "[${($svc.Name)}] Iniciando (Job)..."
    $script = {
      param($p,$c)
      Set-Location "$p"
      & powershell -NoProfile -Command $c
    }
    Start-Job -Name $svc.Name -ScriptBlock $script -ArgumentList @($path, $cmd) | Out-Null
  }
}

function Wait-Healthy($svc){
  $url = "http://localhost:$($svc.Port)$($svc.Health)"
  $deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
  $attempts = 0
  do {
    $attempts++
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { 
        Write-Ok "[${($svc.Name)}] UP en $attempts intentos: $url"
        return $true 
      }
    } catch { 
      if ($attempts % 5 -eq 0) {
        Write-Info "[${($svc.Name)}] Esperando respuesta... (intento $attempts)"
      }
      Start-Sleep -Milliseconds 800 
    }
  } while ((Get-Date) -lt $deadline)
  Write-WarnLine "[${($svc.Name)}] No respondió a tiempo después de $attempts intentos: $url"
  return $false
}

Write-Info "=== PRIMERA ENTREGA - Despliegue de Servicios Prioritarios ==="
$launched = @()
$failed = @()

foreach ($svc in $services) {
  if (-not (Test-Path $svc.Path)) {
    Write-WarnLine "[${($svc.Name)}] No existe en el proyecto. Se omite."
    $failed += $svc.Name
    continue
  }

  # Verificar que tiene package.json (es un proyecto Node.js)
  $pkgPath = Join-Path $svc.Path 'package.json'
  if (-not (Test-Path $pkgPath)) {
    Write-WarnLine "[${($svc.Name)}] No es un proyecto Node.js (falta package.json). Se omite."
    $failed += $svc.Name
    continue
  }

  # Instalar dependencias
  $installSuccess = Install-ServiceDeps $svc
  if (-not $installSuccess) {
    Write-Err "[${($svc.Name)}] No se pudo instalar dependencias. Omitiendo servicio."
    $failed += $svc.Name
    continue
  }

  # Iniciar servicio
  Start-ServiceProcess $svc
  
  # Verificar que el servicio esté funcionando
  if (Wait-Healthy $svc) { 
    $launched += $svc 
  } else {
    $failed += $svc.Name
  }
}

Write-Info \"=== Resumen ===\"
Write-Info \"Servicios lanzados exitosamente:\"
foreach ($svc in $launched) {
  $url = \"http://localhost:$($svc.Port)\"
  Write-Ok (\"  [OK] {0,-24} -> {1}\" -f $svc.Name, $url)
}

if ($failed.Count -gt 0) {
  Write-WarnLine "Servicios que fallaron:"
  foreach ($failedName in $failed) {
    Write-WarnLine ("  [ERROR] {0}" -f $failedName)
  }
}

Write-Info \"=== PRIMERA ENTREGA LISTA ===\"
Write-Info \"Servicios desplegados: Autenticacion + Gestion Herbario + API Gateway + Recepcion + Laboratorio + Servicio Externo + Interfaces Frontend\"
Write-Info \"Casos de uso disponibles:\"
Write-Info \"  - Login diferenciado por rol (Recepcionista/Laboratorista/Admin)\"
Write-Info \"  - Recepcion: Registrar paquetes + muestras\"
Write-Info \"  - Laboratorio: Clasificacion taxonomica + foto + estados + firma\"
Write-Info \"  - Admin: Gestion de herbarios, usuarios, regiones, departamentos, municipios\"
Write-Info \"Interfaces disponibles:\"
Write-Info \"  - Herbario IFN: http://localhost:5173 (Recepcion, Laboratorio y Admin integrados)\"
Write-Info \"  - API Gateway: http://localhost:3000 (Orquestador de servicios)\"
Write-Info \"  - Servicio Externo: http://localhost:4000 (Datos de campo IFN - Conglomerados)\"
Write-Info ""
if ($Windows) {
  Write-Info "Servicios ejecutándose en ventanas separadas - revisa cada terminal para logs."
  Write-Info "Para detener servicios: .\Stop-All-Services.ps1"
} else {
  Write-Info "Servicios ejecutándose como jobs en background."
  Write-Info "Usar Get-Job/Receive-Job/Stop-Job para gestionar procesos, o .\Stop-All-Services.ps1 para detener todo."
}
