
document.addEventListener("DOMContentLoaded", () => {
    const habitForm = document.getElementById("habit-form");
    const habitName = document.getElementById("habit-name");
    const habitCategory = document.getElementById("habit-category");
    const habitList = document.getElementById("habit-list");
    const emptyState = document.getElementById("empty-state");
    const message = document.getElementById("message");
    const addButton = document.getElementById("add-button");

    const habitCount = document.getElementById("habit-count");
    const progressPercent = document.getElementById("progress-percent");
    const progressFill = document.getElementById("progress-fill");
    const progressNote = document.getElementById("progress-note");
    const todayDate = document.getElementById("today-date");

    const calendarMonth = document.getElementById("calendar-month");
    const calendarDays = document.getElementById("calendar-days");
    const calendarNote = document.getElementById("calendar-note");
    const prevMonth = document.getElementById("prev-month");
    const nextMonth = document.getElementById("next-month");

    let habits = [];
    let messageTimer;

    const now = new Date();
    let viewedYear = now.getFullYear();
    let viewedMonth = now.getMonth();

    if (todayDate) {
        todayDate.textContent = now.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function showMessage(text, type = "success") {
        if (!message) return;

        message.textContent = text;
        message.className = `message show ${type}`;

        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => {
            message.className = "message";
            message.textContent = "";
        }, 3500);
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }

        return data;
    }

    async function loadHabits() {
        try {
            const data = await apiRequest("/api/habits");

            habits = Array.isArray(data)
                ? data
                : (data.habits || []);

            renderHabits();
            await renderCalendar();
        } catch (error) {
            showMessage(error.message || "Unable to load habits.", "error");
        }
    }

    function renderHabits() {
        if (!habitList) return;

        habitList.innerHTML = "";

        const completedCount = habits.filter(
            habit => Boolean(habit.completed)
        ).length;

        const totalCount = habits.length;

        const percent = totalCount === 0
            ? 0
            : Math.round((completedCount / totalCount) * 100);

        if (habitCount) habitCount.textContent = totalCount;
        if (progressPercent) progressPercent.textContent = `${percent}%`;

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        if (progressNote) {
            if (totalCount === 0) {
                progressNote.textContent =
                    "Let's complete your first habit!";
            } else if (completedCount === totalCount) {
                progressNote.textContent =
                    "Amazing! All habits completed!";
            } else {
                progressNote.textContent =
                    `${completedCount} of ${totalCount} habits completed`;
            }
        }

        if (emptyState) {
            emptyState.style.display =
                totalCount === 0 ? "block" : "none";
        }

        habits.forEach(habit => {
            const completed = Boolean(habit.completed);

            const card = document.createElement("article");
            card.className =
                `habit-card${completed ? " completed" : ""}`;

            const checkButton = document.createElement("button");
            checkButton.type = "button";
            checkButton.className =
                `habit-check${completed ? " done" : ""}`;
            checkButton.textContent = completed ? "✓" : "";
            checkButton.setAttribute(
                "aria-label",
                completed
                    ? "Mark habit as incomplete"
                    : "Complete habit"
            );

            checkButton.addEventListener("click", () => {
                toggleHabit(habit.id);
            });

            const info = document.createElement("div");
            info.className = "habit-info";

            const title = document.createElement("h3");
            title.textContent = habit.name;

            const subtitle = document.createElement("p");
            subtitle.textContent = completed
                ? "Completed today"
                : "Keep going — you've got this!";

            info.append(title, subtitle);

            const category = document.createElement("span");
            category.className = "habit-category";
            category.textContent = habit.category || "Personal";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-habit";
            deleteButton.textContent = "×";
            deleteButton.title = "Delete habit";
            deleteButton.setAttribute("aria-label", "Delete habit");

            deleteButton.addEventListener("click", () => {
                deleteHabit(habit.id);
            });

            card.append(checkButton, info, category, deleteButton);
            habitList.appendChild(card);
        });
    }

    async function renderCalendar() {
        if (!calendarMonth || !calendarDays || !calendarNote) {
            return;
        }

        const monthKey =
            `${viewedYear}-${String(viewedMonth + 1).padStart(2, "0")}`;

        calendarMonth.textContent = new Date(
            viewedYear,
            viewedMonth,
            1
        ).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });

        calendarDays.innerHTML = "";
        calendarNote.textContent = "Loading calendar...";

        try {
            const data = await apiRequest(
                `/api/calendar?month=${monthKey}`
            );

            const firstDay = new Date(
                viewedYear,
                viewedMonth,
                1
            );

            const daysInMonth = new Date(
                viewedYear,
                viewedMonth + 1,
                0
            ).getDate();

            // Calendar starts on Monday.
            const offset = (firstDay.getDay() + 6) % 7;

            for (let i = 0; i < offset; i++) {
                const blank = document.createElement("span");
                blank.className = "calendar-blank";
                blank.setAttribute("aria-hidden", "true");
                calendarDays.appendChild(blank);
            }

            const today = new Date();
            let daysWithCompletions = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey =
                    `${monthKey}-${String(day).padStart(2, "0")}`;

                const count = Number(data.days[dateKey] || 0);

                const cell = document.createElement("div");
                cell.className = "calendar-day";

                const number = document.createElement("span");
                number.className = "day-number";
                number.textContent = day;
                cell.appendChild(number);

                if (count > 0) {
                    cell.classList.add("has-completion");

                    const mark = document.createElement("span");
                    mark.className = "day-mark";
                    mark.textContent = "✓";
                    mark.setAttribute("aria-hidden", "true");

                    cell.appendChild(mark);
                    daysWithCompletions++;

                    cell.title =
                        `${count} completed habit${count === 1 ? "" : "s"}`;
                    cell.setAttribute(
                        "aria-label",
                        `${dateKey}: ${count} completed habits`
                    );
                } else {
                    cell.title = dateKey;
                    cell.setAttribute("aria-label", dateKey);
                }

                const isToday =
                    viewedYear === today.getFullYear() &&
                    viewedMonth === today.getMonth() &&
                    day === today.getDate();

                if (isToday) {
                    cell.classList.add("is-today");
                }

                calendarDays.appendChild(cell);
            }

            calendarNote.textContent = daysWithCompletions > 0
                ? `${daysWithCompletions} day${daysWithCompletions === 1 ? "" : "s"} with completed habits this month.`
                : "No completed habits recorded this month yet.";

        } catch (error) {
            calendarNote.textContent = "Could not load calendar.";
            showMessage(error.message || "Calendar error.", "error");
        }
    }

    if (prevMonth) {
        prevMonth.addEventListener("click", () => {
            viewedMonth--;

            if (viewedMonth < 0) {
                viewedMonth = 11;
                viewedYear--;
            }

            renderCalendar();
        });
    }

    if (nextMonth) {
        nextMonth.addEventListener("click", () => {
            viewedMonth++;

            if (viewedMonth > 11) {
                viewedMonth = 0;
                viewedYear++;
            }

            renderCalendar();
        });
    }

    if (habitForm) {
        habitForm.addEventListener("submit", async event => {
            event.preventDefault();

            const name = habitName.value.trim();
            const category = habitCategory.value;

            if (!name) {
                showMessage("Please enter a habit name.", "error");
                habitName.focus();
                return;
            }

            addButton.disabled = true;
            addButton.textContent = "Adding...";

            try {
                await apiRequest("/api/habits", {
                    method: "POST",
                    body: JSON.stringify({ name, category })
                });

                habitForm.reset();
                await loadHabits();

                showMessage("Habit added successfully!");
                habitName.focus();
            } catch (error) {
                showMessage(error.message || "Could not add habit.", "error");
            } finally {
                addButton.disabled = false;
                addButton.textContent = "+ Add Habit";
            }
        });
    }

    async function toggleHabit(id) {
        try {
            await apiRequest(`/api/habits/${id}/toggle`, {
                method: "PATCH"
            });

            await loadHabits();
            showMessage("Habit progress updated!");
        } catch (error) {
            showMessage(error.message || "Could not update habit.", "error");
        }
    }

    async function deleteHabit(id) {
        if (!window.confirm("Do you want to delete this habit?")) {
            return;
        }

        try {
            await apiRequest(`/api/habits/${id}`, {
                method: "DELETE"
            });

            await loadHabits();
            showMessage("Habit deleted.");
        } catch (error) {
            showMessage(error.message || "Could not delete habit.", "error");
        }
    }

    loadHabits();
});

