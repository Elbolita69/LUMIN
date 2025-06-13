"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, BarChart3, Settings } from "lucide-react"
import UserManagement from "@/components/admin/user-management"
import { useAuth } from "@/hooks/use-auth"

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("users")
  const router = useRouter()
  const { isAdmin } = useAuth()

  // Redirigir si no es administrador
  if (!isAdmin()) {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-4">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Panel de Administración</h1>
          <p className="text-gray-600">Gestiona usuarios y configuraciones del sistema</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="stats">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Estadísticas del Sistema</h2>
              <p className="text-gray-600">Esta sección está en desarrollo.</p>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Configuración del Sistema</h2>
              <p className="text-gray-600">Esta sección está en desarrollo.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
