param(
  [switch]$Gentle,           # Si se especifica, solo muestra procesos sin terminarlos
  [switch]$KeepNodeModules   # Si se especifica, mantiene las carpetas node_modules
)

# Este script detiene todos los servicios y por defecto elimina las carpetas node_modules
# para ahorrar espacio en disco. Use -KeepNodeModules si desea mantenerlas.
# Funcionalidades:
# - Detiene procesos en puertos de servicios de la Primera Entrega
# - Detiene jobs de PowerShell relacionados
# - Elimina carpetas node_modules de todos los servicios (configurable)

function Write-Info($msg){ Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg){ Write-Host $msg -ForegroundColor Green }
function Write-WarnLine($msg){ Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host $msg -ForegroundColor Red }

Write-Info "=== Deteniendo servicios PRIMERA ENTREGA ==="

# Directorio raíz del proyecto (Scripts/..)
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

# Definición de servicios (misma lista que Deploy-All-Services.ps1)
$services = @(
  # Servicios CORE
  @{ Name = 'Auth_Service';         Path = (Join-Path $Root 'Servicios/Auth_Service') },
  @{ Name = 'Gest_Herb_service';    Path = (Join-Path $Root 'Servicios/Gest_Herb_service') },
  @{ Name = 'Api_Gateway';          Path = (Join-Path $Root 'Servicios/Api_Gateway') },
  
  # Servicios de NEGOCIO
  @{ Name = 'Recepcion_service';    Path = (Join-Path $Root 'Servicios/Recepcion_service') },
  @{ Name = 'Lab_Service';          Path = (Join-Path $Root 'Servicios/Lab_Service') },
  
  # Servicio EXTERNO
  @{ Name = 'Servicio_Externo_API'; Path = (Join-Path $Root 'Servicio_Externo_API') },
  
  # Interfaces FRONTEND
  @{ Name = 'Admin_App';            Path = (Join-Path $Root 'Frontend/Admin_App') },
  @{ Name = 'Herbario_IFN';         Path = (Join-Path $Root 'Frontend/Herbario-ifn') }
)

# Detener jobs si existen
$jobs = Get-Job -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "(Service|App|IFN)" }
if ($jobs) {
  Write-Info "Deteniendo jobs..."
  $jobs | Stop-Job
  $jobs | Remove-Job
  Write-Ok "Jobs detenidos: $($jobs.Count) jobs eliminados"
}

# Puertos de PRIMERA ENTREGA (servicios + interfaces frontend)
$ports = @(
  3001,  # Auth_Service - Autenticación con roles
  3002,  # Gest_Herb_service - Gestión central de datos
  3000,  # Api_Gateway - Gateway principal
  3004,  # Recepcion_service - Flujo de recepción
  3005,  # Lab_Service - Clasificación taxonómica
  4000,  # Servicio_Externo_API - Datos de campo IFN (Conglomerados)
  5173,  # Frontend Herbario-ifn (Vite dev server)
  5174,  # Frontend Admin_App (Vite dev server)
  5175,  # Frontend Herbario-ifn (puerto alternativo Vite)
  5176   # Frontend Admin_App (puerto alternativo Vite)
)

Write-Info "Buscando procesos en puertos: $($ports -join ', ')"
$processesFound = 0

foreach ($port in $ports) {
  try {
    $connections = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
    foreach ($conn in $connections) {
      $parts = $conn.ToString().Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
      $processId = $parts[-1]
      if ($processId -match '^\d+$') {
        try {
          $process = Get-Process -Id $processId -ErrorAction Stop
          $processesFound++
          Write-WarnLine "Puerto $port -> PID $processId ($($process.ProcessName))"
          
          if ($Gentle) {
            Write-Info "  [MODO GENTIL] Proceso encontrado pero no terminado"
          } else {
            try {
              Stop-Process -Id $processId -Force -ErrorAction Stop
              Write-Ok "  [OK] Proceso $processId terminado forzadamente"
              Start-Sleep -Milliseconds 100  # Pequeña pausa para asegurar terminación
            } catch {
              Write-WarnLine "  [ERROR] Error terminando proceso $processId`: $($_.Exception.Message)"
            }
          }
        } catch {
          Write-WarnLine "  No se pudo obtener info del proceso $processId (puede que ya haya terminado)"
        }
      }
    }
  } catch {
    Write-WarnLine "Error verificando puerto $port`: $($_.Exception.Message)"
  }
}

function Remove-NodeModules($services) {
  Write-Info ""
  Write-Info "=== Limpiando carpetas node_modules ==="
  $removed = 0
  $failed = 0
  
  foreach ($svc in $services) {
    if (-not (Test-Path "$($svc.Path)")) {
      Write-WarnLine "[${($svc.Name)}] Directorio no existe, se omite"
      continue
    }
    
    $nodeModulesPath = Join-Path "$($svc.Path)" 'node_modules'
    if (Test-Path "$nodeModulesPath") {
      try {
        Write-Info "[${($svc.Name)}] Eliminando node_modules..."
        Remove-Item "$nodeModulesPath" -Recurse -Force -ErrorAction Stop
        Write-Ok "[${($svc.Name)}] [OK] node_modules eliminado"
        $removed++
      } catch {
        Write-Err "[${($svc.Name)}] [ERROR] Error eliminando node_modules: $($_.Exception.Message)"
        $failed++
      }
    } else {
      Write-Info "[${($svc.Name)}] node_modules no existe, se omite"
    }
  }
  
  Write-Info "Limpieza completada: $removed eliminados, $failed fallidos"
}

Write-Info ""
if ($Gentle) {
  Write-Info "=== MODO GENTIL - Solo mostrar procesos ==="
  Write-Info "Se encontraron $processesFound procesos en puertos de Primera Entrega"
  Write-Info "Para terminarlos forzadamente, ejecute sin -Gentle:"
  Write-Info "  .\Scripts\Stop-All-Services.ps1"
  Write-Info "Para mantener node_modules despues de detener servicios:"
  Write-Info "  .\Scripts\Stop-All-Services.ps1 -KeepNodeModules"
} else {
  Write-Info "=== PRIMERA ENTREGA - Limpieza de puertos completada ==="
  Write-Ok "Servicios detenidos: Auth + Gest_Herb + API_Gateway + Recepcion + Lab + Servicio_Externo + Interfaces Frontend"
  Write-Info "Puertos liberados: 3001, 3002, 3000, 3004, 3005, 4000, 5173"
  if ($processesFound -eq 0) {
    Write-Ok "Ningun proceso encontrado en los puertos objetivo"
  } else {
    Write-Ok "$processesFound procesos terminados forzadamente"
  }
  
  # Limpiar node_modules a menos que se especifique lo contrario
  if (-not $KeepNodeModules) {
    Remove-NodeModules $services
  } else {
    Write-Info "Se mantuvieron las carpetas node_modules (parametro -KeepNodeModules)"
  }
}

Write-Ok "Listo."