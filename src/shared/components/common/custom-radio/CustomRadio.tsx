import type { ChangeEventHandler } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './CustomRadio.module.scss';

interface CustomRadioProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  label: string;
  disabled?: boolean;
}

const CustomRadio = ({
  name,
  value,
  checked,
  onChange,
  label,
  disabled = false,
}: CustomRadioProps) => {
  return (
    <label className={cx(styles.root, disabled && styles['root--disabled'])}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.input}
      />
      <span className={styles.label}>{label}</span>
    </label>
  );
};

export default CustomRadio;
