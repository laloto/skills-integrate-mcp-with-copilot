document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const accountToggle = document.getElementById("account-toggle");
  const accountPanel = document.getElementById("account-panel");
  const publicAccountActions = document.getElementById("public-account-actions");
  const teacherAccountActions = document.getElementById("teacher-account-actions");
  const teacherIdentity = document.getElementById("teacher-identity");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  let isTeacher = false;

  function updateAuthUI(username = "") {
    signupContainer.classList.toggle("hidden", !isTeacher);
    publicAccountActions.classList.toggle("hidden", isTeacher);
    teacherAccountActions.classList.toggle("hidden", !isTeacher);
    teacherIdentity.textContent = isTeacher ? `Signed in as ${username}` : "";
    accountToggle.setAttribute("aria-label", isTeacher ? "Teacher account menu" : "Teacher login");
    accountToggle.setAttribute("aria-expanded", "false");
    accountPanel.classList.add("hidden");
  }

  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  async function refreshAuthStatus() {
    try {
      const response = await fetch("/auth/status");
      const status = await response.json();
      isTeacher = response.ok && status.authenticated;
      updateAuthUI(status.username || "");
    } catch (error) {
      isTeacher = false;
      updateAuthUI();
      console.error("Error checking teacher session:", error);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Keep rosters public while limiting registration changes to teachers.
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${isTeacher ? `<button class="delete-btn" type="button" data-activity="${name}" data-email="${email}" aria-label="Unregister ${email}" title="Unregister student">&times;</button>` : ""}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to teacher-only unregister buttons.
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          isTeacher = false;
          updateAuthUI();
          fetchActivities();
        }
        showMessage(result.detail || "An error occurred", "error");
      }

    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          isTeacher = false;
          updateAuthUI();
          fetchActivities();
        }
        showMessage(result.detail || "An error occurred", "error");
      }

    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  accountToggle.addEventListener("click", () => {
    const isExpanded = accountToggle.getAttribute("aria-expanded") === "true";
    accountToggle.setAttribute("aria-expanded", String(!isExpanded));
    accountPanel.classList.toggle("hidden", isExpanded);
  });

  document.getElementById("show-login-button").addEventListener("click", () => {
    accountPanel.classList.add("hidden");
    accountToggle.setAttribute("aria-expanded", "false");
    loginMessage.className = "hidden";
    loginDialog.showModal();
    document.getElementById("teacher-username").focus();
  });

  document.getElementById("cancel-login-button").addEventListener("click", () => {
    loginDialog.close();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        loginMessage.textContent = result.detail || "Unable to sign in.";
        loginMessage.className = "error";
        return;
      }

      isTeacher = true;
      updateAuthUI(result.username);
      loginForm.reset();
      loginDialog.close();
      await fetchActivities();
    } catch (error) {
      loginMessage.textContent = "Failed to sign in. Please try again.";
      loginMessage.className = "error";
      console.error("Error signing in:", error);
    }
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", { method: "POST" });
    } finally {
      isTeacher = false;
      updateAuthUI();
      await fetchActivities();
    }
  });

  async function initialize() {
    await refreshAuthStatus();
    await fetchActivities();
  }

  initialize();
});
