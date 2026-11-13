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
  const catalogPromise = fetch("/api/products")
    .then(async response => {
      if (!response.ok) throw new Error("Catalog unavailable");
      const data = await response.json();
      const catalog = Array.isArray(data) ? data : data.products;
      if (!Array.isArray(catalog)) throw new Error("Invalid catalog");
      return catalog;
    })
    .catch(error => {
      console.warn("Could not load consultant products:", error);
      return [];
    });

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addMessage(text, role = "bot", recommendedProducts = []) {
    const message = document.createElement("div");
    message.className =
      `message ${role === "user" ? "user-message" : "bot-message"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "👤" : "✨";

    const content = document.createElement("div");
    content.className = "message-content";
    const messageText = String(text ?? "").replace(/\[\[product:\s*\d+\s*\]\]/gi, "");

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

    if (role === "bot" && recommendedProducts.length) {
      const cards = document.createElement("div");
      cards.className = "chat-product-cards";
      cards.setAttribute("aria-label", "Recommended products");
      recommendedProducts.forEach(product => {
        const card = document.createElement("a");
        card.className = "chat-product-card";
        card.href = `product_detail.html?id=${encodeURIComponent(product.id)}`;
        const image = document.createElement("img");
        image.alt = product.name || "Skincare product";
        image.loading = "lazy";
        image.width = 64;
        image.height = 76;
        const fallback = "/frontend/images/product-placeholder.svg";
        try {
          const url = new URL(product.image || fallback, window.location.href);
          image.src = ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
        } catch { image.src = fallback; }
        image.onerror = () => { image.onerror = null; image.src = fallback; };
        const details = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = product.name;
        const action = document.createElement("span");
        action.className = "chat-product-action";
        action.textContent = "View product →";
        details.append(name, action);
        card.append(image, details);
        cards.appendChild(card);
      });
      content.appendChild(cards);
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

      const catalog = await catalogPromise;
      const recommendedIds = new Set(
        [...data.reply.matchAll(/\[\[product:\s*(\d+)\s*\]\]/gi)].map(match => String(Number(match[1])))
      );
      const recommendedProducts = catalog.filter(product => recommendedIds.has(String(product.id)));
      addMessage(data.reply, "bot", recommendedProducts);
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
    const catalog = await catalogPromise;
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
      const suggestions = document.getElementById("chatSuggestions");
      if (suggestions) suggestions.after(panel);
      else sidebar.appendChild(panel);
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
