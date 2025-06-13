"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { AlertCircle } from "lucide-react"
import type { UserRole } from "@/hooks/use-auth"

interface AuthCheckProps {
  children: React.ReactNode
  adminOnly?: boolean
  allowedRoles?: UserRole[]
}

export default function AuthCheck({ children, adminOnly = false, allowedRoles }: AuthCheckProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      // Si se requiere verificación de roles
      if (adminOnly || allowedRoles) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))

          if (userDoc.exists()) {
            const userData = userDoc.data()
            const userRole = userData.role as UserRole

            // Verificar si es admin cuando se requiere
            if (adminOnly && userRole === "admin") {
              setHasAccess(true)
            }
            // Verificar si tiene alguno de los roles permitidos
            else if (allowedRoles && allowedRoles.includes(userRole)) {
              setHasAccess(true)
            }
            // Si no cumple con los requisitos de rol
            else {
              setHasAccess(false)
            }
          } else {
            setHasAccess(false)
          }
        } catch (error) {
          console.error("Error al verificar rol:", error)
          setHasAccess(false)
        }
      } else {
        // Si no se requiere verificación de roles, solo autenticación
        setHasAccess(true)
      }

      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [router, adminOnly, allowedRoles])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acceso Denegado</h1>
        <p className="text-gray-600 mb-6">No tienes permisos para acceder a esta sección.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Volver al Dashboard
        </button>
      </div>
    )
  }

  return <>{children}</>
}
