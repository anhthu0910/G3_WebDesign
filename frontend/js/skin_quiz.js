"use strict";
document.addEventListener("DOMContentLoaded", async () => {

  const questions = [
    {
      title: "How does your skin feel after cleansing?",
      description: "Think about how your face usually feels after washing.",
      answers: [
        { text: "Tight, dry or flaky", type: "dry" },
        { text: "Comfortable and balanced", type: "normal" },
        { text: "Oily again quite quickly", type: "oily" },
        { text: "Dry cheeks but oily T-zone", type: "combination" }
      ]
    },
    {
      title: "How shiny does your face become during the day?",
      description: "Choose the option that best describes your skin.",
      answers: [
        { text: "Rarely shiny", type: "dry" },
        { text: "A little natural shine", type: "normal" },
        { text: "Shiny across most of my face", type: "oily" },
        { text: "Mostly shiny on my forehead and nose", type: "combination" }
      ]
    },
    {
      title: "Which description best matches your skin?",
      description: "Consider your usual skin condition, not just today.",
      answers: [
        { text: "Often rough or flaky", type: "dry" },
        { text: "Generally smooth and balanced", type: "normal" },
        { text: "Often feels greasy", type: "oily" },
        { text: "Different in different facial areas", type: "combination" }
      ]
    },
    {
      title: "What is your main skincare concern?",
      description: "Pick the concern you would like to focus on first.",
      answers: [
        { text: "Dryness", concern: "dryness" },
        { text: "Acne and breakouts", concern: "acne" },
        { text: "Dark spots and uneven tone", concern: "dark-spots" },
        { text: "Skin barrier and discomfort", concern: "barrier" }
      ]
    },
    {
      title: "Which moisturizer texture do you usually prefer?",
      description: "This helps estimate your texture preferences.",
      answers: [
        { text: "Rich and creamy", type: "dry" },
        { text: "A balanced lotion", type: "normal" },
        { text: "Very lightweight gel", type: "oily" },
        { text: "Lightweight but moisturizing", type: "combination" }
      ]
    }
  ];

  const currentUser = typeof getCurrentUser === "function" ? await getCurrentUser() : null;
  if (currentUser?.role === "admin") {
    try {
      const savedQuiz = await authRequest("/api/admin/quiz");
      if (savedQuiz.questions.length) {
        questions.splice(0, questions.length, ...savedQuiz.questions.map(item => ({ ...item, answers: item.answers || [] })));
      }
    } catch (error) {
      console.warn("Could not load saved quiz questions:", error);
    }
    renderAdminQuiz();
    return;
  }

  try {
    const response = await fetch("/api/quiz");
    if (!response.ok) throw new Error("Quiz unavailable");
    const savedQuiz = await response.json();
    if (savedQuiz.questions.length) {
      questions.splice(0, questions.length, ...savedQuiz.questions);
    }
  } catch (error) {
    console.warn("Using built-in quiz:", error);
  }

  function renderAdminQuiz() {
    const container = document.querySelector(".quiz-container") || document.querySelector("main");
    container.replaceChildren();
    const heading = document.createElement("h1");
    heading.textContent = "Manage Skin Quiz";
    const intro = document.createElement("p");
    intro.textContent = "Edit all quiz questions and answers below.";
    const addQuestion = document.createElement("button");
    addQuestion.type = "button";
    addQuestion.className = "admin-quiz-add";
    addQuestion.textContent = "Add Question";
    addQuestion.onclick = () => {
      questions.push({
        title: "New question",
        description: "",
        answers: [{ text: "Answer 1", type: "normal" }, { text: "Answer 2", type: "dry" }]
      });
      renderAdminQuiz();
    };
    container.append(heading, intro);

    const form = document.createElement("form");
    form.className = "admin-quiz-form";
    questions.forEach((question, questionIndex) => {
      const section = document.createElement("section");
      section.className = "admin-quiz-question";
      section.innerHTML = `<h2>Question ${questionIndex + 1}</h2><label>Question title<input name="title-${questionIndex}" value="${escapeValue(question.title)}"></label><label>Description<textarea name="description-${questionIndex}">${escapeValue(question.description)}</textarea></label><div class="admin-quiz-answers"></div>`;
      const titleInput = section.querySelector("input");
      titleInput.required = true;
      titleInput.oninput = () => { question.title = titleInput.value; };
      section.querySelector("textarea").oninput = event => { question.description = event.target.value; };
      const answers = section.querySelector(".admin-quiz-answers");
      question.answers.forEach((answer, answerIndex) => {
        const label = document.createElement("label");
        label.textContent = `Answer ${answerIndex + 1}`;
        const input = document.createElement("input");
        input.name = `answer-${questionIndex}-${answerIndex}`;
        input.value = answer.text;
        input.required = true;
        input.oninput = () => { answer.text = input.value; };
        const scoring = document.createElement("select");
        scoring.setAttribute("aria-label", `Skin type for answer ${answerIndex + 1}`);
        ["", "dry", "normal", "oily", "combination", "sensitive"].forEach(type => {
          const option = new Option(type || "No skin type score", type);
          option.selected = (answer.type || "") === type;
          scoring.add(option);
        });
        scoring.onchange = () => { if (scoring.value) answer.type = scoring.value; else delete answer.type; };
        const concern = document.createElement("input");
        concern.placeholder = "Concern (optional, e.g. acne)";
        concern.setAttribute("aria-label", `Concern for answer ${answerIndex + 1}`);
        concern.value = answer.concern || "";
        concern.oninput = () => { answer.concern = concern.value.trim(); };
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove answer";
        remove.disabled = question.answers.length <= 1;
        remove.onclick = () => { question.answers.splice(answerIndex, 1); renderAdminQuiz(); };
        label.append(input, scoring, concern, remove);
        answers.appendChild(label);
      });
      const addAnswer = document.createElement("button");
      addAnswer.type = "button";
      addAnswer.textContent = "Add Answer";
      addAnswer.onclick = () => { question.answers.push({ text: "", type: "normal" }); renderAdminQuiz(); };
      section.appendChild(addAnswer);
      const deleteQuestion = document.createElement("button");
      deleteQuestion.type = "button";
      deleteQuestion.className = "admin-quiz-delete";
      deleteQuestion.textContent = "Delete Question";
      deleteQuestion.onclick = () => {
        if (questions.length <= 1) return;
        const removed = questions[questionIndex];
        const removeSavedQuestion = removed.id
          ? authRequest(`/api/admin/quiz/${removed.id}`, { method: "DELETE" })
          : Promise.resolve();
        removeSavedQuestion.then(() => { questions.splice(questionIndex, 1); renderAdminQuiz(); }).catch(error => alert(error.message));
      };
      section.appendChild(deleteQuestion);
      form.appendChild(section);
    });

    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Save All Quiz Questions";
    form.append(addQuestion, save);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (questions.some(question => !question.title.trim() || !question.answers.length || question.answers.some(answer => !answer.text.trim()))) {
        save.textContent = "Please complete all questions and answers.";
        return;
      }
      save.disabled = true;
      try {
        for (let i = 0; i < questions.length; i++) {
          const payload = { question_order: i, title: form.elements[`title-${i}`].value, description: form.elements[`description-${i}`].value, answers: questions[i].answers.map((answer, j) => ({ ...answer, text: form.elements[`answer-${i}-${j}`].value })), published: true };
          const saved = await authRequest(`/api/admin/quiz${questions[i].id ? `/${questions[i].id}` : ""}`, { method: questions[i].id ? "PUT" : "POST", body: JSON.stringify(payload) });
          questions[i].id = saved.id;
        }
        save.textContent = "Questions saved.";
      } catch (error) { save.textContent = error.message; }
      finally { save.disabled = false; }
    });
    container.appendChild(form);

  }

  function escapeValue(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  let currentQuestion = 0;
  const selectedAnswers = Array(questions.length).fill(null);

  const welcomeScreen = document.getElementById("quizWelcome");
  const quizContent = document.getElementById("quizContent");
  const startQuizButton = document.getElementById("startQuizButton");

  // Track whether the user is currently taking the quiz.
  let quizInProgress = false;
  const questionBox = document.getElementById("quizQuestion");
  const resultBox = document.getElementById("quizResult");
  const backButton = document.getElementById("backButton");
  const nextButton = document.getElementById("nextButton");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const questionCounter = document.getElementById("questionCounter");
  const navigation = document.querySelector(".quiz-navigation");

  const skinLabels = {
    dry: "Dry Skin",
    normal: "Normal Skin",
    oily: "Oily Skin",
    combination: "Combination Skin",
    sensitive: "Sensitive Skin"
  };

  const concernLabels = {
    dryness: "Dryness",
    acne: "Acne and Breakouts",
    "dark-spots": "Dark Spots",
    barrier: "Skin Barrier"
  };

  // ==========================================
  // SHOW QUESTION
  // ==========================================

  function renderQuestion() {
    const question = questions[currentQuestion];

    questionBox.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = question.title;

    const description = document.createElement("p");
    description.className = "question-description";
    description.textContent = question.description;

    const options = document.createElement("div");
    options.className = "quiz-options";

    question.answers.forEach((answer, index) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "quiz-option";
      button.textContent = answer.text;

      const isSelected =
        selectedAnswers[currentQuestion] === index;

      if (isSelected) {
        button.classList.add("selected");
      }

      button.setAttribute("aria-pressed", String(isSelected));

      button.addEventListener("click", () => {
        selectedAnswers[currentQuestion] = index;
        renderQuestion();
      });

      options.appendChild(button);
    });

    questionBox.append(heading, description, options);

    const percentage = Math.round(
      ((currentQuestion + 1) / questions.length) * 100
    );

    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;

    questionCounter.textContent =
      `Question ${currentQuestion + 1} of ${questions.length}`;

    backButton.disabled = currentQuestion === 0;

    nextButton.disabled =
      selectedAnswers[currentQuestion] === null;

    nextButton.textContent =
      currentQuestion === questions.length - 1
        ? "See My Results ✨"
        : "Next →";
  }

  // ==========================================
  // CALCULATE RESULT
  // ==========================================

  function calculateResult() {
    const scores = {
      dry: 0,
      normal: 0,
      oily: 0,
      combination: 0,
      sensitive: 0
    };

    let concern = "";

    selectedAnswers.forEach((answerIndex, questionIndex) => {
      const answer =
        questions[questionIndex].answers[answerIndex];

      if (Object.hasOwn(scores, answer.type)) {
        scores[answer.type]++;
      }

      if (answer.concern) {
        concern = answer.concern;
      }
    });

    const highestScore = Math.max(...Object.values(scores));

    const topTypes = Object.keys(scores).filter(
      type => scores[type] === highestScore
    );

    // An equal score means the quiz is inconclusive.
    const skinType =
      topTypes.length === 1 ? topTypes[0] : null;

    return {
      skinType,
      concern,
      scores,
      inconclusive: skinType === null
    };
  }

  // ==========================================
  // SHOW RESULT
  // ==========================================

  function showResult(restoredResult = null) {
    quizInProgress = false;

    const result = restoredResult || calculateResult();

    questionBox.hidden = true;
    navigation.hidden = true;
    resultBox.hidden = false;
    resultBox.replaceChildren();

    progressBar.style.width = "100%";
    progressText.textContent = "100%";
    questionCounter.textContent = "Quiz Completed";

    const title = document.createElement("h2");
    title.textContent = "Your Skin Profile ✨";

    const skinType = document.createElement("p");
    skinType.className = "result-type";

    skinType.textContent = result.inconclusive
      ? "Mixed Skin Characteristics"
      : skinLabels[result.skinType];

    const concern = document.createElement("p");
    concern.textContent =
      `Your main concern: ${concernLabels[result.concern] || result.concern || "Not specified"}`;

    const description = document.createElement("p");

    description.textContent = result.inconclusive
      ? "Your answers suggest more than one skin type. " +
        "A short quiz cannot determine your skin type reliably."
      : "Your answers suggest these skin characteristics. " +
        "Use this as a starting point when exploring skincare.";

    const actions = document.createElement("div");
    actions.className = "quiz-result-actions";

    // Match the query parameters used by Products.
    const productParams = new URLSearchParams();

    if (result.skinType) {
      productParams.set("skin", result.skinType);
    }

    productParams.set("concern", result.concern);

    const productsLink = document.createElement("a");
    productsLink.className = "quiz-result-link";
    productsLink.href =
      `products.html?${productParams.toString()}`;
    productsLink.textContent = "Find My Products";

    const restartButton = document.createElement("button");
    restartButton.type = "button";
    restartButton.className = "restart-button";
    restartButton.textContent = "Retake Quiz";

    restartButton.addEventListener("click", restartQuiz);

    actions.append(productsLink, restartButton);

    resultBox.append(
      title,
      skinType,
      concern,
      description,
      actions
    );

    const savedProfile = { completionId: restoredResult ? restoredResult.completionId : crypto.randomUUID(), skinType: result.skinType, concern: result.concern, inconclusive: result.inconclusive };
    try {
      localStorage.setItem(
        currentUser?.role === "user" ? `glowguide_skin_profile:user:${currentUser.id}` : "glowguide_skin_profile",
        JSON.stringify(savedProfile)
      );
    } catch (error) {
      console.warn("Skin profile could not be saved:", error);
    }
    if (savedProfile.completionId) {
      const trackingStatus = document.createElement("p");
      trackingStatus.setAttribute("role", "status");
      const retryTracking = document.createElement("button");
      retryTracking.type = "button"; retryTracking.textContent = "Retry recording completion";
      retryTracking.hidden = true;
      async function recordCompletion() {
        retryTracking.disabled = true;
        try {
          const response = await fetch("/api/quiz/completions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completion_id: savedProfile.completionId })
          });
          if (!response.ok) throw new Error("Completion not recorded");
          trackingStatus.textContent = ""; retryTracking.hidden = true;
        } catch {
          trackingStatus.textContent = "Your result is visible, but the completion could not be recorded.";
          retryTracking.hidden = false;
        } finally { retryTracking.disabled = false; }
      }
      retryTracking.onclick = recordCompletion;
      resultBox.append(trackingStatus, retryTracking);
      recordCompletion();
    }
    if (currentUser?.role === "user" && !restoredResult) {
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      const retry = document.createElement("button");
      retry.type = "button";retry.textContent = "Retry saving result";
      const profile = document.createElement("a");
      profile.href = "profile.html";profile.textContent = "View saved profile";
      async function saveResult() {
        retry.hidden = true;status.textContent = "Saving result...";
        try {
          await authRequest("/api/user/profile", { method: "PUT", body: JSON.stringify({ quiz_result: { skinType: savedProfile.skinType, concern: savedProfile.concern, inconclusive: savedProfile.inconclusive } }) });
          status.textContent = "Result saved to your account.";
        } catch { status.textContent = "Could not save. Your result remains visible; sign in again if your session expired, then retry.";retry.hidden = false; }
      }
      retry.addEventListener("click", saveResult);
      resultBox.append(status, retry, profile);saveResult();
    }
  }

  // ==========================================
  // RESTART
  // ==========================================

  function restartQuiz() {
    currentQuestion = 0;
    selectedAnswers.fill(null);
    quizInProgress = true;

    resultBox.hidden = true;
    questionBox.hidden = false;
    navigation.hidden = false;

    renderQuestion();
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  backButton.addEventListener("click", () => {
    if (currentQuestion > 0) {
      currentQuestion--;
      renderQuestion();
    }
  });

  nextButton.addEventListener("click", () => {
    if (selectedAnswers[currentQuestion] === null) {
      return;
    }

    if (currentQuestion < questions.length - 1) {
      currentQuestion++;
      renderQuestion();
    } else {
      showResult();
    }
  });

  // ==========================================
  // START QUIZ
  // ==========================================

  startQuizButton.addEventListener("click", () => {
    welcomeScreen.hidden = true;
    quizContent.hidden = false;

    quizInProgress = true;
    currentQuestion = 0;
    selectedAnswers.fill(null);

    renderQuestion();
  });


  // ==========================================
  // WARN BEFORE LEAVING QUIZ
  // ==========================================

  try {
    const key = currentUser?.role === "user" ? `glowguide_skin_profile:user:${currentUser.id}` : "glowguide_skin_profile";
    let saved = JSON.parse(localStorage.getItem(key) || "null");
    if (currentUser?.role === "user") {
      try {
        const remote = (await authRequest("/api/user/profile")).quiz_result;
        if (remote && (!saved || remote.skinType !== saved.skinType || remote.concern !== saved.concern || remote.inconclusive !== saved.inconclusive)) saved = remote;
      }
      catch (error) { console.warn("Using locally saved quiz result:", error); }
    }
    if (saved && typeof saved.inconclusive === "boolean" && (saved.skinType === null || Object.hasOwn(skinLabels, saved.skinType))) {
      welcomeScreen.hidden = true;
      quizContent.hidden = false;
      showResult(saved);
    }
  } catch (error) { console.warn("Could not restore quiz result:", error); }

  // Browser warning when refreshing or closing the tab.
  window.addEventListener("beforeunload", event => {
    if (!quizInProgress) return;

    event.preventDefault();
    event.returnValue = "";
  });

  // Custom warning when navigating through website links.
  document.addEventListener("click", event => {
    if (!quizInProgress) return;

    const link = event.target.closest("a[href]");

    if (!link) return;

    // Do not warn when opening a new tab.
    if (link.target === "_blank") return;

    // Ignore modified clicks (Ctrl/Cmd/Shift + click).
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    const confirmed = window.confirm(
      "You are currently taking the Skin Quiz.\n\n" +
      "If you leave this page, all your answers will be lost.\n\n" +
      "Are you sure you want to leave?"
    );

    if (!confirmed) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      // Prevent a second browser warning.
      quizInProgress = false;
    }
  }, true);

});
