"use client"

import { useState, useEffect } from "react"
import { onAuthStateChanged, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

export type UserRole = "admin" | "inspector" | "brigade" | "viewer"

export interface UserData {
  uid: string
  email: string | null
  displayName: string | null
  role: UserRole
  photoURL?: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser)

      if (authUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", authUser.uid))
          if (userDoc.exists()) {
            const data = userDoc.data() as Omit<UserData, "uid">
            setUserData({
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              photoURL: authUser.photoURL,
              role: data.role || "viewer",
            })
          } else {
            // Si no existe el documento, asignar rol por defecto
            setUserData({
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              photoURL: authUser.photoURL,
              role: "viewer",
            })
          }
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error)
        }
      } else {
        setUserData(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Verificar si el usuario tiene un rol específico
  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!userData) return false

    if (Array.isArray(roles)) {
      return roles.includes(userData.role)
    }

    return userData.role === roles
  }

  // Verificar si el usuario es administrador
  const isAdmin = (): boolean => {
    return hasRole("admin")
  }

  return {
    user,
    userData,
    loading,
    hasRole,
    isAdmin,
  }
}
