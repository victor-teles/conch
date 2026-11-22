"""Records one take of the real Conch launcher through a persistent cua-driver MCP session.

Usage: python3 capture/take.py <output-dir> <path-to-Conch-dev.app>

Drives the launcher with desktop-level input through cua-driver, records the main
display at full Retina resolution with macOS `screencapture -v` (the calling app
needs Screen Recording permission), and writes marks.json with the time of every beat (seconds
from the start of the recording) so the Remotion edit can cut on them.
"""

import json
import signal
import subprocess
import sys
import time

OUT_DIR, APP = sys.argv[1], sys.argv[2]
DESKTOP = {"kind": "desktop", "display_id": "primary"}
TYPE_DELAY_MS = 45


class Driver:
    def __init__(self):
        self.proc = subprocess.Popen(
            ["cua-driver", "mcp"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.next_id = 0
        self.request("initialize", {
            "capabilities": {},
            "clientInfo": {"name": "conch-take", "version": "1"},
            "protocolVersion": "2025-06-18",
        })
        self.notify("notifications/initialized")

    def notify(self, method):
        self.proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": method}) + "\n")

    def request(self, method, params):
        self.next_id += 1
        message = {"id": self.next_id, "jsonrpc": "2.0", "method": method, "params": params}
        self.proc.stdin.write(json.dumps(message) + "\n")
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("cua-driver mcp closed the connection")
            reply = json.loads(line)
            if reply.get("id") == self.next_id:
                if "error" in reply:
                    raise RuntimeError(f"{method}: {reply['error']}")
                return reply["result"]

    def call(self, tool, args):
        result = self.request("tools/call", {"arguments": args, "name": tool})
        if result.get("isError"):
            raise RuntimeError(f"{tool}: {json.dumps(result)[:400]}")
        return result


driver = Driver()
marks = {}
started = 0.0


def mark(name):
    marks[name] = round(time.monotonic() - started, 2)
    print(f"{marks[name]:7.2f}s {name}", flush=True)


def conch_pid():
    found = subprocess.run(
        ["pgrep", "-f", "Conch-dev.app/Contents/MacOS/bun"],
        capture_output=True,
        text=True,
    ).stdout.split()
    if not found:
        raise RuntimeError("Conch-dev is not running")
    return int(found[0])


PID = conch_pid()


def launcher_visible():
    result = driver.call("list_windows", {"pid": PID})
    windows = result.get("structuredContent", {}).get("windows", [])
    return any(window.get("is_on_screen") for window in windows)


def require_launcher():
    if not launcher_visible():
        raise RuntimeError("launcher is not on screen; refusing to send keys elsewhere")


def summon():
    subprocess.run(["open", APP], check=True)
    deadline = time.monotonic() + 5
    while not launcher_visible():
        if time.monotonic() > deadline:
            raise RuntimeError("launcher did not appear")
        time.sleep(0.1)
    time.sleep(0.5)


def type_text(text):
    require_launcher()
    driver.call("type_text", {"delay_ms": TYPE_DELAY_MS, "target": DESKTOP, "text": text})


def key(name):
    require_launcher()
    driver.call("press_key", {"key": name, "target": DESKTOP})


def hotkey(*keys):
    require_launcher()
    driver.call("hotkey", {"keys": list(keys), "target": DESKTOP})


def ask(beat, prompt, wait, submit=("return",)):
    mark(f"{beat}:type")
    type_text(prompt)
    time.sleep(0.5)
    mark(f"{beat}:submit")
    if len(submit) == 1:
        key(submit[0])
    else:
        hotkey(*submit)
    time.sleep(wait)


def use_connection(needle, from_answer=True):
    if from_answer:
        key("escape")
        time.sleep(0.6)
        key("escape")
        time.sleep(0.6)
    type_text(f"@{needle}")
    time.sleep(0.4)
    key("return")
    time.sleep(0.9)


PARK_CURSOR = 'ObjC.import("CoreGraphics"); $.CGWarpMouseCursorPosition({x: 1500, y: 120});'
subprocess.run(["osascript", "-l", "JavaScript", "-e", PARK_CURSOR], check=True)
driver.call("set_agent_cursor_enabled", {"enabled": False})
driver.call("move_cursor", {"x": 1500, "y": 8})
summon()
use_connection("prod", from_answer=False)
key("escape")
time.sleep(1.2)
if launcher_visible():
    raise RuntimeError("launcher should be hidden before recording")

recorder = subprocess.Popen(["screencapture", "-v", "-x", f"{OUT_DIR}/recording.mov"])
time.sleep(1.0)
started = time.monotonic()
mark("start")
time.sleep(1.5)

mark("summon")
summon()

ask("revenue", "monthly revenue by region this year", 8)
ask("refine", "by quarter, stacked", 8)
ask("customers", "how many active customers do we have", 7, submit=("cmd", "return"))

use_connection("orders")
ask("orders", "orders by status this week as a pie", 8)

use_connection("prod")
ask("delete", "delete customers who haven't logged in for a year", 8)

mark("dismiss")
key("escape")
time.sleep(0.6)
key("escape")
time.sleep(0.6)
if launcher_visible():
    key("escape")
time.sleep(1.2)
mark("end")

recorder.send_signal(signal.SIGINT)
recorder.wait(timeout=30)
with open(f"{OUT_DIR}/marks.json", "w") as handle:
    json.dump(marks, handle, indent=2)
print(f"recorded {OUT_DIR}/recording.mov")
