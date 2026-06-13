'use client';

import type { ReactNode } from 'react';
import Button from '@/shared/components/common/button/Button';
import OnboardingFooter from './OnboardingFooter';
import styles from './OnboardingStubLayout.module.scss';

interface OnboardingStubLayoutProps {
  title: string;
  description?: string;
  step?: string;
  children?: ReactNode;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

// Slice 2-B 단계 placeholder. 실제 form / 사진 업로드 / 약관 텍스트는
// Slice 2-C 또는 Phase 4 / Phase 9에서 채운다.
const OnboardingStubLayout = ({
  title,
  description,
  step,
  children,
  primaryAction,
  secondaryAction,
}: OnboardingStubLayoutProps) => {
  return (
    <>
      <section className={styles.root} aria-labelledby="onboarding-title">
        {step && <p className={styles.step}>{step}</p>}
        <h1 className={styles.title} id="onboarding-title">
          {title}
        </h1>
        {description && <p className={styles.description}>{description}</p>}
        {children && <div className={styles.body}>{children}</div>}
        <div className={styles.actions}>
          {primaryAction && (
            <Button
              text={primaryAction.label}
              href={primaryAction.href}
              onClick={primaryAction.disabled ? undefined : primaryAction.onClick}
            />
          )}
          {secondaryAction && (
            <Button
              text={secondaryAction.label}
              href={secondaryAction.href}
              onClick={secondaryAction.onClick}
              type="secondary"
            />
          )}
        </div>
      </section>
      <OnboardingFooter />
    </>
  );
};

export default OnboardingStubLayout;
