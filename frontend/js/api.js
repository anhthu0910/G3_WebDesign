const API_BASE_URL = "";

async function sendChatMessage(message, history = []) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message, history })
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;

    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // Keep the HTTP error when the response is not JSON.
    }

    throw new Error(errorDetail);
  }

  return await response.json();
}
