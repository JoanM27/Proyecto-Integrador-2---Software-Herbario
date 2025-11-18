// Modelo de dominio: Usuario
export class Usuario {
  constructor(data = {}) {
    this.id = data.id || null
    this.cedula = data.cedula || null
    this.rol = data.rol || null
    this.id_herbario = data.id_herbario || null
    this.info = data.info || new InfoUsuario(data)
  }

  // Métodos de negocio
  esAdmin() {
    return this.rol === 'admin' || this.rol === 'super_admin'
  }

  esLaboratorista() {
    return this.rol === 'laboratorista'
  }

  esRecepcionista() {
    return this.rol === 'recepcionista'
  }

  puedeClasificar() {
    return this.esLaboratorista() || this.esAdmin()
  }

  puedeGestionarPaquetes() {
    return this.esRecepcionista() || this.esAdmin()
  }

  toJSON() {
    return {
      id: this.id,
      cedula: this.cedula,
      rol: this.rol,
      id_herbario: this.id_herbario,
      ...this.info.toJSON()
    }
  }
}

export class InfoUsuario {
  constructor(data = {}) {
    this.nombre_completo = data.nombre_completo || data.nombre || ''
    this.correo_electronico = data.correo_electronico || data.email || ''
    this.telefono = data.telefono || null
  }

  toJSON() {
    return {
      nombre_completo: this.nombre_completo,
      correo_electronico: this.correo_electronico,
      telefono: this.telefono
    }
  }
}
