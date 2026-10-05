import { Component } from "react";

export default class SectionBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(`${this.props.name || "Section"} failed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="status"
          className="rounded-2xl border border-green-100 bg-white p-5 text-sm text-taazly-secondary"
        >
          This section is temporarily unavailable.
        </div>
      );
    }

    return this.props.children;
  }
}