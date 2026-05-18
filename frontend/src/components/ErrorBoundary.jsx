import React from 'react';

/**
 * ErrorBoundary — bắt lỗi render của React component tree.
 * Khi bất kỳ component con nào crash, hiển thị fallback UI thay vì
 * làm toàn bộ app trắng/đơ.
 *
 * Cách dùng:
 *   <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *     <MyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // TODO (trung hạn): gửi lên error tracking service (Sentry, etc.)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Nếu có custom fallback prop, dùng nó
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '40px 20px', gap: '16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '12px', margin: '16px',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h3 style={{ margin: 0, color: '#ef4444' }}>
            {this.props.title || 'Đã xảy ra lỗi'}
          </h3>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center' }}>
            {this.state.error?.message || 'Một component gặp sự cố không mong muốn.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ width: '100%', maxWidth: '600px' }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.75rem' }}>
                Chi tiết lỗi (dev only)
              </summary>
              <pre style={{
                marginTop: '8px', padding: '12px', background: '#111827',
                borderRadius: '6px', fontSize: '0.7rem', color: '#f87171',
                overflow: 'auto', maxHeight: '200px',
              }}>
                {this.state.error?.stack}
                {'\n\nComponent Stack:'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 20px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
