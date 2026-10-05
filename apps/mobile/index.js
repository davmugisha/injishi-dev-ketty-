// The app's entry (ADR-063). Crash reporting starts first, so its handlers
// exist before Expo Router loads any route module; then Expo Router's own
// entry, which this file replaces as `main` in package.json. Keep the order.
import './src/lib/crash-boot';
import 'expo-router/entry';
