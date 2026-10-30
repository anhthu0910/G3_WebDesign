
const API_BASE_URL = "";

async function sendChatMessage(message, history = []) {
  const response = await fetch(
    `${API_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        history: history
      })
    }
  );

  if (!response.ok) {
    let errorMessage = "Unable to connect to AI service.";

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // Keep default error message
    }

    throw new Error(errorMessage);
  }

  return await response.json();
}
