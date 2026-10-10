import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import Icon, { type IconName } from './Icon'

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'danger-soft'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
  block?: boolean
  touch?: boolean
  ref?: Ref<HTMLButtonElement>
  children?: ReactNode
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-soft': 'btn-danger-soft',
}

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
}

export default function Button({
  variant = 'outline',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  block = false,
  touch = false,
  ref,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variantClass[variant],
    sizeClass[size],
    block ? 'btn-block' : '',
    touch ? 'btn-touch' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {!loading && icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 15 : 16} />}
    </button>
  )
}
