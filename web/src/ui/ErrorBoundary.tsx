import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Shown instead of the children after one of them threw; `retry` renders the children again. */
  fallback: (retry: () => void) => ReactNode;
  /** The boundary forgets the error when this value changes (for example the step of the flow). */
  resetKey?: unknown;
  children: ReactNode;
}

interface State { failed: boolean }

/**
 * Keeps one broken part from blanking the whole page: without a boundary React
 * unmounts everything when a render throws or a lazy chunk fails to load.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('render failed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
