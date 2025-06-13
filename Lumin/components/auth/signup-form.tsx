"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { UserPlus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UserRole } from "@/hooks/use-auth"

export default function SignupForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<UserRole>("viewer")
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Verificar si el usuario actual es administrador
  const checkAdminStatus = async () => {
    if (!auth.currentUser) return

    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid))
      if (userDoc.exists() && userDoc.data().role === "admin") {
        setIsAdmin(true)
      }
    } catch (error) {
      console.error("Error al verificar estado de administrador:", error)
    }
  }

  // Verificar estado de administrador al cargar el componente
  useState(() => {
    checkAdminStatus()
  })

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Crear usuario con email y contraseña
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Actualizar el perfil con el nombre
      await updateProfile(user, {
        displayName: name,
      })

      // Determinar el rol a asignar
      // Solo los administradores pueden asignar roles diferentes a "viewer"
      const assignedRole = isAdmin ? role : "viewer"

      // Guardar información adicional en Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        email: email,
        role: assignedRole,
        createdAt: new Date().toISOString(),
      })

      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido creada correctamente.",
      })

      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error al registrar usuario:", error)
      toast({
        title: "Error al registrar",
        description: error.message || "Ocurrió un error durante el registro.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Crear Cuenta</CardTitle>
        <CardDescription className="text-center">
          Regístrate para acceder al sistema de monitoreo de luminarias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {/* Selector de rol (solo visible para administradores) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="role">Rol de usuario</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="inspector">Inspector</SelectItem>
                  <SelectItem value="brigade">Brigada</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Registrando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Registrarse
              </span>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="link" onClick={() => router.push("/login")}>
          ¿Ya tienes una cuenta? Inicia sesión
        </Button>
      </CardFooter>
    </Card>
  )
}
