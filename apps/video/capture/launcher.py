"""Shared helpers for recording takes of the real Conch launcher.

Drives the launcher with desktop-level input through a persistent cua-driver MCP
session, records the main display at full Retina resolution with macOS
`screencapture -v` (the calling app needs Screen Recording permission), and keeps
the time of every beat (seconds from the start of the recording) so the Remotion
edit can cut on them. Keys are only sent while the launcher is on screen.
"""

import json
import re
import signal
import subprocess
import time

DESKTOP = {"kind": "desktop", "display_id": "primary"}
TYPE_DELAY_MS = 45
SUMMON_KEYS = ["option", "shift", "space"]
PARK_CURSOR = 'ObjC.import("CoreGraphics"); $.CGWarpMouseCursorPosition({x: 1500, y: 120});'


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


def conch_pid():
    found = subprocess.run(
        ["pgrep", "-f", "Conch-dev.app/Contents/MacOS/bun"],
        capture_output=True,
        text=True,
    ).stdout.split()
    if not found:
        raise RuntimeError("Conch-dev is not running")
    return int(found[0])


class Launcher:
    def __init__(self, app):
        self.app = app
        self.driver = Driver()
        self.pid = conch_pid()
        self.marks = {}
        self.started = time.monotonic()
        self.recorder = None

    def mark(self, name):
        self.marks[name] = round(time.monotonic() - self.started, 2)
        print(f"{self.marks[name]:7.2f}s {name}", flush=True)

    def visible(self):
        result = self.driver.call("list_windows", {"pid": self.pid})
        windows = result.get("structuredContent", {}).get("windows", [])
        return any(window.get("is_on_screen") for window in windows)

    def window_id(self):
        result = self.driver.call("list_windows", {"pid": self.pid})
        windows = result.get("structuredContent", {}).get("windows", [])
        return next(window["window_id"] for window in windows if window.get("is_on_screen"))

    def screen_text(self):
        result = self.driver.call("get_window_state", {
            "include_screenshot": False,
            "max_elements": 2000,
            "pid": self.pid,
            "timeout_ms": 5000,
            "tree_format": "elements",
            "window_id": self.window_id(),
        })
        content = result.get("structuredContent", {})
        items = content.get("elements", []) + content.get("observations", [])
        return "\n".join(item.get("label") or item.get("value") or "" for item in items)

    # Answers come from a model and change between takes, so each beat waits
    # for the state it needs and stops the take when it never shows up.
    def wait_for_any(self, patterns, timeout):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            text = self.screen_text()
            for index, pattern in enumerate(patterns):
                if re.search(pattern, text):
                    return index
            time.sleep(0.5)
        raise RuntimeError(f"never saw any of {patterns} on the launcher")

    def wait_for(self, pattern, timeout):
        self.wait_for_any([pattern], timeout)

    def require_visible(self):
        if not self.visible():
            raise RuntimeError("launcher is not on screen; refusing to send keys elsewhere")

    def wait_visible(self, seconds):
        deadline = time.monotonic() + seconds
        while not self.visible():
            if time.monotonic() > deadline:
                return False
            time.sleep(0.1)
        return True

    # The global hotkey is the real summon; `open` is the fallback when
    # Accessibility trust is missing and the shortcut never fires.
    def summon(self):
        self.driver.call("hotkey", {"keys": SUMMON_KEYS, "target": DESKTOP})
        if not self.wait_visible(2):
            subprocess.run(["open", self.app], check=True)
            if not self.wait_visible(5):
                raise RuntimeError("launcher did not appear")
        time.sleep(0.5)

    def type(self, text):
        self.require_visible()
        self.driver.call("type_text", {"delay_ms": TYPE_DELAY_MS, "target": DESKTOP, "text": text})

    def key(self, name):
        self.require_visible()
        self.driver.call("press_key", {"key": name, "target": DESKTOP})

    def hotkey(self, *keys):
        self.require_visible()
        self.driver.call("hotkey", {"keys": list(keys), "target": DESKTOP})

    def press(self, keys):
        if len(keys) == 1:
            self.key(keys[0])
        else:
            self.hotkey(*keys)

    def ask(self, beat, prompt, wait, submit=("return",)):
        self.mark(f"{beat}:type")
        self.type(prompt)
        time.sleep(0.5)
        self.mark(f"{beat}:submit")
        self.press(submit)
        time.sleep(wait)

    def use_connection(self, needle, from_answer=True):
        if from_answer:
            self.key("escape")
            time.sleep(0.6)
            self.key("escape")
            time.sleep(0.6)
        self.type(f"@{needle}")
        time.sleep(0.4)
        self.key("return")
        time.sleep(0.9)

    def dismiss(self):
        for _ in range(3):
            if not self.visible():
                return
            self.key("escape")
            time.sleep(0.6)

    def prepare(self, connection):
        subprocess.run(["osascript", "-l", "JavaScript", "-e", PARK_CURSOR], check=True)
        self.driver.call("set_agent_cursor_enabled", {"enabled": False})
        self.driver.call("move_cursor", {"x": 1500, "y": 8})
        self.summon()
        self.use_connection(connection, from_answer=False)
        self.dismiss()
        time.sleep(1.2)
        if self.visible():
            raise RuntimeError("launcher should be hidden before recording")

    def start_recording(self, out_dir):
        self.out_dir = out_dir
        self.recorder = subprocess.Popen(["screencapture", "-v", "-x", f"{out_dir}/recording.mov"])
        time.sleep(1.0)
        self.started = time.monotonic()
        self.mark("start")
        time.sleep(1.5)

    def stop_recording(self):
        time.sleep(1.2)
        self.mark("end")
        self.finish()

    def finish(self):
        if self.recorder is None:
            return
        self.recorder.send_signal(signal.SIGINT)
        self.recorder.wait(timeout=30)
        with open(f"{self.out_dir}/marks.json", "w") as handle:
            json.dump(self.marks, handle, indent=2)
        print(f"recorded {self.out_dir}/recording.mov")
