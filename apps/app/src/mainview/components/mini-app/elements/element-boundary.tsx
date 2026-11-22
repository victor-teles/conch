import type { ReactNode } from "react";

import { Component } from "react";

import { Reveal } from "@/components/motion/reveal";

interface ElementBoundaryProps {
  elementKey: string;
  children: ReactNode;
}

interface ElementBoundaryState {
  failed: boolean;
}

export function ElementProblem({ elementKey }: { elementKey: string }) {
  return (
    <Reveal className="rounded-[12px] border border-dashed border-panel-border px-4 py-3">
      <p className="type-body text-foreground" role="alert">
        This part couldn’t be shown.
      </p>
      <p className="font-mono type-micro text-panel-muted">{elementKey}</p>
    </Reveal>
  );
}

// One part of a panel failing to draw leaves the rest of the app working.
export class ElementBoundary extends Component<
  ElementBoundaryProps,
  ElementBoundaryState
> {
  constructor(props: ElementBoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): ElementBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error(`[app] ${this.props.elementKey} failed to draw`, error);
  }

  override render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return <ElementProblem elementKey={this.props.elementKey} />;
  }
}
