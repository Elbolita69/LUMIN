"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Upload,
  Search,
  MapPin,
  Camera,
  Calendar,
  FileText,
  Zap,
  FileSpreadsheet,
  FileIcon as FilePdf,
  LogOut,
  Settings,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "@/components/ui/use-toast"
import { processKMZFile } from "@/lib/kmz-processor"
import { generateExcelReport, generatePdfReport } from "@/lib/report-generator"
import { calculateDowntime } from "@/lib/time-calculator"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { luminariasService, historyService, type Luminaria, type HistoryEntry } from "@/lib/firebase-service"
import { useAuth } from "@/hooks/use-auth"
import dynamic from "next/dynamic"

// Importar Leaflet dinámicamente (sin SSR)
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
})

export default function LuminariasMonitoring() {
  const [luminarias, setLuminarias] = useState<Luminaria[]>([])
  const [selectedLuminaria, setSelectedLuminaria] = useState<Luminaria | null>(null)
  const [searchId, setSearchId] = useState("")
  const [activeTab, setActiveTab] = useState("monitoring")
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showBrigadeDialog, setShowBrigadeDialog] = useState(false)
  const [showFixDialog, setShowFixDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([4.6097, -74.0817]) // Bogotá por defecto
  const [mapZoom, setMapZoom] = useState(13)
  const [brigadeAction, setBrigadeAction] = useState<"ok" | "confirm">("confirm")
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [history, setHistory] = useState<{ [key: string]: HistoryEntry[] }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const brigadeNotesRef = useRef<HTMLTextAreaElement>(null)
  const brigadePhotoRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { userData, hasRole, isAdmin } = useAuth()

  // Cargar luminarias desde Firestore al iniciar
  useEffect(() => {
    const loadLuminarias = async () => {
      setIsLoading(true)
      try {
        const data = await luminariasService.getAll()
        setLuminarias(data)

        // Si hay luminarias, centrar el mapa en la primera
        if (data.length > 0) {
          setMapCenter([data[0].lat, data[0].lng])
          setMapZoom(14)
        }
      } catch (error) {
        console.error("Error al cargar luminarias:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar las luminarias.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadLuminarias()
  }, [])

  // Cargar historial cuando se selecciona una luminaria
  useEffect(() => {
    const loadHistory = async () => {
      if (selectedLuminaria?.documentId) {
        try {
          const historyData = await historyService.getByLuminariaId(selectedLuminaria.documentId)
          setHistory((prev) => ({
            ...prev,
            [selectedLuminaria.documentId!]: historyData,
          }))
        } catch (error) {
          console.error("Error al cargar historial:", error)
        }
      }
    }

    if (selectedLuminaria && !history[selectedLuminaria.documentId!]) {
      loadHistory()
    }
  }, [selectedLuminaria, history])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".kmz")) {
      toast({
        title: "Error",
        description: "Por favor seleccione un archivo KMZ válido.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const extractedPoints = await processKMZFile(file)

      if (extractedPoints.length === 0) {
        toast({
          title: "Error",
          description: "No se encontraron puntos en el archivo KMZ.",
          variant: "destructive",
        })
        return
      }

      // Convertir los puntos extraídos al formato de luminarias
      const newLuminarias: Luminaria[] = extractedPoints.map((point) => ({
        id: point.name || point.id, // Usar el nombre real del KMZ
        lat: point.lat,
        lng: point.lng,
        status: "ok",
        createdBy: auth.currentUser?.uid || "unknown",
        createdAt: new Date().toISOString(),
      }))

      // Guardar luminarias en Firestore
      try {
        await luminariasService.createBatch(newLuminarias)

        // Crear entradas de historial para cada luminaria
        for (const luminaria of newLuminarias) {
          const historyEntry: HistoryEntry = {
            luminariaId: luminaria.id,
            date: new Date().toISOString().split("T")[0],
            time: new Date().toTimeString().split(" ")[0],
            action: "Carga KMZ",
            details: `Luminaria cargada desde archivo KMZ: ${luminaria.id}`,
            user: auth.currentUser?.displayName || "Sistema",
            userId: auth.currentUser?.uid || "unknown",
          }

          await historyService.create(historyEntry)
        }

        // Actualizar el estado local
        const updatedLuminarias = await luminariasService.getAll()
        setLuminarias(updatedLuminarias)

        // Centrar el mapa en el primer punto
        if (newLuminarias.length > 0) {
          setMapCenter([newLuminarias[0].lat, newLuminarias[0].lng])
          setMapZoom(14)
        }

        toast({
          title: "Éxito",
          description: `Se cargaron ${newLuminarias.length} luminarias desde el archivo KMZ.`,
        })

        setActiveTab("monitoring")
      } catch (error) {
        console.error("Error al guardar luminarias en Firestore:", error)
        toast({
          title: "Error",
          description: "Ocurrió un error al guardar las luminarias en la base de datos.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error procesando archivo KMZ:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar el archivo KMZ.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    if (!searchId.trim()) return

    const luminaria = luminarias.find((l) => l.id.toLowerCase().includes(searchId.toLowerCase()))
    if (luminaria) {
      setSelectedLuminaria(luminaria)
      setMapCenter([luminaria.lat, luminaria.lng])
      setMapZoom(17)
      toast({
        title: "Luminaria encontrada",
        description: `Luminaria ${luminaria.id} seleccionada en el mapa.`,
      })
    } else {
      toast({
        title: "No encontrada",
        description: "No se encontró ninguna luminaria con ese ID.",
        variant: "destructive",
      })
    }
  }

  const handleReportProblem = async (problem: string) => {
    if (selectedLuminaria && selectedLuminaria.documentId) {
      const now = new Date()
      const reportDate = now.toISOString().split("T")[0]
      const reportTime = now.toTimeString().split(" ")[0]

      try {
        // Actualizar en Firestore
        await luminariasService.update(selectedLuminaria.documentId, {
          status: "reported",
          problem,
          reportDate,
          reportTime,
          updatedBy: auth.currentUser?.uid || "unknown",
        })

        // Crear entrada de historial
        const historyEntry: HistoryEntry = {
          luminariaId: selectedLuminaria.documentId,
          date: reportDate,
          time: reportTime,
          action: "Reporte",
          details: `Problema reportado: ${problem}`,
          user: auth.currentUser?.displayName || "Inspector",
          userId: auth.currentUser?.uid || "unknown",
        }

        await historyService.create(historyEntry)

        // Actualizar estado local
        const updatedLuminaria = {
          ...selectedLuminaria,
          status: "reported" as const,
          problem,
          reportDate,
          reportTime,
        }

        setLuminarias((prev) => prev.map((l) => (l.documentId === selectedLuminaria.documentId ? updatedLuminaria : l)))
        setSelectedLuminaria(updatedLuminaria)

        // Actualizar historial local
        const newHistoryEntry = await historyService.getByLuminariaId(selectedLuminaria.documentId)
        setHistory((prev) => ({
          ...prev,
          [selectedLuminaria.documentId!]: newHistoryEntry,
        }))

        setShowReportDialog(false)

        toast({
          title: "Problema reportado",
          description: `Se ha reportado un problema en la luminaria ${selectedLuminaria.id}.`,
        })
      } catch (error) {
        console.error("Error al reportar problema:", error)
        toast({
          title: "Error",
          description: "No se pudo reportar el problema. Intente nuevamente.",
          variant: "destructive",
        })
      }
    }
  }

  const handleBrigadeAction = async () => {
    if (selectedLuminaria && selectedLuminaria.documentId) {
      const now = new Date()
      const actionDate = now.toISOString().split("T")[0]
      const actionTime = now.toTimeString().split(" ")[0]
      const notes = brigadeNotesRef.current?.value || ""

      try {
        let photoURL
        // Procesar la foto si existe
        if (brigadePhotoRef.current?.files?.length) {
          photoURL = await luminariasService.uploadPhoto(brigadePhotoRef.current.files[0], selectedLuminaria.documentId)
        }

        const newStatus = brigadeAction === "ok" ? "ok" : "confirmed"
        const actionText = brigadeAction === "ok" ? "Verificación OK" : "Confirmación"
        const detailsText = brigadeAction === "ok" ? "Poste verificado como OK" : `Problema confirmado: ${notes}`

        // Actualizar en Firestore
        await luminariasService.update(selectedLuminaria.documentId, {
          status: newStatus,
          brigadeNotes: notes,
          photoURL,
          updatedBy: auth.currentUser?.uid || "unknown",
        })

        // Crear entrada de historial
        const historyEntry: HistoryEntry = {
          luminariaId: selectedLuminaria.documentId,
          date: actionDate,
          time: actionTime,
          action: actionText,
          details: detailsText,
          user: auth.currentUser?.displayName || "Brigada",
          userId: auth.currentUser?.uid || "unknown",
        }

        await historyService.create(historyEntry)

        // Actualizar estado local
        const updatedLuminaria = {
          ...selectedLuminaria,
          status: newStatus as "ok" | "confirmed",
          brigadeNotes: notes,
          photoURL,
        }

        setLuminarias((prev) => prev.map((l) => (l.documentId === selectedLuminaria.documentId ? updatedLuminaria : l)))
        setSelectedLuminaria(updatedLuminaria)

        // Actualizar historial local
        const newHistoryEntry = await historyService.getByLuminariaId(selectedLuminaria.documentId)
        setHistory((prev) => ({
          ...prev,
          [selectedLuminaria.documentId!]: newHistoryEntry,
        }))

        setShowBrigadeDialog(false)

        toast({
          title: brigadeAction === "ok" ? "Luminaria verificada" : "Problema confirmado",
          description:
            brigadeAction === "ok"
              ? `La luminaria ${selectedLuminaria.id} ha sido verificada como OK.`
              : `Se ha confirmado el problema en la luminaria ${selectedLuminaria.id}.`,
        })
      } catch (error) {
        console.error("Error en acción de brigada:", error)
        toast({
          title: "Error",
          description: "No se pudo completar la acción. Intente nuevamente.",
          variant: "destructive",
        })
      }
    }
  }

  const handleMarkAsFixed = async (startDate: string, endDate: string) => {
    if (selectedLuminaria && selectedLuminaria.documentId) {
      const now = new Date()
      const fixDate = now.toISOString().split("T")[0]
      const fixTime = now.toTimeString().split(" ")[0]

      // Calcular tiempo de inactividad
      const downtime = calculateDowntime(
        selectedLuminaria.reportDate || fixDate,
        selectedLuminaria.reportTime || "18:00:00",
        fixDate,
        fixTime,
      )

      try {
        // Actualizar en Firestore
        await luminariasService.update(selectedLuminaria.documentId, {
          status: "ok",
          fixStartDate: startDate,
          fixEndDate: endDate,
          fixDate,
          fixTime,
          downtime,
          updatedBy: auth.currentUser?.uid || "unknown",
        })

        // Crear entrada de historial
        const historyEntry: HistoryEntry = {
          luminariaId: selectedLuminaria.documentId,
          date: fixDate,
          time: fixTime,
          action: "Reparación",
          details: `Luminaria reparada del ${startDate} al ${endDate}. Tiempo de inactividad: ${downtime.toFixed(2)} horas.`,
          user: auth.currentUser?.displayName || "Propietario",
          userId: auth.currentUser?.uid || "unknown",
        }

        await historyService.create(historyEntry)

        // Actualizar estado local
        const updatedLuminaria = {
          ...selectedLuminaria,
          status: "ok" as const,
          fixStartDate: startDate,
          fixEndDate: endDate,
          fixDate,
          fixTime,
          downtime,
        }

        setLuminarias((prev) => prev.map((l) => (l.documentId === selectedLuminaria.documentId ? updatedLuminaria : l)))
        setSelectedLuminaria(updatedLuminaria)

        // Actualizar historial local
        const newHistoryEntry = await historyService.getByLuminariaId(selectedLuminaria.documentId)
        setHistory((prev) => ({
          ...prev,
          [selectedLuminaria.documentId!]: newHistoryEntry,
        }))

        setShowFixDialog(false)

        toast({
          title: "Reparación registrada",
          description: `Se ha registrado la reparación de la luminaria ${selectedLuminaria.id}.`,
        })
      } catch (error) {
        console.error("Error al marcar como reparado:", error)
        toast({
          title: "Error",
          description: "No se pudo registrar la reparación. Intente nuevamente.",
          variant: "destructive",
        })
      }
    }
  }

  const handleGenerateReport = async (format: "excel" | "pdf") => {
    setIsGeneratingReport(true)
    try {
      // Preparar datos para el reporte
      const reportData = luminarias.map((lum) => ({
        id: lum.id,
        estado: getStatusText(lum.status),
        problema: lum.problem || "N/A",
        fechaReporte: lum.reportDate || "N/A",
        horaReporte: lum.reportTime || "N/A",
        fechaSolucion: lum.fixDate || "N/A",
        horaSolucion: lum.fixTime || "N/A",
        tiempoInactividad: lum.downtime ? `${lum.downtime.toFixed(2)} horas` : "N/A",
        coordenadas: `${lum.lat.toFixed(6)}, ${lum.lng.toFixed(6)}`,
      }))

      if (format === "excel") {
        await generateExcelReport(reportData)
        toast({
          title: "Reporte generado",
          description: "El reporte Excel ha sido generado y descargado.",
        })
      } else {
        await generatePdfReport(reportData)
        toast({
          title: "Reporte generado",
          description: "El reporte PDF ha sido generado y descargado.",
        })
      }
    } catch (error) {
      console.error("Error generando reporte:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el reporte.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-green-500"
      case "reported":
        return "bg-orange-500"
      case "confirmed":
        return "bg-red-500"
      case "fixed":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "ok":
        return "OK"
      case "reported":
        return "Reportado"
      case "confirmed":
        return "Confirmado"
      case "fixed":
        return "Reparado"
      default:
        return "Desconocido"
    }
  }

  const handleMarkerClick = (luminaria: Luminaria) => {
    setSelectedLuminaria(luminaria)

    // Solo mostrar el diálogo de reporte si el usuario es inspector o admin
    if (hasRole(["admin", "inspector"])) {
      setShowReportDialog(true)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
      toast({
        title: "Error",
        description: "No se pudo cerrar la sesión. Intente nuevamente.",
        variant: "destructive",
      })
    }
  }

  // Agregar estilos CSS para el z-index de los diálogos
  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `
    [data-radix-popper-content-wrapper] {
      z-index: 9999 !important;
    }
    [role="dialog"] {
      z-index: 9999 !important;
    }
    .leaflet-container {
      z-index: 1 !important;
    }
  `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-4">
        <div className="mb-8 text-center relative">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-yellow-500" />
            <h1 className="text-4xl font-bold text-gray-800">Sistema de Monitoreo de Luminarias</h1>
          </div>
          <p className="text-gray-600">Gestión integral de postes de iluminación pública</p>

          {/* Botón de cerrar sesión */}
          <div className="absolute right-0 top-0 flex items-center gap-2">
            {isAdmin() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin")}
                className="flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-1">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>

          {/* Mostrar usuario actual y rol */}
          {userData && (
            <div className="absolute left-0 top-0 text-sm text-gray-600 flex items-center gap-2">
              <span>Usuario: {userData.displayName || userData.email}</span>
              <Badge
                variant="outline"
                className={
                  userData.role === "admin"
                    ? "bg-red-100 text-red-800"
                    : userData.role === "inspector"
                      ? "bg-blue-100 text-blue-800"
                      : userData.role === "brigade"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-800"
                }
              >
                {userData.role === "admin"
                  ? "Administrador"
                  : userData.role === "inspector"
                    ? "Inspector"
                    : userData.role === "brigade"
                      ? "Brigada"
                      : "Visualizador"}
              </Badge>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {/* Solo mostrar la pestaña de carga KMZ a administradores e inspectores */}
            {hasRole(["admin", "inspector"]) && (
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Cargar KMZ
              </TabsTrigger>
            )}
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Monitoreo
            </TabsTrigger>
            {/* Solo mostrar la pestaña de brigada a administradores y brigadas */}
            {hasRole(["admin", "brigade"]) && (
              <TabsTrigger value="brigade" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Brigada
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Historial
            </TabsTrigger>
            {/* Mostrar pestaña de usuarios solo a administradores */}
            {isAdmin() && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuarios
              </TabsTrigger>
            )}
          </TabsList>

          {hasRole(["admin", "inspector"]) && (
            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Cargar Archivo KMZ
                  </CardTitle>
                  <CardDescription>
                    Sube un archivo KMZ con las coordenadas de las luminarias para comenzar el monitoreo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Arrastra tu archivo KMZ aquí o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-gray-500 mb-4">Solo archivos .kmz son permitidos</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".kmz"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                      {isLoading ? "Procesando..." : "Seleccionar Archivo"}
                    </Button>
                  </div>

                  {luminarias.length > 0 && (
                    <div className="mt-6 p-4 bg-green-50 rounded-lg">
                      <p className="text-green-800 font-medium">
                        ✅ {luminarias.length} luminarias cargadas exitosamente
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="monitoring">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Mapa de Luminarias
                    </CardTitle>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Buscar por ID (ej: LUM001)"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <Button onClick={handleSearch}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96 rounded-lg overflow-hidden">
                      <MapComponent
                        center={mapCenter}
                        zoom={mapZoom}
                        markers={luminarias.map((lum) => ({
                          id: lum.id,
                          position: [lum.lat, lum.lng],
                          status: lum.status,
                          onClick: () => handleMarkerClick(lum),
                        }))}
                        selectedMarker={selectedLuminaria ? selectedLuminaria.id : null}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    {/* Solo mostrar botones de exportación a administradores e inspectores */}
                    {hasRole(["admin", "inspector"]) && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleGenerateReport("excel")}
                          disabled={isGeneratingReport || luminarias.length === 0}
                          className="flex items-center gap-2"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          Exportar Excel
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleGenerateReport("pdf")}
                          disabled={isGeneratingReport || luminarias.length === 0}
                          className="flex items-center gap-2"
                        >
                          <FilePdf className="h-4 w-4" />
                          Exportar PDF
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen del Sistema</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span>Funcionando OK</span>
                        </div>
                        <Badge variant="secondary">{luminarias.filter((l) => l.status === "ok").length}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span>Reportados</span>
                        </div>
                        <Badge variant="secondary">{luminarias.filter((l) => l.status === "reported").length}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span>Confirmados</span>
                        </div>
                        <Badge variant="secondary">{luminarias.filter((l) => l.status === "confirmed").length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {selectedLuminaria && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Luminaria Seleccionada</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p>
                          <strong>ID:</strong> {selectedLuminaria.id}
                        </p>
                        <p>
                          <strong>Estado:</strong>
                          <Badge className={`ml-2 ${getStatusColor(selectedLuminaria.status)} text-white`}>
                            {getStatusText(selectedLuminaria.status)}
                          </Badge>
                        </p>
                        <p>
                          <strong>Coordenadas:</strong> {selectedLuminaria.lat.toFixed(6)},{" "}
                          {selectedLuminaria.lng.toFixed(6)}
                        </p>
                        {selectedLuminaria.problem && (
                          <p>
                            <strong>Problema:</strong> {selectedLuminaria.problem}
                          </p>
                        )}
                        {selectedLuminaria.reportDate && (
                          <p>
                            <strong>Fecha Reporte:</strong> {selectedLuminaria.reportDate}{" "}
                            {selectedLuminaria.reportTime && `a las ${selectedLuminaria.reportTime.substring(0, 5)}`}
                          </p>
                        )}
                        {selectedLuminaria.downtime !== undefined && (
                          <p>
                            <strong>Tiempo inactivo:</strong> {selectedLuminaria.downtime.toFixed(2)} horas
                          </p>
                        )}
                        {selectedLuminaria.photoURL && (
                          <div className="mt-2">
                            <strong>Foto:</strong>
                            <div className="mt-1 rounded-md overflow-hidden">
                              <img
                                src={selectedLuminaria.photoURL || "/placeholder.svg"}
                                alt={`Foto de luminaria ${selectedLuminaria.id}`}
                                className="w-full h-auto max-h-40 object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        {/* Solo mostrar botón de reportar problema a administradores e inspectores */}
                        {hasRole(["admin", "inspector"]) && (
                          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                            <DialogTrigger asChild>
                              <Button className="w-full" variant="outline">
                                Reportar Problema
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reportar Problema - {selectedLuminaria.id}</DialogTitle>
                                <DialogDescription>
                                  Selecciona el tipo de problema encontrado en esta luminaria
                                </DialogDescription>
                              </DialogHeader>
                              <RadioGroup onValueChange={(value) => handleReportProblem(value)}>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Hurto de luminario" id="hurto-luminario" />
                                  <Label htmlFor="hurto-luminario">Hurto de luminario</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Hurto de cable" id="hurto-cable" />
                                  <Label htmlFor="hurto-cable">Hurto de cable</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Apagado" id="apagado" />
                                  <Label htmlFor="apagado">Apaga durante la noche</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Encendido" id="encendido" />
                                  <Label htmlFor="encendido">Encendido durante el día</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Intermitente" id="intermitente" />
                                  <Label htmlFor="intermitente">Intermitente</Label>
                                </div>
                              </RadioGroup>
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Solo mostrar botón de marcar como reparado a administradores */}
                        {isAdmin() && selectedLuminaria.status !== "ok" && (
                          <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
                            <DialogTrigger asChild>
                              <Button className="w-full" variant="default">
                                Marcar como Reparado
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Registrar Reparación - {selectedLuminaria.id}</DialogTitle>
                                <DialogDescription>
                                  Ingresa las fechas de inicio y fin de la reparación
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="start-date">Fecha de inicio</Label>
                                  <Input
                                    id="start-date"
                                    type="date"
                                    defaultValue={new Date().toISOString().split("T")[0]}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="end-date">Fecha de finalización</Label>
                                  <Input
                                    id="end-date"
                                    type="date"
                                    defaultValue={new Date().toISOString().split("T")[0]}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={() => {
                                    const startDate = (document.getElementById("start-date") as HTMLInputElement).value
                                    const endDate = (document.getElementById("end-date") as HTMLInputElement).value
                                    handleMarkAsFixed(startDate, endDate)
                                  }}
                                >
                                  Registrar Reparación
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {hasRole(["admin", "brigade"]) && (
            <TabsContent value="brigade">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Verificación de Brigada
                  </CardTitle>
                  <CardDescription>
                    Verifica el estado de las luminarias reportadas y sube evidencia fotográfica
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Luminarias Reportadas</h3>
                      {luminarias.filter((l) => l.status === "reported").length === 0 ? (
                        <div className="p-4 bg-gray-50 rounded-lg text-center">
                          <p className="text-gray-500">No hay luminarias reportadas actualmente</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                          {luminarias
                            .filter((l) => l.status === "reported")
                            .map((lum) => (
                              <div
                                key={lum.documentId}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedLuminaria?.documentId === lum.documentId
                                    ? "bg-blue-50 border-blue-300"
                                    : "hover:bg-gray-50 border-gray-200"
                                }`}
                                onClick={() => {
                                  setSelectedLuminaria(lum)
                                  setMapCenter([lum.lat, lum.lng])
                                  setMapZoom(17)
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <h4 className="font-medium">{lum.id}</h4>
                                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                    Reportado
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  <strong>Problema:</strong> {lum.problem}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <strong>Fecha:</strong> {lum.reportDate}{" "}
                                  {lum.reportTime && `a las ${lum.reportTime.substring(0, 5)}`}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      {selectedLuminaria && (
                        <div>
                          <h3 className="text-lg font-medium mb-4">Verificación</h3>
                          <div className="p-4 bg-gray-50 rounded-lg mb-4">
                            <p>
                              <strong>ID:</strong> {selectedLuminaria.id}
                            </p>
                            <p>
                              <strong>Problema:</strong> {selectedLuminaria.problem || "No especificado"}
                            </p>
                            <p>
                              <strong>Coordenadas:</strong> {selectedLuminaria.lat.toFixed(6)},{" "}
                              {selectedLuminaria.lng.toFixed(6)}
                            </p>
                          </div>

                          <Dialog open={showBrigadeDialog} onOpenChange={setShowBrigadeDialog}>
                            <DialogTrigger asChild>
                              <Button className="w-full">Verificar Luminaria</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Verificación de Brigada - {selectedLuminaria.id}</DialogTitle>
                                <DialogDescription>
                                  Registra el resultado de la verificación en terreno
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <RadioGroup
                                  defaultValue="confirm"
                                  onValueChange={(value) => setBrigadeAction(value as "ok" | "confirm")}
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="ok" id="ok" />
                                    <Label htmlFor="ok">Luminaria en buen estado (falsa alarma)</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="confirm" id="confirm" />
                                    <Label htmlFor="confirm">Confirmar problema reportado</Label>
                                  </div>
                                </RadioGroup>

                                <div className="space-y-2">
                                  <Label htmlFor="brigade-notes">Notas de la brigada</Label>
                                  <Textarea
                                    id="brigade-notes"
                                    placeholder="Describe la situación encontrada en terreno..."
                                    ref={brigadeNotesRef}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="brigade-photo">Evidencia fotográfica</Label>
                                  <Input id="brigade-photo" type="file" accept="image/*" ref={brigadePhotoRef} />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleBrigadeAction}>Registrar Verificación</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}

                      <div className="h-64 rounded-lg overflow-hidden mt-4">
                        <MapComponent
                          center={mapCenter}
                          zoom={mapZoom}
                          markers={luminarias
                            .filter((lum) => lum.status === "reported")
                            .map((lum) => ({
                              id: lum.id,
                              position: [lum.lat, lum.lng],
                              status: lum.status,
                              onClick: () => {
                                setSelectedLuminaria(lum)
                                setMapCenter([lum.lat, lum.lng])
                                setMapZoom(17)
                              },
                            }))}
                          selectedMarker={selectedLuminaria ? selectedLuminaria.id : null}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Historial de Luminarias
                </CardTitle>
                <CardDescription>Consulta el historial completo de eventos para cada luminaria</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedLuminaria ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">
                        Historial de Luminaria: <span className="font-bold">{selectedLuminaria.id}</span>
                      </h3>
                      <Button variant="outline" onClick={() => setSelectedLuminaria(null)}>
                        Ver Todas
                      </Button>
                    </div>

                    {history[selectedLuminaria.documentId!]?.length ? (
                      <div className="space-y-4">
                        {history[selectedLuminaria.documentId!].map((entry, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex justify-between">
                              <Badge variant="outline" className="mb-2">
                                {entry.action}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {entry.date} a las {entry.time.substring(0, 5)}
                              </span>
                            </div>
                            <p className="text-gray-700">{entry.details}</p>
                            <p className="text-sm text-gray-500 mt-2">Por: {entry.user}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No hay registros de historial para esta luminaria</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Selecciona una luminaria para ver su historial</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {luminarias.map((lum) => (
                        <div
                          key={lum.documentId}
                          className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setSelectedLuminaria(lum)
                            setMapCenter([lum.lat, lum.lng])
                            setMapZoom(17)
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">{lum.id}</h4>
                            <Badge className={`${getStatusColor(lum.status)} text-white`}>
                              {getStatusText(lum.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Coordenadas:</strong> {lum.lat.toFixed(6)}, {lum.lng.toFixed(6)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin() && (
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gestión de Usuarios
                  </CardTitle>
                  <CardDescription>Administra los usuarios y sus roles en el sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => router.push("/admin")} className="mb-4">
                    Ir al Panel de Administración
                  </Button>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="roles">
                      <AccordionTrigger>Roles del Sistema</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h4 className="font-medium text-red-800">Administrador</h4>
                            <p className="text-sm text-gray-600">
                              Acceso completo a todas las funcionalidades del sistema, incluyendo gestión de usuarios,
                              reportes y configuración.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium text-blue-800">Inspector</h4>
                            <p className="text-sm text-gray-600">
                              Puede cargar archivos KMZ, reportar problemas en luminarias y generar reportes.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium text-amber-800">Brigada</h4>
                            <p className="text-sm text-gray-600">
                              Puede verificar problemas reportados, subir evidencia fotográfica y confirmar el estado de
                              las luminarias.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">Visualizador</h4>
                            <p className="text-sm text-gray-600">
                              Solo puede ver el estado de las luminarias y consultar el historial.
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
