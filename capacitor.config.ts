import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pratham.attendease',
  appName: 'AttendEase',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
