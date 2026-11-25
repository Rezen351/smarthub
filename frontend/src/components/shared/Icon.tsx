import type { CSSProperties } from 'react'
import { LayoutDashboard, Scale, Archive, ShieldCheck, Tag, QrCode, ScanLine, Users, User, ChartColumn, Settings, LogOut, Menu, X, Check, CircleCheck, CircleAlert, Info, TriangleAlert, Search, Plus, Minus, Printer, Truck, Package, Box, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Clock, Calendar, MapPin, Leaf, Wifi, WifiOff, RefreshCw, Trash2, Pencil, Eye, ChevronRight, ChevronLeft, ChevronDown, Filter, Download, Lock, Bell, History, ArrowDownUp, Zap, Target, Layers, Inbox, Send, Phone, Map, Weight, Clipboard, Shield, Maximize, Minimize } from 'lucide-react'

export type IconName =
  | 'dashboard' | 'scale' | 'pallet' | 'grade' | 'label' | 'qr' | 'scan'
  | 'users' | 'user' | 'reports' | 'settings' | 'logout' | 'menu' | 'close'
  | 'check' | 'check-circle' | 'alert' | 'info' | 'warning' | 'search'
  | 'plus' | 'minus' | 'print' | 'truck' | 'package' | 'box' | 'arrow-right'
  | 'arrow-left' | 'arrow-up' | 'arrow-down' | 'clock' | 'calendar' | 'location'
  | 'leaf' | 'wifi' | 'wifi-off' | 'refresh' | 'trash' | 'edit' | 'eye'
  | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'filter' | 'download'
  | 'lock' | 'bell' | 'history' | 'sortir' | 'flash' | 'target' | 'stack'
  | 'inbox' | 'send' | 'phone' | 'map' | 'weight' | 'clipboard' | 'shield'
  | 'expand' | 'compress'

const icons: Record<IconName, typeof Scale> = {
  'dashboard': LayoutDashboard,
  'scale': Scale,
  'pallet': Archive,
  'grade': ShieldCheck,
  'label': Tag,
  'qr': QrCode,
  'scan': ScanLine,
  'users': Users,
  'user': User,
  'reports': ChartColumn,
  'settings': Settings,
  'logout': LogOut,
  'menu': Menu,
  'close': X,
  'check': Check,
  'check-circle': CircleCheck,
  'alert': CircleAlert,
  'info': Info,
  'warning': TriangleAlert,
  'search': Search,
  'plus': Plus,
  'minus': Minus,
  'print': Printer,
  'truck': Truck,
  'package': Package,
  'box': Box,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'clock': Clock,
  'calendar': Calendar,
  'location': MapPin,
  'leaf': Leaf,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'refresh': RefreshCw,
  'trash': Trash2,
  'edit': Pencil,
  'eye': Eye,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  'filter': Filter,
  'download': Download,
  'lock': Lock,
  'bell': Bell,
  'history': History,
  'sortir': ArrowDownUp,
  'flash': Zap,
  'target': Target,
  'stack': Layers,
  'inbox': Inbox,
  'send': Send,
  'phone': Phone,
  'map': Map,
  'weight': Weight,
  'clipboard': Clipboard,
  'shield': Shield,
  'expand': Maximize,
  'compress': Minimize,
}

interface IconProps {
  name: IconName | string
  size?: number
  className?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 18, className, style }: IconProps) {
  const Component = icons[name as IconName]
  return Component ? <Component size={size} className={className} style={style} aria-hidden="true" focusable="false" /> : null
}
