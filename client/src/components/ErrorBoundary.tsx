import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    handleRecover = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    background: '#0a0a12',
                    color: '#e0e0e0',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    gap: 20,
                    padding: 40,
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        background: 'rgba(255, 77, 77, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                    }}>
                        ⚠
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>
                        Something went wrong
                    </h2>
                    <p style={{
                        margin: 0,
                        color: '#888',
                        fontSize: '0.9rem',
                        maxWidth: 420,
                        lineHeight: 1.5,
                    }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.handleRecover}
                        style={{
                            padding: '10px 24px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(135deg, #7c4dff, #651fff)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'transform 0.15s',
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
