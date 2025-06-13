/**
 * Calcula el tiempo de inactividad de una luminaria en horas
 * Considerando que las luminarias funcionan de 6PM (18:00) a 6AM (06:00)
 *
 * @param reportDate Fecha del reporte (YYYY-MM-DD)
 * @param reportTime Hora del reporte (HH:MM:SS)
 * @param fixDate Fecha de la reparación (YYYY-MM-DD)
 * @param fixTime Hora de la reparación (HH:MM:SS)
 * @returns Horas de inactividad
 */
export function calculateDowntime(reportDate: string, reportTime: string, fixDate: string, fixTime: string): number {
  // Convertir fechas y horas a objetos Date
  const reportDateTime = new Date(`${reportDate}T${reportTime}`)
  const fixDateTime = new Date(`${fixDate}T${fixTime}`)

  // Calcular la diferencia en días
  const diffTime = fixDateTime.getTime() - reportDateTime.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Extraer horas de reporte y reparación
  const reportHour = reportDateTime.getHours() + reportDateTime.getMinutes() / 60
  const fixHour = fixDateTime.getHours() + fixDateTime.getMinutes() / 60

  // Calcular horas de inactividad
  let downtimeHours = 0

  // Caso 1: Mismo día
  if (diffDays === 0) {
    // Si el reporte y la reparación ocurren el mismo día
    if (reportHour >= 18 && fixHour <= 6) {
      // Ambos dentro del horario de funcionamiento
      downtimeHours = fixHour + (24 - reportHour)
    } else if (reportHour >= 18 && fixHour > 6) {
      // Reporte en horario de funcionamiento, reparación fuera
      downtimeHours = 12 - (reportHour - 18)
    } else if (reportHour < 6 && fixHour <= 6) {
      // Ambos en horario de funcionamiento (madrugada)
      downtimeHours = fixHour - reportHour
    } else {
      // Fuera del horario de funcionamiento
      downtimeHours = 0
    }
  }
  // Caso 2: Días diferentes
  else {
    // Horas del primer día
    if (reportHour >= 18) {
      downtimeHours += 12 - (reportHour - 18)
    } else if (reportHour < 6) {
      downtimeHours += 6 - reportHour
    }

    // Horas del último día
    if (fixHour <= 6) {
      downtimeHours += fixHour
    } else if (fixHour > 6 && fixHour < 18) {
      downtimeHours += 6
    } else {
      downtimeHours += 6 + (fixHour - 18)
    }

    // Días completos entre medio (12 horas por día)
    if (diffDays > 1) {
      downtimeHours += (diffDays - 1) * 12
    }
  }

  return Math.max(0, downtimeHours)
}
