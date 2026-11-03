
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from functools import wraps
import sqlite3

app = Flask(__name__)
app.secret_key = "habitflow-local-secret-key-change-this"

# Database file is saved beside main.py
DATABASE = Path(__file__).resolve().parent / "habits.db"

# Philippine time: UTC+8
PH_TIMEZONE = timezone(timedelta(hours=8))


def get_db():
    conn = sqlite3.connect(str(DATABASE))
    conn.row_factory = sqlite3.Row
    return conn


def today_date():
    return datetime.now(PH_TIMEZONE).date().isoformat()


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'Personal',
            completed INTEGER NOT NULL DEFAULT 0
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS habit_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL,
            UNIQUE (habit_id, completion_date)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            weekly_goal INTEGER NOT NULL DEFAULT 20
                CHECK (weekly_goal BETWEEN 1 AND 200)
        )
    """)

    # Preserve today's completed habits from an older database.
    conn.execute("""
        INSERT OR IGNORE INTO habit_completions
        (habit_id, user_id, completion_date)
        SELECT id, user_id, ?
        FROM habits
        WHERE completed = 1
    """, (today_date(),))

    conn.commit()
    conn.close()


def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Please log in again."}), 401
            return redirect(url_for("login"))
        return func(*args, **kwargs)
    return wrapper


@app.route("/")
@login_required
def index():
    return render_template("index.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not name or not email or not password:
            return render_template(
                "register.html",
                error="Please fill in all fields."
            )

        if len(password) < 6:
            return render_template(
                "register.html",
                error="Password must be at least 6 characters."
            )

        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                (name, email, generate_password_hash(password))
            )
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return render_template(
                "register.html",
                error="Email already registered. Please log in."
            )

        conn.close()
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        conn = get_db()
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        conn.close()

        if user and check_password_hash(user["password"], password):
            session.clear()
            session["user_id"] = user["id"]
            session["name"] = user["name"]
            return redirect(url_for("index"))

        return render_template(
            "login.html",
            error="Incorrect email or password."
        )

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/api/habits", methods=["GET"])
@login_required
def get_habits():
    conn = get_db()
    rows = conn.execute("""
        SELECT h.id, h.name, h.category,
            EXISTS (
                SELECT 1 FROM habit_completions c
                WHERE c.habit_id = h.id
                  AND c.user_id = h.user_id
                  AND c.completion_date = ?
            ) AS completed
        FROM habits h
        WHERE h.user_id = ?
        ORDER BY h.id DESC
    """, (today_date(), session["user_id"])).fetchall()
    conn.close()

    return jsonify([
        {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "completed": bool(row["completed"])
        }
        for row in rows
    ])


@app.route("/api/habits", methods=["POST"])
@login_required
def add_habit():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "Personal")).strip() or "Personal"

    if not name:
        return jsonify({"error": "Please enter a habit name."}), 400

    if len(name) > 120:
        return jsonify({"error": "Habit name is too long."}), 400

    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO habits (user_id, name, category, completed)
        VALUES (?, ?, ?, 0)
    """, (session["user_id"], name, category))
    conn.commit()
    habit_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "id": habit_id,
        "name": name,
        "category": category,
        "completed": False
    }), 201


@app.route("/api/habits/<int:habit_id>/toggle", methods=["PATCH"])
@login_required
def toggle_habit(habit_id):
    user_id = session["user_id"]
    today = today_date()
    conn = get_db()

    habit = conn.execute(
        "SELECT id FROM habits WHERE id = ? AND user_id = ?",
        (habit_id, user_id)
    ).fetchone()

    if habit is None:
        conn.close()
        return jsonify({"error": "Habit not found."}), 404

    existing = conn.execute("""
        SELECT id FROM habit_completions
        WHERE habit_id = ? AND user_id = ? AND completion_date = ?
    """, (habit_id, user_id, today)).fetchone()

    if existing:
        conn.execute("""
            DELETE FROM habit_completions
            WHERE habit_id = ? AND user_id = ? AND completion_date = ?
        """, (habit_id, user_id, today))
        completed = False
    else:
        conn.execute("""
            INSERT INTO habit_completions
            (habit_id, user_id, completion_date)
            VALUES (?, ?, ?)
        """, (habit_id, user_id, today))
        completed = True

    conn.execute(
        "UPDATE habits SET completed = ? WHERE id = ? AND user_id = ?",
        (int(completed), habit_id, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "completed": completed})


