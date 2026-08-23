/**
 * context/AuthContext.jsx
 * -----------------------
 * Global authentication state. Stores the JWT + user in localStorage and
 * exposes login / register / logout helpers to the whole app.
 */

import { createContext, useContext, useEffect, useState } from "react";

import { authApi, getErrorMessage } from "../api/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  // On mount, if we have a token, verify it and refresh the user object
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
      })
      .catch(() => {
        // token invalid/expired -> clear it
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (token, userObj) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);
  };

  // The backend may answer an auth call with either a session or a demand for
  // an emailed code, so every caller goes through this one shape.
  const settle = (data) => {
    if (data?.otp_required) {
      return {
        success: true,
        otpRequired: true,
        email: data.email,
        purpose: data.purpose,
        devEcho: !!data.dev_echo,
        message: data.message,
      };
    }
    persistSession(data.token, data.user);
    return { success: true, otpRequired: false };
  };

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password });
      return settle(res.data);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await authApi.register({ name, email, password });
      return settle(res.data);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  /**
   * Sign in or register from a Google ID token.
   *
   * Never returns otpRequired: Google only issues a token for an address it
   * has already verified, so there is nothing left for an emailed code to
   * prove. settle() still handles the response so the session is stored the
   * same way as every other route.
   */
  const loginWithGoogle = async (credential) => {
    try {
      const res = await authApi.google(credential);
      return settle(res.data);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  /** Finish a pending signup/login by submitting the emailed code. */
  const verifyOtp = async (email, code, purpose = "register") => {
    try {
      const res = await authApi.verifyOtp({ email, code, purpose });
      return settle(res.data);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  /** Ask for a fresh code for a pending signup/login. */
  const resendOtp = async (email, purpose = "register") => {
    try {
      const res = await authApi.resendOtp({ email, purpose });
      return { success: true, devEcho: !!res.data?.dev_echo, message: res.data?.message };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        verifyOtp,
        resendOtp,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
