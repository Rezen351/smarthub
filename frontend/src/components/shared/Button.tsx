import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

const variantMap: Record<Variant, 'default' | 'accent' | 'outline' | 'ghost' | 'destructive' | 'dangerSoft'> = {
  primary: 'default',
  accent: 'accent',
  outline: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
  'danger-soft': 'dangerSoft',
}

const sizeMap: Record<Size, 'sm' | 'default' | 'lg'> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
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
  return (
    <button
      type={type}
      ref={ref}
      className={cn(
        buttonVariants({
          variant: variantMap[variant],
          size: sizeMap[size],
        }),
        block && 'w-full',
        touch && 'min-h-[44px]',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent shrink-0"
          aria-hidden="true"
        />
      )}
      {!loading && icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 15 : 16} />}
    </button>
  )
}
export { buttonVariants }
