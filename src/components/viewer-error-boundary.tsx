import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  /** Changing resetKey clears the error state — typically the selected file's id */
  resetKey?: string | number | null
  children: ReactNode
}

type State = {
  error: Error | null
}

export class ViewerErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Viewer crashed:", error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <div>
            <p className="text-sm font-medium">Failed to display this file</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.state.error.message || "Unexpected error occurred"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
