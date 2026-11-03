
document.addEventListener("DOMContentLoaded", () => {
    const habitForm = document.getElementById("habit-form");
    const habitName = document.getElementById("habit-name");
    const habitCategory = document.getElementById("habit-category");
    const habitList = document.getElementById("habit-list");
    const emptyState = document.getElementById("empty-state");
    const message = document.getElementById("message");
    const addButton = document.getElementById("add-button");
    const searchInput = document.getElementById("habit-search");
    const panelToggle = document.querySelector(".panel-toggle");
    const panelContent = document.getElementById("habit-panel-content");
    const rangeTabs = document.querySelectorAll(".range-tab");
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    const categoryFilter = document.getElementById("category-filter");
    const habitResults = document.getElementById("habit-results");
    const weeklyGoalForm = document.getElementById("weekly-goal-form");
    const weeklyGoalInput = document.getElementById("weekly-goal-input");
    const weeklyGoalNote = document.getElementById("weekly-goal-note");
    const weeklyGoalTrack = document.querySelector(".weekly-goal-track");
    const weeklyGoalFill = document.getElementById("weekly-goal-fill");
    const weeklyGoalProgress = document.getElementById("weekly-goal-progress");
    const weeklyGoalPercent = document.getElementById("weekly-goal-percent");
    const weeklyBars = document.getElementById("weekly-bars");
    const weeklyActivityTotal = document.getElementById("weekly-activity-total");
    const journeyProgressCount = document.getElementById("journey-progress-count");
    const journeyProgressTrack = document.querySelector(".journey-progress-track");
    const journeyProgressFill = document.getElementById("journey-progress-fill");
    const journeySummary = document.getElementById("journey-summary");
    const journeyMilestones = document.getElementById("journey-milestones");
    const journeyAction = document.getElementById("journey-action");

    const habitCount = document.getElementById("habit-count");
    const completedCountElement = document.getElementById("completed-count");
    const remainingCount = document.getElementById("remaining-count");
    const notificationCount = document.getElementById("notification-count");
    const progressPercent = document.getElementById("progress-percent");
    const progressFill = document.getElementById("progress-fill");
    const progressNote = document.getElementById("progress-note");
    const todayDate = document.getElementById("today-date");
    const currentStreak = document.getElementById("current-streak");
    const longestStreak = document.getElementById("longest-streak");
    const totalCompleted = document.getElementById("total-completed");
    const chart = document.getElementById("progress-chart");
    const chartBox = document.getElementById("chart-box");
    const chartLabels = document.getElementById("chart-labels");

    const calendarMonth = document.getElementById("calendar-month");
    const calendarDays = document.getElementById("calendar-days");
    const calendarNote = document.getElementById("calendar-note");
    const prevMonth = document.getElementById("prev-month");
    const nextMonth = document.getElementById("next-month");

    let habits = [];
    let messageTimer;
    let currentSearch = "";
    let selectedRange = "week";
    let weeklyGoal = 20;
    let weeklySeries = [];
    let totalCompletedHabits = 0;
    let longestRecordedStreak = 0;

    function getPhilippineToday() {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "numeric",
            day: "numeric"
        }).formatToParts(new Date());
        const values = Object.fromEntries(
            parts.map(part => [part.type, part.value])
        );
        return new Date(
            Number(values.year),
            Number(values.month) - 1,
            Number(values.day)
        );
    }

    const now = getPhilippineToday();
    let viewedYear = now.getFullYear();
    let viewedMonth = now.getMonth();

    if (todayDate) {
        todayDate.textContent = now.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "Asia/Manila"
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
            await Promise.all([renderCalendar(), renderAnalytics()]);
        } catch (error) {
            showMessage(error.message || "Unable to load habits.", "error");
        }
    }

    function renderHabits() {
        if (!habitList) return;

        const filteredHabits = habits.filter(habit => {
            const haystack = `${habit.name} ${habit.category}`.toLowerCase();
            const matchesSearch = haystack.includes(currentSearch.toLowerCase());
            const matchesCategory =
                !categoryFilter ||
                categoryFilter.value === "all" ||
                habit.category === categoryFilter.value;
            return matchesSearch && matchesCategory;
        });

        habitList.innerHTML = "";

        const completedCount = habits.filter(
            habit => Boolean(habit.completed)
        ).length;

        const totalCount = habits.length;
        const remaining = totalCount - completedCount;

        const percent = totalCount === 0
            ? 0
            : Math.round((completedCount / totalCount) * 100);

        if (habitCount) habitCount.textContent = totalCount;
        if (completedCountElement) {
            completedCountElement.textContent = completedCount;
        }
        if (remainingCount) remainingCount.textContent = remaining;
        if (notificationCount) {
            notificationCount.textContent = remaining;
            notificationCount.hidden = remaining === 0;
        }
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
                filteredHabits.length === 0 && totalCount === 0 ? "block" : "none";
        }

        if (habitResults) {
            const isFiltered = Boolean(currentSearch) ||
                Boolean(categoryFilter && categoryFilter.value !== "all");
            habitResults.textContent = isFiltered
                ? `Showing ${filteredHabits.length} of ${totalCount} habits`
                : `${totalCount} ${totalCount === 1 ? "habit" : "habits"}`;
        }

        if (filteredHabits.length === 0 && totalCount > 0) {
            const noResults = document.createElement("div");
            noResults.className = "empty-state compact-empty";
            noResults.innerHTML = `
                <div class="empty-icon">⌕</div>
                <h3>No habits match your search</h3>
                <p>Try another keyword or add a new habit.</p>
            `;
            habitList.appendChild(noResults);
            return;
        }

        filteredHabits.forEach(habit => {
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

    function renderChart(series) {
        if (!chart || !chartBox || !chartLabels) return;

        const width = 280;
        const height = 120;
        const left = 8;
        const right = width - 8;
        const bottom = height - 12;
        const top = 12;
        const maxValue = Math.max(1, ...series.map(point => point.value));
        const points = series.map((point, index) => {
            const x = series.length === 1
                ? (left + right) / 2
                : left + (index / (series.length - 1)) * (right - left);
            const y = bottom - (point.value / maxValue) * (bottom - top);
            return `${x},${y}`;
        });

        chart.replaceChildren();
        [30, 60, 90].forEach(y => {
            const line = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );
            line.setAttribute("x1", "0");
            line.setAttribute("x2", String(width));
            line.setAttribute("y1", String(y));
            line.setAttribute("y2", String(y));
            line.setAttribute("stroke", "#edf1f8");
            line.setAttribute("stroke-width", "1");
            chart.appendChild(line);
        });

        if (points.length > 0) {
            const line = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "polyline"
            );
            line.setAttribute("points", points.join(" "));
            line.setAttribute("fill", "none");
            line.setAttribute("stroke", "var(--primary)");
            line.setAttribute("stroke-width", "3");
            line.setAttribute("stroke-linecap", "round");
            line.setAttribute("stroke-linejoin", "round");
            chart.appendChild(line);
        }

        const labelCount = Math.min(7, series.length);
        chartLabels.replaceChildren();
        chartLabels.style.gridTemplateColumns =
            `repeat(${labelCount || 1}, minmax(0, 1fr))`;
        for (let index = 0; index < labelCount; index++) {
            const pointIndex = labelCount === 1
                ? 0
                : Math.round(index * (series.length - 1) / (labelCount - 1));
            const label = document.createElement("span");
            label.textContent = series[pointIndex].label;
            chartLabels.appendChild(label);
        }
        chart.setAttribute(
            "aria-label",
            `${selectedRange} habit completions chart`
        );
        chartBox.setAttribute("aria-busy", "false");
    }

    async function renderAnalytics() {
        if (!chart) return;

        if (chartBox) chartBox.setAttribute("aria-busy", "true");
        try {
            const data = await apiRequest(
                `/api/analytics?range=${selectedRange}`
            );
            if (currentStreak) {
                currentStreak.textContent = `${data.current_streak} days`;
            }
            if (longestStreak) {
                longestStreak.textContent = `${data.longest_streak} days`;
            }
            if (totalCompleted) {
                totalCompleted.textContent = data.total_completed;
            }
            totalCompletedHabits = data.total_completed;
            longestRecordedStreak = data.longest_streak;
            if (selectedRange === "week") {
                weeklySeries = data.series;
                renderWeeklyActivity();
            }
            renderJourney();
            renderChart(data.series);
        } catch (error) {
            if (chartBox) chartBox.setAttribute("aria-busy", "false");
            showMessage(error.message || "Unable to load progress.", "error");
        }
    }

    function renderWeeklyActivity() {
        if (!weeklyBars || !weeklyActivityTotal) return;

        const total = weeklySeries.reduce(
            (sum, point) => sum + Number(point.value || 0), 0
        );
        const maxValue = Math.max(1, ...weeklySeries.map(point => point.value));
        weeklyBars.replaceChildren();

        weeklySeries.forEach((point, index) => {
            const day = document.createElement("div");
            day.className = `weekly-day${index === weeklySeries.length - 1 ? " is-today" : ""}`;
            day.setAttribute(
                "aria-label",
                `${point.label}: ${point.value} completed habits${index === weeklySeries.length - 1 ? ", today" : ""}`
            );

            const value = document.createElement("span");
            value.className = "weekly-bar-value";
            value.textContent = point.value;

            const track = document.createElement("div");
            track.className = "weekly-bar-track";
            const bar = document.createElement("span");
            const height = point.value > 0
                ? Math.max(12, (point.value / maxValue) * 100)
                : 4;
            bar.style.height = `${height}%`;
            track.appendChild(bar);

            const label = document.createElement("span");
            label.className = "weekly-day-label";
            label.textContent = point.label;

            day.append(value, track, label);
            weeklyBars.appendChild(day);
        });

        weeklyActivityTotal.textContent =
            `${total} ${total === 1 ? "completion" : "completions"}`;
        updateWeeklyGoalDisplay(total);
    }

    function updateWeeklyGoalDisplay(completed = null) {
        const total = completed === null
            ? weeklySeries.reduce((sum, point) => sum + Number(point.value || 0), 0)
            : completed;
        const percent = Math.min(100, Math.round((total / weeklyGoal) * 100));

        if (weeklyGoalInput) weeklyGoalInput.value = weeklyGoal;
        if (weeklyGoalNote) {
            weeklyGoalNote.textContent = total >= weeklyGoal
                ? "Goal reached — you're building a great rhythm!"
                : `${weeklyGoal - total} more to reach your weekly goal.`;
        }
        if (weeklyGoalFill) weeklyGoalFill.style.width = `${percent}%`;
        if (weeklyGoalTrack) {
            weeklyGoalTrack.setAttribute("aria-valuenow", String(percent));
        }
        if (weeklyGoalProgress) {
            weeklyGoalProgress.textContent = `${total} of ${weeklyGoal} completions`;
        }
        if (weeklyGoalPercent) weeklyGoalPercent.textContent = `${percent}%`;
        renderJourney();
    }

    function renderJourney() {
        if (!journeyMilestones) return;

        const weeklyCompletions = weeklySeries.reduce(
            (sum, point) => sum + Number(point.value || 0), 0
        );
        const milestones = [
            {
                title: "Choose your first habit",
                detail: "Pick one small action to start your routine.",
                complete: habits.length > 0,
                icon: "✦"
            },
            {
                title: "Celebrate your first check-in",
                detail: "Mark a habit complete to record your first win.",
                complete: totalCompletedHabits > 0,
                icon: "✓"
            },
            {
                title: "Build a 7-day streak",
                detail: "Show up at least once each day for a week.",
                complete: longestRecordedStreak >= 7,
                icon: "↗"
            },
            {
                title: "Reach your weekly goal",
                detail: `Complete ${weeklyGoal} habits in the last seven days.`,
                complete: weeklyCompletions >= weeklyGoal,
                icon: "◎"
            }
        ];
        const completedMilestones = milestones.filter(
            milestone => milestone.complete
        ).length;

        journeyMilestones.replaceChildren();
        milestones.forEach(milestone => {
            const item = document.createElement("li");
            item.className = `journey-milestone${milestone.complete ? " complete" : ""}`;

            const marker = document.createElement("span");
            marker.className = "journey-marker";
            marker.textContent = milestone.complete ? "✓" : milestone.icon;
            marker.setAttribute("aria-hidden", "true");

            const copy = document.createElement("span");
            copy.className = "journey-milestone-copy";
            const title = document.createElement("strong");
            title.textContent = milestone.title;
            const detail = document.createElement("small");
            detail.textContent = milestone.detail;
            copy.append(title, detail);

            const status = document.createElement("span");
            status.className = "journey-status";
            status.textContent = milestone.complete ? "Done" : "Next";
            item.append(marker, copy, status);
            journeyMilestones.appendChild(item);
        });

        if (journeyProgressCount) {
            journeyProgressCount.textContent = `${completedMilestones} / ${milestones.length}`;
        }
        if (journeyProgressFill) {
            journeyProgressFill.style.width =
                `${(completedMilestones / milestones.length) * 100}%`;
        }
        if (journeyProgressTrack) {
            journeyProgressTrack.setAttribute(
                "aria-valuenow",
                String(completedMilestones)
            );
        }
        if (journeySummary) {
            journeySummary.textContent = completedMilestones === milestones.length
                ? "You reached every milestone. Keep your momentum going!"
                : `${completedMilestones} of ${milestones.length} milestones complete. Keep taking it one day at a time.`;
        }
        if (journeyAction) {
            journeyAction.innerHTML = completedMilestones === milestones.length
                ? "Keep it going <span aria-hidden=\"true\">→</span>"
                : habits.length === 0
                    ? "Start your journey <span aria-hidden=\"true\">→</span>"
                    : "Add another habit <span aria-hidden=\"true\">→</span>";
        }
    }

    async function loadWeeklyGoal() {
        try {
            const data = await apiRequest("/api/weekly-goal");
            weeklyGoal = data.weekly_goal;
            updateWeeklyGoalDisplay();
        } catch (error) {
            showMessage(error.message || "Unable to load weekly goal.", "error");
        }
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

            const offset = firstDay.getDay();

            for (let i = 0; i < offset; i++) {
                const blank = document.createElement("span");
                blank.className = "calendar-blank";
                blank.setAttribute("aria-hidden", "true");
                calendarDays.appendChild(blank);
            }

            const today = getPhilippineToday();
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

    if (searchInput) {
        searchInput.addEventListener("input", event => {
            currentSearch = event.target.value.trim();
            renderHabits();
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", renderHabits);
    }

    if (journeyAction) {
        journeyAction.addEventListener("click", () => {
            habitName?.focus();
            habitName?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }

    if (panelToggle) {
        panelToggle.addEventListener("click", () => {
            if (!panelContent) return;
            const collapsed = !panelContent.hidden;
            panelContent.hidden = collapsed;
            panelToggle.setAttribute("aria-expanded", String(!collapsed));
            panelToggle.setAttribute(
                "aria-label",
                collapsed ? "Expand habit panel" : "Collapse habit panel"
            );
            panelToggle.textContent = collapsed ? "⌄" : "^";
        });
    }

    rangeTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            rangeTabs.forEach(item => {
                item.classList.remove("active");
                item.setAttribute("aria-pressed", "false");
            });
            tab.classList.add("active");
            tab.setAttribute("aria-pressed", "true");
            selectedRange = tab.dataset.range || "week";
            renderAnalytics();
        });
    });

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(navItem => navItem.classList.remove("active"));
            item.classList.add("active");
        });
    });

    if (weeklyGoalForm) {
        weeklyGoalForm.addEventListener("submit", async event => {
            event.preventDefault();
            const nextGoal = Number(weeklyGoalInput.value);
            if (!Number.isInteger(nextGoal) || nextGoal < 1 || nextGoal > 200) {
                showMessage("Choose a weekly goal between 1 and 200.", "error");
                weeklyGoalInput.focus();
                return;
            }

            const saveButton = weeklyGoalForm.querySelector("button");
            saveButton.disabled = true;
            try {
                const data = await apiRequest("/api/weekly-goal", {
                    method: "PUT",
                    body: JSON.stringify({ weekly_goal: nextGoal })
                });
                weeklyGoal = data.weekly_goal;
                updateWeeklyGoalDisplay();
                showMessage("Weekly goal saved!");
            } catch (error) {
                showMessage(error.message || "Could not save weekly goal.", "error");
            } finally {
                saveButton.disabled = false;
            }
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
                addButton.textContent = "+ Add new";
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
    loadWeeklyGoal();
});
