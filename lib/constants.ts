// Estados del pedido (protocolo Amala)
export const ESTADOS = ['Pendiente de pago', 'En cocina', 'Listo para recoger', 'En camino', 'Entregado', 'Cancelado'] as const
export type Estado = (typeof ESTADOS)[number]

// Clases de color por estado (usar con <Chip/>)
export const ESTADO_COLOR: Record<string, string> = {
  'Pendiente de pago': 'chip-yellow',
  'En cocina': 'chip-orange',
  'Listo para recoger': 'chip-green',
  'En camino': 'chip-blue',
  'Entregado': 'chip-green',
  'Cancelado': 'chip-red',
}

export const MENU_CATS = ['Pizzas tradicionales', 'Pizzas especiales', 'Pizzas por mitades', 'Entradas', 'Tacos', 'Burritos', 'Quesadillas', 'Nachos', 'Dorilocos', 'Adicionales', 'Postres', 'Bebidas', 'Combazos']

export const METODOS_PAGO = ['Efectivo', 'Datáfono', 'Nequi', 'Transferencia', 'Llave']
// Pagos anticipados: requieren comprobante antes de entrar a cocina
export const PAGOS_ANTICIPADOS = ['Nequi', 'Transferencia', 'Llave']

export interface Pedido {
  id: string; sede_id?: string | null; num_pedido: string; fecha: string; hora: string; cliente: string
  cedula: string | null; telefono: string; direccion: string; ubicacion: string | null
  referencia: string | null; items: string; cantidad: number; subtotal: number
  descuento: number; total: number; estado: string; metodo_pago: string
  costo_domicilio: number; notas: string | null; user_ns: string; alerta: string | null
  valor_comprobante: number | null; cuenta_destino: string | null
  url_comprobante: string | null; id_comprobante: string | null
  inbox_url: string | null; created_at: string
}

export interface MenuItem {
  id: string; sede_id?: string | null; nombre: string; categoria: string; precio: number; tipo: string | null
  sabores: string | null; sabores_agotados?: string | null; descripcion: string | null; modificaciones: string | null
  activo: boolean; hora_fin: string | null
}

export interface Tarifa { id: string; sede_id?: string | null; barrio: string; precio: number; zona: string | null; hora_limite?: string | null }
export interface Cliente { id: string; nombre: string; cedula: string | null; telefono: string; user_ns: string; canal: string; total_pedidos: number; gasto_total: number; ultima_visita: string | null }
export interface Alerta { id: string; sede_id?: string | null; cliente: string; telefono: string; razon: string; user_ns: string; chat_link: string | null; estado: string; created_at: string }
export interface Reserva { id: string; sede_id?: string | null; num_reserva: string; cliente: string; telefono: string; motivo: string; fecha_reserva: string; hora_reserva: string; personas: number; tipo: string; notas: string; estado: string }
export interface Promo { id: string; sede_id?: string | null; codigo: string; nombre: string; descripcion: string; activa: boolean; imagen_url: string | null; dias: string | null; hora_inicio: string | null; hora_fin: string | null; activa_festivos: boolean; items: { nombre: string; precio: number }[] }
