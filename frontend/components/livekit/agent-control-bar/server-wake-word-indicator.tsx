'use client';

import * as React from 'react';
import { Ear, EarSlash } from '@phosphor-icons/react/dist/ssr';
import { useWakeWordState } from '@/hooks/useWakeWordState';
import { cn } from '@/lib/utils';

/**
 * Indicator for server-side wake word detection state.
 * Shows an ear icon with color indicating current state:
 * - Blue: Sleeping (waiting for wake word)
 * - Green: Listening (active conversation)
 * - Grey with slash: Disabled/unknown
 *
 * This replaces the client-side Picovoice toggle - server controls the state.
 */
export function ServerWakeWordIndicator({ className }: { className?: string }) {
  const state = useWakeWordState();

  // Determine icon and color based on state
  const isDisabled = state === null;
  const isSleeping = state === 'listening';
  const isActive = state === 'active';

  const IconComponent = isDisabled ? EarSlash : Ear;

  const title = isDisabled
    ? 'Wake word detection disabled'
    : isSleeping
      ? 'Waiting for wake word - say "Hey Jarvis"'
      : 'Listening - speak now';

  return (
    <div
      className={cn(
        // Match Toggle component styling (size="icon", variant="secondary")
        'inline-flex size-9 items-center justify-center rounded-full',
        'text-sm font-medium',
        'cursor-default transition-[color,box-shadow,background-color] outline-none',
        // Background based on state
        isActive
          ? 'bg-green-500/20 text-green-700 dark:text-green-300'
          : isSleeping
            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
            : 'bg-muted text-muted-foreground',
        className
      )}
      title={title}
    >
      <IconComponent weight="bold" className="size-4 shrink-0" />
    </div>
  );
}
