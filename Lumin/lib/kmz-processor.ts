import JSZip from "jszip"
import { DOMParser } from "@xmldom/xmldom"

interface KMLPoint {
  id: string
  lat: number
  lng: number
  name?: string
  description?: string
}

export async function processKMZFile(file: File): Promise<KMLPoint[]> {
  try {
    // Leer el archivo KMZ como un archivo ZIP
    const zip = new JSZip()
    const zipContent = await zip.loadAsync(file)

    // Buscar el archivo KML dentro del ZIP
    let kmlContent = ""
    let kmlFile = null

    // Buscar el archivo doc.kml o cualquier archivo .kml
    for (const filename in zipContent.files) {
      if (filename.toLowerCase() === "doc.kml" || filename.toLowerCase().endsWith(".kml")) {
        kmlFile = zipContent.files[filename]
        break
      }
    }

    if (!kmlFile) {
      throw new Error("No se encontró un archivo KML dentro del archivo KMZ")
    }

    // Extraer el contenido del archivo KML
    kmlContent = await kmlFile.async("text")

    // Parsear el XML del KML
    const parser = new DOMParser()
    const kmlDoc = parser.parseFromString(kmlContent, "text/xml")

    // Extraer los puntos (Placemarks) del KML
    const placemarks = kmlDoc.getElementsByTagName("Placemark")
    const points: KMLPoint[] = []

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i]

      // Obtener el nombre del punto (si existe)
      const nameElements = placemark.getElementsByTagName("name")
      const name = nameElements.length > 0 ? nameElements[0].textContent?.trim() : null

      // Obtener la descripción (si existe)
      const descElements = placemark.getElementsByTagName("description")
      const description = descElements.length > 0 ? descElements[0].textContent?.trim() : ""

      // Buscar las coordenadas del punto
      const coordinates = placemark.getElementsByTagName("coordinates")

      if (coordinates.length > 0) {
        const coordText = coordinates[0].textContent?.trim()

        if (coordText) {
          // Las coordenadas en KML están en formato: longitud,latitud,altitud
          const [lng, lat, _] = coordText.split(",").map(Number.parseFloat)

          if (!isNaN(lat) && !isNaN(lng)) {
            points.push({
              id: name || `Punto_${i + 1}`, // Usar el nombre real o un fallback
              lat,
              lng,
              name: name || `Punto ${i + 1}`,
              description: description || undefined,
            })
          }
        }
      }
    }

    return points
  } catch (error) {
    console.error("Error procesando archivo KMZ:", error)
    throw error
  }
}
