# Driver Work Log System

A complete driver work time tracking system with admin dashboard, built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

### Driver Interface (No Login Required)
- Simple numeric code entry (no login)
- Car number input
- 24-hour time picker for start and end times
- Overnight shift support
- Automatic duration and overtime calculation
- One submission per driver per day
- German language interface

### Admin Dashboard (Password Protected)
- **Drivers Management**
  - Add new drivers with numeric codes
  - Activate/deactivate drivers
  - Delete drivers (if no logs exist)

- **Logs Management**
  - View all work submissions
  - Filter by date range, driver code, or car number
  - Delete individual or bulk logs

- **Reports**
  - Quick summaries: Today, 7 Days, 30 Days, Month-to-Date
  - Monthly reports with day-by-day breakdown
  - CSV export for monthly reports
  - All times displayed in HH:MM format

### Business Logic
- Standard workday: 9 hours (540 minutes)
- Overtime calculated automatically: `max(0, duration - 540)`
- Overnight shifts supported: If end time < start time, assumes next day
- Timezone: Europe/Vienna

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Icons**: Lucide React

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_ADMIN_PASSWORD=your_admin_password_here
```

**Note:** The service role key is configured in Supabase Edge Functions and should NEVER be in frontend .env.

## Setup Instructions

### 1. Database Setup

The database schema is automatically created via Supabase migrations. Tables:

- `drivers` (code, name, active)
- `work_logs` (driver_code, work_date, car_number, times, duration, overtime)

See `SETUP.md` for detailed instructions.

### 2. Edge Functions

Four Edge Functions are deployed:
- `driver-submit` - Handle driver work log submissions
- `admin-drivers` - CRUD operations for drivers
- `admin-logs` - Query and delete logs
- `admin-reports` - Generate reports

These are deployed automatically to your Supabase project.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

## Usage

### For Drivers

1. Go to the home page
2. Enter your numeric code (e.g., 1, 2, 3)
3. Enter car number
4. Select start time (24-hour format)
5. Select end time (24-hour format)
6. Click "Arbeitszeit speichern"

### For Admins

1. Go to `/admin`
2. Login with your admin password
3. Manage drivers, view logs, generate reports

## Testing

1. Add a test driver via admin panel (Code: 1, Name: "Mohamed")
2. Submit a work log from driver interface
3. View the log in admin dashboard
4. Try submitting again with same code (should be blocked)
5. Generate reports to verify calculations

See `TEST_DATA.sql` for SQL commands to add test data directly.

## Documentation

- `IMPLEMENTATION_COMPLETE.md` - Complete technical documentation
- `SETUP.md` - Detailed setup guide
- `DEPLOYMENT.md` - Deployment instructions
- `FEATURES.md` - Feature list
- `TEST_DATA.sql` - SQL test data

## Security

- Row Level Security (RLS) enabled on all tables
- No RLS policies (all access via Edge Functions)
- Frontend only has anon key (safe)
- Edge Functions use service role key
- Admin endpoints require password authentication

## Health Check

Click the health check widget in the bottom-right corner to verify:
- Database connection
- Supabase project URL
- API key verification
- Table accessibility

## Language & Formatting

- **Language**: German (Deutsch)
- **Time Format**: 24-hour
- **Duration Display**: HH:MM (not decimal hours)
- **Date Format**: YYYY-MM-DD

## License

MIT

## Support

For issues or questions, check the browser console (F12) for detailed logs and error messages.
