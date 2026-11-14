const API_BASE_URL = "";

async function sendChatMessage(message, history = []) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, history })
    });
  } catch (error) {
    console.error("Could not reach the chat API:", error);
    throw new Error("Cannot connect to GlowGuide. Start the server or check your connection.");
  }

  if (!response.ok) {
    let detail = `AI request failed (HTTP ${response.status}).`;
    try {
      const error = await response.json();
      if (typeof error.detail === "string") detail = error.detail;
    } catch (error) {
      console.warn("Could not read the AI error response:", error);
    }
    throw new Error(detail);
  }

  return await response.json();
}
