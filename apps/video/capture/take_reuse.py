"""Records the "ask, save, reuse" take on the Production connection.

Usage: python3 capture/take_reuse.py <output-dir> <path-to-Conch-dev.app>

Beats: ask a question with a literal (the Team plan), save it with inputs (⌘⇧S,
the AI lifts the plan into a Plan input), rename it, rerun the widget on the
Scale plan through its argument pills (no AI), search History, then a plain-words
"delete" that comes back as a read-only list. See launcher.py for how the
launcher is driven and recorded.
"""

import sys
import time

from launcher import Launcher

OUT_DIR, APP = sys.argv[1], sys.argv[2]

ROWS = r"\b[1-9][\d,]* rows"
ANSWERED = r"(?s)(?=.*\b[1-9][\d,]* rows)(?=.*New question)"

take = Launcher(APP)
take.prepare("prod")
take.start_recording(OUT_DIR)
try:
    take.mark("summon")
    take.summon()

    take.ask("ask", "monthly revenue by region on the Team plan", 2)
    take.wait_for(ANSWERED, 40)
    take.mark("ask:answer")
    time.sleep(3)

    take.mark("save:inputs")
    take.hotkey("cmd", "shift", "s")
    take.wait_for(r"\b1 input\b", 30)
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

    take.mark("history:open")
    take.key("escape")
    time.sleep(0.8)
    take.hotkey("cmd", "y")
    time.sleep(1.5)
    take.mark("history:search")
    take.type("revenue")
    time.sleep(2.5)
    take.key("escape")
    time.sleep(0.8)

    take.ask("delete", "delete customers who haven't logged in for a year", 2)
    take.wait_for(ANSWERED, 40)
    take.mark("delete:answer")
    time.sleep(4)

    take.mark("dismiss")
    take.dismiss()
except Exception:
    take.finish()
    raise
take.stop_recording()
