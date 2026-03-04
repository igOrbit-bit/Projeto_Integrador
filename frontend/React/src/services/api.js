const BASE_URL = "https://libras-api.fly.dev/api/v1";

export const registerUser = async (name, email, password, passwordConfirmation) => {
  const response = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao registrar");
  }

  return response.json();
};

export const loginUser = async (email, password) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao fazer login");
  }

  return response.json();
};