"""Records the tour take: every chart kind, three engines, save and reuse.

Usage: python3 capture/take_tour.py <output-dir> <path-to-Conch-dev.app>

Beats: revenue by region on Postgres, switched between bar, table and line
with ⌘1-3; refined into stacked quarters; a new question answered with one
number; a donut from MongoDB; a leaderboard from Redis; an answer saved as a
widget with a Plan input and run again on another plan without the AI; and a
plain-words "delete" that comes back as a read-only list. See launcher.py for
how the launcher is driven and recorded.
"""

import sys
import time

from launcher import Launcher

OUT_DIR, APP = sys.argv[1], sys.argv[2]

ROWS = r"\b[1-9][\d,]* rows?\b"
IDLE = r"(?s)^(?!.*\bStop\b)(?=.*(?:New question|Ask again))"
# An answer is on screen once a result has rows and the footer no longer offers Stop.
ANSWERED = r"(?s)^(?!.*\bStop\b)(?=.*\b[1-9][\d,]* rows?\b)(?=.*New question)"
REFUSED = r"Conch only runs read-only questions"
TRIES = 3
TEAM_PROMPT = "monthly revenue by region on the Team plan"


# Answers come from a model, so a beat that lands on an empty result is asked
# again as a new question; the edit cuts the retries out.
def answer(beat, prompt, submit=("return",), accept=(ANSWERED,)):
    take.ask(beat, prompt, 1.5, submit)
    for attempt in range(TRIES):
        if take.wait_for_any([*accept, IDLE], 40) < len(accept):
            take.mark(f"{beat}:answer")
            return
        take.mark(f"{beat}:retry{attempt + 1}")
        take.type(prompt)
        time.sleep(0.4)
        take.hotkey("cmd", "return")
        time.sleep(1.5)
    raise RuntimeError(f"{beat} never answered")


def save_with_inputs(prompt):
    for attempt in range(TRIES):
        take.mark("save:inputs")
        take.hotkey("cmd", "shift", "s")
        if take.wait_for_any([r"\b1 input\b", r"\b0 inputs\b|changes more than"], 30) == 0:
            return
        take.mark(f"save:retry{attempt + 1}")
        take.key("escape")
        time.sleep(0.8)
        answer("ask", prompt, submit=("cmd", "return"))
        time.sleep(1)
    raise RuntimeError("no input was found to save")


def switch_to(connection):
    take.key("escape")
    time.sleep(0.8)
    take.use_connection(connection, from_answer=False)


take = Launcher(APP)
take.prepare("prod")
take.start_recording(OUT_DIR)
try:
    take.mark("summon")
    take.summon()

    answer("revenue", "monthly revenue by region this year")
    time.sleep(2.5)
    take.mark("views")
    for view in ("1", "3", "2"):
        take.hotkey("cmd", view)
        time.sleep(1.6)

    answer("refine", "by quarter, stacked")
    time.sleep(3)

    answer("kpi", "how many active accounts do we have", submit=("cmd", "return"))
    time.sleep(2.5)

    switch_to("orders")
    answer("orders", "share of orders by status")
    time.sleep(3)

    switch_to("game")
    answer("leaderboard", "top 10 players on this week's leaderboard")
    time.sleep(3)

    switch_to("prod")
    answer("ask", TEAM_PROMPT)
    time.sleep(2)

    save_with_inputs(TEAM_PROMPT)
    time.sleep(1.5)
    take.mark("save:name")
    take.key("tab")
    time.sleep(0.3)
    take.hotkey("cmd", "a")
    take.type("Revenue by region")
    time.sleep(0.8)
    take.mark("save:confirm")
    take.hotkey("cmd", "return")
    time.sleep(1.8)

    take.mark("reuse:pills")
    take.key("tab")
    time.sleep(1.0)
    take.hotkey("cmd", "a")
    take.type("Scale")
    time.sleep(0.6)
    take.key("return")
    time.sleep(0.6)
    take.mark("reuse:run")
    take.key("return")
    take.wait_for(ROWS, 10)
    time.sleep(3)

    take.key("escape")
    time.sleep(0.8)
    answer(
        "delete",
        "delete customers who haven't logged in for a year",
        accept=(ANSWERED, REFUSED),
    )
    time.sleep(4)

    take.mark("dismiss")
    take.dismiss()
except Exception:
    take.finish()
    raise
take.stop_recording()
