import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"

// Interfaces
export interface Luminaria {
  id: string
  documentId?: string // ID del documento en Firestore
  lat: number
  lng: number
  status: "ok" | "reported" | "confirmed" | "fixed"
  problem?: string
  reportDate?: string
  reportTime?: string
  fixDate?: string
  fixTime?: string
  fixStartDate?: string
  fixEndDate?: string
  brigadeNotes?: string
  photoURL?: string
  downtime?: number
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface HistoryEntry {
  luminariaId: string
  date: string
  time?: string
  action: string
  details: string
  user: string
  userId?: string
  createdAt?: string
}

// Convertir DocumentData a Luminaria
const convertLuminariaDoc = (doc: QueryDocumentSnapshot<DocumentData>): Luminaria => {
  const data = doc.data()
  return {
    ...data,
    documentId: doc.id,
    id: data.id || doc.id,
  } as Luminaria
}

// Convertir DocumentData a HistoryEntry
const convertHistoryDoc = (doc: QueryDocumentSnapshot<DocumentData>): HistoryEntry => {
  const data = doc.data()
  return {
    ...data,
    date: data.date || data.createdAt?.toDate().toISOString().split("T")[0] || "",
  } as HistoryEntry
}

// Servicios para Luminarias
export const luminariasService = {
  // Obtener todas las luminarias
  getAll: async (): Promise<Luminaria[]> => {
    const querySnapshot = await getDocs(collection(db, "luminarias"))
    return querySnapshot.docs.map(convertLuminariaDoc)
  },

  // Obtener una luminaria por ID
  getById: async (id: string): Promise<Luminaria | null> => {
    const q = query(collection(db, "luminarias"), where("id", "==", id))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) return null
    return convertLuminariaDoc(querySnapshot.docs[0])
  },

  // Crear una nueva luminaria
  create: async (luminaria: Omit<Luminaria, "documentId">): Promise<string> => {
    const docRef = await addDoc(collection(db, "luminarias"), {
      ...luminaria,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  },

  // Crear múltiples luminarias
  createBatch: async (luminarias: Omit<Luminaria, "documentId">[]): Promise<void> => {
    // Implementar lógica de batch si es necesario para grandes cantidades
    for (const luminaria of luminarias) {
      await luminariasService.create(luminaria)
    }
  },

  // Actualizar una luminaria
  update: async (documentId: string, data: Partial<Luminaria>): Promise<void> => {
    const docRef = doc(db, "luminarias", documentId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  // Eliminar una luminaria
  delete: async (documentId: string): Promise<void> => {
    await deleteDoc(doc(db, "luminarias", documentId))
  },

  // Subir una foto y obtener la URL
  uploadPhoto: async (file: File, luminariaId: string): Promise<string> => {
    const storageRef = ref(storage, `luminarias/${luminariaId}/${Date.now()}_${file.name}`)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  },
}

// Servicios para el historial
export const historyService = {
  // Obtener historial de una luminaria
  getByLuminariaId: async (luminariaId: string): Promise<HistoryEntry[]> => {
    const q = query(collection(db, "history"), where("luminariaId", "==", luminariaId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(convertHistoryDoc)
  },

  // Crear una entrada de historial
  create: async (entry: HistoryEntry): Promise<string> => {
    const docRef = await addDoc(collection(db, "history"), {
      ...entry,
      createdAt: serverTimestamp(),
    })
    return docRef.id
  },
}
