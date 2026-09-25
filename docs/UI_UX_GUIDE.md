# UI/UX Design Guide — ENYX-Smart Hub

Dokumen ini menjelaskan desain antarmuka dan pengalaman penggunaan untuk setiap role di ENYX-Smart Hub.

---

## Design Principles

1. **Minimalis** — Tanpa shadow, tanpa dekorasi berlebih
2. **Konsisten** — Pola layout dan komponen sama di semua role
3. **Fungsional** — Setiap tombol/aksi memiliki tujuan yang jelas
4. **Responsif** — Mobile-first, berfungsi di tablet dan desktop
5. **Aksesibel** — Kontras warna tinggi, font readable

---

## Color Palette

| Warna | Hex | Penggunaan |
|-------|-----|------------|
| Primary | `#166534` | Header, tombol utama, link aktif |
| Primary Light | `#22c55e` | Hover state, accent |
| Primary Dark | `#14532d` | Active state, dropdown |
| White | `#ffffff` | Background card, text di primary |
| Gray 50 | `#f9fafb` | Background page |
| Gray 100 | `#f3f4f6` | Border, divider |
| Gray 500 | `#6b7280` | Secondary text |
| Gray 900 | `#111827` | Heading, primary text |

---

## Typography

- **Font**: Poppins
- **Weights**: 300, 400, 500, 600, 700
- **Base size**: 16px
- **Line height**: 1.5

---

## Layout Structure

### Desktop (>= 768px)
```
┌─────────────────────────────────────────┐
│  Navbar (fixed, 64px height)            │
│  Logo (left) | Menu (center) | Profile (right) │
├─────────────────────────────────────────┤
│                                         │
│  Main Content (max-w-7xl, centered)     │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌─────────────────────┐
│  Navbar (fixed)     │
│  Logo | Hamburger   │
├─────────────────────┤
│                     │
│  Main Content       │
│  (full width, px-4) │
│                     │
└─────────────────────┘
```

---

## Component Library

### Card
```tsx
<Card>
  <h3>Title</h3>
  <p>Content</p>
</Card>
```
- Border: `border border-primary/10`
- Radius: `rounded-lg`
- Background: `bg-white`
- Padding: `p-6`

### Button Primary
```tsx
<button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
  Action
</button>
```

### Input
```tsx
<input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary" />
```

### Table
- Header: `bg-gray-50`
- Row hover: `hover:bg-gray-50`
- Padding: `px-4 py-3`
- Font size: `text-sm`

---

## Role-Specific UI/UX

---

## 👨‍🌾 Farmer Dashboard

### Filosofi
Mobile banking-style dashboard. Focus pada **delivery history** dan **traceability**. Tanpa form input yang rumit.

