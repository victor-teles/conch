import type { BoundValue } from "@/lib/ipc";

const shown = (value: BoundValue["value"]) =>
  value === null ? (
    <span className="text-panel-muted italic">NULL</span>
  ) : (
    String(value)
  );

// Every value that will be sent, untruncated, with where it came from.
export function BoundValues({ bound }: { bound: readonly BoundValue[] }) {
  if (bound.length === 0) {
    return null;
  }
  return (
    <table aria-label="Bound values" className="w-full type-meta">
      <thead className="sr-only">
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Value</th>
          <th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        {bound.map((item) => (
          <tr
            className="border-t border-panel-border align-top"
            key={item.name}
          >
            <th
              className="w-0 py-1.5 pr-3 text-left font-mono font-normal whitespace-nowrap text-panel-muted"
              scope="row"
            >
              {item.name}
            </th>
            <td className="py-1.5 pr-3 font-mono break-all whitespace-pre-wrap text-foreground">
              {shown(item.value)}
            </td>
            <td className="w-0 py-1.5 text-right whitespace-nowrap text-panel-muted">
              {item.detail}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
