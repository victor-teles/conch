"""Records the ShowcaseReal take: five asks across Postgres and MongoDB.

Usage: python3 capture/take.py <output-dir> <path-to-Conch-dev.app>

See launcher.py for how the launcher is driven and recorded.
"""

import sys
import time

from launcher import Launcher

OUT_DIR, APP = sys.argv[1], sys.argv[2]

take = Launcher(APP)
take.prepare("prod")
take.start_recording(OUT_DIR)

take.mark("summon")
take.summon()

take.ask("revenue", "monthly revenue by region this year", 8)
take.ask("refine", "by quarter, stacked", 8)
take.ask("customers", "how many active customers do we have", 7, submit=("cmd", "return"))

take.use_connection("orders")
take.ask("orders", "orders by status this week as a pie", 8)

take.use_connection("prod")
take.ask("delete", "delete customers who haven't logged in for a year", 8)

take.mark("dismiss")
take.key("escape")
time.sleep(0.6)
take.dismiss()
take.stop_recording()