### Home Screen
```
┌─────────────────────────────┐
│  [Logo]               [Menu] │
├─────────────────────────────┤
│  Welcome back,              │
│  Ahmad Santoso              │
│  ┌────────┬────────┬──────┐ │
│  │ 🚛     │ 📅     │ ⏳    │ │
│  │ 24     │ 8      │ 2    │ │
│  │Total   │This    │Pend. │ │
│  │Deliveries│Month│      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Quick Actions               │
│  ┌────────┬────────┬──────┐ │
│  │ 🚛     │ 🔍     │ 📋   │ │
│  │My      │Trace   │Hist. │ │
│  │Deliveries│      │      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Recent Activity             │
│  ┌─────────────────────────┐│
│  │ 🚛 Delivery 14 Sep 2026││
│  │    156 kg to Jakarta   ││
│  │    ✅ Completed        ││
│  ├─────────────────────────┤│
│  │ 📦 Pickup 13 Sep 2026  ││
│  │    200 kg to Bandung   ││
│  │    🚚 In Transit       ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### My Deliveries Screen
- List view dengan card per delivery
- Setiap card menampilkan: tanggal, tujuan, jumlah kg, status
- Tap card untuk detail

### Traceability Screen
- Search bar dengan icon scanner
- Input kode QR/barcode
- Hasil trace ditampilkan dalam card:
  - Farmer name
  - Commodity
  - Grade
  - Weight
  - Harvest date
  - Journey timeline

### Interaction Pattern
- **Tap** → Navigate ke detail
- **Swipe** → Tidak digunakan (konsisten dengan mobile banking)
- **Long press** → Tidak digunakan

---

## ⚖️ Weighing Operator Dashboard

### Filosofi
Fast input untuk penimbangan. Focus pada **quick data entry** dan **real-time feedback**.

### Home Screen
```
┌─────────────────────────────┐
│  [Logo]               [Menu] │
├─────────────────────────────┤
│  Welcome back,              │
│  Weighing Operator          │
│  ┌────────┬────────┬──────┐ │
│  │ ⚖️     │ 📦     │ ⏳    │ │
│  │ 156    │ 24     │ 5    │ │
│  │Today's │Active  │Pend. │ │
│  │Weighing│Pallets │      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Quick Actions               │
│  ┌────────┬────────┬──────┐ │
│  │ ⚖️     │ 📦     │ 📋   │ │
│  │New     │Pallets │Hist. │ │
│  │Weighing│        │      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Recent Weighings            │
│  ┌─────────────────────────┐│
│  │ ⚖️ 45.5 kg Grade A     ││
│  │    10:15 | ✅ Completed ││
│  ├─────────────────────────┤│
│  │ ⚖️ 30.0 kg Grade B     ││
│  │    09:45 | ✅ Completed ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### Weighing Screen
- Form horizontal di atas (pallet ID, grade, weight)
- Tombol **Record** besar di kanan
- Setelah submit, data langsung masuk tabel di bawah
- Tabel menampilkan: Time, Pallet ID, Grade, Weight

### Pallets Screen
- Form: Farmer ID, Commodity, Location
- Tombol **Create Pallet**
- Tabel: Code, Farmer, Commodity, Status badge

### Interaction Pattern
- **Quick form submit** — Enter key atau tap tombol
- **Auto-focus** ke input berikutnya setelah submit
- **Real-time feedback** — record langsung muncul di tabel

---

## 📊 Sorting Operator Dashboard

### Filosofi
Grading dan labeling yang cepat. Focus pada **grade selection** dan **label tracking**.

### Home Screen
```
┌─────────────────────────────┐
│  [Logo]               [Menu] │
├─────────────────────────────┤
│  Welcome back,              │
│  Sorting Operator           │
│  ┌────────┬────────┬──────┐ │
│  │ 📊     │ 📦     │ 🏷️   │ │
│  │ 12     │ 156    │ 142  │ │
│  │Pending │Pouches │Labels│ │
│  │Grading │Created │Print │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Quick Actions               │
│  ┌────────┬────────┬──────┐ │
│  │ 📊     │ 🏷️     │ 📋   │ │
│  │Grading │Labels  │Hist. │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Recent Activity             │
│  ┌─────────────────────────┐│
│  │ 📊 Grade A: 45.5 kg    ││
│  │    10:15 | ✅ Completed ││
│  ├─────────────────────────┤│
│  │ 📦 Pouch ...001 created ││
│  │    09:45 | ✅ Completed ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### Grading Screen
- Form: Pallet ID, Grade (dropdown), Weight
- Table shows grading history

### Labels Screen
- Form: Pouch/Packaging ID, Label Type (dropdown)
- Table shows generated labels with status badges

### Interaction Pattern
- **Grade dropdown** dengan opsi A/B/C
- **Status badge** — Pending/Printed
- **Tap label row** untuk regenerate/preview

---

## 🏭 Warehouse Operator Dashboard

### Filosofi
Stock management yang jelas. Focus pada **stock movement tracking** dan **capacity monitoring**.

### Home Screen
```
┌─────────────────────────────┐
│  [Logo]               [Menu] │
├─────────────────────────────┤
│  Welcome back,              │
│  Warehouse Operator         │
│  ┌────────┬────────┬──────┐ │
│  │ 📦     │ 🏭     │ ⏳    │ │
│  │2,340   │ 78%    │ 3    │ │
│  │Total   │Capac.  │Pend. │ │
│  │Stock   │        │      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Quick Actions               │
│  ┌────────┬────────┬──────┐ │
│  │ 📥     │ 📤     │ 📊   │ │
│  │Stock   │Stock   │Rep.  │ │
│  │In      │Out     │      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Recent Movements            │
│  ┌─────────────────────────┐│
│  │ 📥 +10 pouch Grade A    ││
│  │    09:30 | ✅ In        ││
│  ├─────────────────────────┤│
│  │ 📤 -50 kg Packaging     ││
│  │    08:45 | ✅ Out       ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### Stock In Screen
- Form: Pouch/Pallet ID, Grade, Quantity, Warehouse ID
- Table shows stock in history

