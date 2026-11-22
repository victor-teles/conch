import type { ChangeEvent } from "react";

import { useCallback, useState } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { useSteadyHeight } from "./use-steady-height";

const NAMES = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
];

function Search() {
  const [query, setQuery] = useState("");
  const steady = useSteadyHeight(query);
  const { onInput } = steady;
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onInput(event.target.value);
      setQuery(event.target.value);
    },
    [onInput]
  );
  const handleClear = useCallback(() => setQuery(""), []);
  const rows = NAMES.filter((name) => name.includes(query));
  return (
    <div>
      <input aria-label="Search" onChange={handleChange} value={query} />
      <button onClick={handleClear} type="button">
        Clear
      </button>
      <div
        data-testid="body"
        ref={steady.bodyRef}
        style={{ minHeight: steady.minHeight }}
      >
        {rows.map((name) => (
          <div key={name} style={{ height: 40 }}>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

const heightOf = (element: Element) => (element as HTMLElement).offsetHeight;

describe("useSteadyHeight", () => {
  it("holds the body's height while results narrow", async () => {
    const screen = await render(<Search />);
    const body = screen.getByTestId("body").element();
    expect(heightOf(body)).toBe(320);

    await userEvent.type(screen.getByRole("textbox"), "golf");
    await expect.element(screen.getByText("bravo")).not.toBeInTheDocument();
    expect(heightOf(body)).toBe(320);
  });

  it("releases the floor when the query is cleared from anywhere", async () => {
    const screen = await render(<Search />);
    const body = screen.getByTestId("body").element() as HTMLElement;
    await userEvent.type(screen.getByRole("textbox"), "golf");
    expect(body.style.minHeight).toBe("320px");

    await screen.getByRole("button", { name: "Clear" }).click();
    await expect.poll(() => body.style.minHeight).toBe("0px");
  });

  it("measures again when a new query starts", async () => {
    const screen = await render(<Search />);
    const body = screen.getByTestId("body").element() as HTMLElement;
    body.style.paddingTop = "40px";
    await userEvent.type(screen.getByRole("textbox"), "golf");
    expect(body.style.minHeight).toBe("360px");

    await userEvent.clear(screen.getByRole("textbox"));
    body.style.paddingTop = "0px";
    await userEvent.type(screen.getByRole("textbox"), "o");
    expect(body.style.minHeight).toBe("320px");
  });
});
