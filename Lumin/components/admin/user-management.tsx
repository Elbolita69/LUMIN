"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth, type UserRole } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertCircle, Trash2, UserCog } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface User {
  uid: string
  email: string
  displayName: string
  role: UserRole
  createdAt: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { userData, isAdmin } = useAuth()

  // Cargar usuarios
  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin()) {
        setLoading(false)
        return
      }

      try {
        const querySnapshot = await getDocs(collection(db, "users"))
        const usersData = querySnapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        })) as User[]

        setUsers(usersData)
      } catch (error) {
        console.error("Error al cargar usuarios:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los usuarios.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [isAdmin])

  // Cambiar rol de usuario
  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        role: newRole,
      })

      // Actualizar estado local
      setUsers((prev) => prev.map((user) => (user.uid === uid ? { ...user, role: newRole } : user)))

      toast({
        title: "Rol actualizado",
        description: "El rol del usuario ha sido actualizado correctamente.",
      })
    } catch (error) {
      console.error("Error al actualizar rol:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol del usuario.",
        variant: "destructive",
      })
    }
  }

  // Eliminar usuario
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      await deleteDoc(doc(db, "users", selectedUser.uid))

      // Actualizar estado local
      setUsers((prev) => prev.filter((user) => user.uid !== selectedUser.uid))

      setShowDeleteDialog(false)
      setSelectedUser(null)

      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente.",
      })
    } catch (error) {
      console.error("Error al eliminar usuario:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario.",
        variant: "destructive",
      })
    }
  }

  // Si no es administrador, mostrar mensaje de acceso denegado
  if (!isAdmin()) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Gestión de Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 text-center">
            No tienes permisos para acceder a esta sección. Esta funcionalidad está reservada para administradores.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Gestión de Usuarios
        </CardTitle>
        <CardDescription>Administra los usuarios y sus roles en el sistema</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Fecha de registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.displayName || "Sin nombre"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.uid, value as UserRole)}
                      disabled={user.uid === userData?.uid} // No permitir cambiar el propio rol
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>
                          <Badge
                            variant="outline"
                            className={
                              user.role === "admin"
                                ? "bg-red-100 text-red-800 hover:bg-red-100"
                                : user.role === "inspector"
                                  ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                  : user.role === "brigade"
                                    ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                    : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                            }
                          >
                            {user.role === "admin"
                              ? "Administrador"
                              : user.role === "inspector"
                                ? "Inspector"
                                : user.role === "brigade"
                                  ? "Brigada"
                                  : "Visualizador"}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="inspector">Inspector</SelectItem>
                        <SelectItem value="brigade">Brigada</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Dialog
                      open={showDeleteDialog && selectedUser?.uid === user.uid}
                      onOpenChange={setShowDeleteDialog}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedUser(user)}
                          disabled={user.uid === userData?.uid} // No permitir eliminar el propio usuario
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <span className="sr-only">Eliminar usuario</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirmar eliminación</DialogTitle>
                          <DialogDescription>
                            ¿Estás seguro de que deseas eliminar al usuario{" "}
                            {selectedUser?.displayName || selectedUser?.email}? Esta acción no se puede deshacer.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            Cancelar
                          </Button>
                          <Button variant="destructive" onClick={handleDeleteUser}>
                            Eliminar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
