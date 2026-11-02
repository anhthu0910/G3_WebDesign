
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
    throw new Error("AI is busy. Please try again later.");
  }

  return await response.json();
}
