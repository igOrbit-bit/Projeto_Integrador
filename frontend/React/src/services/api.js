export const API_ROOT = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const API_BASE_URL = `${API_ROOT.replace(/\/$/, "")}/api/v1`;

export function getAuthToken() {
  return localStorage.getItem("authToken") || localStorage.getItem("token") || "";
}

export function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  };
}

export const registerUser = async (name, email, password, passwordConfirmation) => {

  const response = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: name,
      email: email,
      password: password,
      password_confirmation: passwordConfirmation
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao registrar");
  }

  return response.json();
};


export const loginUser = async (email, password) => {

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: email,
      password: password
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao fazer login");
  }

  return response.json();
};
