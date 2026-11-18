import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Verifica si existe una sesión activa válida en el servidor
   * mediante la cookie HttpOnly al montar o recargar la aplicación.
   */
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authApi.getMe();
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      // Si responde 401 o no hay cookie, el usuario simplemente no está autenticado
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Inicia sesión con correo y contraseña.
   */
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const data = await authApi.login({ email, password });
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const msg = err.message || "Error al iniciar sesión";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Registra un nuevo usuario cliente.
   */
  const register = async ({ name, email, password, phone }) => {
    setAuthError(null);
    try {
      const data = await authApi.register({ name, email, password, phone });
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      const msg = err.message || "Error al registrarse";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Cierra la sesión activa en el servidor y limpia la sesión local.
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("Error durante el logout:", err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider");
  }
  return context;
}
