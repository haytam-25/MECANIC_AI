/** Rutas de cada coche del garaje: /coche/:id, sus consultas, su informe médico, su diario de reparaciones y su cesta. */
export const carPath = (vehicleId: string) => `/coche/${vehicleId}`
export const chatsPath = (vehicleId: string) => `/coche/${vehicleId}/consultas`
/** Consulta guardada, o 'nuevo' para empezar una. */
export const chatPath = (vehicleId: string, conversationId: string) => `/coche/${vehicleId}/consultas/${conversationId}`
export const reportPath = (vehicleId: string) => `/coche/${vehicleId}/informe`
export const repairsPath = (vehicleId: string) => `/coche/${vehicleId}/reparaciones`
/** Reparación del diario para corregirla, o 'nueva' para apuntar una. */
export const repairPath = (vehicleId: string, repairId: string) => `/coche/${vehicleId}/reparaciones/${repairId}`
export const basketPath = (vehicleId: string) => `/coche/${vehicleId}/cesta`
