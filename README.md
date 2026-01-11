# Employee Attendance App

## Folder Structure

- `/src`
  - `/components`: Reusable UI components.
  - `/screens`: Screen components. Note: Expo Router uses `/app` for file-based routing. `src/screens` can be used for logic or components imported by `/app`.
  - `/services`: API and backend services (Supabase configuration in `supabase.ts`).
  - `/types`: TypeScript type definitions.
- `/app`: Expo Router file-based routing directory.

## Dependencies

- **Supabase**: Backend (Auth, DB).
- **NativeWind**: Tailwind CSS styling.
- **Expo Location**: GPS tracking.
- **Expo Camera**: Photo proof.
- **Expo Router**: Navigation.

## Setup

1. Add Supabase keys in `src/services/supabase.ts`.
2. Run `npm run ios` or `npm run android`.
