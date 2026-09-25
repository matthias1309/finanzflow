import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
}

// React error boundaries must be class components — there is no hook equivalent.
export default class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Chart-Rendering fehlgeschlagen:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3"
          data-testid="sankey-chart-error"
        >
          <svg viewBox="0 0 48 48" width="40" height="40" fill="none" className="opacity-30">
            <path d="M8 16h10v16H8zm14-6h8v28h-8zm12 10h8v16h-8z" fill="currentColor" />
          </svg>
          <p className="text-sm">Diagramm kann für diese Buchungen nicht dargestellt werden.</p>
          <p className="text-xs opacity-70">
            Prüfe gegenläufige Umbuchungen zwischen mehreren Konten im selben Monat.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
