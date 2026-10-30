document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const clearChat = document.getElementById("clearChat");
  const typingIndicator = document.getElementById("typingIndicator");

  if (!chatMessages || !chatForm || !messageInput || !sendButton ||
      !clearChat || !typingIndicator) {
    return;
  }

  const welcomeHTML = chatMessages.innerHTML;
  let conversationHistory = [];

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addMessage(text, role = "bot") {
    const message = document.createElement("div");
    message.className =
      `message ${role === "user" ? "user-message" : "bot-message"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "👤" : "✨";

    const content = document.createElement("div");
    content.className = "message-content";
    const messageText = String(text ?? "");

    if (role === "bot" && typeof marked !== "undefined" &&
        typeof DOMPurify !== "undefined") {
      try {
        const html = marked.parse(messageText);
        content.innerHTML = DOMPurify.sanitize(html);
      } catch (error) {
        console.warn("Markdown rendering failed:", error);
        content.textContent = messageText;
      }
    } else {
      content.textContent = messageText;
    }

    message.append(avatar, content);
    chatMessages.appendChild(message);
    scrollToBottom();
  }

  async function handleMessage(question) {
    const text = question.trim();
    if (!text || sendButton.disabled) return;

    addMessage(text, "user");
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendButton.disabled = true;
    messageInput.disabled = true;
    typingIndicator.hidden = false;
    scrollToBottom();

    try {
      console.log("Sending question:", text);
      console.log("History:", conversationHistory);

      const data = await sendChatMessage(
        text,
        conversationHistory.slice(-6)
      );

      console.log("API RESPONSE:", data);

      if (typeof data?.reply !== "string" || !data.reply.trim()) {
        throw new Error("Invalid AI response");
      }

      addMessage(data.reply, "bot");
      conversationHistory.push(
        { role: "user", content: text },
        { role: "assistant", content: data.reply }
      );
      conversationHistory = conversationHistory.slice(-6);
    } catch (error) {
      console.error("GlowGuide Chat Error:", error);
      addMessage(
        "🌸 Sorry, GlowGuide AI is a little busy right now. " +
        "Please wait a moment and try sending your question again.",
        "bot"
      );
      messageInput.value = text;
    } finally {
      typingIndicator.hidden = true;
      sendButton.disabled = false;
      messageInput.disabled = false;
      messageInput.focus();
    }
  }

  chatForm.addEventListener("submit", event => {
    event.preventDefault();
    handleMessage(messageInput.value);
  });

  messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 130)}px`;
  });

  document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
      messageInput.value = button.dataset.question || "";
      messageInput.focus();
    });
  });

  clearChat.addEventListener("click", () => {
    if (sendButton.disabled) return;
    conversationHistory = [];
    chatMessages.innerHTML = welcomeHTML;
    messageInput.value = "";
    messageInput.style.height = "auto";
    messageInput.focus();
  });

  const productId = new URLSearchParams(window.location.search).get("product");
  if (productId && typeof products !== "undefined") {
    const product = products.find(item => String(item.id) === productId);
    if (product) {
      messageInput.value =
        `Is ${product.brand} ${product.name} suitable for my skin?`;
      addMessage(
        `You selected ${product.name}. Your question is ready to send.`,
        "bot"
      );
    }
  }
});