@app.route("/api/habits/<int:habit_id>", methods=["DELETE"])
@login_required
def delete_habit(habit_id):
    conn = get_db()
    user_id = session["user_id"]

    habit = conn.execute(
        "SELECT id FROM habits WHERE id = ? AND user_id = ?",
        (habit_id, user_id)
    ).fetchone()

    if habit is None:
        conn.close()
        return jsonify({"error": "Habit not found."}), 404

    conn.execute(
        "DELETE FROM habit_completions WHERE habit_id = ? AND user_id = ?",
        (habit_id, user_id)
    )
    conn.execute(
        "DELETE FROM habits WHERE id = ? AND user_id = ?",
        (habit_id, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@app.route("/api/calendar", methods=["GET"])
@login_required
def get_calendar():
    month = request.args.get("month", "")

    try:
        selected = datetime.strptime(month, "%Y-%m")
    except ValueError:
        return jsonify({"error": "Use month format YYYY-MM."}), 400

    start_date = selected.strftime("%Y-%m-01")

    if selected.month == 12:
        next_month = selected.replace(year=selected.year + 1, month=1)
    else:
        next_month = selected.replace(month=selected.month + 1)

    end_date = next_month.strftime("%Y-%m-01")

    conn = get_db()
    rows = conn.execute("""
        SELECT completion_date, COUNT(*) AS completed_count
        FROM habit_completions
        WHERE user_id = ?
          AND completion_date >= ?
          AND completion_date < ?
        GROUP BY completion_date
    """, (session["user_id"], start_date, end_date)).fetchall()
    conn.close()

    return jsonify({
        "month": month,
        "days": {
            row["completion_date"]: row["completed_count"]
            for row in rows
        }
    })


@app.route("/api/analytics", methods=["GET"])
@login_required
def get_analytics():
    selected_range = request.args.get("range", "week")
    if selected_range not in {"all", "week", "month", "year"}:
        return jsonify({"error": "Choose all, week, month, or year."}), 400

    today = datetime.now(PH_TIMEZONE).date()
    user_id = session["user_id"]
    conn = get_db()

    totals = conn.execute("""
        SELECT completion_date, COUNT(*) AS completed_count
        FROM habit_completions
        WHERE user_id = ?
        GROUP BY completion_date
        ORDER BY completion_date
    """, (user_id,)).fetchall()

    if selected_range == "week":
        start = today - timedelta(days=6)
        rows = conn.execute("""
            SELECT completion_date, COUNT(*) AS completed_count
            FROM habit_completions
            WHERE user_id = ? AND completion_date >= ? AND completion_date <= ?
            GROUP BY completion_date
        """, (user_id, start.isoformat(), today.isoformat())).fetchall()
        values_by_date = {
            row["completion_date"]: row["completed_count"] for row in rows
        }
        series = [
            {
                "label": (start + timedelta(days=offset)).strftime("%a"),
                "value": values_by_date.get(
                    (start + timedelta(days=offset)).isoformat(), 0
                )
            }
            for offset in range(7)
        ]
    elif selected_range == "month":
        start = today.replace(day=1)
        values_by_date = {
            row["completion_date"]: row["completed_count"]
            for row in conn.execute("""
                SELECT completion_date, COUNT(*) AS completed_count
                FROM habit_completions
                WHERE user_id = ? AND completion_date >= ? AND completion_date <= ?
                GROUP BY completion_date
            """, (user_id, start.isoformat(), today.isoformat())).fetchall()
        }
        series = [
            {
                "label": str(day),
                "value": values_by_date.get(
                    date(today.year, today.month, day).isoformat(), 0
                )
            }
            for day in range(1, today.day + 1)
        ]
    elif selected_range == "year":
        start = today.replace(month=1, day=1)
        values_by_month = {
            row["completion_date"][:7]: row["completed_count"]
            for row in conn.execute("""
                SELECT substr(completion_date, 1, 7) AS completion_date,
                       COUNT(*) AS completed_count
                FROM habit_completions
                WHERE user_id = ? AND completion_date >= ? AND completion_date <= ?
                GROUP BY substr(completion_date, 1, 7)
            """, (user_id, start.isoformat(), today.isoformat())).fetchall()
        }
        series = [
            {
                "label": date(today.year, month, 1).strftime("%b"),
                "value": values_by_month.get(
                    f"{today.year}-{month:02d}", 0
                )
            }
            for month in range(1, today.month + 1)
        ]
    else:
        month_counts = {}
        for row in totals:
            month_key = row["completion_date"][:7]
            month_counts[month_key] = (
                month_counts.get(month_key, 0) + row["completed_count"]
            )

        if month_counts:
            first_month = date.fromisoformat(
                f"{min(month_counts)}-01"
            )
        else:
            first_month = today.replace(day=1)

        series = []
        current_month = first_month
        while current_month <= today.replace(day=1):
            month_key = current_month.strftime("%Y-%m")
            series.append({
                "label": current_month.strftime("%b %y"),
                "value": month_counts.get(month_key, 0)
            })
            if current_month.month == 12:
                current_month = current_month.replace(
                    year=current_month.year + 1, month=1
                )
            else:
                current_month = current_month.replace(
                    month=current_month.month + 1
                )

    conn.close()

    completed_dates = {
        date.fromisoformat(row["completion_date"])
        for row in totals
    }
    total_completed = sum(row["completed_count"] for row in totals)

    streak_end = today
    if streak_end not in completed_dates:
        streak_end -= timedelta(days=1)
    current_streak = 0
    while streak_end in completed_dates:
        current_streak += 1
        streak_end -= timedelta(days=1)

    longest_streak = 0
    streak = 0
    previous_date = None
    for completed_date in sorted(completed_dates):
        if previous_date and completed_date == previous_date + timedelta(days=1):
            streak += 1
        else:
            streak = 1
        longest_streak = max(longest_streak, streak)
        previous_date = completed_date

    return jsonify({
        "range": selected_range,
        "series": series,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_completed": total_completed
    })


@app.route("/api/weekly-goal", methods=["GET", "PUT"])
@login_required
def weekly_goal():
    user_id = session["user_id"]
    conn = get_db()

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        goal = data.get("weekly_goal")
        if isinstance(goal, bool) or not isinstance(goal, int) or not 1 <= goal <= 200:
            conn.close()
            return jsonify({
                "error": "Weekly goal must be a whole number between 1 and 200."
            }), 400

        conn.execute("""
            INSERT INTO user_settings (user_id, weekly_goal)
            VALUES (?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET weekly_goal = excluded.weekly_goal
        """, (user_id, goal))
        conn.commit()
    else:
        row = conn.execute(
            "SELECT weekly_goal FROM user_settings WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        goal = row["weekly_goal"] if row else 20

    conn.close()
    return jsonify({"weekly_goal": goal})


init_db()

if __name__ == "__main__":
    app.run(debug=True)
