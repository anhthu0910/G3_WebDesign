document.addEventListener("DOMContentLoaded", async () => {
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
      const data = await sendChatMessage(
        text,
        conversationHistory.slice(-6)
      );

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
        "AI is busy. Please try again later.",
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
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Catalog unavailable");
    const data = await response.json();
    const catalog = Array.isArray(data) ? data : data.products;
    const sidebar = document.querySelector(".chat-sidebar") || document.querySelector("aside");
    if (sidebar && Array.isArray(catalog)) {
      const panel = document.createElement("div");
      panel.className = "sidebar-card consultant-products";
      const heading = document.createElement("h3"); heading.textContent = "Explore products";
      panel.appendChild(heading);
      const ordered = [...catalog].sort((a, b) => Number(String(b.id) === productId) - Number(String(a.id) === productId));
      ordered.slice(0, 4).forEach(item => {
        const link = document.createElement("a");
        link.href = `ai_consultant.html?product=${encodeURIComponent(item.id)}`;
        const image = document.createElement("img");
        image.alt = item.name; image.loading = "lazy";
        const fallback = document.createElement("span");
        fallback.className = "consultant-product-fallback"; fallback.textContent = "??";
        if (item.image) { image.src = item.image; image.onerror = () => image.replaceWith(fallback); link.appendChild(image); }
        else link.appendChild(fallback);
        const name = document.createElement("span"); name.textContent = item.name;
        link.appendChild(name); panel.appendChild(link);
      });
      sidebar.prepend(panel);
    }
    if (!productId) return;
    const product = catalog.find(item => String(item.id) === productId);
    if (product) {
      messageInput.value =
        `Is ${product.brand} ${product.name} suitable for my skin?`;
      addMessage(
        `You selected ${product.name}. Your question is ready to send.`,
        "bot"
      );
    }
  } catch (error) { console.warn("Could not load consultant products:", error); }
});
