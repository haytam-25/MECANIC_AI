/** Rutas de cada coche del garaje: /coche/:id, sus consultas y su informe médico. */
export const carPath = (vehicleId: string) => `/coche/${vehicleId}`
export const chatsPath = (vehicleId: string) => `/coche/${vehicleId}/consultas`
/** Consulta guardada, o 'nuevo' para empezar una. */
export const chatPath = (vehicleId: string, conversationId: string) => `/coche/${vehicleId}/consultas/${conversationId}`
export const reportPath = (vehicleId: string) => `/coche/${vehicleId}/informe`