### Stock Out Screen
- Form: Packaging ID, Destination, Driver, Quantity
- Table shows stock out history

### Interaction Pattern
- **Warehouse selector** — dropdown untuk pilih gudang
- **Capacity warning** — alert jika capacity > 90%
- **Movement type** — color coded (green=In, red=Out, yellow=Alert)

---

## 🚛 Delivery Operator Dashboard

### Filosofi
Delivery tracking dan packaging verification. Focus pada **shipment status** dan **verification**.

### Home Screen
```
┌─────────────────────────────┐
│  [Logo]               [Menu] │
├─────────────────────────────┤
│  Welcome back,              │
│  Delivery Operator          │
│  ┌────────┬────────┬──────┐ │
│  │ 🚛     │ 📦     │ ✅    │ │
│  │ 5      │ 8      │ 3    │ │
│  │Active  │Pending │Compl.│ │
│  │Deliv.  │Pkg     │Today │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Quick Actions               │
│  ┌────────┬────────┬──────┐ │
│  │ 📦     │ 🚛     │ ✔️   │ │
│  │Packag- │Deliver-│Verify│ │
│  │ ing    │ ies    │      │ │
│  └────────┴────────┴──────┘ │
├─────────────────────────────┤
│  Recent Activity             │
│  ┌─────────────────────────┐│
│  │ 🚛 B1234XYZ → Jakarta  ││
│  │    08:00 | 🚚 Transit   ││
│  ├─────────────────────────┤│
│  │ 📦 PKG-001 created      ││
│  │    07:30 | ✅ Packed    ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### Packaging Screen
- Form: Size (10kg/50kg), Commodity, Quantity
- Table shows packaging units with status

### Deliveries Screen
- Form: Truck Plate, Destination, Driver Name
- Table shows deliveries with status badges

### Interaction Pattern
- **Scan barcode** — quick input via scanner
- **Status flow** — Pending → Packed → In Transit → Delivered
- **Verification step** — scan ITF-14 before departure

---

## Shared UI Patterns

### Loading State
```
┌─────────────────────────────┐
│                             │
│    [Spinner]                │
│    Loading...               │
│                             │
└─────────────────────────────┘
```

### Empty State
```
┌─────────────────────────────┐
│                             │
│    [Icon]                   │
│    No data available        │
│                             │
└─────────────────────────────┘
```

### Error State
```
┌─────────────────────────────┐
│  ❌ Error                   │
│  Something went wrong       │
│  [Retry]                    │
└─────────────────────────────┘
```

### Success Toast
```
┌─────────────────────────────┐
│  ✅ Success                 │
│  Action completed           │
└─────────────────────────────┘
```

---

## Mobile Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, full width |
| Tablet | 640px - 768px | 2 columns, padding sm |
| Desktop | > 768px | 3-4 columns, padding lg |

---

## Accessibility

- All interactive elements have minimum 44x44px touch target
- Color contrast ratio >= 4.5:1 for text
- Focus indicators on all interactive elements
- Screen reader labels on icon-only buttons
- Keyboard navigation supported

---

## Implementation Notes

- All colors defined in `frontend/tailwind.config.js`
- Components in `frontend/src/components/shared/`
- Pages in `frontend/src/pages/`
- Role routing in `frontend/src/pages/DashboardHomeRouter.tsx`
