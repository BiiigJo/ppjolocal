
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6 border border-zinc-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-zinc-900">Une erreur est survenue</h1>
              <p className="text-zinc-500 text-sm">
                L'application a rencontré un problème inattendu. Cela peut être dû à une saturation temporaire du stockage ou une erreur de connexion.
              </p>
            </div>
            
            <div className="pt-4 space-y-3">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full h-12 rounded-xl font-bold bg-zinc-900"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Recharger l'application
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }} 
                className="w-full text-xs text-zinc-400 hover:text-red-500"
              >
                Réinitialiser les données (Mode Démo)
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
