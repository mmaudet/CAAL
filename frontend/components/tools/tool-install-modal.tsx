'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, CircleNotch, Warning, X } from '@phosphor-icons/react/dist/ssr';
import type { InstallStep, ToolIndexEntry, ToolManifest } from '@/types/tools';

interface ToolInstallModalProps {
  tool: ToolIndexEntry;
  onClose: () => void;
  onInstallComplete: () => void;
}

export function ToolInstallModal({ tool, onClose, onInstallComplete }: ToolInstallModalProps) {
  const [step, setStep] = useState<InstallStep>('variables');
  const [manifest, setManifest] = useState<ToolManifest | null>(null);
  const [workflow, setWorkflow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const doInstall = useCallback(
    async (
      wf: Record<string, unknown>,
      vars: Record<string, string>,
      creds: Record<string, string>,
      mf: ToolManifest
    ) => {
      setStep('installing');
      setError(null);

      try {
        const res = await fetch('/api/tools/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: wf,
            variables: vars,
            credentials: creds,
            toolName: mf.name,
            voiceTrigger: mf.voice_triggers[0],
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Install failed');
        }

        setStep('complete');
        onInstallComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStep('error');
      }
    },
    [onInstallComplete]
  );

  // Fetch manifest and workflow on mount
  useEffect(() => {
    async function fetchTool() {
      try {
        const res = await fetch(`/api/tools/workflow?path=${encodeURIComponent(tool.path)}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch tool');
        }
        const data = await res.json();
        setManifest(data.manifest);
        setWorkflow(data.workflow);

        // Initialize variable values
        const initialVars: Record<string, string> = {};
        for (const v of data.manifest.required_variables || []) {
          initialVars[v.name] = '';
        }
        setVariables(initialVars);

        // Initialize credential values (empty - user enters their n8n credential name)
        const initialCreds: Record<string, string> = {};
        for (const c of data.manifest.required_credentials || []) {
          initialCreds[c.name] = '';
        }
        setCredentials(initialCreds);

        // Skip variables step if none required
        if ((data.manifest.required_variables || []).length === 0) {
          if ((data.manifest.required_credentials || []).length === 0) {
            setStep('installing');
            // Auto-install if no inputs needed
            doInstall(data.workflow, {}, {}, data.manifest);
          } else {
            setStep('credentials');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStep('error');
      } finally {
        setLoading(false);
      }
    }
    fetchTool();
  }, [tool.path, doInstall]);

  const handleVariablesSubmit = () => {
    // Validate all required variables are filled
    for (const v of manifest?.required_variables || []) {
      if (!variables[v.name]?.trim()) {
        setError(`Please fill in ${v.description}`);
        return;
      }
    }
    setError(null);

    if ((manifest?.required_credentials || []).length > 0) {
      setStep('credentials');
    } else {
      doInstall(workflow!, variables, {}, manifest!);
    }
  };

  const handleCredentialsSubmit = () => {
    // Validate all required credentials are filled
    for (const c of manifest?.required_credentials || []) {
      if (!credentials[c.name]?.trim()) {
        setError(`Please fill in credential name for ${c.name}`);
        return;
      }
    }
    setError(null);
    doInstall(workflow!, variables, credentials, manifest!);
  };

  const handleRetry = () => {
    setError(null);
    if ((manifest?.required_variables || []).length > 0) {
      setStep('variables');
    } else if ((manifest?.required_credentials || []).length > 0) {
      setStep('credentials');
    } else {
      doInstall(workflow!, variables, credentials, manifest!);
    }
  };

  // Render content based on step
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <CircleNotch className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-muted-foreground mt-4">Loading tool details...</p>
        </div>
      );
    }

    switch (step) {
      case 'variables':
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Enter the configuration values for this tool:
            </p>
            {manifest?.required_variables.map((v) => (
              <div key={v.name} className="space-y-1">
                <label className="text-sm font-medium">{v.description}</label>
                <input
                  type="text"
                  value={variables[v.name] || ''}
                  onChange={(e) => setVariables({ ...variables, [v.name]: e.target.value })}
                  placeholder={v.example}
                  className="border-input bg-background w-full rounded-lg border px-4 py-3 text-sm"
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleVariablesSubmit}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This tool requires n8n credentials. Enter the exact name of each credential as it
              appears in your n8n instance.
            </p>
            {manifest?.required_credentials.map((c) => (
              <div key={c.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.description}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      c.auth_type === 'predefined'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {c.auth_type === 'predefined' ? 'Built-in' : 'Generic'}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Type: {c.credential_type || c.type}
                </p>
                <input
                  type="text"
                  value={credentials[c.name] || ''}
                  onChange={(e) => setCredentials({ ...credentials, [c.name]: e.target.value })}
                  placeholder="Enter n8n credential name"
                  className="border-input bg-background w-full rounded-lg border px-4 py-3 text-sm"
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleCredentialsSubmit}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors"
            >
              Install
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );

      case 'installing':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <CircleNotch className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-muted-foreground mt-4">Installing tool to n8n...</p>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <Check className="h-6 w-6 text-green-500" weight="bold" />
              </div>
              <h3 className="text-lg font-semibold">Tool Installed!</h3>
              <p className="text-muted-foreground text-center text-sm">
                {manifest?.name.replace(/-/g, ' ')} is now available.
              </p>
            </div>
            {manifest?.voice_triggers && manifest.voice_triggers.length > 0 && (
              <div className="rounded-lg border p-4">
                <p className="mb-2 text-sm font-medium">Try saying:</p>
                <ul className="space-y-1">
                  {manifest.voice_triggers.slice(0, 3).map((trigger, i) => (
                    <li key={i} className="text-sm text-blue-400 italic">
                      &ldquo;{trigger}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={onClose}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 font-medium transition-colors"
            >
              Done
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <Warning className="h-6 w-6 text-red-500" weight="bold" />
              </div>
              <h3 className="text-lg font-semibold">Installation Failed</h3>
              <p className="text-muted-foreground text-center text-sm">{error}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="bg-muted text-muted-foreground hover:bg-muted/80 flex-1 rounded-lg px-4 py-3 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-lg px-4 py-3 font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="bg-background relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Install {tool.name.replace(/-/g, ' ')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>,
    document.body
  );
}
