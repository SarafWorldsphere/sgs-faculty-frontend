"use client";

/**
 * NotesContext — Notes CRUD State Provider
 *
 * All operations now go to the FastAPI backend via api.js.
 * Local state is kept in sync with the server after each mutation.
 *
 * Backend endpoints used:
 *   GET    /api/v1/notes         — Fetch all notes
 *   POST   /api/v1/notes         — Create a new note
 *   PUT    /api/v1/notes/:id     — Update an existing note
 *   DELETE /api/v1/notes/:id     — Delete a note
 *   GET    /api/v1/chapters      — Fetch chapter list
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchNotes, createNote, updateNote, deleteNote, fetchChapters } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const NotesContext = createContext(undefined);

export function NotesProvider({ children }) {
  const { user, isLoading: authLoading, activeClassId } = useAuth();
  const [notes, setNotes] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load notes + chapters once auth has resolved (so the token exists).
  // Re-runs when the user becomes available — fixes the mount-time token race
  // where the first fetch fired before AuthContext stored the token.
  useEffect(() => {
    if (authLoading) return;          // auth still resolving — wait
    if (!user) {                      // no session — nothing to load
      setNotes([]);
      setChapters([]);
      setIsLoading(false);
      return;
    }
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [notesData, chaptersData] = await Promise.all([
          fetchNotes(),
          fetchChapters(),
        ]);
        setNotes(notesData);
        setChapters(chaptersData);
      } catch (err) {
        // API unreachable — show empty state, no mock data
        console.error("Notes API error:", err.message);
        setNotes([]);
        setChapters([]);
        setError(err.message || "Unable to load notes.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user, authLoading, activeClassId]);

  /**
   * Add a new note — POST /api/v1/notes
   */
  const addNote = useCallback(async (noteData) => {
    const newNote = await createNote(noteData);
    setNotes((prev) => [newNote, ...prev]);
    return newNote;
  }, []);

  /**
   * Update an existing note — PUT /api/v1/notes/:id
   */
  const editNote = useCallback(async (id, updates) => {
    const updated = await updateNote(id, updates);
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? updated : note))
    );
    return updated;
  }, []);

  /**
   * Delete a note — DELETE /api/v1/notes/:id
   */
  const removeNote = useCallback(async (id) => {
    await deleteNote(id);
    setNotes((prev) => prev.filter((note) => note.id !== id));
  }, []);

  /**
   * Get a single note by ID (local lookup, no extra API call).
   */
  const getNoteById = useCallback(
    (id) => notes.find((note) => note.id === id) || null,
    [notes]
  );

  const value = {
    notes,
    chapters,
    isLoading,
    error,
    addNote,
    editNote,
    removeNote,
    getNoteById,
    totalNotes: notes.length,
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

/**
 * Hook to access notes context.
 * Must be used within a NotesProvider.
 */
export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error("useNotes must be used within a NotesProvider");
  }
  return context;
}
