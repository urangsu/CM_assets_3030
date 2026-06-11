import React, { Component, ReactNode, ErrorInfo } from 'react';

type Props = {
  children: ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || '알 수 없는 화면 오류',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Screen ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h2 className="text-base font-bold">
            {this.props.title ? `[${this.props.title}] ` : ''}화면을 표시하는 중 오류가 발생했습니다.
          </h2>
          <p className="mt-2 text-sm">
            {this.state.message}
          </p>
          <button
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white cursor-pointer hover:bg-rose-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
