"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface MapMarker {
  id: string
  position: [number, number]
  status: string
  onClick: () => void
}

interface MapComponentProps {
  center: [number, number]
  zoom: number
  markers: MapMarker[]
  selectedMarker: string | null
}

export default function MapComponent({ center, zoom, markers, selectedMarker }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<{ [key: string]: L.Marker }>({})

  useEffect(() => {
    // Inicializar el mapa si no existe
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView(center, zoom)

      // Añadir capa de mapa base (OpenStreetMap)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapRef.current)
    } else {
      // Actualizar vista si cambia el centro o zoom
      mapRef.current.setView(center, zoom)
    }

    // Limpiar marcadores existentes
    Object.values(markersRef.current).forEach((marker) => {
      marker.remove()
    })
    markersRef.current = {}

    // Crear iconos personalizados para cada estado
    const createIcon = (status: string) => {
      let color = "#4ade80" // verde por defecto

      switch (status) {
        case "reported":
          color = "#f97316" // naranja
          break
        case "confirmed":
          color = "#ef4444" // rojo
          break
        case "fixed":
          color = "#3b82f6" // azul
          break
      }

      return L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background-color: ${color};
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
          ${selectedMarker && selectedMarker === status ? "transform: scale(1.5);" : ""}
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
    }

    // Añadir nuevos marcadores
    markers.forEach((marker) => {
      const icon = createIcon(marker.status)

      const leafletMarker = L.marker(marker.position, { icon })
        .addTo(mapRef.current!)
        .bindTooltip(marker.id, {
          permanent: false,
          direction: "top",
          opacity: 0.9,
        })
        .on("click", marker.onClick)

      // Si este marcador está seleccionado, hacerlo más grande
      if (selectedMarker === marker.id) {
        leafletMarker.setIcon(
          L.divIcon({
            className: "custom-marker",
            html: `<div style="
              background-color: ${marker.status === "reported" ? "#f97316" : marker.status === "confirmed" ? "#ef4444" : "#4ade80"};
              width: 24px;
              height: 24px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 8px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        )

        // Abrir el tooltip automáticamente
        leafletMarker.openTooltip()
      }

      markersRef.current[marker.id] = leafletMarker
    })

    // Limpiar al desmontar
    return () => {
      if (mapRef.current && !document.getElementById("map")) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [center, zoom, markers, selectedMarker])

  return <div id="map" className="h-full w-full" />
}
