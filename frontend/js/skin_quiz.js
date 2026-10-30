
"use strict";

// ==========================================
// GLOWGUIDE SKIN QUIZ
// ==========================================

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
      const answers = section.querySelector(".admin-quiz-answers");
      question.answers.forEach((answer, answerIndex) => {
        const label = document.createElement("label");
        label.textContent = `Answer ${answerIndex + 1}`;
        const input = document.createElement("input");
        input.name = `answer-${questionIndex}-${answerIndex}`;
        input.value = answer.text;
        label.appendChild(input);
        answers.appendChild(label);
      });
      const deleteQuestion = document.createElement("button");
      deleteQuestion.type = "button";
      deleteQuestion.className = "admin-quiz-delete";
      deleteQuestion.textContent = "Delete Question";
      deleteQuestion.onclick = () => {
        if (questions.length <= 1) return;
        const removed = questions.splice(questionIndex, 1)[0];
        const removeSavedQuestion = removed.id
          ? authRequest(`/api/admin/quiz/${removed.id}`, { method: "DELETE" })
          : Promise.resolve();
        removeSavedQuestion.then(renderAdminQuiz).catch(error => alert(error.message));
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
      try {
        for (let i = 0; i < questions.length; i++) {
          const payload = { question_order: i, title: form.elements[`title-${i}`].value, description: form.elements[`description-${i}`].value, answers: questions[i].answers.map((answer, j) => ({ ...answer, text: form.elements[`answer-${i}-${j}`].value })), published: true };
          await authRequest(`/api/admin/quiz${questions[i].id ? `/${questions[i].id}` : ""}`, { method: questions[i].id ? "PUT" : "POST", body: JSON.stringify(payload) });
        }
        save.textContent = "Saved";
      } catch (error) { save.textContent = error.message; }
    });
    container.appendChild(form);

  }

  function escapeValue(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  let currentQuestion = 0;
  const selectedAnswers = Array(questions.length).fill(null);

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
    combination: "Combination Skin"
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
      combination: 0
    };

    let concern = "";

    selectedAnswers.forEach((answerIndex, questionIndex) => {
      const answer =
        questions[questionIndex].answers[answerIndex];

      if (answer.type) {
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

  function showResult() {
    const result = calculateResult();

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
      `Your main concern: ${concernLabels[result.concern]}`;

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

    // Save profile locally for future AI integration.
    try {
      localStorage.setItem(
        "glowguide_skin_profile",
        JSON.stringify({
          skinType: result.skinType,
          concern: result.concern,
          inconclusive: result.inconclusive
        })
      );
    } catch (error) {
      console.warn("Skin profile could not be saved:", error);
    }
  }

  // ==========================================
  // RESTART
  // ==========================================

  function restartQuiz() {
    currentQuestion = 0;
    selectedAnswers.fill(null);

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

  renderQuestion();
});
