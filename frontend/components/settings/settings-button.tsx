'use client';

import { useState } from 'react';
import { GearSix } from '@phosphor-icons/react/dist/ssr';
import { Toggle } from '@/components/livekit/toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { SettingsModal } from './settings-modal';

interface SettingsButtonProps {
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'secondary' | 'outline' | 'primary';
  onDisconnect?: () => void;
}

export function SettingsButton({ size = 'icon', variant = 'secondary', onDisconnect }: SettingsButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip content={t('controls.settings')}>
        <Toggle
          size={size}
          variant={variant}
          aria-label={t('controls.settings')}
          pressed={isOpen}
          onPressedChange={setIsOpen}
        >
          <GearSix weight="bold" />
        </Toggle>
      </Tooltip>
      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} onDisconnect={onDisconnect} />
    </>
  );
}
